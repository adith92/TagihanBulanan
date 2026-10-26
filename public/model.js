// Core rules: amounts are integer Rupiah; 1 month = independent snapshot.
export const DEFAULT_CATEGORIES = [
  'Listrik','Telkom / Telepon / Satelit','Tagihan PAM Jakarta','PAM Cianjur','IndiHome','Listrik Puncak','Lainnya'
];
export const periodKey = (year,month) => `${year}-${String(month).padStart(2,'0')}`;
export const validPeriod = ym => /^20\d\d-(0[1-9]|1[0-2])$/.test(ym);
export const makeId = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function blankState() { return { schema: 2, revision: 0, categories: DEFAULT_CATEGORIES.map((name,i) => ({id:`cat-${i}`,name,order:i,active:true})), templates:[], months:{}, migrated:null, updatedAt:null }; }
// Parse Rupiah pasted from websites, including markdown and Indonesian/Western grouping.
// Returns integer IDR or null. Never silently combine two values or discard cents.
export function parseIdrAmount(value){
  if(typeof value==='number')return Number.isSafeInteger(value)&&value>=0&&value<=1e13?value:null;
  let text=String(value??'').replace(/[\u00a0\u202f]/g,' ').trim();
  text=text.replace(/^(?:\*{1,2}|_{1,2}|`)\s*/,'').replace(/\s*(?:\*{1,2}|_{1,2}|`)$/,'').trim();
  text=text.replace(/^(?:Rp\.?|IDR)\s*/i,'').replace(/\s*,-$/,'').trim().replace(/\s/g,'');
  if(!text||!/^[\d.,]+$/.test(text))return null;
  if(/[.,]\d{2}$/.test(text)){
    if(!/[.,]00$/.test(text))return null;
    text=text.slice(0,-3);
  }
  if(!/^\d+$/.test(text)){
    const separator=text.includes('.')?'.':',';
    if(separator==='.'&&text.includes(',')||separator===','&&text.includes('.'))return null;
    const groups=text.split(separator);
    if(!/^\d{1,3}$/.test(groups[0])||groups.length<2||groups.slice(1).some(group=>!/^\d{3}$/.test(group)))return null;
    text=groups.join('');
  }
  const amount=Number(text);
  return Number.isSafeInteger(amount)&&amount>=0&&amount<=1e13?amount:null;
}

export const money = v => Number.isSafeInteger(Number(v)) && Number(v)>=0 ? Number(v) : 0;
export const summary = rows => {
  const visible = rows.filter(r=>!r.hidden);
  const total = visible.reduce((n,r)=>n+money(r.amount),0);
  const paid = visible.filter(r=>r.paid).reduce((n,r)=>n+money(r.amount),0);
  return {count:visible.length,total,paid,due:total-paid,paidCount:visible.filter(r=>r.paid).length,unpaidCount:visible.filter(r=>!r.paid).length,unprintedCount:visible.filter(r=>r.paid&&!r.printed).length};
};
export function generatePeriod(state,ym){
  if(state.months[ym]) return state.months[ym];
  if(!validPeriod(ym)) throw new Error('Periode tidak valid');
  const known=Object.keys(state.months).filter(x=>x<ym).sort().reverse();
  return state.templates.filter(t=>t.active!==false && (!t.createdYm || t.createdYm<=ym)).map(t=>{
    let previous;
    for(const previousMonth of known){previous=state.months[previousMonth].find(row=>row.templateId===t.id&&!row.hidden);if(previous)break;}
    const category=state.categories.find(c=>c.id===t.categoryId);
    return {id:makeId(),templateId:t.id,categoryId:t.categoryId,categoryName:category?.name??'Lainnya',name:t.name,number:String(t.number||''),amount:previous?.amount??0,platform:previous?.platform??t.platform??'',paid:false,printed:false,paidAt:null,printedAt:null,notes:'',recurring:true,hidden:false};
  });
}
export function validateState(state){
  if(!state || state.schema!==2 || !Array.isArray(state.categories) || !Array.isArray(state.templates) || !state.months || typeof state.months!=='object') throw new Error('Format data salah');
  const seenCats=new Set();
  for(const c of state.categories){if(!c.id||typeof c.name!=='string'||!c.name.trim()||seenCats.has(c.id))throw new Error('Kategori invalid/duplikat');seenCats.add(c.id);}
  for(const [ym,rows] of Object.entries(state.months)){
    if(!validPeriod(ym)||!Array.isArray(rows)||rows.length>5000) throw new Error(`Bulan invalid: ${ym}`);
    const ids=new Set();
    for(const r of rows){if(!r.id||ids.has(r.id)||!Number.isSafeInteger(r.amount)||r.amount<0||r.amount>1e13||typeof r.name!=='string'||!r.name.trim()||typeof r.number!=='string'||typeof r.paid!=='boolean'||typeof r.printed!=='boolean')throw new Error(`Baris invalid: ${ym}`);ids.add(r.id);}
  }
  if(JSON.stringify(state).length>9000000) throw new Error('Ukuran data melebihi batas 9 MB');
  return true;
}
