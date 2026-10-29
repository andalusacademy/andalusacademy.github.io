/* Andalus Academy Service Worker — clean HTML delivery + cache reset v34 */
const CACHE='andalus-v34-clean-html';
const ASSETS=['./manifest.json'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of clients){
      try{ await client.navigate(client.url); }catch(_){ }
    }
  })());
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith((async()=>{
    try{
      // HTML is ALWAYS fetched directly. It is never rewritten or cached.
      const r=await fetch(e.request,{cache:'no-store'});
      if(r?.ok && e.request.url.startsWith(self.location.origin) && e.request.destination!=='document'){
        const c=await caches.open(CACHE);
        c.put(e.request,r.clone()).catch(()=>{});
      }
      return r;
    }catch(_){
      return await caches.match(e.request) || Response.error();
    }
  })());
});
