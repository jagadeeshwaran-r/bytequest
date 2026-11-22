import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {earnedStreakBadgesMarkup,earnedStreakBadges,STREAK_BADGE_TIERS} from '../dist/streak-awards.js';

const span=(start,n)=>Array.from({length:n},(_,i)=>new Date(Date.parse(start+'T00:00:00Z')+i*86400000).toISOString().slice(0,10));
const days=span('2026-01-01',7);
const markup=earnedStreakBadgesMarkup(days,'2026-11-22');
assert.match(markup,/class="streak-award tier-silver"/);
assert.match(markup,/viewBox="0 0 160 160"/,'Circular ink stamp uses square viewBox');
for(const mark of ['stamp-ring-outer','stamp-ring-middle','stamp-ring-inner','stamp-curve-text','stamp-number','stamp-tier','stamp-impression','stamp-stars','stamp-mark'])
  assert.ok(markup.includes(mark),'Missing rubber stamp element '+mark);
assert.ok(markup.includes('>BYTEQUEST</textPath>'));
assert.ok(markup.includes('>DAY STREAK</textPath>'));
assert.ok(markup.includes('>7</text>'));
assert.ok(markup.includes('>STREAKER</text>'));
assert.ok(markup.includes('<mask id="bq-stamp-7-ink"'),'Distressed appearance uses cut-out ink mask');
assert.ok(!markup.includes('ribbon')&&!markup.includes('laurel'),'No ribbon or award-shield decoration');
assert.equal(earnedStreakBadgesMarkup([],'2026-11-22'),'','Never show locked tiers');
assert.deepEqual(earnedStreakBadges(days,'2026-11-22').map(x=>x.days),[7]);
for(const tier of STREAK_BADGE_TIERS){
 const generated=earnedStreakBadgesMarkup(span('2025-01-01',tier.days),'2026-11-22');
 assert.ok(generated.includes('data-days="'+tier.days+'"'),'Must preserve '+tier.days+' day tier');
 assert.ok(generated.includes('bq-stamp-'+tier.days+'-ink'),'Unique SVG defs for '+tier.days);
}
const css=readFileSync('dist/profile-streak-awards.css','utf8');
assert.ok(css.includes('font-variant-numeric:tabular-nums lining-nums'));
assert.ok(css.includes('html[data-theme="light"]'),'Light theme ink colors must be defined');
assert.ok(css.includes('.streak-award.tier-silver')&&css.includes('.streak-award.tier-red'));
assert.ok(css.includes('prefers-reduced-motion:reduce'),'Avoid unrequested motion');
assert.ok(css.includes('width:clamp(88px,7.3vw,112px)'),'Compact stamp row');
assert.ok(css.includes('width:clamp(76px,22vw,98px)'),'Mobile compact stamp');
const page=readFileSync('dist/community.html','utf8');
const profile=readFileSync('dist/profile-view.js','utf8');
const community=readFileSync('dist/community.js','utf8');
assert.ok(page.includes('badge-stamp=3'),'Bump guarded module and stylesheet cache URLs');
assert.ok(profile.includes('streak-awards.js?v=lifetime-1&badge-stamp=3'));
assert.ok(community.includes('profile-view.js?v=lifetime-awards-1&github=1&streak-correction=1&badge-stamp=3'));
assert.equal(page.split('online-alerts=1&amp;badge-stamp=3').length,3,'Update both preload and guarded app module');
console.log('PASS: distressed circular stamp badges, earned tiers, contrast, repeat awards and cache refresh');
