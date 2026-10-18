/* Andalus Academy Service Worker — basic offline cache */
const CACHE = 'andalus-v6.10';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js',
  'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
async function injectFaceCameraFix(response){
 try{
  if(!response || !response.ok)return response;
  const type=response.headers.get('content-type')||'';
  if(!type.includes('text/html'))return response;
  const text=await response.clone().text();
  if(text.includes('face-camera-fix.js'))return response;
  const tag='<script src="./face-camera-fix.js?v=1"></script>';
  const body=text.replace('</head>',tag+'\n</head>');
  return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});
 }catch(_){return response;}
}
self.addEventListener('fetch', e => {
 if(e.request.method!=='GET')return;
 const isHtml=e.request.mode==='navigate'||e.request.destination==='document'||e.request.url.endsWith('/index.html');
 e.respondWith(caches.match(e.request).then(async cached=>{
  const network=fetch(e.request).then(res=>{
   if(res&&res.status===200&&(e.request.url.startsWith(self.location.origin)||e.request.url.includes('fonts.')||e.request.url.includes('cdn.jsdelivr'))){const clone=res.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));}
   return res;
  }).catch(()=>cached);
  const response=cached||await network;
  return isHtml?injectFaceCameraFix(response):response;
 }));
});
