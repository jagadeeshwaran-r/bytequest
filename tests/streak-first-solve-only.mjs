import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blankProgress,firstSolveDays,solveStreak,validateProgress,mergeProgress} from '../dist/progress.js';

const at=s=>Date.parse(s+'T10:00:00Z');
const now=Date.parse('2026-10-20T23:00:00Z');
const p=blankProgress();
p.acceptedDays=['2026-10-18','2026-10-19','2026-10-20'];
p.activity=[
 {id:'two-sum',at:at('2026-10-20'),type:'review'},
 {id:'two-sum',at:at('2026-10-20'),type:'solved'}
];
assert.equal(solveStreak(p,now),0,'Legacy review and accepted-day records cannot extend the streak');
assert.deepEqual(validateProgress(p).acceptedDays,[],'Legacy acceptedDays must not restore invalid days');

p.solved={'two-sum':at('2026-10-18')};
assert.equal(solveStreak(p,now),0,'A repeat submission today does not extend a broken streak');
assert.deepEqual(firstSolveDays(p.solved,now),['2026-10-18']);
p.solved['valid-anagram']=at('2026-10-19');
assert.equal(solveStreak(p,now),2,'Yesterday is the active streak until a new problem is solved today');
p.solved['contains-duplicate']=at('2026-10-20');
assert.equal(solveStreak(p,now),3);
p.solved['reverse-linked-list']=at('2026-10-20');
assert.equal(solveStreak(p,now),3,'Multiple first solves today only earn one day');
assert.deepEqual(validateProgress(p).acceptedDays,['2026-10-18','2026-10-19','2026-10-20']);
const yesterday=Date.parse('2026-10-19T12:00:00Z');
assert.equal(solveStreak(p,yesterday),2,'Future-dated solves must not count early');

const legacy=blankProgress();
legacy.solved['two-sum']=at('2026-10-18');
legacy.acceptedDays=['2026-10-19','2026-10-20'];
legacy.activity=[{id:'two-sum',at:at('2026-10-20'),type:'review'}];
const merged=mergeProgress(legacy,{...blankProgress(),solved:{'valid-anagram':at('2026-10-19')}});
assert.deepEqual(merged.acceptedDays,['2026-10-18','2026-10-19'],'Merges must not resurrect review-only days');
assert.equal(solveStreak(merged,now),2);
assert.deepEqual(firstSolveDays({'two-sum':Number.NaN,'reverse-linked-list':Date.parse('2026-12-01T10:00:00Z')},now),[]);

const app=readFileSync('dist/app.js','utf8');
const client=readFileSync('dist/progress.js','utf8');
const domain=readFileSync('supabase/functions/bytequest-firebase/domain/progress.js','utf8');
const profileSql=readFileSync('database/streak-correction-audited.sql','utf8');
const baselineSql=readFileSync('database/submissions-and-solving.sql','utf8');
const upgradeSql=readFileSync('database/first-solve-only-streak-upgrade.sql','utf8');
const index=readFileSync('dist/index.html','utf8');
assert.equal(client,domain,'Client and server progress normalization must stay aligned');
assert.match(app,/if\(first\)\{[\s\S]*?state\.solved\[p\.id\]=now;[\s\S]*?state\.acceptedDays\.push\(solvedDay\)/,
 'Only the first solve can credit a new streak day in the browser');
assert.match(index,/first-solve=1/,'Refresh the frontend bundle on deploy');
assert.match(profileSql,/with earliest as \([\s\S]*?union all[\s\S]*?min\(s\.created_at\)/,
 'Profile activity must use earliest verified submissions');
assert.match(profileSql,/select id,min\(at_ms\) as at_ms from earliest group by id/,
 'First solve is unique per problem across client and server');
const latestDays=profileSql.split('with accepted_days as (').at(-1).split(') select coalesce(jsonb_agg')[0];
assert.ok(!latestDays.includes("payload->'acceptedDays'")&&!latestDays.includes("'review'")&&!latestDays.includes('s.created_at'),
 'Legacy dates and repeat reviews must not influence the profile calendar or streak awards');
assert.match(baselineSql,/if not \(coalesce\(payload->'solved','\{\}'\) \? q\.id\) then[\s\S]*?credited_day:=/,
 'The verified submission path must credit acceptedDays only on the first solve');
assert.ok(upgradeSql.includes('CREATE OR REPLACE FUNCTION public.bytequest_submission_record'));
assert.ok(upgradeSql.includes('CREATE OR REPLACE FUNCTION public.bytequest_profile_activity'));
assert.ok(upgradeSql.includes('select id,min(at_ms) as at_ms from earliest group by id'));
console.log('PASS: first accepted problems only extend UTC streaks, and server/profile rules ignore repeat submissions and reviews.');
