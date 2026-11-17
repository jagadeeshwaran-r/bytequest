import assert from 'node:assert/strict';
import {makePrivateJudge} from '../supabase/functions/bytequest-firebase/private-judge.js';
import {submitSolution} from '../supabase/functions/bytequest-firebase/submissions.js';

const judgeUrl='https://trusted-judge.example.invalid/';
const token='aabbccdd-1111-4111-8111-112233445566';
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
const lower={
 id:'lower-bound',title:'Lower Bound',method:'lowerBound',returns:'int',
 params:[{name:'nums',type:'int[]'},{name:'target',type:'int'}],
 tests:[{args:[[1,3,5],4],expected:2,label:'middle insertion'}]
};
const lowerSource='class Solution { int lowerBound(int[] nums,int target) { int lo=0,hi=nums.length;while(lo<hi){int mid=(lo+hi)>>>1;if(nums[mid]<target)lo=mid+1;else hi=mid;}return lo;} }';
const palindrome={
 id:'linked-list-palindrome',title:'Palindrome Linked List',method:'isPalindrome',returns:'boolean',
 params:[{name:'head',type:'ListNode'}],
 tests:[{args:[[1,2,1]],expected:true,label:'odd palindrome'}]
};
const palindromeSource='class Solution { boolean isPalindrome(ListNode head) { return true; } }';
const hidden=[{args:[[1,2,3,2,1]],expected:true,label:'PRIVATE INPUT'}];
let requests=[],reads=0,clock=1000;
const trusted=makePrivateJudge({url:judgeUrl,languageId:62,apiKey:'test-only-secret',now:()=>clock,
 wait:async ms=>{clock+=ms;},fetchImpl:async(url,options)=>{
  requests.push({url:String(url),method:options.method||'GET',headers:options.headers,body:options.body});
  if(options.method==='POST')return reply({token});
  reads++;
  if(reads<3)return reply({status:{id:reads}});
  return reply({status:{id:3},time:'0.035',memory:6500,stdout:'PRIVATE ACTUAL',compile_output:'PRIVATE EXPECTED'});
}});
assert.equal(trusted.ready,true);
const publicVerdict=await trusted.run(lowerSource,lower,lower.tests,{visibility:'public'});
assert.equal(publicVerdict.accepted,true);
assert.equal(publicVerdict.status,'accepted');
assert.equal(publicVerdict.passed,1);
assert.equal(publicVerdict.total,1);
assert.equal(publicVerdict.hiddenCount,0);
assert.equal(publicVerdict.runtimeMs,35);
assert.equal(publicVerdict.memoryBytes,6500*1024);
assert.ok(requests[0].url.endsWith('/submissions?base64_encoded=false'));
assert.ok(!requests[0].url.includes('wait=true'),'Do not use Judge0 blocking wait=true');
assert.ok(requests.slice(1).every(req=>req.url.includes('fields=status,time,memory')),'Do not fetch private stdout while polling');
assert.ok(requests.every(req=>req.headers['X-Auth-Token']==='test-only-secret'));
assert.equal(JSON.parse(requests[0].body).enable_network,false);
assert.ok(JSON.parse(requests[0].body).source_code.includes('new Solution().lowerBound('));
assert.ok(!JSON.stringify(publicVerdict).includes('PRIVATE'));
assert.equal(reads,3);

let recorded=0,benchmarked=0,visibilityArg,caseCount;
const body=(p,src)=>({
 problemId:p.id,revision:2,language:'java',source:src,
 nonce:'11111111-1111-4111-8111-111111111111',shared:false
});
const dbFor=(problem,privateCases=[])=>({
 existingSubmission:async()=>null,
 privateProblem:async()=>({content:problem,revision:2,hidden:privateCases}),
 claimOnlineRun:async()=>true,
 recordSubmission:async(owner,data)=>{recorded++;return {id:recorded,compiler:data.compiler,test_count:data.testCount};}
});
const judgeStub={
 ready:true,
 run:async(source,problem,cases,options)=>{
  visibilityArg=options.visibility;caseCount=cases.length;
  return {accepted:true,status:'accepted',runtimeMs:4,memoryBytes:2000000,message:'Accepted'};
 }
};
const unusedBenchmark={run:async()=>{benchmarked++;throw new Error('Dedicated Java judge should be preferred');}};
const lowResult=await submitSolution({
 owner:'verified',body:body(lower,lowerSource),db:dbFor(lower),
 privateJudge:judgeStub,benchmarkJudge:unusedBenchmark
});
assert.equal(lowResult.accepted,true);
assert.equal(lowResult.compiler,'trusted-private-java');
assert.equal(lowResult.passed,1);
assert.equal(lowResult.total,1);
assert.equal(visibilityArg,'public');
assert.equal(caseCount,1);
assert.equal(benchmarked,0);

const linkedResult=await submitSolution({
 owner:'verified',body:body(palindrome,palindromeSource),db:dbFor(palindrome,hidden),
 privateJudge:judgeStub,benchmarkJudge:unusedBenchmark
});
assert.equal(linkedResult.accepted,true);
assert.equal(visibilityArg,'private');
assert.equal(caseCount,2);
assert.equal(benchmarked,0);
assert.equal(recorded,2);

const forbidden={ready:true,run:async()=>({accepted:false,status:'wrong_answer',message:'Hidden inputs remain private'})};
const bad=await submitSolution({
 owner:'verified',body:body(palindrome,palindromeSource),db:dbFor(palindrome,hidden),
 privateJudge:forbidden,benchmarkJudge:unusedBenchmark
});
assert.equal(bad.accepted,false);
assert.equal(recorded,2,'Rejected submissions must never be recorded');

// Without a trusted judge the existing Wandbox route remains available for
// public problems: this PR never requires a new server for ordinary practice.
let fallback=0;
const legacy=await submitSolution({
 owner:'verified',body:body(lower,lowerSource),db:dbFor(lower),
 privateJudge:{ready:false},benchmarkJudge:{run:async()=>{fallback++;return {
 accepted:true,status:'accepted',runtimeMs:5,memoryBytes:2000000,
 compiler:'openjdk-jdk-21+35',benchmarkVersion:'bq-v2-single-pass',total:1
 };}}
});
assert.equal(legacy.accepted,true);
assert.equal(fallback,1);

// For a configured trusted judge, do not accidentally send hidden cases to
// the public compiler even if a hidden-suite submission failed.
assert.equal(benchmarked,0);

// Reject queued results that exceed the deadline, without exposing the
// provider's output or recording a fabricated wrong answer.
let timeoutClock=0;
const stuck=makePrivateJudge({url:judgeUrl,languageId:62,now:()=>timeoutClock,
 wait:async ms=>{timeoutClock+=ms;},
 fetchImpl:async(url,options)=>options.method==='POST'?reply({token}):reply({status:{id:2},stdout:'PRIVATE INPUT'})
});
await assert.rejects(stuck.run(lowerSource,lower,lower.tests),
 error=>error.status===503&&!JSON.stringify(error).includes('PRIVATE INPUT'));
console.log('PASS: dedicated Java route for public and hidden cases, non-blocking Judge0 polling, bounded deadline and private-output isolation.');
