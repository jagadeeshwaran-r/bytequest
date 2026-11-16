import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {avatarKeyFromSignedUrl,avatarKeyFromRow,warmAvatarImages,
  readCachedAvatar,clearAvatarImages,hydrateLeaderboardAvatars,
  releaseAvatarObjectUrls} from "../dist/avatar-cache.js";
import {createViewCache} from "../dist/view-cache.js";
import {leaderboardRow} from "../dist/leaderboard-model.js";

const owner="firebase:project:avatar-owner",other="firebase:project:another";
const key="profile-123/avatar.jpg";
const signed="https://zwubrziriuppkldrdoos.supabase.co/storage/v1/object/sign/bytequest-avatars/"+key+"?token=short-lived-secret";
assert.equal(avatarKeyFromSignedUrl(signed),key);
assert.equal(avatarKeyFromSignedUrl("https://lh3.googleusercontent.com/profile.jpg"),"");
assert.equal(avatarKeyFromSignedUrl("javascript:alert(1)"),"");
assert.equal(avatarKeyFromSignedUrl("https://attacker.test/storage/v1/object/sign/bytequest-avatars/"+key),"");
assert.equal(avatarKeyFromSignedUrl(signed.replace("avatar.jpg","../../other-file.jpg")),"");
assert.equal(avatarKeyFromRow({avatar_cache_key:key,avatar_url:""}),key);
assert.equal(avatarKeyFromRow({avatar_cache_key:"../../attack"}),"");

const files=new Map();
const cacheStorage={
 async open(name){
   let items=files.get(name);if(!items){items=new Map();files.set(name,items);}
   return {
     async match(req){const response=items.get(req.url);return response?response.clone():undefined;},
     async put(req,response){items.set(req.url,response.clone());},
     async delete(req){return items.delete(req.url);},
     async keys(){return [...items.keys()].map(url=>new Request(url));}
   };
 },
 async delete(name){return files.delete(name);}
};
let clock=1000000,requestCount=0;
const fakeImage=async(url,opts)=>{
 assert.equal(url,signed);
 assert.equal(opts.credentials,"omit");
 assert.equal(opts.mode,"cors");
 requestCount++;
 return new Response(new Blob([new Uint8Array([255,216,255,217])],{type:"image/jpeg"}),{
   status:200,headers:{"Content-Type":"image/jpeg"}});
};
await warmAvatarImages(owner,[{avatar_url:signed},{avatar_url:signed}],
  {cacheStorage,fetchImpl:fakeImage,now:()=>clock});
assert.equal(requestCount,1,"Duplicate avatars are fetched once.");
let avatar=await readCachedAvatar(owner,key,{cacheStorage,now:()=>clock});
assert.ok(avatar?.size===4,"Cached JPEG bytes should be readable.");
assert.equal(await readCachedAvatar(other,key,{cacheStorage,now:()=>clock}),null,
  "Private blob cache must be isolated by verified account.");
const keys=[...files.values()].flatMap(items=>[...items.keys()]);
assert.equal(keys.length,1);
assert.ok(!keys[0].includes("short-lived-secret"),"Do not persist signed URL tokens in cache keys.");
await warmAvatarImages(owner,[{avatar_url:signed}],{cacheStorage,fetchImpl:fakeImage,now:()=>clock});
assert.equal(requestCount,1,"Warm cache must avoid duplicate network downloads.");

const row={username:"learner",display_name:"Learner",rank:4,solved:5,
  points:50,avatar_url:signed};
const markup=leaderboardRow(row);
assert.ok(markup.includes('data-avatar-key="'+key+'"'),"Leaderboard rows must expose stable avatar cache keys.");
assert.ok(markup.includes('referrerpolicy="no-referrer"'));
assert.ok(!leaderboardRow({...row,avatar_url:"javascript:alert(1)"}).includes("javascript:"));
const staleMarkup=leaderboardRow({...row,avatar_url:"",avatar_cache_key:key});
assert.ok(staleMarkup.includes('data-avatar-key="'+key+'"'));
assert.ok(!staleMarkup.includes("short-lived-secret"),"Stale view must not expose expired tokens.");

const sessionItems=new Map(),session={
 getItem:k=>sessionItems.get(k)??null,
 setItem:(k,v)=>sessionItems.set(k,v),
 removeItem:k=>sessionItems.delete(k),
 get length(){return sessionItems.size;},
 key:i=>[...sessionItems.keys()][i]??null
};
const viewerCache=createViewCache({storage:session,now:()=>clock});
const query={scope:"global",period:"all",page:0};
viewerCache.saveBoard(owner,query,{users:[row],total:1,me:row});
clock+=9*60*1000;
const aged=viewerCache.board(owner,query,{allowStale:true});
assert.equal(aged.users[0].avatar_url,"","Expired signed URL should be hidden.");
assert.equal(aged.users[0].avatar_cache_key,key,"Stable key should remain for cached blob restoration.");
assert.equal(aged.me.avatar_cache_key,key);
assert.ok(!aged.users[0].avatar_url.includes("token"));

const prevDocument=globalThis.document;
let appended=null;
const fakeNode={dataset:{avatarKey:key},isConnected:true,
 querySelector:()=>null,append(img){appended=img}};
const fakeContainer={querySelectorAll:()=>[fakeNode],contains:node=>node===fakeNode};
globalThis.document={createElement:()=>({alt:"",decoding:""})};
try{
  await hydrateLeaderboardAvatars(fakeContainer,owner,{cacheStorage});
  assert.ok(appended?.src?.startsWith("blob:"),"Expired avatar should render from stored JPEG bytes.");
}finally{
 releaseAvatarObjectUrls();
 if(prevDocument===undefined)delete globalThis.document;else globalThis.document=prevDocument;
}
clock+=24*60*60*1000;
assert.equal(await readCachedAvatar(owner,key,{cacheStorage,now:()=>clock}),null,
  "Very old image bytes must not be reused indefinitely.");
await clearAvatarImages(owner,{cacheStorage});
assert.equal(await readCachedAvatar(owner,key,{cacheStorage,now:()=>clock}),null);
assert.equal(files.size,0,"Sign-out should clear the owner's private image bytes.");

const viewSource=readFileSync("dist/view-cache.js","utf8");
assert.ok(viewSource.includes('warmAvatarImages(owner,[...value.users,value.me])'));
assert.ok(viewSource.includes('clearAvatarImages(owner)'));
const leaderSource=readFileSync("dist/leaderboard.js","utf8");
assert.ok(leaderSource.includes("hydrateLeaderboardAvatars($('leaderRows'),owner)"));
assert.ok(leaderSource.includes("releaseAvatarObjectUrls()"));
assert.ok(leaderSource.includes("load({force:true})"),"Refresh ranks must remain a live server fetch.");
const css=readFileSync("dist/problem-alignment.css","utf8");
assert.ok(css.includes(".problem-table th:nth-child(3){width:190px}"));
assert.ok(css.includes(".problem-table :is(th,td)"));
assert.ok(css.includes(".problem-table td:nth-child(3)>.company-overflow"));
assert.ok(css.includes("#practiceView .learning-content .example-card"));
assert.ok(css.includes("#practiceView .pane-tabs button"));
for(const page of ["index.html","studio.html"]){
 const html=readFileSync("dist/"+page,"utf8");
 assert.ok(html.includes('problem-alignment.css?v=align-1'));
}
console.log("PASS: signed avatar warm-cache/restore/isolation/expiry/sign-out and aligned problem catalog/detail layouts.");
