import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCloudHealthStore,describeCloudHealth} from '../dist/cloud-health.js';
import {Cloud} from '../dist/cloud.js';

class MemoryStorage{
 constructor(){this.data=new Map();}
 getItem(key){return this.data.get(key)??null;}
 setItem(key,value){this.data.set(key,String(value));}
 removeItem(key){this.data.delete(key);}
}
const storage=new MemoryStorage(),owner='firebase:test:owner-1',other='firebase:test:owner-2';
let time=1795020000000;
const store=createCloudHealthStore({storage,clock:()=>time});
store.setOwner(owner);
store.update({kind:'pending',localSaved:true});
assert.equal(store.view(),null,'Draft sync must not trigger an alert while the user types');
time+=30000;
assert.equal(store.view(),null,'No mid-typing popups from a routine thirty-second delay');
time+=31000;
assert.equal(store.view().title,'Sync delayed','Only an overdue save shows a small passive status');
store.update({kind:'request-error',action:'profile',status:500});
store.update({kind:'request-error',action:'public-catalog',status:503});
store.update({kind:'request-error',action:'submission-create',status:503});
store.update({kind:'request-error',action:'sync',status:500});
assert.equal(store.view().title,'Sync delayed','Background failures must never become an outage banner');
assert.equal(store.getState().kind,'pending','Failed unrelated requests do not replace actual save state');
store.update({kind:'request-ok',action:'profile'});
assert.equal(store.view().kind,'pending','Profile success is not proof of a completed sync');
store.update({kind:'sync-failed',localSaved:true});
assert.equal(store.view(),null,'Failed cloud sync gets a short retry grace period');
time+=31000;
assert.equal(store.view().title,'Sync paused');
assert.match(store.view().message,/remain on this device/);
const onProfile=createCloudHealthStore({storage,clock:()=>time});
onProfile.setOwner(owner);
assert.equal(onProfile.view().title,'Sync paused','Persistent pending cloud sync is available in profile');
onProfile.setOwner(other);
assert.equal(onProfile.view(),null,'Other accounts must never inherit private sync status');
onProfile.setOwner(owner);
assert.equal(onProfile.view().title,'Sync paused');
store.update({kind:'pending',localSaved:true});
assert.equal(store.view().title,'Sync paused','A local save must not falsely clear cloud sync failure');
store.update({kind:'synced'});
assert.equal(store.view(),null,'Confirmed cloud save clears the indicator');
assert.equal(storage.getItem('bytequest.sync-health.v1.'+owner),null);
assert.equal(describeCloudHealth(null,{online:false}),null,'Offline alone is not grounds to interrupt coding');
store.update({kind:'storage-failed'});
assert.equal(store.view().title,'Local save failed','Browser storage failure remains visible');
store.update({kind:'pending',localSaved:false});
assert.equal(store.view().title,'Local save failed');
store.update({kind:'pending',localSaved:true});
assert.equal(store.view(),null,'A confirmed browser save can clear a local storage error');
time+=61000;
assert.equal(store.view({online:false}).title,'Working offline');
store.update({kind:'synced'});
store.update({kind:'request-error',action:'submission-create',status:503});
assert.equal(store.view(),null,'Java provider problems belong in submission feedback, not a global popup');
assert.equal(storage.getItem('bytequest.sync-health.v1.'+owner),null,'Transient errors cannot persist across tab restores');
const config={url:'https://example.supabase.co',publishableKey:'sb_publishable_abcdefghijklmnopqrstuvwxyz'};
const networkEvents=[];
const cloud=new Cloud(()=>{},{
 config,storage:null,
 sessionFactory:()=>({tokenFor:async()=> 'test-token'}),
 fetchImpl:async()=>({ok:false,status:503,json:async()=>({error:'Cloud is unavailable'})})
});
cloud.user={id:owner};cloud.onHealth=e=>networkEvents.push(e);
await assert.rejects(cloud.request('progress',{},owner),/Cloud is unavailable/);
assert.equal(networkEvents.at(-1).status,503,'Health monitor must retain real HTTP error status');
assert.equal(networkEvents.at(-1).kind,'request-error');
assert.ok(!JSON.stringify(networkEvents).includes('test-token'),'Health signal must not leak auth tokens');
const shell=readFileSync('dist/shell.js','utf8'),app=readFileSync('dist/app.js','utf8');
assert.ok(shell.includes('mountCloudHealthNotice(document,tools)'),'Sync status is placed inside the top navigation');
assert.ok(shell.includes('cloudHealth.setOwner(owner)'),'Correct account-scoped warning is loaded on every profile visit');
assert.ok(app.includes("kind:storageOK?'pending':'storage-failed'"),'Local save status must be tracked');
assert.ok(app.includes("kind:changedWhileSaving?'pending':'synced'"),'Only confirmed sync clears status');
assert.ok(app.includes("kind:'sync-failed',localSaved:storageOK"),'Network errors must not conceal unsynced attempts');
assert.ok(app.includes('updateStats();renderMap();'),
  'Cloud merge must refresh problem-list solved ticks without requiring a page reload');
const sync=app.slice(app.indexOf('async function syncCloud()'),app.indexOf('// Public catalog loading'));
assert.ok(!sync.includes('loadEditor(')&&!sync.includes('renderPractice('),
  "Cloud synchronization must never remount the user\'s code editor");
const css=readFileSync('dist/cloud-health.css','utf8');
assert.ok(css.includes('.bq-cloud-health[hidden]'),'Quiet status indicator can hide on recovery');
assert.ok(css.includes('position:relative')&&!css.includes('position:sticky'),'Connection status must not create a blocking full-width banner');
assert.ok(readFileSync('dist/cloud-health.js','utf8').includes('doc.createElement(\'details\')'),'Sync details only open on an explicit user click');
console.log('PASS: quiet header sync indicator, no false service popups, owner isolation and confirmed-cloud-only success.');
