import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {earnedStreakBadgesMarkup,earnedStreakBadges,STREAK_BADGE_TIERS} from '../dist/streak-awards.js';
const span=(start,n)=>Array.from({length:n},(_,i)=>new Date(Date.parse(start+'T00:00:00Z')+i*86400000).toISOString().slice(0,10));
const markup=earnedStreakBadgesMarkup(span('2026-01-01',7),'2026-11-22');
assert.match(markup,/class="streak-award tier-silver"/);
assert.match(markup,/viewBox="0 0 200 200"/);
for(const token of ['stamp-ink-rings','stamp-ring-outer','stamp-ring-inner',
  'stamp-impression','stamp-curve-text','stamp-number','stamp-day-band',
  'stamp-day-ink','stamp-day-text','stamp-bottom-word','stamp-star','streak-award-name'])
 assert.ok(markup.includes(token),'Missing realistic stamp element '+token);
assert.ok(markup.includes('>BYTEQUEST</textPath>'));
assert.ok(markup.includes('y="120" text-anchor="middle" style="font-size:95px">7</text>'));
assert.ok(markup.includes('transform="rotate(-9 100 124)"'));
assert.ok(markup.includes('>DAY</text>')&&markup.includes('>STREAK</text>'));
assert.ok(markup.includes('<span class="streak-award-name" aria-hidden="true">STREAKER</span>'));
assert.ok(markup.includes('mask="url(#bq-stamp-7-ink)"'));
assert.ok((markup.match(/<ellipse/g)||[]).length>=32,'Ring edges must show irregular ink wear');
assert.ok((markup.match(/<circle/g)||[]).length>=90,'Stamp must include fine ink texture');
assert.equal(earnedStreakBadgesMarkup([],'2026-11-22'),'');
assert.deepEqual(earnedStreakBadges(span('2026-01-01',7),'2026-11-22').map(x=>x.days),[7]);
for(const tier of STREAK_BADGE_TIERS){
 const generated=earnedStreakBadgesMarkup(span('2025-01-01',tier.days),'2026-11-22');
 assert.ok(generated.includes('data-days="'+tier.days+'"'));
 assert.ok(generated.includes('bq-stamp-'+tier.days+'-ink'));
 const size=tier.days<10?95:tier.days<100?82:62;
 assert.ok(generated.includes('style="font-size:'+size+'px"'));
}
const css=readFileSync('dist/profile-streak-awards.css','utf8');
assert.ok(css.includes('html[data-theme="light"]'));
assert.ok(css.includes('--stamp-paper:#f6f8f7'),'Band knockout must work in light mode');
assert.ok(css.includes('font-variant-numeric:tabular-nums lining-nums'));
assert.ok(css.includes('prefers-reduced-motion:reduce'));
assert.ok(css.includes('width:clamp(142px,10.5vw,176px)'));
assert.ok(css.includes('width:clamp(122px,36vw,154px)'));
const html=readFileSync('dist/community.html','utf8');
const profile=readFileSync('dist/profile-view.js','utf8');
const community=readFileSync('dist/community.js','utf8');
assert.ok(html.includes('badge-real-ink=6'));
assert.ok(profile.includes('streak-awards.js?v=lifetime-1&badge-real-ink=6'));
assert.ok(community.includes('profile-view.js?v=lifetime-awards-1&github=1&streak-correction=1&badge-real-ink=6'));
assert.equal(html.split('online-alerts=1&amp;badge-real-ink=6').length,3);
console.log('PASS: realistic embossed ink stamp, diagonal DAY band, dark/light and earned streak invariants');
