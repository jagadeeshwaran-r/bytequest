import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync('dist/app.js','utf8');
const html=readFileSync('dist/index.html','utf8');
const sync=app.slice(app.indexOf('async function syncCloud()'),app.indexOf('// Public catalog loading'));
const manual=app.slice(app.indexOf('$("syncNowBtn").onclick='),app.indexOf('$("signOutBtn").onclick='));

assert.ok(html.includes('manual-sync-feedback=1'),'Live pages must load a fresh version of the manual sync code');
assert.match(sync,/if\(!accountReady\)\{/,'Unready accounts must be handled explicitly');
assert.match(sync,/Account setup could not complete/,'If local account setup truly fails, explain the actual failure instead of an endless loading message');
assert.match(sync,/await changeAccount\(cloud\.user\)/,'Sync now must attempt local account recovery when boot was interrupted');
assert.match(sync,/Save in progress · another queued/,'Concurrent clicks must explain queued sync');
assert.match(sync,/You appear offline/,'Offline sync must have visible diagnostic');
assert.match(manual,/button.disabled=true;button.textContent="Syncing…"/,'Manual sync must visibly show in-progress status');
assert.match(manual,/const confirmed=await syncCloud\(\)/,'Manual sync must await the actual result');
assert.match(manual,/if\(confirmed\)\{/,'Never claim a successful save without confirmation');
assert.match(manual,/status.textContent=message;notify\("Cloud sync confirmed\."\)/,'Confirmed saves must be visibly acknowledged');
assert.match(manual,/Cloud save is not yet confirmed/,'Unconfirmed saves must never look successful');
assert.match(manual,/finally\{\s*button.disabled=false;button.textContent="Sync now"/,'Button must recover after failures');
assert.ok(!/state\.(?:drafts|solved|acceptedDays)\s*=|localStorage\.clear\(/.test(manual),
  'Manual sync must never clear or replace local drafts, solves or accepted days');
console.log('PASS: manual cloud sync is visible, truthful, retries in progress and does not modify local progress.');
