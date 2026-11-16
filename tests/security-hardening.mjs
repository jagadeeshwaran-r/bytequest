import assert from "node:assert/strict";
import {readFileSync,readdirSync,statSync} from "node:fs";
import {makePrivateJudge} from "../supabase/functions/bytequest-firebase/private-judge.js";
import {makeOnlineJudge} from "../supabase/functions/bytequest-firebase/online-judge.js";
import {makeBenchmarkJudge} from "../supabase/functions/bytequest-firebase/benchmark.js";
import {submitSolution} from "../supabase/functions/bytequest-firebase/submissions.js";
import {createHandler} from "../supabase/functions/bytequest-firebase/handler.js";
import {problems} from "../dist/problems.js";

const p=problems[0],cases=p.tests.slice(0,1);
const judgeUrl="https://judge.example.invalid/api";
const statusResult=(id,extra={})=>new Response(JSON.stringify({
 status:{id,description:"PRIVATE CASE SECRET"},time:"0.25",memory:8000,
 stdout:"PRIVATE ACTUAL VALUE",stderr:"PRIVATE INPUT VALUE",
 compile_output:"PRIVATE EXPECTED VALUE",...extra
}),{headers:{"content-type":"application/json"}});
let target,requestBody,requestHeaders;
const judge=makePrivateJudge({
 url:judgeUrl,languageId:62,apiKey:"secret-token-fixture",
 fetchImpl:async(url,opts)=>{
  target=String(url);requestHeaders=opts.headers;requestBody=JSON.parse(opts.body);
  return statusResult(3);
 }
});
assert.equal(judge.ready,true);
const accepted=await judge.run(p.reference,p,cases);
assert.equal(accepted.accepted,true);
assert.equal(accepted.status,"accepted");
assert.equal(accepted.runtimeMs,250);
assert.equal(accepted.memoryBytes,8000*1024);
assert.ok(target.startsWith(judgeUrl+"/submissions?"));
assert.equal(requestHeaders["X-Auth-Token"],"secret-token-fixture");
assert.equal(requestBody.enable_network,false);
assert.equal(requestBody.cpu_time_limit,2);
assert.equal(requestBody.wall_time_limit,5);
assert.equal(requestBody.memory_limit,262144);
assert.equal(requestBody.max_file_size,256);
assert.equal(requestBody.language_id,62);
for(const secret of ["PRIVATE CASE SECRET","PRIVATE ACTUAL VALUE","PRIVATE INPUT VALUE","PRIVATE EXPECTED VALUE"])
 assert.ok(!JSON.stringify(accepted).includes(secret),"Never return private judge outputs.");

const map=[
 [4,"wrong_answer"],[5,"time_limit_exceeded"],[6,"compile_error"],
 [7,"runtime_error"],[8,"runtime_error"],[9,"runtime_error"],[10,"runtime_error"],[11,"runtime_error"]
];
for(const [id,kind] of map){
 const instance=makePrivateJudge({url:judgeUrl,languageId:62,
  fetchImpl:async()=>statusResult(id)});
 const result=await instance.run(p.reference,p,cases);
 assert.equal(result.accepted,false);
 assert.equal(result.status,kind,"Judge0 status "+id+" must be classified correctly");
 for(const secret of ["PRIVATE CASE SECRET","PRIVATE ACTUAL VALUE","PRIVATE INPUT VALUE","PRIVATE EXPECTED VALUE"])
  assert.ok(!JSON.stringify(result).includes(secret));
}
const rejects=async(fetchImpl)=>assert.rejects(
 makePrivateJudge({url:judgeUrl,languageId:62,fetchImpl}).run(p.reference,p,cases),
 e=>e?.status===503&&!JSON.stringify(e).includes("PRIVATE INPUT VALUE")
);
for(const id of [1,2,12,13,77])await rejects(async()=>statusResult(id));
await rejects(async()=>new Response('{"status":',{headers:{"content-type":"application/json"}}));
await rejects(async()=>new Response('{}',{headers:{"content-type":"application/json"}}));
await rejects(async()=>new Response('x'.repeat(131073)));
await rejects(async()=>new Response('{}',{status:500}));
await rejects(async()=>{throw new Error("PRIVATE INPUT VALUE FROM PROVIDER");});
assert.equal(makePrivateJudge({url:"http://127.0.0.1:2358",languageId:62}).ready,false,
 "Only HTTPS configured trusted judge is allowed.");

const nonce="11111111-1111-4111-8111-111111111111";
const body={problemId:p.id,revision:1,language:"java",source:p.reference,nonce,shared:false};
for(const [errorKind] of [["time_limit_exceeded"],["compile_error"],["runtime_error"],["wrong_answer"]]){
 let records=0;
 const out=await submitSolution({
  owner:"verified-person",
  body,
  db:{
   existingSubmission:async()=>null,
   privateProblem:async()=>({content:p,revision:1,hidden:[...cases]}),
   claimOnlineRun:async()=>true,
   recordSubmission:async()=>{records++;throw new Error("Must not store a rejected run");}
  },
  privateJudge:{ready:true,run:async()=>({accepted:false,status:errorKind,message:"PRIVATE EXPECTED VALUE"})},
  benchmarkJudge:{run:()=>assert.fail("Never send hidden cases to benchmark while private judge is available")}
 });
 assert.equal(out.status,errorKind);
 assert.equal(records,0);
}
// External fallback remains configurable, but its rejection response never leaks
// the private test suite or provider diagnostics.
const external=await submitSolution({
 owner:"verified-person",body,
 db:{
  existingSubmission:async()=>null,privateProblem:async()=>({content:p,revision:1,hidden:[...cases]}),
  claimOnlineRun:async()=>true,recordSubmission:async()=>assert.fail("No rejected record")
 },privateJudge:{ready:false},allowExternalHiddenJudge:true,
 benchmarkJudge:{run:async(source,problem,allCases,lang)=>{
   assert.equal(lang,"java");
   assert.equal(allCases.length,cases.length+p.tests.length);
   return {accepted:false,status:"runtime_error",
    message:"PRIVATE EXPECTED VALUE",cases:[{expected:"PRIVATE EXPECTED VALUE"}]};
 }}
});
assert.equal(external.status,"runtime_error");
assert.ok(!JSON.stringify(external).includes("PRIVATE EXPECTED VALUE"));
assert.ok(!JSON.stringify(external).includes("cases"));

const errorFixture=new Response(JSON.stringify({status:"1",program_error:"NullPointerException"}));
const remoteRuntime=makeOnlineJudge({fetchImpl:async()=>errorFixture.clone()});
assert.equal((await remoteRuntime.run("x",p,cases,"python")).status,"runtime_error");
const remoteCompile=makeOnlineJudge({fetchImpl:async()=>new Response(JSON.stringify({
 status:"1",compiler_error:"SyntaxError"
}))});
assert.equal((await remoteCompile.run("x",p,cases,"python")).status,"compile_error");
const benchRuntime=makeBenchmarkJudge({
 makeNonce:()=>"fixednonce",
 fetchImpl:async()=>new Response(JSON.stringify({status:"1",program_error:"SIGSEGV"}))
});
assert.equal((await benchRuntime.run(p.reference,p,cases,"java")).status,"runtime_error");

// Access and size limits: untrusted clients may not forge another user's ID,
// bypass CORS, submit unauthenticated code or send megabyte-sized payloads.
let touches=0,compiles=0;
const mockHandler=createHandler({
 projectId:"fixture",
 allowedOrigins:["https://jagadeeshwaran-r.github.io"],
 verifyToken:async token=>{
  if(token!=="valid-token")throw new Error("Invalid signature");
  return{id:"firebase:fixture:legitimate"};
 },
 db:{
  touchAccount:async()=>{touches++;},
  publicProblem:async()=>({content:p,revision:1}),
  claimOnlineRun:async owner=>owner==="firebase:fixture:legitimate"
 },
 onlineJudge:{run:async()=>{compiles++;return {status:"ok",cases:[]};}}
});
const req=(payload,headers={})=>mockHandler(new Request("https://fixture.invalid/",{
 method:"POST",headers:{"content-type":"application/json",origin:"https://jagadeeshwaran-r.github.io",
 authorization:"Bearer valid-token",...headers},body:JSON.stringify(payload)
}));
const runData={action:"native-run",problemId:p.id,revision:1,language:"python",
 source:"print(1)",cases,user_id:"firebase:fixture:victim",admin:true,origin:"https://evil.invalid"};
assert.equal((await req(runData)).status,200);
assert.equal(compiles,1);
assert.equal((await req(runData,{authorization:"Bearer forged"})).status,401);
assert.equal((await req(runData,{origin:"https://evil.invalid"})).status,403);
assert.equal((await req({...runData,language:"sh"})).status,400);
assert.equal((await req({...runData,source:"x".repeat(60001)})).status,400);
assert.equal((await req({...runData,cases:[]})).status,400);
assert.equal((await req({...runData,cases:Array.from({length:109},()=>cases[0])})).status,400);
assert.equal(compiles,1,"Rejected submissions cannot call the compiler.");
assert.equal((await req({...runData,source:"x".repeat(1200001)})).status,413);

function filesUnder(root){
 const found=[];
 for(const entry of readdirSync(root,{withFileTypes:true})){
  const path=root+"/"+entry.name;
  if(entry.isDirectory())found.push(...filesUnder(path));
  else if(/\.(?:js|html|json|css)$/i.test(entry.name))found.push(path);
 }
 return found;
}
for(const file of filesUnder("dist")){
 const content=readFileSync(file,"utf8");
 assert.ok(!/\bsb_secret_[A-Za-z0-9_-]+/.test(content),file+" bundles a Supabase secret key.");
 assert.ok(!/\bSUPABASE_SERVICE_ROLE_KEY\s*=/.test(content),file+" bundles a service-role credential.");
 assert.ok(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content),file+" bundles a private key.");
}
const entry=readFileSync("supabase/functions/bytequest-firebase/index.ts","utf8");
assert.ok(entry.includes("verifyToken:token=>verifyFirebaseToken(token,{projectId})"));
const api=readFileSync("supabase/functions/bytequest-firebase/handler.js","utf8");
assert.ok(api.includes("Identity always comes from the verified Firebase token"));
console.log("PASS: private judge bounded/safe verdicts, hidden-data isolation, execution classification, auth/CORS/size safeguards and frontend secrets scan.");
