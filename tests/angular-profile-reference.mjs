import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {earnedStreakAwards,profileCalendar,solvingGraph,countdownToUTC,solveRelativeTime}
  from '../angular/src/app/features/profile/profile-view-model.ts';

const range=(year,month,from,count)=>Array.from({length:count},(_,i)=>
  new Date(Date.UTC(year,month-1,from+i)).toISOString().slice(0,10));

test('Profile keeps source-of-truth fields and reference visual sections',async()=>{
  const s=await readFile('angular/src/app/features/profile/profile.component.ts','utf8');
  const css=await readFile('angular/src/app/features/profile/profile.component.css','utf8');
  for(const str of ['Problems solved','Total points','Daily streak','New day in','Streak badges',
    'Solving calendar','Recently solved','Skills practiced','Languages used',
    'Solving rhythm','Compare with friends','Topic coverage','Browse ','Show all ',
    'Profile avatar','year()','result.stats.serverDay','record.insights?.skills',
    'record.insights?.languages','friend-analytics','following','profileCalendar']){
    assert.ok(s.includes(str),'missing '+str);
  }
  for(const str of ['grid-template-columns:repeat(12','bqp-rhythm','bqp-metrics','bqp-awards','bqp-months',
    'bqp-calendar-inner','bqp-chart-svg','bqp-topic-stats'])assert.ok(css.includes(str),'missing '+str);
  assert.match(s,/profile\.set\(result\)/);
  assert.match(s,/catalogApi\.all\(\)/);
  assert.match(s,/readonly profile=signal<ProfileReply\|null>/);
  assert.doesNotMatch(s,/\.innerHTML\s*=/);
  assert.doesNotMatch(s,/service_role|private_key|hiddenCases:/);
});

test('Earned badges count runs not submissions; a broken streak retains lifetime awards',()=>{
  const days=[...range(2026,10,1,7),...range(2026,10,15,7)];
  const result=earnedStreakAwards([...days,days[0],days[0],'2026-11-30'],'2026-11-21');
  assert.equal(result.length,1);
  assert.deepEqual([result[0].days,result[0].name,result[0].count,result[0].lastEarned],
    [7,'STREAKER',2,'2026-10-21']);
  assert.equal(earnedStreakAwards(range(2026,1,1,30),'2026-01-31').find(a=>a.days===30)?.name,'CONSISTENT');
  assert.equal(earnedStreakAwards(range(2026,1,1,6),'2026-01-07').length,0);
});

test('Year calendar is exactly 12 UTC months with future days visually separated',()=>{
  const calendar=profileCalendar(2026,['2026-11-20','2026-11-20','2026-11-21'],'2026-11-21');
  assert.equal(calendar.length,12);
  assert.equal(calendar[0].name,'Jan');
  assert.equal(calendar[11].name,'Dec');
  assert.equal(calendar[10].cells.filter(day=>day?.active).length,2);
  assert.equal(calendar[10].cells.find(day=>day?.date==='2026-11-22')?.future,true);
  assert.ok(calendar.every(month=>month.cells.length%7===0));
});

test('Solving rhythm uses accepted evidence only and does not forecast insufficient activity',()=>{
  const chart=solvingGraph([{
    id:'me',label:'You',color:'#12a579',
    solves:[{day:'2026-11-15',topic:'Arrays'},{day:'2026-11-15',topic:'Hash maps'},
      {day:'2026-11-16',topic:'Arrays'},{day:'2026-11-21',topic:'Arrays'}]
  }],{mode:'daily',measure:'period',month:'2026-11',year:2026,topic:'',
    showForecast:true,today:'2026-11-21'});
  assert.equal(chart.series[0].points.find(p=>p.label==='2026-11-15')?.value,2);
  assert.equal(chart.series[0].points.find(p=>p.label==='2026-11-21')?.value,1);
  assert.equal(chart.series[0].points.some(p=>p.label==='2026-11-22'),false);
  assert.match(chart.note,/No forecast yet/);
  const topic=solvingGraph([{id:'me',label:'You',color:'#12a579',solves:[
    {day:'2026-11-15',topic:'Arrays'},{day:'2026-11-15',topic:'Hash maps'}
  ]}],{mode:'daily',measure:'period',month:'2026-11',year:2026,topic:'Arrays',
    showForecast:false,today:'2026-11-21'});
  assert.equal(topic.series[0].points.find(p=>p.label==='2026-11-15')?.value,1);
  assert.equal(countdownToUTC(Date.UTC(2026,10,21,23,59,50)),'00:00:10');
  assert.equal(solveRelativeTime('2026-11-21T17:00:00Z',Date.parse('2026-11-21T17:10:00Z')),'10 minutes ago');
});
