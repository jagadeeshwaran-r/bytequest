import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {profileMarkup} from "../dist/profile-view.js";

const data={
 profile:{public_id:"profile-1",username:"designer",display_name:"Profile Designer",discoverable:true,bio:"Java learner"},
 isOwn:true,followers:5,following:2,
 ranking:{rank:4,points:70},
 stats:{solved:7,total:31,streak:4,days:["2026-11-14","2026-11-15","2026-11-16","2026-11-17"],serverDay:"2026-11-17"},
 insights:{recentSolves:[{problemId:"two-sum",title:"Two Sum",difficulty:"Easy",solvedAt:"2026-11-17T14:00:00Z"}],skills:[],languages:[]}
};
const html=profileMarkup(data,{catalogCount:31,catalog:[{id:"two-sum",title:"Two Sum"}]});
assert.ok(html.includes("profile-unboxed"));
assert.ok(!html.includes('class="white-card profile-main-card"'),"Outer shell remains unboxed; inner summary is unified");
assert.ok(html.includes('class="profile-overview"'),"Profile identity and stats share one summary");
assert.ok(html.includes('class="profile-person"'),"Identity sits above stats");
assert.ok(html.includes("7<small> / 31</small>"),"Keep authentic solved count");
assert.ok(html.includes("Consecutive solve days"),"Keep streak meaning");
assert.ok(html.includes("70"),"Keep points");
const overview=html.indexOf('class="profile-overview"'),
 metrics=html.indexOf('class="social-stats profile-metrics"'),
 calendar=html.indexOf('class="profile-calendar-section"'),
 recent=html.indexOf('class="recent-solves"'),
 skills=html.indexOf('class="profile-expertise"');
assert.ok(overview>=0&&metrics>overview&&calendar>metrics&&recent>calendar&&skills>recent,
 "Profile layout order: identity + stats, solving calendar, recently solved, skills");
assert.ok(html.includes('calendar-month-grid'),"Keep monthly calendar day cells");
assert.ok(html.includes('data-recent-problem-number="two-sum"'),"Keep clickable recent problem list");
assert.ok(html.includes('data-connections="followers"'),"Keep follower interactions");
assert.ok(html.includes('href="#edit"'),"Keep edit profile action");

const page=readFileSync("dist/community.html","utf8");
const css=readFileSync("dist/profile-unboxed.css","utf8");
assert.ok(page.includes('profile-unboxed.css?v=1'),"Load unboxed styles last");
assert.ok(page.indexOf('profile-unboxed.css')>page.indexOf('profile-compact.css'),"New styles override old stat cards");
assert.ok(css.includes('background:transparent!important'),"No backgrounds on metrics");
assert.ok(css.includes('border:0!important'),"No metric boxes or outer profile border");
assert.ok(css.includes('grid-template-columns:repeat(3,minmax(0,1fr))'),"Three right-side stat numbers");
assert.ok(css.includes('@media(max-width:620px)'),"Responsive phone layout");
console.log("PASS: unboxed right-aligned profile metrics, calendar-first activity, recent solves and responsive styles.");

assert.ok(html.includes('class="profile-summary-grid"'));
assert.ok(html.includes('class="profile-bottom-grid"'));
