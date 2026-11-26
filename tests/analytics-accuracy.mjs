import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bucketSolves,chartValues,chartDomain,straightPath,visiblePeriodCount,topicProgress} from '../dist/dashboard-model.js';
import {analyticsMarkup} from '../dist/profile-analytics.js';

const now=Date.UTC(2026,10,17,0,0,0);
assert.deepEqual(chartValues([0,2,0,3]),[0,2,0,3]);
assert.deepEqual(chartValues([0,2,0,3],'cumulative'),[0,2,2,5]);
assert.deepEqual(chartDomain(0),{max:1,step:1,ticks:1});
assert.deepEqual(chartDomain(3),{max:3,step:1,ticks:3});
assert.deepEqual(chartDomain(5),{max:6,step:2,ticks:3});
assert.equal(straightPath([]),'');
assert.equal(straightPath([[1,2],[3,4],[5,6]]),'M1,2 L3,4 L5,6');
assert.equal(straightPath([[1,2],[3,4]]).includes('C'),false,'No misleading curved interpolation');
const november=Array.from({length:30},(_,i)=>'2026-11-'+String(i+1).padStart(2,'0'));
assert.equal(visiblePeriodCount(november,'daily',now),17);
assert.equal(visiblePeriodCount(['2026-12-01','2026-12-02'],'daily',now),0);
assert.equal(visiblePeriodCount(['2026-10','2026-11','2026-12'],'monthly',now),2);
assert.equal(visiblePeriodCount(['2025','2026','2027'],'yearly',now),2);
assert.equal(visiblePeriodCount(['2026-11-29'],'daily',now),0);

const events=[
 {day:'2026-11-15',topic:'Hash maps'},
 {day:'2026-11-16',topic:'Hash maps'},
 {day:'2026-11-17',topic:'Linked List'},
 {day:'2026-11-29',topic:'Hash maps'},
 {day:'2026-12-01',topic:'Linked List'}
];
const grouped=bucketSolves(events,{mode:'daily',month:'2026-11',now});
assert.equal(grouped.total,3,'Future solves must not be represented as completed');
assert.equal(grouped.values[14],1);
assert.equal(grouped.values[15],1);
assert.equal(grouped.values[16],1);
assert.equal(grouped.values[28],0);
assert.deepEqual(chartValues(grouped.values.slice(14,17),'cumulative'),[1,2,3]);

const catalog=[
 {id:'a',topic:'Hash maps'},
 {id:'b',topic:'Hash maps'},
 {id:'c',topic:'Linked List'},
 {id:'d',topic:'Arrays'},
 {id:'d',topic:'Arrays'}
];
const insights=[{name:'Hash maps',solved:2},{name:'Linked List',solved:1},{name:'Legacy removed topic',solved:100}];
const progress=topicProgress(catalog,insights,events,{mode:'daily',month:'2026-11',topic:'Arrays',now});
const hash=progress.find(p=>p.name==='Hash maps');
const linked=progress.find(p=>p.name==='Linked List');
const arrays=progress.find(p=>p.name==='Arrays');
assert.deepEqual(hash,{name:'Hash maps',solved:2,total:2,period:2,percent:100});
assert.deepEqual(linked,{name:'Linked List',solved:1,total:1,period:1,percent:100});
assert.deepEqual(arrays,{name:'Arrays',solved:0,total:1,period:0,percent:0});
assert.equal(progress.length,3,'Only published catalog topics should be included');
assert.equal(topicProgress([],insights,events,{mode:'daily',month:'2026-11',now}).length,0);

assert.ok(analyticsMarkup.includes('id="graphMeasure"'));
assert.ok(analyticsMarkup.includes('value="cumulative"'));
assert.ok(!analyticsMarkup.includes('id="topicBreakdown"'),'Profile no longer renders topic coverage');
assert.ok(analyticsMarkup.includes('id="graphTopic"'),'Retain chart topic filter');
assert.ok(analyticsMarkup.includes('Compare with friends'));
const dashboard=readFileSync('dist/dashboard.js','utf8');
const profile=readFileSync('dist/community.js','utf8');
const html=readFileSync('dist/community.html','utf8');
const css=readFileSync('dist/analytics-accurate.css','utf8');
assert.ok(dashboard.includes('straightPath(historical)'),'Render actual counts with exact straight segments');
assert.ok(dashboard.includes('chartDomain('),'Y axis must use integer tick boundaries');
assert.ok(dashboard.includes('visiblePeriodCount(baseKeys'),'Cut future dates from plotted series and tooltips');
assert.ok(dashboard.includes('if(i<0||i>last){hide();return;}'),'Only show past or explicitly projected tooltip values');
assert.ok(dashboard.includes("this.cloud.request('friend-analytics'"),'Keep server-based friend comparison');
assert.ok(dashboard.includes('this.selected=new Set(this.friends'),'Keep compare-all action');
assert.ok(dashboard.includes('topicProgress(catalog,this.topicInsights,events,opts)'),'Use current catalog and verified insights');
assert.ok(dashboard.includes('aria-valuenow'),'Expose true solved problem count to assistive technology');
assert.ok(dashboard.includes('topic-directory-toggle'),'Offer searchable topic navigation without overwhelming the page');
assert.ok(profile.includes("topicInsights:r.insights?.skills||[]"));
assert.ok(html.includes('analytics-accurate.css?v=accurate-1'));
assert.ok(html.includes('community.js?v=lifetime-awards-1'));
assert.ok(css.includes('.graph-precise-line'));
assert.ok(html.includes('topic-directory.css?v=topic-directory-1'));
assert.ok(css.includes('.graph-precise-line'));
assert.ok(css.includes('@media(max-width:600px)'));
console.log('PASS: exact integer graph, cumulative comparison, UTC future clip, published-catalog topic progress and friend controls.');
