import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [component,workspace]=await Promise.all([
  readFile('angular/src/app/features/practice/submissions.component.ts','utf8'),
  readFile('angular/src/app/features/practice/practice.component.ts','utf8')
]);

test('Submissions remains a left-pane tab; the Java editor stays mounted beside it',()=>{
  assert.match(workspace,/\[class\.submissions-content\]="pane\(\)===\x27submissions\x27"/);
  assert.match(workspace,/<bq-submissions \[problemId\]="problem\(\)!\.id"/);
  assert.match(workspace,/<bq-editor \[value\]="code\(\)"/);
  assert.match(workspace,/openPane\('submissions'\)/);
  assert.doesNotMatch(workspace,/<h3>Your Java submissions<\/h3>/);
  assert.match(workspace,/submissionRefresh\.update\(value=>value\+1\)/);
});
test('History matches the reference table and never fabricates browser verification',()=>{
  for(const label of ['My submissions','Community rankings','SUBMISSION HISTORY',
    'Date','Result / privacy','Language','Runtime','Memory',
    'Browser practice is private and not verified','Publish earlier accepted solution'])
    assert.ok(component.includes(label),label);
  assert.match(component,/api\.request<SubmissionReply>\('submission-history'/);
  assert.match(component,/row\.language==='java'/);
  assert.match(component,/\.slice\(0,25\)/);
  assert.match(component,/row\.benchmark_version==='bq-public-only-v1'/);
});
test('Community rankings are separate for public and full suite, with server unlock checks',()=>{
  for(const label of ['Community submissions','My submissions','Public tests',
    'Full-suite verified','All languages','Rank by','Peak memory','Next →','Previous'])
    assert.ok(component.includes(label),label);
  assert.match(component,/board==='public'\?'submission-public-list':'submission-list'/);
  assert.match(component,/this\.unlocked\.set\(response\.unlocked===true\)/);
  assert.match(component,/@else if\(!unlocked\(\)\)/);
  assert.match(component,/hidden suite has not been checked/);
  assert.match(component,/this\.page\.set\(Math\.max\(0,this\.page\(\)\+delta\)\)/);
  assert.match(component,/rankings\(\)\.length<25/);
});
test('Private sharing and viewing use authorized staging actions; stale requests cannot reappear',()=>{
  assert.match(component,/this\.actions\.write\('submission-public-share'/);
  assert.match(component,/this\.api\.request<DetailReply>\('submission-read'/);
  assert.match(component,/!this\.disposed&&ticket===this\.generation/);
  assert.match(component,/this\.auth\.user\(\)\?\.id===owner/);
  assert.match(component,/ngOnDestroy\(\):void/);
  assert.doesNotMatch(component,/github\.io\/bytequest|service_role|hiddenTests\s*:/);
});
