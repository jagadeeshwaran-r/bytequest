import assert from 'node:assert/strict';
import {makeBenchmarkJudge} from '../supabase/functions/bytequest-firebase/benchmark.js';
import {submitSolution} from '../supabase/functions/bytequest-firebase/submissions.js';

const cases=[
 {args:[[1,2,3,1]],expected:true,label:'Duplicate'},
 {args:[[1,2,3]],expected:false,label:'Distinct'}
];
const p={id:'contains-duplicate',revision:2,method:'containsDuplicate',params:[{name:'nums',type:'int[]'}],returns:'boolean',tests:cases};
const code='class Solution { boolean containsDuplicate(int[] a) { return true; } }';
const output=[
 '__BYTEQUEST_CASE_0__{"ok":true,"actual":true}',
 '__BYTEQUEST_CASE_1__{"ok":true,"actual":false}',
 '__BYTEQUEST_BENCH_fixed__{"runtimeMs":4.2,"memoryBytes":12000000}'
].join('\n');
const mk=(fetchImpl)=>makeBenchmarkJudge({makeNonce:()=> 'fixed',fetchImpl,wait:async()=>{}});
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
let called=0;
const primary=mk(async(url,request)=>{
 called++;
 assert.match(String(url),/^https:\/\/ce\.judge0\.com\/submissions/);
 const body=JSON.parse(request.body);
 assert.equal(body.language_id,91);
 assert.equal(body.enable_network,false);
 assert.match(body.source_code,/public class Main \{/);
 assert.match(body.source_code,/class Solution/);
 assert.ok(!body.source_code.includes('SECRET_PRIVATE_CASE'));
 return json({status:{id:3},stdout:output,token:'36b530a4-4a84-4a83-bc11-0a0dbdeaf60d'});
});
const accepted=await primary.run(code,p,cases,'java',{publicCasesOnly:true});
assert.equal(called,1);
assert.equal(accepted.accepted,true);
assert.equal(accepted.compiler,'judge0-java-17');
assert.equal(accepted.benchmarkVersion,'bq-judge0-public-v1');
assert.equal(accepted.passed,2);
assert.equal(accepted.total,2);
let wrongCalls=0;
const wrong=await mk(async()=>{wrongCalls++;return json({status:{id:3},stdout:output.replace('"actual":false','"actual":true')});})
 .run(code,p,cases,'java',{publicCasesOnly:true});
assert.equal(wrong.status,'wrong_answer');
assert.equal(wrongCalls,1,'A real wrong answer must not trigger a second execution service');
let fallbackCalls=0;
const fallback=await mk(async(url,request)=>{
 fallbackCalls++;
 if(String(url).includes('judge0'))return new Response('busy',{status:500});
 assert.match(String(url),/wandbox\.org/);
 return json({status:'0',program_output:output,signal:null});
}).run(code,p,cases,'java',{publicCasesOnly:true});
assert.equal(fallback.accepted,true);
assert.equal(fallback.compiler,'openjdk-jdk-21+35');
assert.equal(fallbackCalls,2);
let hiddenTransport='';
const hidden=await mk(async(url,request)=>{
 hiddenTransport=String(url);
 return json({status:'0',program_output:output,signal:null});
}).run(code,p,[...cases,{args:[[99]],expected:false,label:'SECRET_PRIVATE_CASE'}],'java');
assert.match(hiddenTransport,/wandbox\.org/,'The alternate demo judge must never receive hidden-case submissions');
assert.equal(hidden.status,'runtime_error','A mismatched suite must never be counted as accepted');
const privateCases=[...cases,{args:[[99]],expected:false,label:'SECRET_PRIVATE_CASE'}];
const privateDb={existingSubmission:async()=>null,
 privateProblem:async()=>({revision:2,content:{...p,hiddenCount:1},hidden:[privateCases.at(-1)]}),
 claimOnlineRun:async()=>true,recordSubmission:async()=>assert.fail('Cannot save without a trusted private verdict')};
await assert.rejects(
 ()=>submitSolution({owner:'someone',body:{problemId:p.id,revision:2,language:'java',source:code,
 nonce:'1cdd911e-e1a8-49c2-8f48-d95b7d933c9c',shared:false},db:privateDb,
 benchmarkJudge:{run:async()=>assert.fail('Hidden cases must not call public judge')},privateJudge:{ready:false}}),
 /requires a configured private Java judge/);
let recorded;
const userResult=await submitSolution({owner:'someone',
 body:{problemId:p.id,revision:2,language:'java',source:code,nonce:'1cdd911e-e1a8-49c2-8f48-d95b7d933c9c',shared:true,scope:'public'},
 db:{...privateDb,recordSubmission:async(_owner,row)=>{recorded=row;return{id:'receipt-1'};}},
 benchmarkJudge:mk(async()=>json({status:{id:3},stdout:output})),privateJudge:{ready:false}});
assert.equal(userResult.accepted,true);
assert.equal(userResult.verificationScope,'public');
assert.equal(recorded.shared,false);
assert.equal(recorded.benchmarkVersion,'bq-public-only-v1');
assert.equal(recorded.suiteKind,'public');
assert.equal(recorded.testCount,2);
console.log('PASS: Judge0 alternate Java execution, Wandbox failover, rejected answers and strict hidden-test isolation.');
