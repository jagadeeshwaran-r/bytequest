import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {usesRemoteSubmit,browserSubmissionVerdict,privateJavaJudgeUnavailable} from '../dist/browser-submit.js';

assert.equal(usesRemoteSubmit('java',true,true),true,'Signed-in Java must attempt server-verified acceptance');
assert.equal(usesRemoteSubmit('java',false,true),false,'Guest Java stays browser-only');
assert.equal(usesRemoteSubmit('java',true,false),false,'Run must not submit to the server');
assert.equal(browserSubmissionVerdict({hiddenCount:3},2,2).verified,false,'Public tests cannot prove hidden acceptance');
assert.equal(privateJavaJudgeUnavailable(new Error('This problem requires a configured private Java judge.')),true);
assert.equal(privateJavaJudgeUnavailable(new Error('Wrong answer')),false);
assert.equal(privateJavaJudgeUnavailable(new Error('This problem changed.')),false);

const app=readFileSync('dist/app.js','utf8');
const start=app.indexOf('async function submitOnline()');
const end=app.indexOf('function logAttempt(');
assert.ok(start>0&&end>start);
const submission=app.slice(start,end);
assert.match(submission,/await cloud\.request\('submission-create'/,'Send signed-in Java to server acceptance path');
assert.match(submission,/if\(lang==="java"&&result\.status==="unavailable"\)/,
 'Only an explicit unavailable verdict can trigger a practice fallback');
assert.match(submission,/lang==="java"&&privateJavaJudgeUnavailable\(e\)/,
 'Only known configuration errors can trigger a practice fallback');
assert.match(submission,/practice\.onclick=\(\)=>\{/,
 'A failed private-judge request must offer public practice only after explicit click');
assert.match(submission,/void run\(true,\{forceBrowser:true,sourceOverride:source\}\)/,
 'Explicit browser practice uses exactly the source attempted on the server');
assert.ok(!submission.includes('await run(true,{forceBrowser:true,sourceOverride:source})'),
 'A failed private submit cannot silently become a counted browser-practice acceptance');
assert.match(submission,/\$\("codeEditor"\)\.value!==source/,'Do not submit a stale editor snapshot silently');
assert.match(submission,/if\(result\.accepted\)/,'Server acceptance is the only way to unlock shared submissions');

const quest=app.slice(app.indexOf('function completeQuest('),app.indexOf('function celebrate('));
assert.match(quest,/pendingProfileRefresh=true/,'Keep the profile invalidation pending until cloud sync completes');
assert.match(quest,/communityCache\.clearOwner\(accountOwner\)/,'Bust cached profile immediately on accepted solve');
assert.match(quest,/void syncCloud\(\)/,'Flush accepted solve without waiting for draft debounce');
const sync=app.slice(app.indexOf('async function syncCloud()'),app.indexOf('// Public catalog loading'));
assert.match(sync,/if\(pendingProfileRefresh\)\{communityCache\.clearOwner\(owner\);pendingProfileRefresh=false;\}/,
 'Refresh profile cache only after cloud sync succeeds');

const submissionUi=readFileSync('dist/submissions.js','utf8');
assert.ok(submissionUi.includes('practiceVerificationSummary(problem,attempt)'));
assert.ok(submissionUi.includes('summary.hidden')||submissionUi.includes('evidence.hidden'));
assert.ok(submissionUi.includes('Try server verification'));
assert.ok(submission.includes('privateJudgeUnavailableSummary(p)'));
assert.ok(submission.includes('No hidden-test acceptance was recorded'));
assert.ok(submissionUi.includes('if(!response.unlocked)'),'Never bypass server submission authorization');
assert.ok(!submissionUi.includes('response.unlocked||localRows()'), 'Browser practice must never bypass server locking');
console.log('PASS: server-first Java acceptance, strict fallback, immediate profile sync and honest unlock messaging.');
