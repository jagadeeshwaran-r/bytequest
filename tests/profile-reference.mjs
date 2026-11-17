import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {profileMetrics} from "../dist/profile-extras.js";
import {profileMarkup} from "../dist/profile-view.js";

const html=profileMarkup({
 profile:{public_id:"fixture",username:"learner",display_name:"Learner",discoverable:true},
 isOwn:true,followers:1,following:1,ranking:{rank:2,points:250},
 stats:{solved:22,total:31,streak:4,days:["2026-11-17"],serverDay:"2026-11-17"},
 insights:{recentSolves:[{problemId:"two-sum",title:"Two Sum",difficulty:"Easy",solvedAt:"2026-11-17T10:00:00Z"}],skills:[],languages:[]}
},{catalogCount:31,catalog:[{id:"two-sum",title:"Two Sum"}]});
assert.ok(html.includes('calendar-heatmap-layout'));
assert.ok(html.includes('class="calendar-weekdays"'));
assert.ok(html.includes('class="calendar-key"'));
assert.ok(html.includes('class="calendar-legend-right"'));
assert.equal((html.match(/class="calendar-month"/g)||[]).length,12);
assert.ok(html.indexOf('profile-calendar-section')<html.indexOf('recent-solves'));
const metrics=profileMetrics({solved:22,total:31,streak:4},250,31);
assert.ok(!metrics.includes('streak-flame'),"Remove the flame graphic, not just conceal it");
assert.ok(metrics.includes('class="streak-count is-burning"'),"Retain number shimmer without an SVG");
assert.ok(!metrics.includes('streak-milestones'),"Remove locked/current streak milestone placeholders");
assert.ok(metrics.includes('22<small> / 31</small>'),"No score data changes");
assert.ok(metrics.includes('250'),"Points remain actual");
const css=readFileSync("dist/profile-reference.css","utf8");
const page=readFileSync("dist/community.html","utf8");
assert.ok(page.includes('profile-reference.css?v=1'));
assert.ok(page.indexOf('profile-reference.css')>page.indexOf('profile-rewards.css'),"Final rules override older metric alignments");
assert.ok(css.includes('grid-template-rows:18px 62px minmax(32px,auto)'),"Equal label, number and caption rows");
assert.ok(css.includes('justify-content:flex-end!important'),"Numbers and units align on the right");
assert.ok(css.includes('text-align:right!important'),"Right align labels, numbers and captions");
assert.ok(css.includes('font-variant-numeric:tabular-nums lining-nums'),"Uniform tabular digits");
assert.ok(css.includes('grid-template-columns:repeat(12,minmax(0,1fr))'),"Preserve one-row annual heatmap");
assert.ok(css.includes('background:var(--surface)!important'),"Use the existing ByteQuest theme instead of copying white-only template");
assert.ok(css.includes('#profileAnalytics .dashboard-chart'),"Bring solving rhythm in line with profile style");
assert.ok(css.includes('.recent-solves li a'),"Keep recently-solved rows consistent");
assert.ok(css.includes('@media(max-width:650px)')&&css.includes('prefers-reduced-motion'));
console.log("PASS: reference-aligned theme, uniform right metrics, no flame icon, heatmap legend, recent list and rhythm chart.");
