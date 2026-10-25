import express from 'express';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {createDecipheriv} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const app=express();
app.disable('x-powered-by');
app.use(express.json({limit:'5mb'}));
const dbUrl=process.env.DATABASE_URL;
const pool=dbUrl?new pg.Pool({connectionString:dbUrl,max:4,idleTimeoutMillis:12000,connectionTimeoutMillis:15000,ssl:process.env.DATABASE_SSL==='require'?{rejectUnauthorized:true}:undefined}):null;
const CORS_ORIGINS=(process.env.EXTRA_ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);

function validateState(state){
  if(!state||state.schema!==2||!Array.isArray(state.categories)||!Array.isArray(state.templates)||!state.months||typeof state.months!=='object'||Array.isArray(state.months))throw Object.assign(new Error('Struktur data tidak valid'),{status:400});
  if(state.categories.length>1000||state.templates.length>10000||Object.keys(state.months).length>500)throw Object.assign(new Error('Jumlah kategori/period melebihi batas'),{status:413});
  for(const [ym,rows] of Object.entries(state.months)){
    if(!/^20\d\d-(0[1-9]|1[0-2])$/.test(ym)||!Array.isArray(rows)||rows.length>2000)throw Object.assign(new Error('Data periode tidak valid'),{status:400});
    for(const row of rows){
      if(!row||typeof row.name!=='string'||row.name.length>350||typeof row.number!=='string'||row.number.length>100||!Number.isSafeInteger(row.amount)||row.amount<0||row.amount>1e13||typeof row.paid!=='boolean'||typeof row.printed!=='boolean')throw Object.assign(new Error('Baris tagihan tidak valid'),{status:400});
    }
  }
  return state;
}
function decodeSeed(bytes,keyHex){
  if(!/^[a-f0-9]{64}$/i.test(keyHex||''))throw new Error('INITIAL_SEED_KEY belum disetel dengan benar');
  if(bytes.subarray(0,7).toString('ascii')!=='TBSEED1')throw new Error('Seed header tidak dikenali');
  const iv=bytes.subarray(7,19),tag=bytes.subarray(19,35),ciphertext=bytes.subarray(35);
  const d=createDecipheriv('aes-256-gcm',Buffer.from(keyHex,'hex'),iv);d.setAuthTag(tag);
  const {gunzipSync}=awaitZip();
  return validateState(JSON.parse(gunzipSync(Buffer.concat([d.update(ciphertext),d.final()])).toString('utf8')));
}
function awaitZip(){return requireZlib;}
const requireZlib=await import('node:zlib');

async function prepareDatabase(){
  if(!pool){console.error('DATABASE_URL belum tersedia: hanya health endpoint yang aktif');return;}
  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    await c.query(`CREATE TABLE IF NOT EXISTS tracker_state (id smallint PRIMARY KEY CHECK(id=1), revision bigint NOT NULL DEFAULT 0, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
    await c.query(`CREATE OR REPLACE VIEW bill_history AS SELECT m.key AS period, r.value->>'id' AS bill_id, r.value->>'templateId' AS template_id, r.value->>'categoryId' AS category_id, r.value->>'categoryName' AS category, r.value->>'name' AS description, r.value->>'number' AS customer_number, (r.value->>'amount')::bigint AS amount_idr, r.value->>'platform' AS payment_platform, (r.value->>'paid')::boolean AS paid, (r.value->>'printed')::boolean AS printed, coalesce((r.value->>'hidden')::boolean,false) AS hidden, r.value->>'sourceSheet' AS original_sheet, (nullif(r.value->>'sourceRow',''))::integer AS original_row FROM tracker_state t CROSS JOIN LATERAL jsonb_each(t.data->'months') m CROSS JOIN LATERAL jsonb_array_elements(m.value) r WHERE t.id=1`);
    await c.query(`CREATE OR REPLACE VIEW bill_period_totals AS SELECT period,count(*) FILTER (WHERE NOT hidden)::integer AS item_count,coalesce(sum(amount_idr) FILTER (WHERE NOT hidden),0)::bigint AS total_idr,coalesce(sum(amount_idr) FILTER (WHERE paid AND NOT hidden),0)::bigint AS paid_idr,coalesce(sum(amount_idr) FILTER (WHERE NOT paid AND NOT hidden),0)::bigint AS due_idr FROM bill_history GROUP BY period`);
    await c.query(`CREATE OR REPLACE VIEW bill_categories AS SELECT c.value->>'id' AS category_id,c.value->>'name' AS name,(c.value->>'order')::integer AS sort_order,(c.value->>'active')::boolean AS active FROM tracker_state t CROSS JOIN LATERAL jsonb_array_elements(t.data->'categories') c WHERE t.id=1`);
    await c.query(`CREATE OR REPLACE VIEW bill_templates AS SELECT s.value->>'id' AS template_id,s.value->>'categoryId' AS category_id,s.value->>'name' AS name,s.value->>'number' AS customer_number,s.value->>'platform' AS payment_platform,(s.value->>'active')::boolean AS active FROM tracker_state t CROSS JOIN LATERAL jsonb_array_elements(t.data->'templates') s WHERE t.id=1`);
    const existing=await c.query('SELECT id FROM tracker_state WHERE id=1 FOR UPDATE');
    if(!existing.rowCount){
      const key=process.env.INITIAL_SEED_KEY;
      if(!key)throw new Error('INITIAL_SEED_KEY diperlukan untuk mengimpor file Numbers asli ke database kosong');
      const bytes=await readFile(path.join(ROOT,'seed','initial.enc'));
      const state=decodeSeed(bytes,key);
      await c.query('INSERT INTO tracker_state (id,revision,data,updated_at) VALUES (1,$1,$2::jsonb,now())',[Number(state.revision||1),JSON.stringify(state)]);
      console.log(`IMPORTED ${Object.keys(state.months).length} periods; ${Object.values(state.months).reduce((n,rows)=>n+rows.length,0)} monthly bills; ${state.templates.length} templates`);
    }else console.log('Database already initialized, historical import skipped safely');
    await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}

app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Cache-Control','no-store');next();});
// As explicitly requested: no password screen. Keep Origin check on mutations.
function checkOrigin(req){const origin=req.get('origin');if(!origin)return false;try {return new URL(origin).host===req.get('host')||CORS_ORIGINS.includes(new URL(origin).origin);}catch{return false;}}
app.get('/api/session',(_req,res)=>res.json({authenticated:true,configured:true}));
app.post('/api/login',(_req,res)=>res.json({ok:true}));
app.post('/api/logout',(_req,res)=>res.json({ok:true}));
app.get('/api/health',async(_req,res)=>{
  try{if(!pool)throw new Error('database not configured');const r=await pool.query('SELECT revision FROM tracker_state WHERE id=1');res.status(r.rowCount?200:503).json({service:'Tagihan Bulanan',storage:'Render PostgreSQL',storageReady:r.rowCount===1,authReady:true,loginRequired:false,revision:r.rows[0]?.revision??null});}
  catch(e){res.status(503).json({service:'Tagihan Bulanan',storageReady:false,error:'Database unavailable'});}
});
app.get('/api/state',async(_req,res)=>{
  if(!pool)return res.status(503).json({error:'Database belum tersedia'});
  try{const r=await pool.query('SELECT revision, data FROM tracker_state WHERE id=1');if(!r.rowCount)return res.status(503).json({error:'Data awal belum diimpor'});res.json({etag:String(r.rows[0].revision),state:r.rows[0].data});}
  catch(e){console.error('GET state:',e.message);res.status(503).json({error:'Gagal membaca database'});}
});
app.put('/api/state',async(req,res)=>{
  if(!checkOrigin(req))return res.status(403).json({error:'Origin tidak valid'});
  if(!pool)return res.status(503).json({error:'Database belum tersedia'});
  let client;
  try{
    const state=validateState(req.body?.state);const etag=String(req.body?.etag??'');
    client=await pool.connect();await client.query('BEGIN');
    const r=await client.query('SELECT revision FROM tracker_state WHERE id=1 FOR UPDATE');
    if(!r.rowCount)throw Object.assign(new Error('Belum ada database'),{status:503});
    const revision=Number(r.rows[0].revision);
    if(etag!==String(revision))throw Object.assign(new Error('Data telah berubah pada perangkat lain, muat ulang dahulu'),{status:409});
    state.revision=revision+1;state.updatedAt=new Date().toISOString();
    await client.query('UPDATE tracker_state SET revision=$1,data=$2::jsonb,updated_at=now() WHERE id=1',[state.revision,JSON.stringify(state)]);
    await client.query('COMMIT');
    res.json({ok:true,etag:String(state.revision),revision:state.revision,updatedAt:state.updatedAt});
  }catch(e){if(client)await client.query('ROLLBACK').catch(()=>{});console.error('SAVE:',e.message);res.status(e.status||500).json({error:e.status?e.message:'Save gagal, coba lagi'});}
  finally{client?.release();}
});
app.use(express.static(path.join(ROOT,'public'),{extensions:['html'],index:'index.html',maxAge:0}));
app.get('*',(_req,res)=>res.sendFile(path.join(ROOT,'public','index.html')));

const PORT=Number(process.env.PORT)||10000;
prepareDatabase().then(()=>app.listen(PORT,'0.0.0.0',()=>console.log(`TagihanBulanan on port ${PORT}`))).catch(e=>{console.error('DATABASE INITIALIZATION FAILED:',e.message);process.exit(1);});
