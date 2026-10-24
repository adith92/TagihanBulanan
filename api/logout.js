import {checkOrigin} from '../lib/auth.js';
export default function handler(req,res){if(req.method!=='POST')return res.status(405).json({error:'Method tidak diizinkan'});if(!checkOrigin(req))return res.status(403).json({error:'Origin tidak valid'});res.setHeader('Set-Cookie','tbs_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');res.status(200).json({ok:true});}
