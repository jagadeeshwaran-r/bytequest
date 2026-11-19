import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {submitSolution,validateSubmission} from '../supabase/functions/bytequest-firebase/submissions.js';

const problem={id:'battery-full-arrivals',revision:4,hiddenCount:70,
 tests:[{args:[5,[3,4,0,-2,5,-6,6]],expected:3,label:'Published case'}]};
const hidden=[{args:[1,[1]],expected:1,label:'DO_NOT_SEND_PRIVATE_TEST'}];
const source='class Solution { public int countFullArrivals(int c,int[] a) {return 3;} }';
const nonce='1cdd911e-e1a8-49c2-8f48-d95b7d933c9c';
const base={problemId:problem.id,revision:4,language:'java',
 nonce,source,scope:'public',shared:true,showcase:true};
assert.equal(validateSubmission(base).shared,true,'New client explicitly requests public showcase');
assert.equal(validateSubmission({...base,showcase:undefined}).shared,false,
 'Older cached clients must keep their previous private-public-test promise.');
assert.equal(validateSubmission({...base,showcase:true,shared:false}).shared,false,
 'Both flags are necessary to publish a public-only accepted result.');
assert.throws(()=>validateSubmission({...base,showcase:'true'}),/public-showcase setting/);

const makeDb=()=>({
 existingSubmission:async()=>null,
 privateProblem:async()=>({content:problem,revision:4,hidden}),
 claimOnlineRun:async()=>true,
 recordSubmission:async(_,row)=>({...row,id:'recorded',suite_kind:row.suiteKind,shared:row.shared})
});
for(const compiler of ['judge0-java-17','openjdk-jdk-21+35']){
 let saved=null;
 const db={...makeDb(),recordSubmission:async(_,row)=>{saved=row;return{id:'accepted-receipt',shared:row.shared};}};
 const judge={run:async(_code,_problem,cases,lang,options)=>{
  assert.deepEqual(cases,problem.tests,'Published public cases only; never send hidden inputs');
  assert.equal(lang,'java');assert.equal(options.publicCasesOnly,true);
  return {accepted:true,status:'accepted',compiler,benchmarkVersion:'bq-judge0-public-v1',
   total:1,passed:1,runtimeMs:10,memoryBytes:123456,memoryMetric:'process_peak_rss'};
 }};
 const result=await submitSolution({owner:'showcase-user',body:base,db,benchmarkJudge:judge,privateJudge:{ready:false}});
 assert.equal(result.accepted,true);
 assert.equal(result.verificationScope,'public');
 assert.equal(saved.shared,true,'Provider '+compiler+' must not force public accepted solutions private');
 assert.equal(saved.suiteKind,'public');
 assert.equal(saved.benchmarkVersion,'bq-public-only-v1','Keep public-only out of private-suite leaderboards');
 assert.equal(saved.testCount,1);
 assert.match(result.message,/public-test community showcase/);
 assert.match(result.message,/hidden cases were NOT checked/i);
}
let legacyStored=null;
await submitSolution({owner:'legacy-user',body:{...base,showcase:undefined},db:{
 ...makeDb(),recordSubmission:async(_,row)=>{legacyStored=row;return{id:'legacy',shared:row.shared};}
},benchmarkJudge:{run:async()=>({accepted:true,status:'accepted',compiler:'judge0-java-17',total:1})},privateJudge:{ready:false}});
assert.equal(legacyStored.shared,false,'Legacy clients must not silently expose old users code');

let writes=0;
const failed=await submitSolution({owner:'bad-answer',body:base,db:{
 ...makeDb(),recordSubmission:async()=>{writes++;return{};}
},benchmarkJudge:{run:async()=>({accepted:false,status:'wrong_answer',passed:0,total:1})},privateJudge:{ready:false}});
assert.equal(failed.accepted,false);
assert.equal(writes,0,'Failed submissions never join showcase');

const dialog=readFileSync('dist/submissions.js','utf8');
const app=readFileSync('dist/app.js','utf8');
assert.ok(!dialog.includes('name="shared" type="checkbox"'),'New submission dialog has no private toggle');
assert.match(dialog,/shared:true,showcase:true/,'The ordinary submit button publishes after acceptance');
assert.match(dialog,/Accepted code and your public profile/,'Public showcase is disclosed before submission');
assert.match(app,/scope:"public",shared:true,showcase:true/,'Private-judge fallback must offer public showcase');
assert.match(app,/scope:'public',nonce:options.nonce\|\|crypto.randomUUID\(\),shared:true,showcase:true/);
assert.match(dialog,/Publish earlier accepted solution/,'Previously private work requires explicit owner publishing');
assert.match(dialog,/data-publish-earlier/,'The public board offers one-click publish for previously private results');
console.log('PASS: Java accepted solutions publicly showcased by default, full/public ranks isolated, legacy privacy and failed verdicts preserved.');
