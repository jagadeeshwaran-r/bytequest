import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blankProgress,validateProgress,mergeProgress,MAX_PRACTICE_SUBMISSIONS,MAX_PRACTICE_SOURCE,MAX_PRACTICE_BYTES} from '../dist/progress.js';
import {createPracticeSubmission,addPracticeSubmission,recentPracticeSubmissions} from '../dist/practice-history.js';
import {validateProgress as serverValidateProgress} from '../supabase/functions/bytequest-firebase/domain/progress.js';

const problem={id:'even-weight-distribution',revision:2,hiddenCount:7};
const oldProblem={id:'lower-bound',revision:0,hiddenCount:0};
const code='class Solution { int run() { return 1; } }';
const attempt=(p,at,status='practice_accepted',id=crypto.randomUUID())=>
 createPracticeSubmission({problem:p,source:code,status,
  passed:status==='practice_accepted'?3:1,total:3,elapsedMs:42.5,now:at,id,customCount:1});
const original=blankProgress();
assert.deepEqual(original.practiceSubmissions,[]);
const a=attempt(problem,1800000000000);
const b=attempt(problem,1800000001500,'wrong_answer');
const local=structuredClone(original);
local.practiceSubmissions=addPracticeSubmission(local,a);
local.practiceSubmissions=addPracticeSubmission(local,b);
const clean=validateProgress(local);
assert.deepEqual(clean.practiceSubmissions,[a,b]);
assert.deepEqual(serverValidateProgress(local).practiceSubmissions,[a,b],
  'The deployed validator must preserve browser submission history');
assert.deepEqual(recentPracticeSubmissions(clean,problem.id).map(x=>x.id),[b.id,a.id]);
assert.equal(recentPracticeSubmissions(clean,'middle-of-linked-list').length,0);
assert.equal(recentPracticeSubmissions(clean,oldProblem.id).length,0);

const remote=blankProgress();
const newlyPublished=attempt({id:'middle-of-linked-list',revision:3,hiddenCount:0},1800000003000);
remote.practiceSubmissions=[newlyPublished];
const merged=mergeProgress(local,remote);
assert.deepEqual(merged.practiceSubmissions.map(x=>x.id),[a.id,b.id,newlyPublished.id]);
assert.deepEqual(mergeProgress(merged,remote).practiceSubmissions,merged.practiceSubmissions,
  'Repeated cross-device merge cannot duplicate accepted attempts');
assert.deepEqual(mergeProgress(remote,local).practiceSubmissions,merged.practiceSubmissions,
  'Offline/online merge should be order independent');
assert.equal(serverValidateProgress(merged).practiceSubmissions.length,3);
assert.equal(merged.solved[problem.id],undefined,'Recording practice history never grants a solve');
const sameRevision=attempt(problem,1800000004000);
merged.practiceSubmissions=addPracticeSubmission(merged,sameRevision);
assert.equal(recentPracticeSubmissions(merged,problem.id).length,3,'Repeat attempts must be stored');

const huge=createPracticeSubmission({problem,source:'x'.repeat(60000),status:'compile_error',
 passed:0,total:2,id:crypto.randomUUID()});
assert.equal(huge.source.length,MAX_PRACTICE_SOURCE);
assert.equal(huge.sourceTruncated,true);
const tampered={...a,verified:true,shared:true,language:'java',runtime_ms:0,hiddenTests:[{}]};
const sanitized=validateProgress({...blankProgress(),practiceSubmissions:[tampered]}).practiceSubmissions[0];
assert.ok(sanitized);
assert.equal(sanitized.verified,undefined);
assert.equal(sanitized.shared,undefined);
assert.equal(sanitized.hiddenTests,undefined);
assert.equal(validateProgress({...blankProgress(),practiceSubmissions:[{...a,language:'cpp'}]}).practiceSubmissions.length,0);
assert.equal(validateProgress({...blankProgress(),practiceSubmissions:[{...a,problemId:'NOT-VALID'}]}).practiceSubmissions.length,0);

const many=Array.from({length:MAX_PRACTICE_SUBMISSIONS+10},(_,i)=>attempt(problem,1800000100000+i*10));
const capped=validateProgress({...blankProgress(),practiceSubmissions:many}).practiceSubmissions;
assert.equal(capped.length,MAX_PRACTICE_SUBMISSIONS);
assert.equal(capped[0].id,many[10].id);
assert.equal(capped.at(-1).id,many.at(-1).id);
assert.deepEqual(recentPracticeSubmissions({practiceSubmissions:capped},problem.id).length,25);
assert.ok(JSON.stringify({...blankProgress(),practiceSubmissions:Array.from({length:MAX_PRACTICE_SUBMISSIONS},(_,i)=>
  createPracticeSubmission({problem,source:'x'.repeat(MAX_PRACTICE_SOURCE),status:'practice_accepted',
   passed:1,total:1,now:1800000010000+i}))}).length<980000,
 'Bound the synced payload under the existing one-megabyte database limit');

const unicodeRows=Array.from({length:MAX_PRACTICE_SUBMISSIONS},(_,i)=>
 createPracticeSubmission({problem,source:'⚡'.repeat(MAX_PRACTICE_SOURCE),status:'practice_accepted',
  passed:1,total:1,now:1800000100000+i}));
const bounded=validateProgress({...blankProgress(),practiceSubmissions:unicodeRows}).practiceSubmissions;
assert.ok(bounded.length<MAX_PRACTICE_SUBMISSIONS,'Byte budget must trim long multi-byte sources');
assert.ok(new TextEncoder().encode(JSON.stringify(bounded)).byteLength<=MAX_PRACTICE_BYTES,
 'History must leave enough space for other private progress under the 1 MB backend limit');
const app=readFileSync('dist/app.js','utf8');
const history=readFileSync('dist/submissions.js','utf8');
const sync=readFileSync('supabase/functions/bytequest-firebase/domain/progress.js','utf8');
const client=readFileSync('dist/progress.js','utf8');
assert.equal(sync,client,'Browser and Edge Function must use identical progress sanitizers');
assert.match(app,/rememberJavaSubmit\(p,source,result\.status,0,cases\.length/);
assert.match(app,/rememberJavaSubmit\(p,source,verdict\.status,passed,cases\.length/);
assert.match(app,/getPracticeSubmissions:\(\)=>state\.practiceSubmissions\|\|\[\]/);
assert.match(app,/if\(verdict\.accepted\)completeQuest\(p,true\)/,'Practice history must not change solved grading');
assert.match(history,/renderHistory\(\[\],\{loading:Boolean\(user\)\}\)/,'Paint local history before remote API');
assert.match(history,/renderHistory\(\[\],\{error:error\.message/,'Offline response must preserve visible practice history');
assert.match(history,/localRows\(\)/);
assert.match(history,/Only server-verified accepted submissions are eligible/);
assert.match(history,/function openPractice\(id\)/,'Private snapshots must open without a server submission ID');
console.log('PASS: Java practice submissions persist privately, merge across devices, and show immediately for new problems.');
