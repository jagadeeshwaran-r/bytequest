import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readSafeProgress,writeSafeProgress} from '../dist/reliable-storage.js';
import {blankProgress,validateProgress} from '../dist/progress.js';
import {submissionFeedback} from '../dist/submission-feedback.js';

class MemoryStorage{
 constructor(){this.items=new Map();}
 getItem(key){return this.items.has(key)?this.items.get(key):null;}
 setItem(key,value){this.items.set(key,value);}
 removeItem(key){this.items.delete(key);}
}
const storage=new MemoryStorage(),owner='bytequest.user.firebase:project:user-a',other='bytequest.user.firebase:project:user-b';
const valid=blankProgress();valid.drafts['two-sum']='class Solution {}';
storage.setItem(owner,JSON.stringify(valid));
const normal=readSafeProgress(storage,owner,validateProgress,blankProgress);
assert.equal(normal.saveKey,owner);
assert.deepEqual(normal.state.drafts,valid.drafts);
writeSafeProgress(storage,normal.saveKey,{...valid,current:'two-sum'});
assert.equal(JSON.parse(storage.getItem(owner)).current,'two-sum');

const corrupted='{ "version": 1, "drafts": BROKEN ';
storage.setItem(owner,corrupted);
const recovery=readSafeProgress(storage,owner,validateProgress,blankProgress);
assert.equal(recovery.saveKey,owner+'.recovery');
assert.match(recovery.warning,/preserved/);
assert.equal(storage.getItem(owner),corrupted,'A damaged original must not be deleted or overwritten');
writeSafeProgress(storage,recovery.saveKey,valid);
assert.equal(storage.getItem(owner),corrupted);
const resumed=readSafeProgress(storage,owner,validateProgress,blankProgress);
assert.equal(resumed.saveKey,owner+'.recovery');
assert.deepEqual(resumed.state.drafts,valid.drafts,'Recovery must survive reload');
assert.equal(storage.getItem(other),null,'Recovery must be scoped by owner');

storage.setItem(owner+'.recovery','{broken again');
const blocked=readSafeProgress(storage,owner,validateProgress,blankProgress);
assert.equal(blocked.saveKey,null,'Corrupted recovery and original must both be preserved');
assert.throws(()=>writeSafeProgress(storage,blocked.saveKey,blankProgress()),/unavailable|recovery/);
assert.equal(storage.getItem(owner),corrupted);
assert.equal(storage.getItem(owner+'.recovery'),'{broken again');

const unavailable={getItem(){throw Error('SecurityError');},setItem(){throw Error('SecurityError');}};
const unreadable=readSafeProgress(unavailable,owner,validateProgress,blankProgress);
assert.equal(unreadable.saveKey,null);
assert.match(unreadable.warning,/storage/i);
assert.throws(()=>writeSafeProgress(unavailable,owner,valid),/SecurityError/);
assert.deepEqual(readSafeProgress(new MemoryStorage(),owner,validateProgress,blankProgress).state,blankProgress());

const app=readFileSync('dist/app.js','utf8');
const history=readFileSync('dist/submissions.js','utf8');
const index=readFileSync('dist/index.html','utf8');
assert.ok(index.includes('app.js?v=ui-polish-1'),'Force a fresh startup bundle');
assert.ok(app.includes('readSafeProgress(localStorage,key,validateProgress,blank)'));
assert.ok(app.includes('writeSafeProgress(localStorage,storageTargets.has(key)?storageTargets.get(key):key,value)'));
assert.ok(app.includes('return storageOK;'),'Persistence must report whether a save succeeded');
assert.ok(app.includes('if(verdict.accepted&&saved)completeQuest(p,true)'),'No celebration when the submission record could not persist');
assert.ok(app.includes('verdict.accepted=false;verdict.status="save_failed"'),'Lost practice history must not be presented as accepted');
const unsavedFeedback=submissionFeedback({status:'save_failed',accepted:false,passed:2,total:2,message:'Tests passed but not saved.'});
assert.equal(unsavedFeedback.title,'Tests passed · not saved');
assert.equal(unsavedFeedback.tone,'warning');
assert.match(unsavedFeedback.html,/class="submission-verdict warning"/);
assert.ok(app.includes('const previous=structuredClone(state)'),'Take a rollback snapshot before granting solve credit');
assert.ok(app.includes('state=previous;'),'Restore solve credit after a failed write');
assert.ok(app.includes('if(!persist()){'),'Success must depend on durable progress');
assert.ok(app.includes('return !changedWhileSaving;'),'Sync must not report success when more changes are queued');
assert.ok(app.includes('if(syncing){syncAgain=true;return false;}'),'Active sync must not be treated as finished');
assert.ok(app.includes('if(!navigator.onLine){setSyncStatus("failed","Offline · saved here");return false;}'));
assert.ok(app.includes('if(!window.confirm(message))return;'),'Require explicit permission to sign out with unsynced changes');
assert.ok(app.includes('notify(synced?"Signed out.'),'Never claim remote persistence after a failed sync');
assert.ok(history.includes('const legacy=!loading&&!browser.length'),'Do not flash a fake legacy row while server history loads');
console.log('PASS: recovery copies, save result integrity, offline sign-out safety and stable submission-history UI.');
