import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {earnedStreakBadges,earnedStreakBadgesMarkup,STREAK_BADGE_TIERS} from '../dist/streak-awards.js';
import {profileMarkup} from '../dist/profile-view.js';
import {profileMetrics} from '../dist/profile-extras.js';

const span=(first,length)=>Array.from({length},(_,i)=>new Date(Date.parse(first+'T00:00:00Z')+i*86400000).toISOString().slice(0,10));
const counts=(days,cutoff='2026-11-18')=>Object.fromEntries(earnedStreakBadges(days,cutoff).map(b=>[b.days,b.count]));
assert.deepEqual(STREAK_BADGE_TIERS.map(t=>t.days),[7,30,100,200,365]);
assert.deepEqual(earnedStreakBadges([]),[],'New users see no locked badges');
assert.equal(earnedStreakBadgesMarkup([],'2026-11-18'),'');
assert.deepEqual(counts(span('2026-01-01',6)),{});
assert.deepEqual(counts(span('2026-01-01',7)),{'7':1});

const first=span('2026-01-01',7),second=span('2026-01-11',7);
assert.deepEqual(counts([...first,...second]),{'7':2},'A new streak following a break earns x2');
assert.deepEqual(counts([...first,...second,...second.slice(0,2)]),{'7':2},'Duplicate solves on one UTC day do not inflate counts');
assert.equal(earnedStreakBadges([...first,...second],'2026-11-18')[0].lastEarned,'2026-01-17');
assert.deepEqual(counts([...first,...second,...span('2026-02-01',30)]),{'7':3,'30':1});
assert.deepEqual(counts(span('2026-01-01',100)),{'7':1,'30':1,'100':1});
assert.deepEqual(counts(span('2026-01-01',200)),{'7':1,'30':1,'100':1,'200':1});
assert.deepEqual(counts(span('2024-01-01',365)),{'7':1,'30':1,'100':1,'200':1,'365':1},'Leap year must count UTC days accurately');
assert.deepEqual(counts(span('2024-01-01',400)),{'7':1,'30':1,'100':1,'200':1,'365':1},'Long streak earns each threshold only once');
const triple=[...span('2026-01-01',7),...span('2026-02-01',7),...span('2026-03-01',7)];
assert.deepEqual(counts(triple),{'7':3});
assert.deepEqual(counts([...triple,'2026-02-30','not-a-date','2027-01-01','2026-03-01']),{'7':3});
assert.deepEqual(counts([...triple].reverse()),{'7':3},'Order is irrelevant');
assert.deepEqual(counts(span('2026-01-01',30),'2026-01-06'),{},'Future solves must not grant badges');

const rendered=earnedStreakBadgesMarkup([...first,...second],'2026-11-18');
assert.match(rendered,/class="streak-awards"/);
assert.match(rendered,/data-days="7" data-count="2"/);
assert.match(rendered,/×2/);
assert.match(rendered,/STREAKER/);
assert.ok(!rendered.includes('CONSISTENT'),'Locked tiers remain hidden');
assert.ok(!rendered.includes('is-locked'));
assert.ok(rendered.includes('src="./assets/streak/7-day-rubber-stamp.png"'),'Seven-day artwork uses approved PNG');
assert.ok(earnedStreakBadgesMarkup(span('2026-01-01',30),'2026-11-18').includes('bq-stamp-30-ink'), 'Higher milestones retain dynamic SVGs');
const x3=earnedStreakBadgesMarkup(triple,'2026-11-18');
assert.ok(x3.includes('×3'));
assert.equal((x3.match(/class="streak-award tier-/g)||[]).length,1);

const sample=(days,streak=0)=>profileMarkup({
 profile:{public_id:'fixture-1',username:'fixture',display_name:'Fixture',discoverable:true},
 ranking:{rank:2,points:70},followers:0,following:0,isOwn:true,
 stats:{days,serverDay:'2026-11-18',solved:7,total:31,streak},
 insights:{recentSolves:[],languages:[],skills:[]}
},{catalogCount:31});
assert.equal(sample([]).includes('streak-awards'),false,'New users have no awards section');
assert.ok(sample([...first,...second],0).includes('×2'),'Past badge remains visible after streak is lost');
assert.ok(sample([...first,...second],0).includes('streak-award tier-silver'));
assert.ok(!profileMetrics({solved:0,total:31,streak:365},0,31).includes('streak-milestones'),'Old milestone row removed');
assert.ok(!profileMetrics({solved:0,total:31,streak:365},0,31).includes('streak-awards'),'Current streak alone does not invent awards');

const page=readFileSync('dist/community.html','utf8');
const css=readFileSync('dist/profile-streak-awards.css','utf8');
const community=readFileSync('dist/community.js','utf8');
assert.ok(page.includes('profile-streak-awards.css?v=lifetime-awards-1'));
assert.ok(page.includes('community.js?v=lifetime-awards-1'));
assert.ok(community.includes("profile-view.js?v=lifetime-awards-1"));
assert.ok(css.includes('.streak-award-multiplier'));
assert.ok(page.includes('profile-streak-awards.css?v=lifetime-awards-1&amp;compact=1'),'The compact stylesheet must bypass browser cache');
assert.match(css,/\.streak-awards\{[\s\S]*?justify-content:flex-start;flex-wrap:wrap;/,'Badge row does not stretch across the full profile width');
assert.match(css,/\.streak-awards-heading\{flex:0 1 220px/,'Heading should not consume all available space');
assert.match(css,/\.streak-award\{[\s\S]*?width:clamp\(142px,10\.5vw,176px\)/,'Badges are compact on desktop');
assert.match(css,/@media\(max-width:540px\)\{[\s\S]*?width:clamp\(122px,36vw,154px\)/,'Badges remain compact on narrow screens');
assert.ok(css.includes('.streak-awards + .profile-calendar-section'),'Tighter spacing only follows earned badges');
for(const color of ['silver','blue','gold','purple','red'])assert.ok(css.includes('.streak-award.tier-'+color));
assert.ok(css.includes('prefers-reduced-motion:reduce'));
console.log('PASS: earned-only lifetime streak ribbons retain awards after a break and display x2/x3 repeats.');
