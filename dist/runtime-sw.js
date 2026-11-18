// Keep ByteQuest's native Java-runner isolation headers intact, and cache
// ONLY the standalone connection recovery page. Never cache account progress,
// private judge responses, source code, or authenticated API traffic.
const RECOVERY_CACHE='bytequest-connection-page-v2';
const RECOVERY_ASSETS=[
 './status.html','./system-state.css?v=maintenance-1','./status-page.js?v=maintenance-1',
 './system-state.js?v=1','./theme-mode.js'
];
const recoverable=new Set(['status.html','system-state.css','status-page.js','system-state.js','theme-mode.js']);
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(RECOVERY_CACHE).then(cache=>
    Promise.allSettled(RECOVERY_ASSETS.map(url=>cache.add(url)))
  ).catch(()=>{})); // Disabled Cache Storage must not block app installation.
  self.skipWaiting();
});
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||event.request.method!=='GET')return;
  if(url.pathname.endsWith('/native-runner.html')){
    // Original COOP/COEP behavior, required for the browser Java runner.
    event.respondWith((async()=>{
      const response=await fetch(event.request);
      const headers=new Headers(response.headers);
      headers.set('Cross-Origin-Opener-Policy','same-origin');
      headers.set('Cross-Origin-Embedder-Policy','require-corp');
      headers.set('Cache-Control','no-store');
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    })());
    return;
  }
  const file=url.pathname.slice(url.pathname.lastIndexOf('/')+1);
  if(!recoverable.has(file))return;
  event.respondWith((async()=>{
    let cache=null;
    try{cache=await caches.open(RECOVERY_CACHE);}catch{}
    try{
      const response=await fetch(event.request);
      if(response.ok&&cache)await cache.put(event.request,response.clone()).catch(()=>{});
      return response;
    }catch{
      const saved=cache?await cache.match(event.request,{ignoreSearch:true}).catch(()=>null):null;
      return saved||Response.error();
    }
  })());
});
