import assert from "node:assert/strict";
import {Cloud,PUBLIC_CATALOG_TTL_MS} from "../dist/cloud.js";
import {problems} from "../dist/problems.js";
import {readFileSync} from "node:fs";

const config={url:"https://example.supabase.co",publishableKey:"sb_publishable_cache_testing"};
const row={id:problems[0].id,content:problems[0],position:0,revision:1};
function memoryStore(){
  const values=new Map();
  return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
}
let time=1000000,calls=0;
const store=memoryStore();
const options={config,storage:store,now:()=>time,sessionFactory:()=>({}),
  fetchImpl:async()=>{calls++;return new Response(JSON.stringify([row]),{status:200,headers:{"Content-Type":"application/json"}});}};
const first=new Cloud(()=>{},options);
assert.equal((await first.publicCatalog())[0].id,row.id);
assert.equal(calls,1,"First navigation fetches Supabase.");
assert.equal((await first.publicCatalog())[0].id,row.id);
assert.equal(calls,1,"Repeated same-page requests must not hit Supabase.");
const second=new Cloud(()=>{},options);
assert.equal((await second.publicCatalog())[0].id,row.id);
assert.equal(calls,1,"Across-page navigation must use persisted public catalog.");
assert.equal(store.values.size,1,"Catalog is the only persisted cache entry.");
const contents=[...store.values.values()][0];
assert.ok(contents.includes('"version":1'));
assert.ok(!contents.includes('chat-thread')&&!contents.includes('"notifications"'));

time+=PUBLIC_CATALOG_TTL_MS+1;
assert.equal((await second.publicCatalog())[0].id,row.id);
assert.equal(calls,2,"Expired cache must revalidate from Supabase.");

const offline=new Cloud(()=>{},{...options,fetchImpl:async()=>{throw new Error("temporary offline");}});
time+=PUBLIC_CATALOG_TTL_MS+1;
assert.equal((await offline.publicCatalog())[0].id,row.id,"Stale published catalog remains usable briefly offline.");
await assert.rejects(()=>offline.publicCatalog({force:true}),/temporary offline/,"Forced post-publish refresh must not return stale data.");

time+=24*60*60*1000;
await assert.rejects(()=>offline.publicCatalog(),/temporary offline/,"Cache more than a day old must not outlive its safety limit.");
time=5000000;
store.values.clear();

let flightCalls=0,resolveFetch;
const overlapping=new Cloud(()=>{},{...options,fetchImpl:async()=>{
  flightCalls++;
  return await new Promise(resolve=>{resolveFetch=resolve;});
}});
const pending1=overlapping.publicCatalog(),pending2=overlapping.publicCatalog();
assert.equal(flightCalls,1,"Overlapping catalog requests share one request.");
resolveFetch(new Response(JSON.stringify([row]),{status:200}));
assert.deepEqual(await pending1,await pending2);
assert.equal(flightCalls,1);

const latest=new Cloud(()=>{},options);
latest.request=async action=>{assert.equal(action,"studio-save");return {problem:row};};
assert.equal((await latest.publicCatalog())[0].id,row.id);
assert.equal(calls,2,"Cached result remains available before a creator saves.");
await latest.saveProblem(problems[0],{published:true});
assert.equal(store.values.size,0,"Saving/publishing must invalidate cached public catalog.");
assert.equal((await latest.publicCatalog())[0].id,row.id);
assert.equal(calls,3,"The next catalog visit must retrieve the newly published revision.");

store.values.set([...store.values.keys()][0],"{not valid JSON");
const corrupt=new Cloud(()=>{},options);
await corrupt.publicCatalog();
assert.equal(calls,4,"Corrupt cache must fall back to the live endpoint.");

// Unavailable browser storage must be a pure optimization failure.
const forbidden={getItem(){throw Error("blocked");},setItem(){throw Error("blocked");},removeItem(){throw Error("blocked");}};
let blockedCalls=0;
const blocked=new Cloud(()=>{},{...options,storage:forbidden,fetchImpl:async()=>{
 blockedCalls++;return new Response(JSON.stringify([row]),{status:200});
}});
await blocked.publicCatalog();await blocked.publicCatalog();
assert.equal(blockedCalls,2,"Disabled storage must not block online catalog loading.");

// Notifications, chat, presence and inbox stay on their original live network path.
const actions=[];
const live=new Cloud(()=>{},{...options,sessionFactory:()=>({tokenFor:async()=>"fresh-firebase-token"}),fetchImpl:async(url,init)=>{
 const action=JSON.parse(init.body).action;actions.push(action);
 return new Response(JSON.stringify({tick:actions.length}),{status:200});
}});
live.user={id:"firebase:fixture:someone"};
assert.equal((await live.request("notifications")).tick,1);
assert.equal((await live.request("notifications")).tick,2,"Notifications never come from cache.");
assert.equal((await live.request("chat-list")).tick,3);
assert.equal((await live.request("chat-list")).tick,4,"Chat threads and lists are never cached.");
assert.equal((await live.request("chat-thread",{target:"friend"})).tick,5);
assert.equal((await live.request("chat-thread",{target:"friend"})).tick,6);
assert.equal((await live.request("profile-presence",{target:"friend"})).tick,7);
assert.equal((await live.request("profile-presence",{target:"friend"})).tick,8);
assert.deepEqual(actions,["notifications","notifications","chat-list","chat-list","chat-thread","chat-thread","profile-presence","profile-presence"]);
const cloudSource=readFileSync("dist/cloud.js","utf8");
assert.ok(cloudSource.includes('this.invalidatePublicCatalog()'));
assert.ok(!cloudSource.includes('cacheRequest("notifications"'),'Notifications must never route through a generic cache.');
console.log("PASS: 5-minute cross-page catalog caching, expiry, validation, offline fallback, creator invalidation, concurrency and uncached chat/notifications/presence.");
