// Cross-layer HTTP contract tests with synthetic Firebase users, DB, and judges.
// Exercises the real ByteQuest Edge handler and native Angular request contracts.
// No network calls, production credentials, or live user/database mutations.
import assert from 'node:assert/strict';
import {createHandler} from '../supabase/functions/bytequest-firebase/handler.js';
import {makeJavaSubmission,verifiedJavaVerdict} from '../angular/src/app/core/java-submission-contract.ts';
import {validateProfileEdit} from '../angular/src/app/core/profile-edit-contract.ts';
import {sampleCreatorDraft,creatorWritePayload} from '../angular/src/app/core/creator-contract.ts';

const origin='https://bytequest-angular-staging.vercel.app';
const endpoint='https://stagingexample.supabase.co/functions/v1/bytequest-firebase';
const alice='firebase:fixture:alice',bob='firebase:fixture:bob';
const nonce1='11111111-1111-4111-8111-111111111111';
const nonce2='22222222-2222-4222-8222-222222222222';
const nonce3='33333333-3333-4333-8333-333333333333';
const secret='HIDDEN_EXPECTED_VALUE_MUST_STAY_PRIVATE';
const source='class Solution { public int[] twoSum(int[] nums,int target) {return new int[]{0,1};} }';
const problem={
 id:'two-sum',title:'Two Sum',difficulty:'Easy',topic:'Arrays',
 method:'twoSum',params:[{name:'nums',type:'int[]'},{name:'target',type:'int'}],
 returns:'int[]',revision:6,hiddenCount:1,
 tests:[{args:[[2,7],9],expected:[0,1],label:'Simple pair'},{args:[[3,3],6],expected:[0,1],label:'Duplicates'}]
};
const hidden=[{args:[[99,1],100],expected:[0,1],label:secret}];
const records=[],communityCalls=[],savedProblems=[],benchCalls=[],privateCalls=[];
let touches=0;
const db={
 maintenance:async()=>null,
 touchAccount:async()=>{touches++;},
 existingSubmission:async(owner,nonce)=>records.find(row=>row.owner===owner&&row.nonce===nonce)||null,
 privateProblem:async id=>id===problem.id?{content:problem,revision:6,hidden}:null,
 claimOnlineRun:async()=>true,
 recordSubmission:async(owner,data)=>{
  const id='aaaaaaaa-aaaa-4aaa-8aaa-'+String(records.length+1).padStart(12,'0');
  records.push({owner,id,nonce:data.nonce,problem_id:data.problemId,source:data.source,
   language:data.language,benchmark_version:data.benchmarkVersion,shared:data.shared,
   suite_kind:data.suiteKind});
  return{id,shared:data.shared,suite_kind:data.suiteKind};
 },
 reference:async(owner,id,revision)=>{
  if(!records.some(r=>r.owner===owner&&r.problem_id===id))
   throw new Error('Reference remains locked.');
  return{reference:source,revision};
 },
 community:async(owner,action,data)=>{
  communityCalls.push({owner,action,data});
  return{ok:true,action,owner};
 },
 saveProblem:async(problem,options)=>{
  savedProblems.push({problem,options});
  return{id:problem.id,revision:1,published:options.published};
 }
};
const benchmarkJudge={run:async(code,p,cases,language,opts)=>{
 assert.equal(language,'java');
 assert.equal(code,source);
 assert.equal(p.id,problem.id);
 assert.deepEqual(cases,problem.tests,'Public suite must not transmit hidden cases to browser/benchmark');
 assert.equal(opts.publicCasesOnly,true);
 benchCalls.push({count:cases.length});
 return{accepted:true,status:'accepted',passed:cases.length,total:cases.length,
  runtimeMs:4,compiler:'fixture-java'};
}};
const privateJudge={ready:true,run:async(code,p,cases)=>{
 assert.equal(code,source);
 assert.equal(p.id,problem.id);
 assert.equal(cases.length,3,'Private judge receives public and hidden suite');
 privateCalls.push(cases.length);
 return{accepted:true,status:'accepted',runtimeMs:5,memoryBytes:1000,
  message:'Full suite accepted.'};
}};
const handler=createHandler({projectId:'fixture',allowedOrigins:[origin],
 verifyToken:async token=>{
  if(token==='alice')return{id:alice,email:'alice@example.test'};
  if(token==='bob')return{id:bob,email:'bob@example.test'};
  throw new Error('Invalid bearer token');
 },db,benchmarkJudge,privateJudge});
const post=(action,body={},token='alice',requestOrigin=origin)=>handler(new Request(endpoint,{
 method:'POST',headers:{Origin:requestOrigin,Authorization:'Bearer '+token,
  'Content-Type':'application/json'},body:JSON.stringify({...body,action})
}));
const expectStatus=async(response,status)=>{const payload=await response.json();
 assert.equal(response.status,status,JSON.stringify(payload));return payload;};

assert.equal((await post('self',{},'invalid')).status,401,'Forged Firebase auth must be rejected');
assert.equal((await post('self',{},'alice','https://untrusted.invalid')).status,403,
 'Unknown website origin must never reach database');
assert.equal(touches,0,'Preflight/auth rejections must not touch the database');
const publicRequest=makeJavaSubmission(problem,source,'public',nonce1);
const first=await expectStatus(await post('submission-create',publicRequest),200);
assert.equal(verifiedJavaVerdict(first,'public').accepted,true);
assert.equal(first.verificationScope,'public');
assert.equal(records.length,1);
assert.equal(records[0].owner,alice);
assert.equal(records[0].shared,true,'Default accepted public solution must be shared');
assert.equal(records[0].benchmark_version,'bq-public-only-v1');
assert.equal(benchCalls.length,1);
assert.ok(!JSON.stringify(first).includes(secret),'Public submission response leaked a hidden test');

const retry=await expectStatus(await post('submission-create',publicRequest),200);
assert.equal(verifiedJavaVerdict(retry,'public').accepted,true);
assert.equal(records.length,1,'Same nonce must be idempotent');
assert.equal((await post('submission-create',{...publicRequest,source:source+'//changed'})).status,409,
 'Reusing nonce for changed source must fail');
const wrongScope={...publicRequest,scope:'complete',nonce:nonce2};
const full=await expectStatus(await post('submission-create',wrongScope),200);
assert.equal(verifiedJavaVerdict(full,'complete').accepted,true);
assert.equal(records.length,2);
assert.equal(records[1].suite_kind,'private');
assert.equal(privateCalls.length,1);
assert.equal(verifiedJavaVerdict(full,'public').accepted,false);
assert.ok(!JSON.stringify(full).includes(secret),'Full submission response leaked a hidden test');
const locked=await post('reference-read',{problemId:problem.id,revision:6},'bob');
assert.notEqual(locked.status,200,'Another account must not inherit Alice\'s editorial unlock');
const unlocked=await expectStatus(await post('reference-read',{problemId:problem.id,revision:6}),200);
assert.equal(unlocked.reference,source);

const form=validateProfileEdit({
 username:' alice_dev ',display_name:' Alice ',bio:'Learning Java',avatar_url:'',
 discoverable:true,show_presence:false,organization_type:'',organization_name:'',
 organization_url:'',linkedin_url:'',github_url:'https://github.com/example'
});
assert.equal((await post('profile-save',{...form,owner_id:bob})).status,200);
assert.deepEqual(communityCalls.at(-1),{owner:alice,action:'profile-save',
 data:communityCalls.at(-1).data});
assert.equal(communityCalls.at(-1).data.username,'alice_dev');
assert.equal(communityCalls.at(-1).data.show_presence,false);
const peer='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
assert.equal((await post('chat-send',{target:peer,body:'Hello teammate',nonce:nonce3,owner_id:bob})).status,200);
assert.equal(communityCalls.at(-1).owner,alice);
assert.equal(communityCalls.at(-1).data.body,'Hello teammate');
assert.equal((await post('chat-send',{target:peer,body:'',nonce:nonce3})).status,400,
 'Blank messages must fail validation');
const creator=creatorWritePayload(sampleCreatorDraft);
const published=await post('studio-save',{...creator,owner_id:bob});
assert.equal(published.status,200,'Native Studio payload must match real publishing handler: '+await published.text());
assert.equal(savedProblems.length,1);
assert.equal(savedProblems[0].options.owner,alice);
assert.equal(savedProblems[0].options.published,false);
assert.equal(savedProblems[0].options.hidden.length,1);
assert.equal(savedProblems[0].problem.hiddenCount,1);
console.log('PASS synthetic authenticated HTTP: public/full Java acceptance, idempotency, private case confidentiality, reference authorization, profile, chat, Studio, CORS and identity binding; no live writes');
