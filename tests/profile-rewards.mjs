import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {profileMetrics,streakMilestonesMarkup,STREAK_MILESTONES} from "../dist/profile-extras.js";
import {profileMarkup} from "../dist/profile-view.js";
import {presenceOnline} from "../dist/presence-model.js";

assert.deepEqual(STREAK_MILESTONES,[30,100,200,365]);
const count=(html,part)=>(html.match(new RegExp(part,"g"))||[]).length;
for(const [value,earned] of [[0,0],[4,0],[29,0],[30,1],[99,1],[100,2],[199,2],[200,3],[364,3],[365,4],[500,4]]){
 const html=streakMilestonesMarkup(value);
 assert.equal(count(html,"is-earned"),earned,value+" current-day streak earned count");
 assert.equal(count(html,"is-locked"),4-earned,value+" current-day streak locked count");
 assert.equal(count(html,'class="streak-milestone '),4,"All milestone badges remain visible");
}
const markup=profileMetrics({solved:22,total:31,streak:4},250,31);
assert.ok(markup.includes('22<small> / 31</small>'),"Solved values unchanged");
assert.ok(markup.includes('250'),"Point values unchanged");
assert.ok(markup.includes('class="streak-count is-burning"'),"An active streak shows flame");
assert.ok(markup.includes('class="streak-digits">4</span>'),"Streak digits are separate and animate independently of units");
assert.ok(markup.includes('>30d</span>')&&markup.includes('>100d</span>')&&markup.includes('>200d</span>')&&markup.includes('>365d</span>'));
assert.ok(!profileMetrics({solved:0,total:31,streak:0},0,31).includes('class="streak-count is-burning"'),"No flame for zero streak");
assert.ok(profileMetrics({solved:0,total:31,streak:30},0,31).includes('30-day streak badge earned'));
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
assert.ok(profile.includes('class="streak-milestones"')&&profile.includes('class="streak-count is-burning"'),"Badges also display on friends' profiles");
const html=readFileSync("dist/community.html","utf8");
const css=readFileSync("dist/profile-rewards.css","utf8");
assert.ok(html.includes('profile-rewards.css?v=1'));
assert.ok(html.indexOf("profile-rewards.css")>html.indexOf("calendar-year.css"),"Override the left-aligned metrics from prior calendar design");
assert.ok(css.includes("align-items:flex-end!important")&&css.includes("text-align:right!important"),"Stat columns align right");
assert.ok(css.includes("font-variant-numeric:tabular-nums lining-nums"),"All three metrics use aligned numerical glyphs");
assert.ok(css.includes("bq-streak-flame")&&css.includes("bq-streak-text"));
assert.ok(css.includes(".presence.online .presence-radar"));
assert.ok(css.includes("#12b981!important"),"Live dot is green");
assert.ok(css.includes("content:none!important"),"No red radar rings");
assert.ok(css.includes("@media(prefers-reduced-motion:reduce)"),"Animation respects reduced motion");
console.log("PASS: right-aligned uniform metrics, current streak milestones, flame and verified-online green pulse.");
