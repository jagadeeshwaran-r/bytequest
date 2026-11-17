import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {yearCalendar,calendarMonthsMarkup,refreshProfileCalendar} from '../dist/profile-calendar.js';
import {streakCountdownUrgency,bindStreakCountdown} from '../dist/streak-countdown.js';
import {rankRibbonBadge,rankCup} from '../dist/rewards.js';
import {profileMarkup} from '../dist/profile-view.js';

const utc=(date,h=0,m=0,s=0)=>Date.parse(date+'T'+[h,m,s].map(v=>String(v).padStart(2,'0')).join(':')+'Z');
const solved=yearCalendar(['2026-11-17'],'2026-11-17');
const todaySolved=calendarMonthsMarkup(solved,'2026-11-17');
assert.match(todaySolved,/calendar-day solved today-solved/);
assert.match(todaySolved,/aria-current="date"/);
assert.match(todaySolved,/today \(UTC\)/);
assert.equal((todaySolved.match(/aria-current="date"/g)||[]).length,1,'Only one current UTC date');
assert.match(calendarMonthsMarkup(yearCalendar([],'2026-11-17'),'2026-11-17'),/calendar-day today-pending/);
const futureToday=calendarMonthsMarkup(solved,'2026-11-18');
assert.match(futureToday,/calendar-day future today-pending/,'A profile snapshot from yesterday still marks actual UTC today');
const historical=calendarMonthsMarkup(yearCalendar(['2024-02-29'],'2026-11-17',2024),'2026-11-17');
assert.equal(historical.includes('today-pending'),false,'Viewing old years does not show a false today marker');
assert.equal(historical.includes('today-solved'),false);

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
assert.match(elements['#profileCalendarMonths'].innerHTML,/today-solved/);
assert.equal(refreshProfileCalendar(root,['2026-11-17'],'2026-11-17',utc('2026-11-18',0)),true);
assert.match(elements['#profileCalendarMonths'].innerHTML,/today-pending/,'Today marker moves after midnight');
assert.equal(elements['#profileCalendarRange'].textContent,'2026-01-01 → 2026-11-18');
assert.equal(elements['#profileCalendarActivity'].textContent,'1 solve day','Calendar never invents an accepted day');
assert.equal(refreshProfileCalendar(root,['2026-11-17'],'2026-11-17',utc('2027-01-01')),true);
assert.equal(elements['#profileCalendarYear'].value,'2027');
assert.equal(elements['#profileCalendarYear'].options[0].value,'2027','Year choice keeps working over New Year');
assert.match(elements['#profileCalendarMonths'].innerHTML,/today-pending/);
assert.equal(refreshProfileCalendar({},[],'2026-11-17',utc('2026-11-17')),false);

assert.equal(streakCountdownUrgency(utc('2026-11-17',0)),'green');
assert.equal(streakCountdownUrgency(utc('2026-11-17',12)),'green');
assert.equal(streakCountdownUrgency(utc('2026-11-17',12,0,1)),'orange');
assert.equal(streakCountdownUrgency(utc('2026-11-17',20)),'orange');
assert.equal(streakCountdownUrgency(utc('2026-11-17',20,0,1)),'red');
assert.equal(streakCountdownUrgency(utc('2026-11-17',23,59,59)),'red');
assert.equal(streakCountdownUrgency(utc('2026-11-18',0)),'green');
assert.throws(()=>streakCountdownUrgency(NaN),/valid timestamp/);
let at=utc('2026-11-17',19,59,59),tick,disposed=0;const signals=[];
const wrapper={dataset:{}},node={textContent:'',isConnected:true,closest:()=>wrapper};
const dispose=bindStreakCountdown({querySelector:()=>node},{now:()=>at,every:fn=>{tick=fn;return 5},stop:()=>{disposed++},onDayChange:d=>signals.push(d)});
assert.equal(wrapper.dataset.urgency,'orange');
assert.equal(node.textContent,'04:00:01');
at=utc('2026-11-17',20,0,1);tick();assert.equal(wrapper.dataset.urgency,'red');
at=utc('2026-11-18');tick();assert.equal(wrapper.dataset.urgency,'green');
assert.deepEqual(signals,['2026-11-18']);
dispose();assert.equal(disposed,1);

for(const [rank,name] of [[1,'Gold'],[2,'Silver'],[3,'Bronze']]){
 const medal=rankRibbonBadge(rank);
 assert.match(medal,/<svg viewBox="0 0 68 78"/);
 assert.ok(medal.includes(name+' ribbon badge, global rank '+rank));
 assert.ok(medal.includes('rank-ribbon tier-'+name.toLowerCase()));
 assert.match(medal,/ribbonSeal|polygon points="/);
}
assert.equal(rankRibbonBadge(4),'');
assert.equal(rankRibbonBadge(0),'');
assert.ok(rankCup(2).includes('rank-cup'),'Leaderboard still has existing cup ranking');
const profile=profileMarkup({
 profile:{public_id:'a',username:'podium',display_name:'Podium user',discoverable:true},
 ranking:{rank:2,points:70},followers:1,following:1,isOwn:true,
 stats:{days:['2026-11-17'],serverDay:'2026-11-17',solved:7,total:31,streak:4},
 insights:{recentSolves:[],languages:[],skills:[]}
},{catalogCount:31});
assert.ok(profile.includes('rank-ribbon tier-silver'));
assert.ok(!profile.includes('class="rank-cup'));
assert.ok(profile.includes('calendar-key-today'));

const community=readFileSync('dist/community.js','utf8');
const page=readFileSync('dist/community.html','utf8');
const css=readFileSync('dist/profile-today-ribbon.css','utf8');
assert.match(community,/onDayChange:\(\)=>refreshProfileCalendar/,'UTC rollover refreshes today heatmap');
assert.ok(page.includes('profile-today-ribbon.css?v=today-ribbon-1'));
assert.ok(page.includes('community.js?v=today-ribbon-1'));
assert.ok(page.indexOf('profile-today-ribbon.css')>page.indexOf('profile-breathing.css'));
assert.ok(css.includes('.calendar-day.today-pending')&&css.includes('@keyframes bq-today-alert'));
assert.ok(css.includes('.calendar-day.today-solved'));
for(const name of ['green','orange','red'])assert.ok(css.includes('[data-urgency="'+name+'"]'));
assert.ok(css.includes('.rank-ribbon'));
assert.ok(css.includes('prefers-reduced-motion:reduce'));
console.log('PASS: UTC today marker, solved/pending distinctions, countdown urgency, midnight rollover and podium ribbons.');
