import { validateState } from './model.js';

// Private Google Drive JSON, accessed through an owner-authorized Google Apps Script.
// Browser and public repo never receive Drive credentials or bridge secret.
export class MissingStorageError extends Error {
  constructor() { super('Google Drive belum terhubung. Deploy apps-script/Code.gs melalui akun Google pemilik, kemudian set GDRIVE_BRIDGE_URL dan GDRIVE_BRIDGE_SECRET pada Vercel.'); }
}
export function isStorageConfigured(){
  return Boolean(process.env.GDRIVE_BRIDGE_URL && (process.env.GDRIVE_BRIDGE_SECRET || '').length>=32);
}
async function bridge(action,data={}) {
  if (!isStorageConfigured()) throw new MissingStorageError();
  const url=process.env.GDRIVE_BRIDGE_URL;
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/?#]+\/exec(?:\?.*)?$/.test(url)) throw new MissingStorageError();
  const resp=await fetch(url,{
    method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({action,secret:process.env.GDRIVE_BRIDGE_SECRET,...data}),
    redirect:'follow',cache:'no-store',signal:AbortSignal.timeout(29000)
  });
  const result=await resp.json().catch(()=>{throw new Error('Respons Google Apps Script tidak dapat dibaca. Periksa URL deployment dan akses Web App.');});
  if (!resp.ok || result?.ok!==true){
    const error=new Error(result?.error||`Google Drive bridge HTTP ${resp.status}`);
    error.status=[400,403,409,413,503].includes(result?.code)?result.code:502;
    throw error;
  }
  return result;
}
export async function loadState() {
  const result=await bridge('read');
  validateState(result.state);
  if (typeof result.etag!=='string') throw new Error('Versi database tidak valid');
  return {state:result.state,etag:result.etag};
}
export async function saveState(state,etag){
  validateState(state);
  if(typeof etag!=='string' || !etag) throw new Error('Versi Save wajib ada');
  const result=await bridge('save',{state,etag});
  if(typeof result.etag!=='string')throw new Error('Save tidak mengembalikan versi terbaru');
  return {etag:result.etag,revision:result.revision,updatedAt:result.updatedAt};
}
