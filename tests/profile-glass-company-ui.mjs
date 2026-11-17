import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {companyIcon,companyIcons} from '../dist/companies.js';
import {profileMetrics} from '../dist/profile-extras.js';

const icon=companyIcon('Google');
assert.ok(icon.includes('company-logo'),'Render the logo');
assert.ok(icon.includes('company-tooltip'),'Retain a single custom hover label');
assert.ok(icon.includes('aria-label="Google"'),'Keep company name accessible');
assert.ok(!icon.includes(' title='),'Avoid native title overlay on logo');
const extra=companyIcons(['Google','Amazon','Meta','Netflix','Adobe'],3);
assert.ok(extra.includes('>+2</button>'),'Only first three logos should show by default');
assert.ok(extra.includes('company-overflow-panel'),'Extra logos appear in the hover panel');
assert.ok(!extra.includes('title="Hover'),'Remove native +N hover bubble');
assert.equal((extra.match(/class="company-logo"/g)||[]).length,5,'No lost company logos');

const metrics=profileMetrics({solved:7,total:31,streak:4},70,31);
assert.ok(metrics.includes('data-streak-countdown'),'Timer stays in the profile');
const spacing=readFileSync('dist/profile-breathing.css','utf8');
assert.ok(spacing.includes('position:static!important;top:auto!important'),'Timer should not be shifted out of view');
assert.ok(spacing.includes('margin-top:clamp(12px,1.3vw,18px)'),'Reserve visible space near the divider');
assert.ok(spacing.includes('opacity:1!important;visibility:visible!important'),'Ensure countdown can display');
const profileHtml=readFileSync('dist/community.html','utf8');
assert.ok(!profileHtml.includes('data-admin-link hidden>Manage creators'),'Profile menu omits Manage creators');
for(const path of ['dist/index.html','dist/studio.html','dist/leaderboard.html']){
 const html=readFileSync(path,'utf8');
 assert.ok(html.includes('data-admin-link hidden>Manage creators'),'Admin role link stays available outside profile on '+path);
}
const ui=readFileSync('dist/premium-ui-polish.css','utf8');
assert.match(ui,/backdrop-filter:blur\(32px\) saturate\(175%\)/,'Glass navigation uses backdrop blur');
assert.match(ui,/prefers-reduced-transparency:reduce/,'Respect reduced-transparency accessibility preference');
assert.match(ui,/#profileAnalytics \.dashboard-chart/,'Keep solving rhythm scoped to profile analytics');
assert.match(ui,/\.graph-forecast-note/,'Do not remove forecast logic or explanation');
assert.match(ui,/\.company-overflow:hover/,'Hover group needs higher stacking order');
assert.match(ui,/company-overflow-panel/,'Popup retains internal company names');
for(const path of ['dist/index.html','dist/studio.html','dist/community.html','dist/leaderboard.html']){
 const html=readFileSync(path,'utf8');
 assert.ok(html.includes('premium-ui-polish.css?v=glass-rhythm-1'),'Updated glass styles on '+path);
}
assert.ok(readFileSync('dist/index.html','utf8').includes('app.js?v=company-hover-1'),'New app module version must load');
assert.ok(readFileSync('dist/app.js','utf8').includes("companies.js?v=company-tooltips-1"),'New company markup must load');
console.log('PASS: visible countdown, glass navigation, simplified chart, profile-only creator menu removal and company hover fixes.');
