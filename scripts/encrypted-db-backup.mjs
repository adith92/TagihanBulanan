/** Backup TagihanBulanan app state as AES-256-GCM/gzip TBSEED1, without plaintext at rest. */
import {createCipheriv,createHash,randomBytes} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function encryptState(state,keyHex){
  if(!/^[0-9a-f]{64}$/i.test(keyHex||''))throw new Error('TAGIHAN_BACKUP_KEY must be 64 hexadecimal characters');
  if(state?.schema!==2||!state.months||!Array.isArray(state.templates)||!Array.isArray(state.categories))throw new Error('Unexpected API state schema');
  const plain=Buffer.from(JSON.stringify(state),'utf8');
  if(plain.length<100||plain.length>10000000)throw new Error('State size out of safe range');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(keyHex,'hex'),iv);
  const body=Buffer.concat([cipher.update(gzipSync(plain,{level:9})),cipher.final()]);
  const seed=Buffer.concat([Buffer.from('TBSEED1'),iv,cipher.getAuthTag(),body]);
  return {seed,plain};
}

async function main(){
  const url=(process.env.TAGIHAN_API_URL||'https://tagihanbulanan.onrender.com').replace(/\/+$/,'');
  if(!/^https:\/\//.test(url))throw new Error('API URL must be HTTPS');
  const key=process.env.TAGIHAN_BACKUP_KEY;
  if(!key)throw new Error('TAGIHAN_BACKUP_KEY secret is missing; no backup written');
  const reply=await fetch(url+'/api/state',{headers:{Accept:'application/json'},signal:AbortSignal.timeout(25000),redirect:'error'});
  if(!reply.ok)throw new Error('Backup source unavailable: HTTP '+reply.status);
  const response=await reply.json();
  if(!response.state)throw new Error('Response has no state; aborting');
  const {seed,plain}=encryptState(response.state,key);
  const summary={format:'TBSEED1',createdAt:new Date().toISOString(),source:'Render /api/state',periods:Object.keys(response.state.months).length,billRows:Object.values(response.state.months).reduce((n,rows)=>n+rows.length,0),templates:response.state.templates.length,revision:response.state.revision??null,seedSHA256:createHash('sha256').update(seed).digest('hex'),plaintextSHA256:createHash('sha256').update(plain).digest('hex'),warning:'Encrypted only. Recovery key is not stored in GitHub.'};
  const dir=process.env.RUNNER_TEMP;
  if(!dir)throw new Error('RUNNER_TEMP must be set');
  await writeFile(join(dir,'tagihan-backup.enc'),seed,{mode:0o600});
  await writeFile(join(dir,'tagihan-backup-manifest.json'),JSON.stringify(summary,null,2)+'\n',{mode:0o600});
  console.log('Encrypted backup ready. Periods:',summary.periods,'rows:',summary.billRows,'revision:',summary.revision);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))await main();