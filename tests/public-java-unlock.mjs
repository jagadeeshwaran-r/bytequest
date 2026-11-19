import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {submitSolution,validateSubmission} from '../supabase/functions/bytequest-firebase/submissions.js';
import {submissionFeedback} from '../dist/submission-feedback.js';

const problem={id:'notebook-underline-counter',revision:4,
 method:'countUnderlines',params:[{name:'text',type:'String'}],returns:'int',
 hiddenCount:70,tests:[
  {args:['hello'],expected:0,label:'No underline'},
  {args:['a_b'],expected:1,label:'One underline'}]};
const hidden=[{args:['secret'],expected:42}];
const source='class Solution { int countUnderlines(String s) { return 0; } }';
const nonce='1cdd911e-e1a8-49c2-8f48-d95b7d933c9c';
const base={problemId:problem.id,revision:problem.revision,source,
 language:'java',nonce,shared:true,scope:'public'};
const fields=validateSubmission(base);
assert.equal(fields.scope,'public');
assert.equal(fields.shared,false,'Public-only acceptance cannot accidentally publish unverified hidden-suite code');
assert.throws(()=>validateSubmission({...base,scope:'hidden'}),/valid verification scope/);
assert.throws(()=>validateSubmission({...base,language:'cpp'}),/currently supports Java/);
let calls=0,saved=null,submissions=0;
const db={
 existingSubmission:async()=>null,
 privateProblem:async()=>({content:problem,revision:4,hidden}),
 claimOnlineRun:async()=>true,
 recordSubmission:async(owner,data)=>{submissions++;saved=data;return{id:'receipt-1',suite_kind:data.suiteKind,shared:data.shared};}
};
const benchmarkJudge={run:async(code,p,cases,lang)=>{
 calls++;
 assert.equal(code,source);
 assert.equal(p.id,problem.id);
 assert.equal(lang,'java');
 assert.deepEqual(cases,problem.tests,'Never send private hidden cases to the public compiler');
 return {accepted:true,status:'accepted',passed:2,total:2,runtimeMs:4,memoryBytes:8000,
  compiler:'openjdk-jdk-21+35',benchmarkVersion:'bq-v2-single-pass'};
}};
const args={owner:'learner-1',body:base,db,benchmarkJudge,privateJudge:{ready:false}};
const accepted=await submitSolution(args);
assert.equal(accepted.accepted,true);
assert.equal(accepted.verificationScope,'public');
assert.equal(accepted.submission.suite_kind,'public');
assert.equal(saved.shared,false);
assert.equal(saved.suiteKind,'public');
assert.equal(saved.benchmarkVersion,'bq-public-only-v1','Do not enter private/full verified rankings');
assert.equal(saved.testCount,2);
assert.match(accepted.message,/Private hidden cases were NOT checked/);
assert.equal(submissionFeedback(accepted).title,'Public tests accepted');
assert.equal(calls,1);
assert.equal(submissions,1);
await assert.rejects(
 ()=>submitSolution({...args,body:{...base,scope:'complete'}}),
 /requires a configured private Java judge/,
 'Full verification must still refuse to pretend hidden cases passed');
let failedRecords=0;
const failedDb={...db,recordSubmission:async()=>{failedRecords++;return{};}};
const failed=await submitSolution({...args,db:failedDb,benchmarkJudge:{run:async()=>({accepted:false,status:'wrong_answer',passed:1,total:2})}});
assert.equal(failed.accepted,false);
assert.equal(failed.verificationScope,'public');
assert.equal(failedRecords,0,'A public test failure must not unlock anything');
await assert.rejects(()=>submitSolution({...args,db:{...db,privateProblem:async()=>({content:problem,revision:5,hidden})}}),
 /This problem changed/,'An older revision must not unlock a newer problem');

const app=readFileSync('dist/app.js','utf8');
const dialog=readFileSync('dist/submissions.js','utf8');
const gate=readFileSync('dist/editorial-access.js','utf8');
const sql=readFileSync('database/submissions-bq-v2-visibility.sql','utf8');
const backend=readFileSync('supabase/functions/bytequest-firebase/database.js','utf8');
assert.match(app,/scope:'public',nonce:options.nonce\|\|crypto.randomUUID\(\),shared:true,showcase:true/,'New public mode joins showcase; legacy request remains private when not marked');
assert.ok(!app.includes("await run(true,{forceBrowser:true,sourceOverride:source})"),'Never silently treat browser practice as verified unlock');
assert.ok(dialog.includes('Submit public tests →'));
assert.ok(dialog.includes("result=collect(publicDefault?'public':'complete')"),'Primary submit must not silently request hidden cases');
assert.ok(gate.includes('Sign in and pass public tests to unlock'),'The small Java-answer hint must preserve the acceptance requirement');
assert.ok(backend.includes('bytequest_submissions'),'Server-managed accepted receipt is the reference unlock authority');
assert.ok(sql.includes("s.benchmark_version in ('bq-v1','bq-v2-single-pass','bq-private-v1')"),
 'Public-only hidden-suite submissions must not be eligible for full-suite rankings');
console.log('PASS: authenticated Java public-suite unlock, no hidden leakage, no false rankings, no unlock on failed or stale tests.');
