import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync('dist/runtime-sw.js','utf8');
const listeners={};const saved=new Map();let connected=true,skipped=false;
const base='https://bytequest.test/bytequest/';
const urlFor=value=>new URL(typeof value==='string'?value:value.url,base);
const urlKey=value=>urlFor(value).pathname;
async function fetchMock(value){
 if(!connected)throw new TypeError('Network unavailable');
 const url=urlFor(value);
 return new Response('cached:'+url.pathname,{status:200,headers:{'Content-Type':'text/plain'}});
}
const cache={
 async add(value){const response=await fetchMock(value);saved.set(urlKey(value),response.clone());},
 async put(value,response){saved.set(urlKey(value),response.clone());},
 async match(value){return saved.get(urlKey(value))?.clone()||undefined;}
};
const self={
 location:{origin:'https://bytequest.test'},
 addEventListener(type,fn){listeners[type]=fn;},
 skipWaiting(){skipped=true;},
 clients:{async claim(){}}
};
const caches={async open(){return cache;}};
runInNewContext(source,{self,caches,fetch:fetchMock,Response,Request,Headers,URL,Promise,console});
let install;
listeners.install({waitUntil(promise){install=promise;}});
await install;
assert.equal(skipped,true);
for(const file of ['status.html','system-state.css','status-page.js','system-state.js','theme-mode.js'])
 assert.ok(saved.has('/bytequest/'+file),'Pre-cache must include '+file);
connected=false;
async function intercepted(request){
 let handled=null;
 listeners.fetch({request,respondWith(promise){handled=promise;}});
 return handled?await handled:null;
}
const offlinePage=await intercepted(new Request(base+'status.html?issue=offline&from=index.html'));
assert.equal(offlinePage.status,200,'Recovery HTML loads from cache while offline');
assert.equal(await offlinePage.text(),'cached:/bytequest/status.html');
const cachedJs=await intercepted(new Request(base+'status-page.js?v=1'));
assert.equal(cachedJs.status,200,'Recovery script remains available offline');
const cachedCss=await intercepted(new Request(base+'system-state.css?v=1'));
assert.equal(cachedCss.status,200,'Recovery visual style remains available offline');
const app=await intercepted(new Request(base+'app.js'));
assert.equal(app,null,'Never cache or intercept application code');
const userPost=await intercepted(new Request(base+'sync',{method:'POST'}));
assert.equal(userPost,null,'Never intercept progress writes');
const remote=await intercepted(new Request('https://example.supabase.co/rest/v1/bytequest_problems'));
assert.equal(remote,null,'Never cache Supabase data or private submissions');
connected=true;
const native=await intercepted(new Request(base+'native-runner.html'));
assert.equal(native.headers.get('Cross-Origin-Opener-Policy'),'same-origin',
 'Native Java runner must retain original isolation');
assert.equal(native.headers.get('Cross-Origin-Embedder-Policy'),'require-corp',
 'Browser Java runtime must keep SharedArrayBuffer isolation');
assert.equal(native.headers.get('Cache-Control'),'no-store');
const shell=readFileSync('dist/shell.js','utf8');
assert.ok(shell.includes("navigator.serviceWorker.register('./runtime-sw.js?v=strict-1'"),
 'All main pages install recovery page caching when service workers are supported');
console.log('PASS: offline recovery page loads with cached JS/CSS, private progress never cached, Java runner isolation preserved.');
