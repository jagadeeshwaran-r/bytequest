import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [board,submissions]=await Promise.all([
  readFile('angular/src/app/features/leaderboard/leaderboard.component.ts','utf8'),
  readFile('angular/src/app/features/practice/submissions.component.ts','utf8')
]);

test('Public-test community is the default for Angular verified submissions',()=>{
  assert.match(submissions,/const defaultBoard:Board='public'/);
  assert.match(submissions,/'submission-public-list':'submission-list'/);
  assert.match(submissions,/No full-suite verified solutions yet/);
  assert.match(submissions,/View public submissions/);
  assert.match(submissions,/response\.unlocked===true/);
  assert.match(submissions,/row\.problem_revision===this\.revision\(\)/);
});
test('Native leaderboard matches canonical seven-column reference and uses server values',()=>{
  for(const label of ['The leaderboard.','Your rank','Points','Solved','Learners',
    'Global','Friends','All time','Find me','Refresh ranks',
    'Easy','Medium','Hard','Community','Your ranking summary','leader-avatar',
    'leader-trophy','leader-you','leader-summary','leader-table','leader-practice']){
    assert.ok(board.toLowerCase().includes(label.toLowerCase()),'missing '+label);
  }
  assert.match(board,/learner\.easy\?\?0/);
  assert.match(board,/learner\.medium\?\?0/);
  assert.match(board,/learner\.hard\?\?0/);
  assert.match(board,/\[src\]="learner\.avatar_url"/);
  assert.match(board,/\[class\.your-ranking\]="learner\.isYou"/);
  assert.match(board,/api\.request<Ranking>\('leaderboard'/);
  assert.match(board,/\{scope,period,page\}/);
  assert.match(board,/Math\.floor\(\(current\.rank-1\)\/perPage\)/);
  assert.doesNotMatch(board,/\.(?:innerHTML|outerHTML)\s*=/);
});
test('Leaderboard preserves signed-out auth gate and stale-request guards',()=>{
  assert.match(board,/@if\(!auth\.user\(\)\)/);
  assert.match(board,/Better, together\./);
  assert.match(board,/ticket!==this\.generation\|\|this\.auth\.user\(\)\?\.id!==owner/);
  assert.match(board,/untracked\(\(\)=>/);
});
