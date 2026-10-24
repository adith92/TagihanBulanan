import {guard,checkOrigin} from '../lib/auth.js';
import {loadState,saveState,MissingStorageError} from '../lib/storage.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(!guard(req,res))return;
  try{
    if(req.method==='GET'){const data=await loadState();return res.status(200).json(data);}
    if(req.method==='PUT'){
      if(!checkOrigin(req))return res.status(403).json({error:'Origin tidak valid'});
      const {state,etag}=req.body||{};
      if(!state||typeof etag!=='string'||!etag)return res.status(400).json({error:'State dan versi diperlukan'});
      const result=await saveState(state,etag);return res.status(200).json({ok:true,...result});
    }
    res.status(405).json({error:'Method tidak diizinkan'});
  }catch(error){console.error('state:',error.constructor?.name,error.message);res.status(error.status||(error instanceof MissingStorageError?503:500)).json({error:error.message||'Gagal mengakses server'});}
}
