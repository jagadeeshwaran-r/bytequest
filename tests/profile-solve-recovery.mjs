import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blankProgress,validateProgress,mergeProgress} from '../dist/progress.js';
import {recoverOwnProfileSolves} from '../dist/profile-solve-recovery.js';

const publicId='c07285ac-e1f7-4428-8134-8943a1e47e11';
const ownerProfile={public_id:publicId,username:'jagadeeshwaran'};
const ids=['two-sum','contains-duplicate','valid-anagram','max-profit',
  'linked-list-cycle','middle-of-linked-list','even-weight-distribution'];
const now=Date.parse('2026-11-18T18:45:00Z');
const remote={
  isOwn:true,
  profile:ownerProfile,
  insights:{recentSolves:ids.map((problemId,i)=>({
    problemId,solvedAt:new Date(now-(i+1)*3600000).toISOString(),
    title:'A confirmed challenge'
  }))}
};
const local=blankProgress();
local.drafts['notebook-underline-counter']='class Solution { int countUnderlinedLetters(String s) { return 3; } }';
local.modified['notebook-underline-counter']={drafts:now,notes:0,confidence:0};
const result=recoverOwnProfileSolves(local,remote,publicId,{now});
assert.equal(result.restored,7,'The own profile contains seven already recorded solves');
assert.deepEqual(Object.keys(result.state.solved).sort(),ids.sort(),
  'Every verified own-profile solved status must be reflected in the Problems library');
assert.equal(result.state.drafts['notebook-underline-counter'],local.drafts['notebook-underline-counter'],
  'Cloud solve recovery must not overwrite a newer local Java draft');
assert.equal(local.solved['two-sum'],undefined,'Input state must remain immutable');
assert.ok(result.state.acceptedDays.length>0,'Historical accepted days must be recovered');
assert.equal(recoverOwnProfileSolves(result.state,remote,publicId,{now}).restored,0,
  'Re-fetching the same profile must not double-count solved problems');
assert.equal(validateProgress(result.state).solved['two-sum'],result.state.solved['two-sum'],
  'Recovered records must survive the normal local/cloud progress sanitizer');

const wrongUser={...remote,isOwn:false};
assert.equal(recoverOwnProfileSolves(local,wrongUser,publicId,{now}).restored,0,
  'Never mark another learner\'s public profile as my solved work');
const wrongId={...remote,profile:{public_id:'another-public-profile-id',username:'jagadeeshwaran'}};
assert.equal(recoverOwnProfileSolves(local,wrongId,publicId,{now}).restored,0,
  'Even isOwn=true must match the expected verified account profile ID');
const tampered={...remote,insights:{recentSolves:[
  {problemId:'../escape',solvedAt:new Date(now).toISOString()},
  {problemId:'binary-search',solvedAt:new Date(now+3600000).toISOString()},
  {problemId:'two-sum',solvedAt:'not-a-date'},
  {problemId:'contains-duplicate',solvedAt:new Date(now-10000).toISOString()}
]}};
const safe=recoverOwnProfileSolves(local,tampered,publicId,{now});
assert.equal(safe.restored,1,'Ignore unknown timestamp format, invalid IDs, and future dates');
assert.equal(safe.state.solved['contains-duplicate'],now-10000);
assert.equal(safe.state.solved['binary-search'],undefined);
assert.equal(safe.state.solved['../escape'],undefined);
const combined=mergeProgress(blankProgress(),result.state);
assert.equal(Object.keys(combined.solved).length,7,
  'The client/server progress merge must preserve the recovered seven solves');

const app=readFileSync('dist/app.js','utf8');
const fallback=app.slice(app.indexOf('async function restoreOwnProfileHistory('),
  app.indexOf('// Read progress independently of writes.'));
assert.ok(fallback.includes('cloud.request("profile",{target:ownerProfile.username},owner)'),
  'Fallback must fetch live own-profile data with the signed-in Firebase token');
assert.ok(fallback.includes('recoverOwnProfileSolves(state,response,ownerProfile.public_id)'),
  'The own verified profile ID must scope solved recovery');
assert.ok(fallback.includes('updateStats();renderMap();'),
  'Problems library must repaint green ticks immediately');
assert.ok(!fallback.includes('renderPractice()')&&!fallback.includes('loadEditor('),
  'Profile-based solve recovery must never reset the code editor');
assert.ok(app.includes('void restoreOwnProfileHistory(owner,epoch,value.profile)'),
  'A successful self response must run independent authenticated solve recovery');
const html=readFileSync('dist/index.html','utf8');
assert.ok(html.includes('own-profile-solve-recovery=1'),
  'Deploy must invalidate the stale Problems entrypoint');
console.log('PASS: seven cloud solves recovered on Problems view; preserve code and reject cross-account credits.');
