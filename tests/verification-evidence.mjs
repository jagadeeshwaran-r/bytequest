import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {practiceVerificationSummary,privateJudgeUnavailableSummary} from '../dist/verification-evidence.js';

// Exact live incident: Notebook Underline Counter revision 4 has 30 published
// public cases and 70 private cases; the saved browser attempt has
// passed:30,total:30,hiddenSkipped:true and no server verified submission.
const problem={id:'notebook-underline-counter',revision:4,hiddenCount:70};
const attempt={problemId:problem.id,revision:4,status:'practice_accepted',
  passed:30,total:30,hiddenSkipped:true,source:'class Solution {}'};
const result=practiceVerificationSummary(problem,attempt);
assert.equal(result.tests,'30/30 browser practice cases passed');
assert.equal(result.hidden,'0/70 private hidden cases verified');
assert.match(result.title,/server verification pending/);
assert.match(result.explanation,/personal progress/);
assert.match(result.explanation,/no server-verified acceptance/);
assert.match(privateJudgeUnavailableSummary(problem).hidden,/0\/70 hidden cases confirmed by the server/);
assert.match(privateJudgeUnavailableSummary(problem).explanation,/explicitly run browser practice/);
assert.equal(practiceVerificationSummary({hiddenCount:0},{passed:2,total:2}).hidden,
 'No private hidden cases advertised');
assert.equal(practiceVerificationSummary(problem,{passed:200,total:30}).tests,
 '30/30 browser practice cases passed','Defensive test counts must not exceed total');

const app=readFileSync('dist/app.js','utf8');
const block=app.slice(app.indexOf('async function submitOnline()'),app.indexOf('function logAttempt('));
assert.ok(block.includes("await cloud.request('submission-create'"),'Signed-in Submit requests a real server verdict');
assert.ok(block.includes('privateJavaJudgeUnavailable(e)'),'Private judge 503 gets an explicit notice');
assert.ok(block.includes('privateJudgeUnavailableSummary(p)'),'Unavailable private judge must show unambiguous test status');
assert.ok(block.includes('practice.onclick=()=>{')&&block.includes('void run(true,{forceBrowser:true,sourceOverride:source})'),
 'Public browser practice must require a deliberate second click');
assert.ok(!block.includes('await run(true,{forceBrowser:true,sourceOverride:source})'),
 'Never auto-submit an unverified practice acceptance after backend failure');
assert.ok(block.includes('retry.onclick=()=>{')&&block.includes('void submitOnline({problemId:p.id,revision:p.revision,lang,user,account,source,options})'),
 'Learner must be able to request verified Submit again');
assert.ok(block.includes('const unchanged=()=>'),'Prevent replay of stale Java source or wrong signed-in account');
const community=readFileSync('dist/submissions.js','utf8');
assert.ok(community.includes("if(!response.unlocked)"),'Only the server authorizes community access');
assert.ok(community.includes('practiceVerificationSummary(problem,attempt)'),
 'Community notice must include real public and hidden verification counts');
assert.ok(community.includes("row.revision===problem.revision"),
 'An old accepted practice result must never imply current revision verification');
assert.ok(community.includes('Try server verification'),'User must be offered a genuine server submission action');
assert.ok(!community.includes('Practice passed · verification required'),
 'Remove ambiguous legacy success banner');
assert.ok(readFileSync('dist/index.html','utf8').includes('verified-judge-status=1'),
 'Live page must load the new code, not old cached banners');
console.log('PASS: verified/private distinction, 30 public vs 70 unverified hidden cases, explicit fallback and safe retry.');
