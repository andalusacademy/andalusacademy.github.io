/* Andalus Academy Service Worker — staff attendance portal v59 */
const CACHE='andalus-v60-hide-staff-shortcut-in-student-portal';
const ASSETS=['./student-ai-assistant.js?v=20261103-4','./assets/andalus-owner-avatar.svg?v=1','./manifest.json','./student-portal-bootstrap.js?v=3','./student-passkey.js?v=2','./study-summary-receipt-admin.js?v=2','./student-portal-admin-gateway-v5.js?v=4','./student-ai-subscriptions-admin-v1.js?v=2','./staff-attendance-entry.js?v=2'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})())});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 e.respondWith((async()=>{
  try{
   const r=await fetch(e.request,{cache:'no-store'});
   if(r?.ok&&e.request.url.startsWith(self.location.origin)&&e.request.destination==='document'){
    const path=new URL(e.request.url).pathname;
    if(path==='/staff-attendance.html')return r;
    if(path==='/'||path==='/index.html'){
     const type=r.headers.get('content-type')||'';
     if(type.includes('text/html')){
      const text=await r.clone().text();let injected=text;
      const scripts=[
       ['student-portal-bootstrap.js','<script src="./student-portal-bootstrap.js?v=3"></script>'],
       ['study-summary-receipt-admin.js','<script src="./study-summary-receipt-admin.js?v=2"></script>'],
       ['student-portal-admin-gateway-v5.js','<script src="./student-portal-admin-gateway-v5.js?v=4"></script>'],
       ['student-ai-subscriptions-admin-v1.js','<script src="./student-ai-subscriptions-admin-v1.js?v=2"></script>'],
       ['staff-attendance-entry.js','<script src="./staff-attendance-entry.js?v=2"></script>']
      ];
      for(const [name,tag] of scripts)if(!injected.includes(name))injected=injected.replace('</head>',tag+'\n</head>');
      if(injected!==text){const headers=new Headers(r.headers);headers.delete('content-length');headers.delete('content-encoding');headers.set('cache-control','no-store');return new Response(injected,{status:r.status,statusText:r.statusText,headers})}
     }
    }
   }
   if(r?.ok&&e.request.url.startsWith(self.location.origin)&&e.request.destination!=='document'){const c=await caches.open(CACHE);c.put(e.request,r.clone()).catch(()=>{})}
   return r;
  }catch(_){return await caches.match(e.request)||Response.error()}
 })())
});
