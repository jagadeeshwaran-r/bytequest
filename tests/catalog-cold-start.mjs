import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Cloud} from "../dist/cloud.js";
import {problems} from "../dist/problems.js";

// A cached copy of the original 16 bundled problems is valid but stale.
// A forced revalidation must replace it with the complete 31-problem result.
const config={url:"https://catalog-recovery.example.supabase.co",publishableKey:"sb_publishable_catalog_test"};
const now=1700000000000,store=new Map();
const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
const seedRow=(p,i)=>({id:p.id,content:p,position:i,revision:1});
const cachedRows=problems.slice(0,16).map(seedRow);
store.set("bytequest.public-catalog.v1:catalog-recovery.example.supabase.co",JSON.stringify({version:1,savedAt:now,rows:cachedRows}));
const liveRows=Array.from({length:31},(_,i)=>seedRow({...problems[i%problems.length],id:"catalog-test-"+i},i));
let calls=0;
const cloud=new Cloud(()=>{},{
  config,storage,now:()=>now,sessionFactory:()=>({}),
  fetchImpl:async()=>{calls++;return new Response(JSON.stringify(liveRows),{status:200,headers:{"Content-Type":"application/json"}});}
});
assert.equal((await cloud.publicCatalog()).length,16);
assert.equal(calls,0,"Cached rows should be available without a request.");
assert.equal((await cloud.publicCatalog({force:true})).length,31);
assert.equal(calls,1,"Explicit revalidation must bypass the cached 16-row catalog.");
assert.equal((await cloud.publicCatalog()).length,31);
const app=readFileSync("dist/app.js","utf8");
const html=readFileSync("dist/index.html","utf8");
const boot=app.slice(app.indexOf("async function bootCloud(){"));
assert.ok(boot.indexOf("const catalogLoading=refreshCatalog();")>=0&&boot.indexOf("const catalogLoading=refreshCatalog();")<boot.indexOf("await cloud.init();"),
  "Public catalog loading must begin before Firebase restoration.");
assert.ok(boot.indexOf("const catalogLoading=refreshCatalog();")<boot.indexOf("await changeAccount(cloud.user);"),
  "Public catalog loading must not wait for authenticated account/profile requests.");
assert.ok(app.includes("void catalogLoading.then(()=>revalidateCatalog());"),
  "A previously cached subset must be revalidated on boot.");
assert.ok(app.includes('catalogSyncStatus')&&app.includes('refreshProblemCatalog'));
assert.ok(app.includes('document.addEventListener("visibilitychange"'));
assert.ok(html.includes('id="refreshProblemCatalog"'));
console.log("PASS: 16-row stale cache recovers to 31 published problems independently of Firebase.");
