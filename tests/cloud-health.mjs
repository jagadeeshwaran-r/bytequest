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
assert.equal(store.view(),null,'Normal background sync should not flash a warning');
time+=16000;
assert.match(store.view().title,/taking longer/,'Overdue sync must be announced');
assert.match(store.view().message,/saved on this device/,'Browser-only progress must be identified');
store.update({kind:'request-ok',action:'profile'});
assert.match(store.view().title,/taking longer/,'Successful profile reads cannot prove a pending save is confirmed');
store.update({kind:'request-error',action:'sync',status:503});
assert.match(store.view().title,/server busy or unreachable/,'HTTP 503 must show server degradation, not a provider-wide outage');
assert.match(store.view().message,/not necessarily mean Supabase or Firebase is down/,'Never claim the provider itself is down');
store.update({kind:'request-ok',action:'sync'});
assert.equal(store.view().kind,'pending','Recovering a request must not hide outstanding unsynced progress');
store.update({kind:'request-error',action:'sync',status:503});
store.update({kind:'sync-failed',localSaved:true});
assert.equal(store.view().title,'Cloud sync failed');
store.update({kind:'request-ok',action:'self'});
assert.equal(store.view().title,'Cloud sync failed','A social API success must not clear progress sync failure');
const onProfile=createCloudHealthStore({storage,clock:()=>time});
onProfile.setOwner(owner);
assert.equal(onProfile.view().title,'Cloud sync failed','Profile must show persisted warning for the same account');
onProfile.setOwner(other);
assert.equal(onProfile.view(),null,'Unrelated accounts must not inherit private sync warnings');
onProfile.setOwner(owner);
assert.equal(onProfile.view().title,'Cloud sync failed','Owner-specific warning must return when switching back');
store.update({kind:'synced'});
assert.equal(store.view(),null,'Only confirmed cloud save clears the warning');
assert.equal(storage.getItem('bytequest.sync-health.v1.'+owner),null,'Confirmed save removes stale persisted warning');
assert.match(describeCloudHealth(null,{online:false}).title,/offline/i,'Offline must be detected without a backend request');
store.update({kind:'storage-failed'});
assert.match(store.view().title,/Local backup unavailable/,'Storage failures must be more serious than sync failures');
store.update({kind:'pending',localSaved:true});
assert.match(store.view().title,/Local backup unavailable/,'Another write must never hide a failed local backup');
store.update({kind:'synced'});
store.update({kind:'request-error',action:'submission-create',status:503});
assert.equal(store.view().title,'Submission verification unavailable','Private judge failure is not a global outage');
store.update({kind:'request-error',action:'profile',status:400});
assert.equal(store.view().title,'Submission verification unavailable','Validation errors cannot create a false outage banner');

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
assert.ok(shell.includes('mountCloudHealthNotice(document)'),'Health banner is shared across all site pages');
assert.ok(shell.includes('cloudHealth.setOwner(owner)'),'Correct account-scoped warning is loaded on every profile visit');
assert.ok(app.includes("kind:storageOK?'pending':'storage-failed'"),'Local save status must be tracked');
assert.ok(app.includes("kind:changedWhileSaving?'pending':'synced'"),'Only confirmed sync clears status');
assert.ok(app.includes("kind:'sync-failed',localSaved:storageOK"),'Network errors must not conceal unsynced attempts');
const css=readFileSync('dist/cloud-health.css','utf8');
assert.ok(css.includes('.bq-cloud-health[hidden]'),'Banner can hide cleanly after recovery');
console.log('PASS: truthful provider-health alerts, unsynced profile warnings, account isolation and confirmed-cloud-only success.');
