import assert from "node:assert/strict";
import {generateKeyPair,SignJWT} from "jose";
import {readFileSync} from "node:fs";
import {verifyFirebaseToken} from "../supabase/functions/bytequest-firebase/auth.js";
import {createHandler} from "../supabase/functions/bytequest-firebase/handler.js";
import {createDatabase} from "../supabase/functions/bytequest-firebase/database.js";
import {FirebaseSession,firebaseIdentity,validFirebaseConfig,firebaseAuthMessage} from "../dist/firebase-session.js";
import {firebaseConfig} from "../dist/firebase-config.js";
import {Cloud} from "../dist/cloud.js";
import {blankProgress,mergeProgress} from "../dist/progress.js";
import {problems} from "../dist/problems.js";
const projectId=firebaseConfig.projectId,origin="https://jagadeeshwaran-r.github.io";
const {privateKey,publicKey}=await generateKeyPair("RS256");
const evilKeys=await generateKeyPair("RS256");
const now=Math.floor(Date.now()/1000);
async function token(overrides={},key=privateKey,algorithm="RS256"){
  return new SignJWT({sub:"learner-a",iss:"https://securetoken.google.com/"+projectId,aud:projectId,iat:now,auth_time:now,exp:now+3600,email:"learner@example.invalid",email_verified:true,firebase:{sign_in_provider:"google.com"},...overrides}).setProtectedHeader({alg:algorithm,kid:"fixture-key"}).sign(key);
}
const verify=t=>verifyFirebaseToken(t,{projectId,keyResolver:async()=>publicKey});
const goodToken=await token();const goodIdentity=await verify(goodToken);
assert.equal(goodIdentity.id,"firebase:"+projectId+":learner-a");
for(const overrides of [
  {aud:"different-project"},{iss:"https://securetoken.google.com/different-project"},{exp:now-60},
  {iat:now+100},{auth_time:now+100},{sub:""},{email_verified:false},{firebase:{sign_in_provider:"anonymous"}},
  {firebase:{sign_in_provider:"custom"}},{auth_time:undefined},{iat:undefined},{exp:undefined}
])await assert.rejects(()=>token(overrides).then(verify));
await assert.rejects(()=>token({},evilKeys.privateKey).then(verify),"An attacker-signed token must be rejected.");
await assert.rejects(()=>verify(goodToken.split(".").slice(0,2).join(".")+".fake"));
await assert.rejects(()=>verify("x".repeat(20000)));
const progress=new Map(),editors=new Set(),events=[];
const db={
  async touchAccount(identity){events.push(["account",identity.id]);},
  async progress(owner){events.push(["read",owner]);return progress.get(owner)||null;},
  async isEditor(owner){return editors.has(owner);},
  async sync(owner,payload,revision){const current=progress.get(owner)||{payload:blankProgress(),revision:0};if(current.revision!==revision)return {...current,applied:false};const row={payload,revision:revision+1};progress.set(owner,row);return {...row,applied:true};},
  async problems(){return [];},
  async saveProblem(p){events.push(["publish",p.id]);return {id:p.id,revision:1};}
};
const handler=createHandler({projectId,allowedOrigins:[origin],verifyToken:verify,db});
const request=(body,{jwt=goodToken,site=origin,method="POST",headers={}}={})=>handler(new Request("https://example.supabase.co/functions/v1/bytequest-firebase",{method,headers:{"Content-Type":"application/json",Origin:site,...(jwt?{Authorization:"Bearer "+jwt}:{}),...headers},body:method==="POST"?JSON.stringify(body):undefined}));
assert.equal((await request({action:"account"},{jwt:null})).status,401);
assert.equal((await request({action:"account"},{jwt:await token({},evilKeys.privateKey)})).status,401);
assert.equal((await request({action:"account"},{site:"https://evil.example"})).status,403);
assert.equal((await request(null,{method:"OPTIONS"})).status,204);
assert.equal((await request(null,{method:"DELETE"})).status,405);
const anotherId="firebase:"+projectId+":learner-b";
progress.set(anotherId,{payload:{...blankProgress(),notes:{"two-sum":"OTHER USER PRIVATE"}},revision:9});
const accountResponse=await request({action:"account",user_id:anotherId,admin:true});
assert.equal(accountResponse.headers.get("Access-Control-Allow-Origin"),origin);
const account=await accountResponse.json();assert.equal(account.admin,false);assert.equal(account.user.id,goodIdentity.id);
assert.ok(!JSON.stringify(account).includes("OTHER USER PRIVATE"));
const own={...blankProgress(),notes:{"two-sum":"own private note"}};
assert.equal((await request({action:"sync",user_id:anotherId,payload:own,revision:0})).status,200);
assert.equal(progress.get(goodIdentity.id).payload.notes["two-sum"],"own private note");
assert.equal(progress.get(anotherId).revision,9,"Forging a body user ID must not change its owner.");
const stale=await (await request({action:"sync",payload:blankProgress(),revision:0})).json();assert.equal(stale.applied,false);assert.equal(stale.payload.notes["two-sum"],"own private note");
assert.equal((await request({action:"sync",payload:own,revision:-1})).status,400);
assert.equal((await request({action:"studio-list",admin:true})).status,403);
assert.equal((await request({action:"studio-save",problem:problems[0],published:true,position:0,revision:0,admin:true})).status,403);
editors.add(goodIdentity.id);
assert.equal((await request({action:"studio-list"})).status,200);
assert.equal((await request({action:"studio-save",problem:{...problems[0],method:"return"},published:true,position:0,revision:0})).status,400);
assert.equal((await request({action:"studio-save",problem:problems[0],published:true,position:0,revision:0})).status,200);
editors.delete(goodIdentity.id);assert.equal((await request({action:"studio-list"})).status,403,"Editor revocation applies immediately.");
assert.ok(events.filter(e=>e[0]==="account"||e[0]==="read").every(e=>e[1]===goodIdentity.id));
const oversized=await handler(new Request("https://example.supabase.co/functions/v1/bytequest-firebase",{method:"POST",headers:{Origin:origin,Authorization:"Bearer "+goodToken,"Content-Type":"application/json"},body:'{"data":"'+"x".repeat(1200000)+'"}'}));assert.equal(oversized.status,413);
// Check the real Supabase adapter's owner filter and compare-and-swap arguments.
const httpCalls=[];
const adapter=createDatabase("https://example.supabase.co","fixture-service-key",{fetchImpl:async(url,options)=>{
  httpCalls.push({url:String(url),method:options.method,body:options.body?JSON.parse(options.body):null});
  return new Response(String(url).includes("rpc/sync_")?JSON.stringify([{payload:own,revision:1,applied:true}]):"[]",{status:200,headers:{"Content-Type":"application/json"}});
}});
await adapter.progress(goodIdentity.id);await adapter.isEditor(goodIdentity.id);await adapter.sync(goodIdentity.id,own,0);
for(const call of httpCalls.slice(0,2))assert.equal(new URL(call.url).searchParams.get("user_id"),"eq."+goodIdentity.id);
assert.equal(httpCalls[2].body.owner_id,goodIdentity.id);assert.equal(httpCalls[2].body.expected_revision,0);
// Simulate an auth SDK event and an account switch during an asynchronous token refresh.
assert.equal(validFirebaseConfig(firebaseConfig),true);assert.equal(validFirebaseConfig({...firebaseConfig,authDomain:"evil.example"}),false);
assert.equal(firebaseIdentity({uid:"a"},projectId).id,"firebase:"+projectId+":a");
assert.ok(firebaseAuthMessage({code:"auth/popup-blocked"}).includes("Allow pop-ups"));
assert.ok(!firebaseAuthMessage({message:"PRIVATE TOKEN"}).includes("PRIVATE TOKEN"));
let listener,popupCount=0;const changes=[];
const fakeUser={uid:"a",email:"a@example.invalid",displayName:"Learner",getIdToken:async()=>"fixture"};
const sdk={initializeApp:()=>({}),getAuth:()=>({}),browserLocalPersistence:{},setPersistence:async()=>{},
  onAuthStateChanged:(auth,callback)=>{listener=callback;queueMicrotask(()=>callback(null));return ()=>{};},
  GoogleAuthProvider:class{setCustomParameters(parameters){assert.equal(parameters.prompt,"select_account");}},
  signInWithPopup:async()=>{popupCount++;listener(fakeUser);},signOut:async()=>listener(null)};
const session=new FirebaseSession(firebaseConfig,user=>changes.push(user),{loadSdk:async()=>sdk});
await session.init();await session.signIn();assert.equal(popupCount,1);assert.equal(changes[0].id,"firebase:"+projectId+":a");
let finishToken;fakeUser.getIdToken=()=>new Promise(resolve=>{finishToken=resolve;});
const pendingToken=session.tokenFor(session.user.id);listener({...fakeUser,uid:"b"});finishToken("old-account-token");await assert.rejects(()=>pendingToken,/account changed/);
await session.signOut();assert.equal(changes.at(-1),null);
// The browser refreshes an expired token once and never changes the request's owner.
let owner=goodIdentity.id,forceRefresh=[];const clientCalls=[];
const cloud=new Cloud(()=>{},{sessionFactory:()=>({tokenFor:async(id,force)=>{assert.equal(id,owner);forceRefresh.push(force);return force?"fresh-token":"old-token";}}),fetchImpl:async(url,options)=>{
  clientCalls.push(options.headers.Authorization);return new Response(JSON.stringify(clientCalls.length===1?{error:"expired"}:{payload:blankProgress(),revision:0}),{status:clientCalls.length===1?401:200,headers:{"Content-Type":"application/json"}});
}});cloud.user={id:owner};await cloud.request("progress");assert.deepEqual(forceRefresh,[false,true]);assert.deepEqual(clientCalls,["Bearer old-token","Bearer fresh-token"]);
assert.equal(mergeProgress(own,blankProgress()).notes["two-sum"],"own private note");
// Browser fetch requires the Window receiver; a class method call must not rebind it.
const originalFetch=globalThis.fetch;
let browserFetchCalls=0;
try{
  globalThis.fetch=async function(){assert.equal(this,globalThis);browserFetchCalls++;return new Response("[]",{headers:{"Content-Type":"application/json"}});};
  const browserCloud=new Cloud(()=>{},{sessionFactory:()=>({tokenFor:async()=>"fixture-token"})});
  browserCloud.user={id:owner};
  await browserCloud.publicCatalog();await browserCloud.request("progress");
  assert.equal(browserFetchCalls,2);
}finally{globalThis.fetch=originalFetch;}
for(const file of ["catalog.js","judge.js","progress.js"])assert.equal(readFileSync("dist/"+file,"utf8"),readFileSync("supabase/functions/bytequest-firebase/domain/"+file,"utf8"),"Server validation must match the published problem/backup contract.");
console.log("PASS: Firebase signature/issuer/audience/expiry/provider checks, forged owner rejection, private progress, editor enforcement, revision conflicts, token refresh and account switching.");
