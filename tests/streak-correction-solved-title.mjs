import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {profileMetrics} from '../dist/profile-extras.js';

const adjusted=profileMetrics({solved:22,total:36,streak:6,streakAdjusted:true},120,36);
assert.match(adjusted,/streak-digits">6</,'Adjusted streak is visible on Sasi profile');
assert.match(adjusted,/Administratively adjusted streak/,'A manually credited streak must be distinguished from verified calendar days');
const natural=profileMetrics({solved:22,total:36,streak:4},120,36);
assert.match(natural,/Consecutive solve days/,'Unaffected profiles retain truthful natural-streak caption');
assert.ok(!natural.includes('Administratively adjusted streak'),'No adjustment labels for ordinary profiles');

const sql=readFileSync('database/streak-correction-audited.sql','utf8');
assert.match(sql,/bytequest_streak_corrections/);
assert.match(sql,/enable row level security/);
assert.match(sql,/revoke all on table public\.bytequest_streak_corrections from public,anon,authenticated/);
assert.match(sql,/for select to service_role using\(true\)/);
assert.match(sql,/correction_base>streak/);
assert.match(sql,/correction_cursor>=today-1/,'A correction expires if solving continuity is broken');
assert.match(sql,/streakAdjusted/);
assert.ok(!sql.includes("jsonb_set(payload"),'Administrative correction must not fabricate accepted solve days');
assert.ok(!sql.includes("where username='sasi'"),'Do not commit a named user adjustment in a public migration');

const app=readFileSync('dist/app.js','utf8');
const css=readFileSync('dist/catalog-refined.css','utf8');
const html=readFileSync('dist/index.html','utf8');
assert.ok(app.includes('class="problem-title\'+(state.solved[p.id]?\' is-solved\':\'\')+\'"'),
 'Only solved problems get the highlighted title class');
assert.match(css,/#mapView \.problem-table \.problem-title\.is-solved/);
assert.ok(app.includes(`class="'+(state.solved[current.id]?'is-solved':'')+'"`),
 'Opened solved problem heading uses the same lettering treatment as the catalog');
assert.match(css,/#practiceView \.problem-title-row h3\.is-solved/,'Green highlight also covers an opened solved challenge');
assert.match(css,/color:var\(--accent\)/,'Use the active ByteQuest theme color rather than a hard-coded one');
assert.match(css,/text-decoration-color:color-mix/,'Mark individual title letters, not a distracting colored row');
assert.match(html,/catalog-refined\.css\?v=catalog-1&amp;quiet=2&amp;solved-title=1/,'Refresh cached solved-title styles');
console.log('PASS: audited 6-day streak correction, no fake solve days, scoped solved-title lettering and theme-aware styles.');
