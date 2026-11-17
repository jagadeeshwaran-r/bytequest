import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {calendarYears,yearCalendar,calendarMonthsMarkup,bindProfileCalendar,monthCalendar} from "../dist/profile-calendar.js";
import {profileMarkup} from "../dist/profile-view.js";
const now="2026-11-17";
const days=["2024-02-29","2025-12-31","2026-01-01","2026-11-16","2026-11-17","2026-11-18","2026-02-30","2027-01-01"];
const years=calendarYears(days,now);
assert.equal(years[0],2026);
assert.equal(years.at(-1),2021,"Offer a useful range even if the learner only joined this year");
assert.ok(years.includes(2024));
const current=yearCalendar(days,now);
assert.equal(current.year,2026);
assert.equal(current.months.length,12);
assert.equal(current.start,"2026-01-01");
assert.equal(current.end,now,"Current year ends at the server's UTC today");
assert.equal(current.activeCount,3,"Future, invalid dates and older years never count in the displayed year");
assert.equal(current.months[10].cells.find(c=>c?.date==="2026-11-18").future,true);
assert.equal(current.months[10].cells.find(c=>c?.date==="2026-11-17").active,true);
const old=yearCalendar(days,now,2024);
assert.equal(old.year,2024);
assert.equal(old.end,"2024-12-31");
assert.equal(old.activeCount,1,"Leap-year solution must be counted");
assert.ok(old.months[1].cells.find(c=>c?.date==="2024-02-29")?.active);
assert.equal(yearCalendar(days,now,2025).activeCount,1);
assert.equal(yearCalendar(days,now,2027).year,2026,"No year after the server date");
assert.equal(yearCalendar(days,now,0).year,2026,"Invalid selection falls back to the current year");
assert.equal(monthCalendar(days,now).months.length,12,"Legacy rolling calendar stays backward-compatible");
const markup=calendarMonthsMarkup(current);
assert.equal((markup.match(/class="calendar-month"/g)||[]).length,12);
assert.ok(markup.includes('class="calendar-day future"'));
assert.ok(markup.includes('2026-11-17: accepted solve'));
assert.ok(!markup.includes('2027-01-01'));
const elements={
  '#profileCalendarYear':{value:"2026",listeners:{},addEventListener(type,fn){this.listeners[type]=fn}},
  '#profileCalendarMonths':{innerHTML:"",setAttribute(k,v){this[k]=v}},
  '#profileCalendarRange':{textContent:""},
  '#profileCalendarActivity':{textContent:""}
};
assert.equal(bindProfileCalendar({querySelector:s=>elements[s]},days,now),true);
elements['#profileCalendarYear'].value="2024";
elements['#profileCalendarYear'].listeners.change();
assert.ok(elements['#profileCalendarMonths'].innerHTML.includes("2024-02-29: accepted solve"));
assert.equal(elements['#profileCalendarRange'].textContent,"2024-01-01 → 2024-12-31");
assert.equal(elements['#profileCalendarActivity'].textContent,"1 solve day");
assert.equal(bindProfileCalendar({},days,now),false);
const profile=profileMarkup({
 profile:{public_id:"fixture",username:"learner",display_name:"Learner",discoverable:true},
 followers:0,following:0,isOwn:true,ranking:{points:70,rank:0},
 stats:{days,serverDay:now,solved:3,streak:2,total:31},
 insights:{recentSolves:[],skills:[],languages:[]}
},{catalogCount:31});
assert.ok(profile.includes('id="profileCalendarYear"'));
assert.ok(profile.includes('<option value="2026" selected>2026</option>'));
assert.ok(profile.indexOf('id="profileCalendarMonths"')<profile.indexOf('class="recent-solves"'));
const community=readFileSync("dist/community.js","utf8");
const page=readFileSync("dist/community.html","utf8");
const css=readFileSync("dist/calendar-year.css","utf8");
assert.ok(community.includes("bindProfileCalendar($('profileContent'),r.stats.days,r.stats.serverDay)"));
assert.ok(page.includes("calendar-year.css?v=1"));
assert.ok(page.indexOf("calendar-year.css")>page.indexOf("profile-unboxed.css"));
assert.ok(css.includes("grid-template-columns:repeat(6,minmax(0,1fr))"));
assert.ok(css.includes("grid-template-columns:repeat(2,minmax(0,1fr))"));
assert.ok(css.includes("17px"));
console.log("PASS: selected-year heatmap, enlarged responsive cells, leap dates, future-day exclusion and in-place year switching.");
