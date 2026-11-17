import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {profileMetrics} from "../dist/profile-extras.js";
import {earnedStreakBadgesMarkup,earnedStreakBadges} from "../dist/streak-awards.js";
import {profileMarkup} from "../dist/profile-view.js";
import {presenceOnline} from "../dist/presence-model.js";

assert.deepEqual(earnedStreakBadges([]),[]);
assert.equal(earnedStreakBadgesMarkup([], '2026-11-18'),'');
const seven=Array.from({length:7},(_,i)=>new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10));
assert.ok(earnedStreakBadgesMarkup(seven,'2026-11-18').includes('STREAKER'));
assert.ok(!earnedStreakBadgesMarkup(seven,'2026-11-18').includes('CONSISTENT'));
const markup=profileMetrics({solved:22,total:31,streak:4},250,31);
assert.ok(markup.includes('22<small> / 31</small>'),"Solved values unchanged");
assert.ok(markup.includes('250'),"Point values unchanged");
assert.ok(markup.includes('class="streak-count is-burning"'),"An active streak shows flame");
assert.ok(markup.includes('class="streak-digits">4</span>'),"Streak digits are separate and animate independently of units");
assert.ok(!markup.includes('streak-milestones'),'Locked and current-only milestone row removed');
assert.ok(!profileMetrics({solved:0,total:31,streak:0},0,31).includes('class="streak-count is-burning"'),"No flame for zero streak");
assert.ok(!profileMetrics({solved:0,total:31,streak:30},0,31).includes('streak-awards'),'Current streak by itself does not create lifetime badges');
assert.equal(presenceOnline({online:true,visible:true,expiresAtMs:5000},4000),true);
assert.equal(presenceOnline({online:false,visible:true,expiresAtMs:5000},4000),false);
assert.equal(presenceOnline({online:true,visible:true,expiresAtMs:5000},5000),false);
assert.equal(presenceOnline({online:true,visible:false},4000),false);
const profile=profileMarkup({
 profile:{public_id:"u-1",username:"someone",display_name:"Someone",discoverable:true},
 isOwn:false,followers:0,following:0,ranking:{rank:1,points:250},
 stats:{solved:22,total:31,streak:4,days:["2026-11-17"],serverDay:"2026-11-17"},
 insights:{recentSolves:[],skills:[],languages:[]}
},{catalogCount:31});
assert.ok(!profile.includes('class="streak-milestones"')&&profile.includes('class="streak-count is-burning"'),'Old milestones removed from friends profiles');
const html=readFileSync("dist/community.html","utf8");
const css=readFileSync("dist/profile-rewards.css","utf8");
assert.ok(html.includes('profile-rewards.css?v=1'));
const profileScript=readFileSync("dist/profile-view.js","utf8");
const communityScript=readFileSync("dist/community.js","utf8");
assert.ok(profileScript.includes("profile-compact-1&rewards=4"),"Changed profile metrics module must bypass old browser cache");
assert.ok(communityScript.includes("profile-view.js?v=lifetime-awards-1"),"Updated profile renderer must bypass old browser cache");
assert.ok(html.indexOf("profile-rewards.css")>html.indexOf("calendar-year.css"),"Override the left-aligned metrics from prior calendar design");
assert.ok(css.includes("align-items:flex-end!important")&&css.includes("text-align:right!important"),"Stat columns align right");
assert.ok(css.includes("font-variant-numeric:tabular-nums lining-nums"),"All three metrics use aligned numerical glyphs");
assert.ok(!css.includes("bq-streak-flame")&&css.includes("bq-streak-text"),"Keep the animated number but remove unused flame icon CSS");
assert.ok(!markup.includes("streak-flame"),"No flame SVG in the streak number");
assert.ok(css.includes(".presence.online .presence-radar"));
assert.ok(css.includes("#12b981!important"),"Live dot is green");
assert.ok(css.includes("content:none!important"),"No red radar rings");
assert.ok(css.includes("@media(prefers-reduced-motion:reduce)"),"Animation respects reduced motion");
console.log("PASS: right-aligned uniform metrics, earned-only streak awards, and green verified-online pulse.");
