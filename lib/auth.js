import crypto from 'node:crypto';
const MAX_AGE = 60*60*24*14;
function expectedPasswordHash(password){return crypto.createHash('sha256').update(`${process.env.APP_PASSWORD_SALT||''}:${password}`).digest('hex');}
export function isConfigured(){return !!(process.env.APP_PASSWORD_HASH && process.env.APP_PASSWORD_SALT && process.env.SESSION_SECRET);}
function equalHex(a,b){if(!/^[a-f0-9]{64}$/.test(a)||!/^[a-f0-9]{64}$/.test(b))return false;return crypto.timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));}
export function checkPassword(password){return isConfigured()&&typeof password==='string'&&password.length<=500&&equalHex(expectedPasswordHash(password),process.env.APP_PASSWORD_HASH);}
function sign(value){return crypto.createHmac('sha256',process.env.SESSION_SECRET).update(value).digest('hex');}
export function makeCookie(){const expiration=Date.now()+MAX_AGE*1000;const token=String(expiration);const value=`${token}.${sign(token)}`;return `tbs_session=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`;}
export function hasSession(req){if(!isConfigured())return false;const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('tbs_session='));if(!cookie)return false;const [expiry,sig]=decodeURIComponent(cookie.slice('tbs_session='.length)).split('.');if(!expiry||!sig||Date.now()>=Number(expiry)||Number(expiry)>Date.now()+MAX_AGE*1000)return false;return equalHex(sign(expiry),sig);}
export function guard(req,res){if(!hasSession(req)){res.status(401).json({error:'Login diperlukan'});return false;}return true;}
export function checkOrigin(req){const origin=req.headers.origin;const host=req.headers.host;if(!origin||!host)return false;try{return new URL(origin).host===host;}catch{return false;}}
export function safeError(res,status,message){res.status(status).json({error:message});}
