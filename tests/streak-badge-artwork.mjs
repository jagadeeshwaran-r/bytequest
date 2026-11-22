import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {earnedStreakBadgesMarkup,earnedStreakBadges,STREAK_BADGE_TIERS} from '../dist/streak-awards.js';

const span=(start,n)=>Array.from({length:n},(_,i)=>new Date(Date.parse(start+'T00:00:00Z')+i*86400000).toISOString().slice(0,10));
const days=span('2026-01-01',7);
const markup=earnedStreakBadgesMarkup(days,'2026-11-22');
assert.match(markup,/class="streak-award tier-silver"/);
assert.match(markup,/viewBox="0 0 160 160"/);
for(const token of ['stamp-ink-rings','stamp-ring-outer','stamp-ring-middle','stamp-ring-inner','stamp-curve-text','stamp-number','stamp-day-label','stamp-crisp-lettering'])
 assert.ok(markup.includes(token),'Missing clear circular stamp element '+token);
assert.ok(markup.includes('>BYTEQUEST</textPath>'));
assert.ok(markup.includes('>ACHIEVEMENT</textPath>'));
assert.ok(markup.includes('>7</text>'));
assert.ok(markup.includes('>DAY STREAK</text>'));
assert.ok(!markup.includes('rotate(-11 80 86)'),'Milestone digit must not be tilted independently');
assert.ok(!markup.includes('stamp-stars')&&!markup.includes('stamp-tier'),'No central stars or overlapping tier text');
assert.ok(markup.includes('<span class="streak-award-name" aria-hidden="true">STREAKER</span>'),'Earned tier title remains readable below, not inside, the seal');
const clipped=markup.indexOf('mask="url(#bq-stamp-7-ink)"');
const crisp=markup.indexOf('class="stamp-crisp-lettering"');
assert.ok(clipped>=0&&crisp>clipped,'Ink wear must apply to rings only, not number or words');
assert.ok(markup.indexOf('</g>',clipped)<crisp,'Masked rings close before the text');
assert.ok(!markup.includes('ribbon')&&!markup.includes('laurel'));
assert.equal(earnedStreakBadgesMarkup([],'2026-11-22'),'');
assert.deepEqual(earnedStreakBadges(days,'2026-11-22').map(x=>x.days),[7]);
for(const tier of STREAK_BADGE_TIERS){
 const generated=earnedStreakBadgesMarkup(span('2025-01-01',tier.days),'2026-11-22');
 assert.ok(generated.includes('data-days="'+tier.days+'"'));
 assert.ok(generated.includes('bq-stamp-'+tier.days+'-ink'));
 const expectedSize=tier.days<10?'73':tier.days<100?'62':'45';
 assert.ok(generated.includes('style="font-size:'+expectedSize+'px"'),'Number size must remain legible for '+tier.days);
}
const css=readFileSync('dist/profile-streak-awards.css','utf8');
assert.ok(css.includes('html[data-theme="light"]'));
assert.ok(css.includes('font-variant-numeric:tabular-nums lining-nums'));
assert.ok(css.includes('prefers-reduced-motion:reduce'));
assert.ok(css.includes('width:clamp(116px,9.5vw,138px)'));
assert.ok(css.includes('width:clamp(104px,28vw,120px)'));
const page=readFileSync('dist/community.html','utf8');
const profile=readFileSync('dist/profile-view.js','utf8');
const community=readFileSync('dist/community.js','utf8');
assert.ok(page.includes('badge-stamp-readable=4'));
assert.ok(profile.includes('streak-awards.js?v=lifetime-1&badge-stamp-readable=4'));
assert.ok(community.includes('profile-view.js?v=lifetime-awards-1&github=1&streak-correction=1&badge-stamp-readable=4'));
assert.equal(page.split('online-alerts=1&amp;badge-stamp-readable=4').length,3);
console.log('PASS: readable seal labels and numbers, ring-only texture, responsive dark/light presentation and no stale assets');
