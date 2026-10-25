// Privacy-first app shell: NEVER intercept or store /api state, session, or financial data.
const CACHE_NAME='tagihanbulanan-shell-v4.3.0';
const ALLOWED=new Set(['/','/index.html','/style.css','/app.js','/model.js','/export.js','/site.webmanifest','/icons/icon-192.png','/icons/icon-512.png','/icons/icon-180.png']);
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('tagihanbulanan-shell-')&&key!==CACHE_NAME)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/')||!ALLOWED.has(url.pathname))return;
  event.respondWith((async()=>{try{
    const response=await fetch(req);
    if(response.ok&&response.type==='basic') { const cache=await caches.open(CACHE_NAME);await cache.put(req,response.clone()); }
    return response;
  }catch(error){const cached=await caches.match(req);if(cached)return cached;throw error;}})());
});
