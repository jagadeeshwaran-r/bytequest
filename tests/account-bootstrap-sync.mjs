import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Cloud} from '../dist/cloud.js';
import {blankProgress,mergeProgress} from '../dist/progress.js';

const app=readFileSync('dist/app.js','utf8');
const init=app.slice(app.indexOf('async function changeAccount(user){'),app.indexOf('async function syncCloud(){'));
assert.ok(init.includes('state=reconcilePracticeProgress(readLocal(storageKey))'),
  'Owner-local drafts/practice history must be restored before network requests');
const ready=init.indexOf('accountReady=true');
assert.ok(ready>0,'Account must become ready based on local progress');
assert.ok(!init.slice(0,ready).includes('await '),
  'No network request may delay owner-local account readiness');
assert.ok(init.indexOf('readLocal(storageKey)')<ready,'Local progress must be read before enabling sync');
assert.ok(init.indexOf('void cloud.checkAdmin(owner)')>ready,
  'Admin and creator checks must happen after local account readiness, without blocking it');
assert.ok(init.indexOf('void cloud.request("self",{},owner)')>ready,
  'Social profile loading must not block personal cloud sync');
assert.ok(init.includes('syncTimer=setTimeout(()=>{')&&init.includes('void refreshCloudProgress(owner,epoch);'),
  'After local readiness, startup must read remote progress even before uploading changes');
assert.ok(!init.includes('await Promise.allSettled([cloud.loadProgress(owner)])'),
  'No hanging account/bootstrap request is allowed on the critical path');
assert.ok(app.includes('cloud.syncProgress(owner,JSON.parse(snapshot),mergeProgress)'),
  'Initial sync must merge the latest remote revision, not blindly overwrite it');
assert.ok(app.includes('pendingProfileRefresh=true'),
  'Recovered personal solves must refresh the stale profile cache after confirmed sync');
assert.ok(readFileSync('dist/index.html','utf8').includes('bootstrap-sync-fix=1'),
  'GitHub Pages must load the new bootstrap bundle');
assert.ok(app.includes('cloud.js?v=outage-1'),
  'GitHub Pages must also reload the updated cloud/token module');

const config={url:'https://example.supabase.co',publishableKey:'sb_publishable_abcdefghijklmnopqrstuvwxyz'};
const owner='firebase:fixture:recover-user';
const fakeSession=tokenFor=>()=>({
  tokenFor,
  init:async()=>{},
  signIn:async()=>{},
  signOut:async()=>{}
});
const stalled=new Cloud(()=>{},{
  config,storage:null,authTimeoutMs:20,
  sessionFactory:fakeSession(()=>new Promise(()=>{})),
  fetchImpl:async()=>{throw new Error('Network must not be called before a token exists');}
});
stalled.user={id:owner};
await assert.rejects(stalled.request('progress',{},owner),/Google sign-in token timed out/,
 'A hung Firebase getIdToken must fail with a useful error instead of waiting indefinitely');

const old=blankProgress();
old.drafts['two-sum']='old code from server';
old.solved['two-sum']=1794800000000;
old.acceptedDays=['2026-11-16'];
const local=blankProgress();
local.drafts['notebook-underline-counter']='class Solution { int countUnderlinedLetters(String notes) { return 3; } }';
local.modified['notebook-underline-counter']={drafts:1795000000000,notes:0,confidence:0};
local.solved['notebook-underline-counter']=1795000000000;
local.acceptedDays=['2026-11-18'];
let calls=[];
const working=new Cloud(()=>{},{
 config,storage:null,authTimeoutMs:20,
 sessionFactory:fakeSession(async()=> 'signed-firebase-token'),
 fetchImpl:async(_url,opts)=>{
  const req=JSON.parse(opts.body);calls.push(req.action);
  if(req.action==='progress')return {ok:true,status:200,json:async()=>({payload:old,revision:8})};
  if(req.action==='sync')return {ok:true,status:200,json:async()=>({
    applied:true,revision:9,payload:req.payload
  })};
  throw new Error('Unexpected action '+req.action);
 }
});
working.user={id:owner};
const merged=await working.syncProgress(owner,local,mergeProgress);
assert.deepEqual(calls,['progress','sync'],'Sync reads the latest server state before writing');
assert.equal(merged.drafts['two-sum'],old.drafts['two-sum'],'Existing remote drafts survive');
assert.equal(merged.drafts['notebook-underline-counter'],local.drafts['notebook-underline-counter'],
  'Local solutions survive the cloud merge');
assert.equal(merged.solved['two-sum'],old.solved['two-sum'],'Existing remote solves survive');
assert.equal(merged.solved['notebook-underline-counter'],local.solved['notebook-underline-counter'],
  'Accepted local practice solves survive');
assert.deepEqual(merged.acceptedDays,['2026-11-16','2026-11-18'],
  'Both prior and current streak days remain in merged account data');
console.log('PASS: owner-local account readiness, token-timeout recovery, and conflict-safe cloud merging preserve drafts/solves.');
