/* Andalus Academy Service Worker — clean HTML delivery + cache reset v33 */
const CACHE='andalus-v33-clean-html';
const ASSETS=['./','./index.html','./manifest.json'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith((async()=>{
    try{
      // Never rewrite HTML. This prevents JavaScript/source from being rendered
      // into the student portal and keeps the original document intact.
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
