import assert from 'node:assert/strict';
import {createDatabase} from '../supabase/functions/bytequest-firebase/database.js';
import {submitSolution} from '../supabase/functions/bytequest-firebase/submissions.js';
import {problems} from '../dist/problems.js';

const problem=problems[0];
const publicCase=problem.tests[0];
const makeBody=(language='java')=>({
  problemId:problem.id,revision:1,language,
  source:problem.reference,nonce:'11111111-1111-4111-8111-111111111111',shared:false
});
const accepted={
  accepted:true,status:'accepted',runtimeMs:1.5,memoryBytes:1024000,
  total:problem.tests.length,compiler:'fixture',benchmarkVersion:'test'
};
function fakeDB(hidden=[]){
  const saved=[];
  return {
    saved,db:{
      existingSubmission:async()=>null,
      privateProblem:async()=>({content:{...problem,hiddenCount:hidden.length},revision:1,hidden}),
      claimOnlineRun:async()=>true,
      recordSubmission:async(owner,data)=>{saved.push({owner,...data});return{id:'new-accepted'};}
    }
  };
}

// Java public submissions use the trusted server-owned suite when the judge
// is configured: no remote Wandbox request or browser-supplied verdict.
{
  const {saved,db}=fakeDB();
  let remote=0,trusted=0;
  const result=await submitSolution({
    owner:'verified',body:makeBody(),db,privateJudge:{ready:true,run:async(source,p,cases)=>{
      trusted++;assert.equal(source,problem.reference);assert.equal(p.id,problem.id);
      assert.deepEqual(cases,problem.tests);
      return {...accepted,compiler:'trusted-private-java'};
    }},benchmarkJudge:{run:async()=>{remote++;throw Error('Wandbox must not run when the trusted Java judge is ready');}}
  });
  assert.equal(result.accepted,true);
  assert.equal(trusted,1);
  assert.equal(remote,0);
  assert.equal(saved.length,1);
  assert.equal(saved[0].suiteKind,'public');
  assert.equal(saved[0].compiler,'trusted-private-java');
  assert.equal(saved[0].benchmarkVersion,'bq-private-v1');
}
// Hidden cases never go to the browser or public compiler and still require
// a trusted judge (or an existing explicit external fallback).
{
  const hidden=[{args:publicCase.args,expected:publicCase.expected}];
  const {saved,db}=fakeDB(hidden);
  const result=await submitSolution({
    owner:'verified',body:makeBody(),db,privateJudge:{ready:true,run:async(src,p,cases)=>{
      assert.deepEqual(cases,[...problem.tests,...hidden]);return accepted;
    }},benchmarkJudge:{run:async()=>assert.fail('Hidden cases must stay private')}
  });
  assert.equal(result.accepted,true);
  assert.equal(saved[0].suiteKind,'private');
}
// Without a trusted judge, Java public submissions retain the current
// provider. Python/C/C++ also retain their existing path.
for(const language of ['java','python','c','cpp']){
  const {db}=fakeDB();
  let used=0;
  const result=await submitSolution({
    owner:'verified',body:makeBody(language),db,
    privateJudge:{ready:language==='java'?false:true,run:async()=>assert.fail('Non-Java cannot use trusted Java judge')},
    benchmarkJudge:{run:async(source,p,cases,actualLanguage)=>{
      used++;assert.equal(actualLanguage,language);return accepted;
    }}
  });
  assert.equal(result.accepted,true);
  assert.equal(used,1,language+' must retain public compiler path');
}
// An unavailable trusted judge cannot be converted to an accepted public
// submission without server execution and verification.
{
  const {saved,db}=fakeDB();
  await assert.rejects(()=>submitSolution({
    owner:'verified',body:makeBody(),db,
    privateJudge:{ready:true,run:async()=>{throw Object.assign(new Error('unavailable'),{status:503});}},
    benchmarkJudge:{run:async()=>assert.fail('Do not silently downgrade a failing trusted judge')}
  }),error=>error.status===503);
  assert.equal(saved.length,0);
}

// Both DB reads must be in flight before either is released.
{
  const seen=new Set();
  let release;
  const together=new Promise(resolve=>release=resolve);
  const db=createDatabase('https://fixture.supabase.co','test-service-only-key',{
    fetchImpl:async url=>{
      const pathname=new URL(url).pathname;
      let value;
      if(pathname.endsWith('/bytequest_problems')){
        seen.add('public');value=[{content:problem,revision:1}];
      }else if(pathname.endsWith('/bytequest_problem_private')){
        seen.add('private');value=[{hidden_tests:[publicCase]}];
      }else throw new Error('Unexpected DB request '+pathname);
      if(seen.size===2)release();
      await together;
      return new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
    }
  });
  const finished=Promise.race([
    db.privateProblem(problem.id),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('DB reads were sequential')),2000))
  ]);
  const loaded=await finished;
  assert.deepEqual([...seen].sort(),['private','public']);
  assert.equal(loaded.revision,1);
  assert.deepEqual(loaded.hidden,[publicCase]);
}
console.log('PASS: Java trusted-judge fast path, safe fallbacks, accepted suite metadata and concurrent public/private DB reads.');
