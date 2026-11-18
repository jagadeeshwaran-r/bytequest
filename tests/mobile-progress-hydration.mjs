import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Cloud} from '../dist/cloud.js';
import {blankProgress,mergeProgress,validateProgress} from '../dist/progress.js';
import {reconcilePracticeProgress} from '../dist/practice-history.js';

const app=readFileSync('dist/app.js','utf8');
const hydrate=app.slice(app.indexOf('async function refreshCloudProgress('),app.indexOf('async function changeAccount(user){'));
const sync=app.slice(app.indexOf('async function syncCloud()'),app.indexOf('// Public catalog loading'));
const bootstrap=app.slice(app.indexOf('async function changeAccount(user){'),app.indexOf('async function syncCloud()'));
assert.ok(hydrate.includes('await cloud.request("progress",{},owner)'),
  'Mobile must read previously stored account progress directly, independently of upload');
assert.ok(hydrate.includes('mergeProgress(state,cloudState)'),'Device and server progress must merge, never replace');
assert.ok(hydrate.includes('state=recovered;'),'Previously saved solves must be hydrated before upload is attempted');
assert.ok(hydrate.indexOf('state=recovered;')<hydrate.indexOf('if(needsUpload){'),
  'Show cloud solves even if a later sync write fails');
assert.ok(hydrate.includes('writeLocalProgress(storageKey,state)'),
  'Download cloud history must preserve it on the device even without successful upload');
assert.ok(hydrate.includes('updateStats();renderMap();'),
  'Rehydrate both solved count and green ticks on the Problems screen');
assert.ok(hydrate.includes('communityCache.clearOwner(owner)'),
  'A restored solve must invalidate the stale own-profile cache');
assert.ok(!hydrate.includes('renderPractice()')&&!hydrate.includes('loadEditor('),
  'Background mobile hydration must not wipe the code currently being edited');
assert.ok(hydrate.includes('!hadUnsyncedEditorDraft')&&
  hydrate.includes('current?.id===selectedProblem&&language===selectedLanguage&&!busy')&&
  hydrate.includes('$("codeEditor").value===editorAtRequest')&&
  hydrate.includes('editorAtRequest===currentStarter()'),
  'Only an untouched starter may be filled with downloaded cloud code');
assert.ok(hydrate.includes('$("codeEditor").value=state.drafts[selectedDraftKey]'),
  'A new mobile device must display the recovered cloud draft when it is safe');
assert.ok(hydrate.includes('epoch!==accountEpoch||cloud.user?.id!==owner'),
  'An old account response must not write into the next signed-in account');
assert.ok(bootstrap.includes('void refreshCloudProgress(owner,epoch)'),
  'Every freshly signed-in device must read the cloud state');
assert.ok(app.includes('addEventListener("focus",recheckCloudProgress)')&&
  app.includes('visibilitychange'), 'Mobile and resumed tabs must refresh solved history');
assert.ok(sync.includes('cloud.syncProgress(owner,JSON.parse(snapshot),mergeProgress)'),
  'Uploading newer local changes must still be revision-checked');
assert.ok(readFileSync('dist/index.html','utf8').includes('mobile-hydration=1'),
  'Updated browser bundle must be requested on GitHub Pages');

const owner='firebase:fixture:phone';
const old=blankProgress();
old.solved['two-sum']=1794800000000;
old.solved['contains-duplicate']=1794800010000;
old.acceptedDays=['2026-11-16'];
old.drafts['contains-duplicate']='class Solution { boolean containsDuplicate(int[] a) { return true; } }';
const local=blankProgress();
const seen=[];
const cloud=new Cloud(()=>{},{
 config:{url:'https://example.supabase.co',publishableKey:'sb_publishable_abcdefghijklmnopqrstuvwxyz'},
 storage:null,
 sessionFactory:()=>({tokenFor:async()=> 'mock-token'}),
 fetchImpl:async(_url,request)=>{
   const action=JSON.parse(request.body).action;seen.push(action);
   if(action==='progress')return {ok:true,status:200,json:async()=>({payload:old,revision:100})};
   if(action==='sync')return {ok:false,status:503,json:async()=>({error:'Server busy'})};
   throw new Error('Unexpected request');
 }
});
cloud.user={id:owner};
const downloaded=await cloud.request('progress',{},owner);
const mobile=reconcilePracticeProgress(mergeProgress(local,validateProgress(downloaded.payload)));
assert.ok(mobile.solved['two-sum'],'Previously accepted Two Sum must appear on mobile');
assert.ok(mobile.solved['contains-duplicate'],'Previously accepted Contains Duplicate must appear on mobile');
assert.equal(mobile.drafts['contains-duplicate'],old.drafts['contains-duplicate'],
  'Previously synced code must remain recoverable on mobile');
assert.deepEqual(seen,['progress'],'Downloading old solved history does not require a write');
const next=structuredClone(mobile);
next.solved['notebook-underline-counter']=1795010000000;
await assert.rejects(cloud.syncProgress(owner,next,mergeProgress),/Server busy/,
 'New submission uploads may fail independently of cloud downloads');
assert.ok(mobile.solved['two-sum']&&mobile.solved['contains-duplicate'],
 'Failed upload must never hide downloaded older progress');
console.log('PASS: mobile retrieves older cloud solves and code without requiring a successful upload.');
