import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {yearCalendar,calendarMonthsMarkup,refreshProfileCalendar} from '../dist/profile-calendar.js';
import {streakCountdownUrgency,bindStreakCountdown} from '../dist/streak-countdown.js';
import {rankRibbonBadge,rankCup} from '../dist/rewards.js';
import {profileMarkup} from '../dist/profile-view.js';

const utc=(date,h=0,m=0,s=0)=>Date.parse(date+'T'+[h,m,s].map(v=>String(v).padStart(2,'0')).join(':')+'Z');
const solved=yearCalendar(['2026-11-17'],'2026-11-17');
const markup=calendarMonthsMarkup(solved);
assert.match(markup,/calendar-day solved/);
assert.ok(!markup.includes('today-pending')&&!markup.includes('today-solved'),
 'Calendar must not render special today borders or blinking markers');
assert.ok(!markup.includes('aria-current="date"'));
assert.match(markup,/2026-11-17: accepted solve/);
assert.match(calendarMonthsMarkup(yearCalendar([],'2026-11-17')), /calendar-day"/);
const historical=calendarMonthsMarkup(yearCalendar(['2024-02-29'],'2026-11-17',2024));
assert.ok(!historical.includes('today-pending'));
assert.ok(!historical.includes('today-solved'));

const elements={
 '#profileCalendarYear':{value:'2026',options:[{value:'2026'}],listeners:{},
  addEventListener(type,fn){this.listeners[type]=fn},
  add(option,index){this.options.splice(index,0,option)}},
 '#profileCalendarMonths':{innerHTML:'',setAttribute(name,value){this[name]=value}},
 '#profileCalendarRange':{textContent:''},
 '#profileCalendarActivity':{textContent:''}
};
const root={querySelector:key=>elements[key],ownerDocument:{createElement:()=>({})}};
assert.equal(refreshProfileCalendar(root,['2026-11-17'],'2026-11-17',utc('2026-11-17',19)),true);
assert.match(elements['#profileCalendarMonths'].innerHTML,/calendar-day solved/);
assert.equal(refreshProfileCalendar(root,['2026-11-17'],'2026-11-17',utc('2026-11-18',0)),true);
assert.ok(!elements['#profileCalendarMonths'].innerHTML.includes('today-pending'));
assert.equal(elements['#profileCalendarRange'].textContent,'2026-01-01 → 2026-11-18');
assert.equal(elements['#profileCalendarActivity'].textContent,'1 solve day');
assert.equal(refreshProfileCalendar(root,['2026-11-17'],'2026-11-17',utc('2027-01-01')),true);
assert.equal(elements['#profileCalendarYear'].value,'2027');
assert.equal(elements['#profileCalendarYear'].options[0].value,'2027');
assert.equal(refreshProfileCalendar({},[],'2026-11-17',utc('2026-11-17')),false);

assert.equal(streakCountdownUrgency(utc('2026-11-17',0)),'green');
assert.equal(streakCountdownUrgency(utc('2026-11-17',12)),'green');
assert.equal(streakCountdownUrgency(utc('2026-11-17',12,0,1)),'orange');
assert.equal(streakCountdownUrgency(utc('2026-11-17',20)),'orange');
assert.equal(streakCountdownUrgency(utc('2026-11-17',20,0,1)),'red');
assert.equal(streakCountdownUrgency(utc('2026-11-18',0)),'green');
assert.throws(()=>streakCountdownUrgency(NaN),/valid timestamp/);
let at=utc('2026-11-17',19,59,59),tick,disposed=0;
const signals=[],wrapper={dataset:{}},node={textContent:'',isConnected:true,closest:()=>wrapper};
const stop=bindStreakCountdown({querySelector:()=>node},{now:()=>at,every:fn=>{tick=fn;return 5},stop:()=>{disposed++},onDayChange:day=>signals.push(day)});
assert.equal(wrapper.dataset.urgency,'orange');
at=utc('2026-11-17',20,0,1);tick();assert.equal(wrapper.dataset.urgency,'red');
at=utc('2026-11-18');tick();assert.equal(wrapper.dataset.urgency,'green');
assert.deepEqual(signals,['2026-11-18']);
stop();assert.equal(disposed,1);

for(const [rank,name] of [[1,'Gold'],[2,'Silver'],[3,'Bronze']]){
 const badge=rankRibbonBadge(rank);
 assert.ok(badge.includes(name+' ribbon badge, global rank '+rank));
 assert.ok(badge.includes('rank-ribbon tier-'+name.toLowerCase()));
}
assert.equal(rankRibbonBadge(4),'');
assert.ok(rankCup(2).includes('rank-cup'),'Leaderboard trophies remain unchanged');
const profile=profileMarkup({
 profile:{public_id:'a',username:'podium',display_name:'Podium user',discoverable:true},
 ranking:{rank:2,points:70},followers:1,following:1,isOwn:true,
 stats:{days:['2026-11-17'],serverDay:'2026-11-17',solved:7,total:31,streak:4},
 insights:{recentSolves:[],languages:[],skills:[]}
},{catalogCount:31});
const avatarStart=profile.indexOf('class="profile-avatar-frame"');
const avatarEnd=profile.indexOf('</span><div class="profile-identity">',avatarStart);
const nameStart=profile.indexOf('<h2 class="profile-title');
const nameEnd=profile.indexOf('</h2>',nameStart);
assert.ok(avatarStart>=0&&avatarEnd>avatarStart);
assert.ok(profile.slice(avatarStart,avatarEnd).includes('rank-ribbon tier-silver'),
 'Rank ribbon is anchored at the avatar lower-right');
assert.ok(!profile.slice(nameStart,nameEnd).includes('rank-ribbon'),
 'Username is free of ribbon badge');
assert.ok(!profile.includes('calendar-key-today'),'Remove today label from calendar legend');
assert.ok(!profile.includes('red blinking outline'));
const community=readFileSync('dist/community.js','utf8');
const page=readFileSync('dist/community.html','utf8');
const css=readFileSync('dist/profile-today-ribbon.css','utf8');
const calendarSource=readFileSync('dist/profile-calendar.js','utf8');
assert.match(community,/onDayChange:\(\)=>refreshProfileCalendar/,'UTC calendar date-range refresh remains');
assert.ok(page.includes('profile-today-ribbon.css?v=avatar-clean-1'));
assert.ok(page.includes('community.js?v=lifetime-awards-1'));
assert.ok(css.includes('.profile-hero>.profile-avatar-frame'));
assert.ok(css.includes('.profile-avatar-frame>.rank-ribbon'));
assert.ok(css.includes('bottom:-13px'));
assert.ok(!css.includes('bq-today-alert'));
assert.ok(!css.includes('today-pending'));
assert.ok(!calendarSource.includes('today-solved'));
for(const color of ['green','orange','red'])assert.ok(css.includes('[data-urgency="'+color+'"]'));
console.log('PASS: badge overlays avatar, no red today calendar indicator, UTC urgency and rank metadata retained.');
