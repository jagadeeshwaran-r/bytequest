import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nextLivePollDelay} from '../supabase/functions/bytequest-firebase/live-stream.js';
import {PRESENCE_HEARTBEAT_MS,PRESENCE_INPUT_THROTTLE_MS} from '../dist/presence.js';

assert.equal(nextLivePollDelay(0),1000);
assert.equal(nextLivePollDelay(2),1000);
assert.equal(nextLivePollDelay(3),2000);
assert.equal(nextLivePollDelay(6),2500);
assert.equal(nextLivePollDelay(10,1),3,'The test fixture retains millisecond-scale polling');
assert.equal(PRESENCE_HEARTBEAT_MS,12000);
assert.equal(PRESENCE_INPUT_THROTTLE_MS,12000);
assert.ok(PRESENCE_HEARTBEAT_MS<30000,'Presence must remain fresher than the 30-second online lease');
// Simulate a quiet 50-second connection and compare to the original fixed 1s schedule.
let ticks=0,elapsed=0;
while(elapsed<50000){ticks++;elapsed+=nextLivePollDelay(ticks===1?0:ticks-1);}
assert.ok(ticks<=25,'Idle feed load should use at most half the original queries per 50 seconds, got '+ticks);
for(const page of ['index','community','leaderboard','studio']){
 const html=readFileSync('dist/'+page+'.html','utf8');
 const gate=html.match(/data-bq-app="([^"]+)"/);
 const preload=html.match(/<link rel="modulepreload" href="([^"]+)"/);
 assert.ok(gate&&preload,page+' must prefetch its own ES module');
 assert.equal(preload[1],gate[1],page+' preload must use exactly the guarded application URL');
 assert.ok(html.includes('rel="preconnect" href="https://zwubrziriuppkldrdoos.supabase.co"'),page+' preconnects to API');
 assert.ok(html.includes('dataset.bqMaintenanceCheck="pending"'),page+' keeps strict maintenance UI');
}
const stream=readFileSync('supabase/functions/bytequest-firebase/live-stream.js','utf8');
assert.ok(stream.includes('nextLivePollDelay(idlePolls,intervalMs)'));
assert.ok(stream.includes("text/event-stream"),'Live messages must remain server-sent events');
console.log('PASS: guarded module preloads, API preconnect, reduced presence and activity-feed query budget');
