import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {usesRemoteSubmit,browserSubmissionCases,browserSubmissionVerdict,privateJavaJudgeUnavailable} from '../dist/browser-submit.js';
import {blocksEditorClipboardEvent,blocksEditorShortcut,blocksEditorBeforeInput} from '../dist/editor-clipboard.js';
import {submissionFeedback} from '../dist/submission-feedback.js';

const publicCases=[
  {args:[[1,3,5],4],expected:2,label:'Insert in sorted array'},
  {args:[[],9],expected:0,label:'Empty array'}
];
const lower={id:'lower-bound',method:'lowerBound',tests:publicCases,hiddenCount:0};
const palindrome={id:'linked-list-palindrome',method:'isPalindrome',tests:[{args:[[1,2,1]],expected:true}],hiddenCount:11};
assert.equal(usesRemoteSubmit('java',true,true),true,'Signed-in Java Submit must request server verification for shared-solution unlock');
assert.equal(usesRemoteSubmit('java',false,true),false,'Guest Java Submit must use Java Run');
assert.equal(usesRemoteSubmit('java',true,false),false,'Run must never use remote Submit');
for(const language of ['python','c','cpp'])assert.equal(usesRemoteSubmit(language,true,true),true,'Keep remote verified submits for '+language);
assert.equal(usesRemoteSubmit('python',false,true),false,'Guest users cannot submit unverified remote attempts');
assert.equal(usesRemoteSubmit('java',true,false),false,'Java Run remains in browser');
for(const message of [
 'This problem requires a configured private Java judge. Hidden cases remain private by default.',
 'Private Java judging is not connected yet.',
 'The private suite is unavailable.'
])assert.equal(privateJavaJudgeUnavailable(new Error(message)),true,'Only known private-judge configuration errors fall back to Java practice');
for(const message of ['Wrong answer','Java could not compile','The submission request timed out','You do not have access to this action','This problem changed'])
 assert.equal(privateJavaJudgeUnavailable(new Error(message)),false,'Never convert a substantive rejection to a practice pass');
const custom=[{args:[[2,3,4],1],expected:0}];
const cases=browserSubmissionCases(lower,custom);
assert.deepEqual(cases,[...publicCases,...custom]);
assert.equal(cases.length,3);
assert.equal(lower.tests.length,2,'Do not mutate published cases');
const accepted=browserSubmissionVerdict(lower,3,3,1);
assert.equal(accepted.accepted,true);
assert.equal(accepted.status,'practice_accepted');
assert.equal(accepted.verified,false);
assert.match(accepted.message,/No verified server submission/);
assert.match(accepted.message,/custom/);
assert.equal(submissionFeedback(accepted).title,'Practice accepted');
assert.equal(submissionFeedback(accepted).tone,'success');
const hidden=browserSubmissionVerdict(palindrome,1,1);
assert.equal(hidden.accepted,true);
assert.match(hidden.message,/Hidden cases were not checked/);
assert.equal(hidden.total,1,'Only public tests are evaluated in the browser');
const rejected=browserSubmissionVerdict(lower,1,2);
assert.equal(rejected.accepted,false);
assert.equal(rejected.status,'wrong_answer');
assert.equal(browserSubmissionVerdict(lower,0,0).accepted,false,'Zero cases cannot be accepted');

assert.equal(blocksEditorClipboardEvent('copy'),false);
for(const action of ['cut','paste','drop'])assert.equal(blocksEditorClipboardEvent(action),true);
for(const key of ['c','C'])assert.equal(blocksEditorShortcut(key.toLowerCase(),true),false);
for(const key of ['x','v'])assert.equal(blocksEditorShortcut(key,true),true);
assert.equal(blocksEditorShortcut('v',false),false);
for(const input of ['insertFromPaste','insertFromPasteAsQuotation','insertFromDrop','insertFromYank','deleteByCut'])assert.equal(blocksEditorBeforeInput(input),true);
assert.equal(blocksEditorBeforeInput('insertText'),false);
const app=readFileSync('dist/app.js','utf8'),editor=readFileSync('dist/editor-tools.js','utf8');
assert.match(app,/usesRemoteSubmit\(language,Boolean\(cloud\.user\),submit\)/,'Remote selection must use the shared policy');
assert.match(app,/browserSubmissionVerdict\(p,passed,cases\.length,customCases\.length\)/,'Local result must be labeled as practice');
assert.ok(!app.includes('cloud.request("hidden-submit"'),'Java browser Submit must never call hidden-submit');
assert.match(app,/if\(verdict\.accepted&&saved\)completeQuest\(p,true\)/,'Practice completion must require a durable save');
assert.match(editor,/blocksEditorClipboardEvent\(event\)/);
assert.match(editor,/blocksEditorShortcut\(key,mod\)/);
assert.match(editor,/blocksEditorBeforeInput\(e\.inputType\)/);
const submissionDialog=readFileSync('dist/submissions.js','utf8');
assert.match(app,/allowPublicPractice:lang==='java'/,'Signed-in Java users can choose public practice directly');
assert.match(app,/const publicOnly=options\.mode==='public-practice'/,'Public-only verification requires an explicit user choice');
assert.match(app,/options=\{\.\.\.options,scope:'public',nonce:options.nonce\|\|crypto.randomUUID\(\),shared:false/,'Legacy public intent preserves explanation, uses explicit scope and disables sharing');
assert.match(app,/if\(publicOnly&&\(lang!=='java'\|\|codeTools\.prepare\(\)!==source\)\)/,'Reject stale or non-Java server public submissions');
assert.match(submissionDialog,/allowPublicPractice=false/,'The public practice dialog action is opt-in for Java only');
assert.match(submissionDialog,/Submit public tests →/,'Public tests are the primary Java submission action on hidden-suite problems');
assert.match(submissionDialog,/collect\(publicDefault\?'public':'complete'\)/,'Hidden-case Java problems default to explicit public scope');
console.log('PASS: browser Java submissions, local progress, honest verdicts, and copy-allowed/paste-blocked editor.');
