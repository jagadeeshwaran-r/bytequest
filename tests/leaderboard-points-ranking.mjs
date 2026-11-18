import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pointValues,pointsFor} from '../dist/rewards.js';

// Rank 1 + number of learners with STRICTLY more points. Ties are not broken
// by solved count, username or signup time; only display order is deterministic.
const fixture=[
 {username:'arjun',solves:['Hard','Hard']},  // 100 points, 2 solves
 {username:'jagdesh',solves:['Hard','Easy']},// 60 points, 2 solves
 {username:'rahul',solves:['Medium','Medium','Easy']}, // 60 points, 3 solves
 {username:'karthik',solves:['Easy','Easy','Easy','Easy','Easy']}, // 50, 5 solves
 {username:'priya',solves:['Easy','Easy','Easy']}, // 30, 3 solves
 {username:'guest',solves:[]} // 0
].map(row=>({...row,points:row.solves.reduce((v,d)=>v+pointsFor(d),0)}));
fixture.sort((a,b)=>b.points-a.points||a.username.localeCompare(b.username));
const ranked=fixture.map((row,i)=>({...row,rank:1+fixture.filter(x=>x.points>row.points).length,position:i+1}));
assert.deepEqual(ranked.map(x=>x.rank),[1,2,2,4,5,6],
 'Standard competition ranking (1224) shares ties and skips ranks appropriately');
assert.equal(ranked[1].rank,ranked[2].rank,
 'Two different solved counts with equal weighted points receive the SAME rank');
assert.ok(ranked[3].solves.length>ranked[0].solves.length&&ranked[3].rank>ranked[0].rank,
 'Many Easy solves must not outrank fewer Hard solves with higher points');
assert.deepEqual(pointValues,{Easy:10,Medium:25,Hard:50},
 'Client practice scoring must retain its configured difficulty weights');

const initial=readFileSync('database/leaderboard.sql','utf8');
const full=readFileSync('database/points-and-awards.sql','utf8');
const scoring="coalesce(sum(case q.content->>'difficulty' when 'Easy' then 10 when 'Medium' then 25 when 'Hard' then 50 else 0 end),0)::integer as points";
const rankRule='rank() over(order by points desc) as rank,row_number() over(order by points desc,username) as position';
for(const [name,sql] of [['database/leaderboard.sql',initial],['database/points-and-awards.sql',full]]){
 assert.ok(sql.includes(scoring),name+' must agree with frontend 10/25/50 point weights');
 assert.ok(sql.includes(rankRule),name+' must use 1224 RANK by points and stable alphabetical pagination order');
 assert.ok(!sql.includes('rank() over(order by solved desc)'),name+' may never revert to ranking by problem count');
 assert.ok(sql.includes('where q.id=e.key')===false || sql.includes('q.id=e.key'),
  name+' must keep matching published problem IDs');
 assert.ok(sql.includes('q.published'),name+' must exclude unpublished problems');
 assert.ok(sql.includes('jsonb_typeof(e.value)'),name+' must validate client-progress solve timestamps');
 assert.ok(sql.includes('start_ms and end_ms'),name+' must retain period-scoped ranking');
 assert.ok(sql.includes('board_scope')&&sql.includes("'friends'"),name+' must retain friend-scope filtering');
 assert.ok(sql.includes("revoke all on function public.bytequest_leaderboard"),name+' must not expose leaderboard RPC to public/anon');
 assert.ok(sql.includes("grant execute on function public.bytequest_leaderboard")&&sql.includes('service_role'),
   name+' must remain service-role-only');
}
assert.ok(initial.includes('create or replace function public.bytequest_leaderboard'),
 'Re-applying the bootstrap SQL must update existing installations safely');
assert.ok(full.includes('public.bytequest_profile_rank')&&full.includes("public.bytequest_leaderboard(p.owner_id,'global','all',0)"),
 'Profile rank must use the same weighted global scoreboard');
const board=readFileSync('dist/leaderboard.js','utf8');
const profile=readFileSync('dist/profile-view.js','utf8');
assert.ok(board.includes("'yourPoints'")&&board.includes('r.me?.points'),
 'Leaderboard points display must come from server-computed points');
assert.ok(profile.includes('r.ranking?.points'),
 'Profile score must come from server-computed points');
console.log('PASS: rank-by-points 1224 ties, 10/25/50 weights, period filters, service authorization and profile/board consistency.');
