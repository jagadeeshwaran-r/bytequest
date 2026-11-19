import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOnlineAlertGate,ONLINE_ALERT_THRESHOLD_MS} from '../dist/online-alert-gate.js';

assert.equal(ONLINE_ALERT_THRESHOLD_MS,60000);
let clock=1795104000000;
const backing=new Map();
const storage={
 getItem:k=>backing.get(k)||null,
 setItem:(k,v)=>backing.set(k,v),
 removeItem:k=>backing.delete(k)
};
const first=createOnlineAlertGate({now:()=>clock,storage});
first.setOwner('viewer-a');
const actor={public_id:'friend-public-id',username:'friend'};
assert.equal(first.accept(actor),true,'A real first online transition shows once');
for(let i=0;i<10;i++){
 clock+=1000;
 assert.equal(first.accept(actor),false,'Repeated reconnect '+i+' never creates another toast');
}
const otherTab=createOnlineAlertGate({now:()=>clock,storage});
otherTab.setOwner('viewer-a');
assert.equal(otherTab.accept(actor),false,'Another browser tab shares the cooldown');
const afterReload=createOnlineAlertGate({now:()=>clock,storage});
afterReload.setOwner('viewer-a');
assert.equal(afterReload.accept(actor),false,'Reload cannot bypass online-alert deduplication');
assert.equal(afterReload.accept({public_id:'second-friend'}),true,'Separate friends can still be announced independently');
clock+=50000;
assert.equal(first.accept(actor),true,'A new event after 60 seconds can be shown only if the server verified a fresh re-entry');
const newOwner=createOnlineAlertGate({now:()=>clock,storage});
newOwner.setOwner('viewer-b');
assert.equal(newOwner.accept(actor),true,'The new account must not inherit another account notification history');
newOwner.setOwner(null);
assert.equal(newOwner.accept(actor),false,'Signed-out browsers never show friend alerts');
assert.equal(first.accept(null),false);
assert.equal(first.accept({public_id:123}),false);
const unavailable=createOnlineAlertGate({now:()=>clock,storage:{getItem(){throw Error('storage blocked');},setItem(){throw Error('storage blocked');}}});
unavailable.setOwner('viewer-c');
assert.equal(unavailable.accept(actor),true,'Private browsing must still permit a single active alert');
assert.equal(unavailable.accept(actor),false,'In-memory fallback must deduplicate');

const sql=readFileSync('database/one-minute-online-arrivals.sql','utf8');
const shell=readFileSync('dist/shell.js','utf8');
assert.match(sql,/previous_activity>at_time-interval '1 minute'/,'Requires a full minute offline before a new arrival');
assert.match(sql,/last_notice>at_time-interval '1 minute'/,'One-minute server-side notification cooldown');
assert.match(sql,/pg_advisory_xact_lock/,'Concurrent page/tab presence updates serialized');
assert.match(sql,/public\.bytequest_presence_status\(recipient\.owner_id,recipient\.owner_id\)/,
 'Only online recipients get persisted friend_online alerts');
assert.match(sql,/reader_online/,'A returning offline recipient cannot receive a new alert');
assert.match(sql,/e\.created_at>=at_time-interval '1 minute'/,'Old queued friend_online events expire');
assert.match(sql,/e\.kind='message'/,'Messages remain readable even while recipient is offline');
assert.match(sql,/f\.following=actor\.public_id/,'Only actual followers get notifications');
assert.match(sql,/revoke all on function public\.bytequest_update_presence_live/,'Only verified service-role RPC may announce');
assert.match(shell,/onlineAlertGate\.setOwner\(owner\)/);
assert.match(shell,/document\.visibilityState==='visible'&&document\.hasFocus\(\)&&onlineAlertGate\.accept\(event\.actor\)/,
 'A background or unfocused recipient must never see an online toast');

console.log('PASS: one-minute online reentry/cooldown, ten reconnects suppressed, cross-tab dedupe, online-only delivery, and chat preservation.');
