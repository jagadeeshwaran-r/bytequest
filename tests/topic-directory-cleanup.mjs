import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {topicCoverageSummary,topicExplorerPage} from '../dist/topic-explorer.js';
import {analyticsMarkup} from '../dist/profile-analytics.js';

const topics=Array.from({length:155},(_,i)=>({
 name:'Topic '+String(i+1).padStart(3,'0'),total:20,
 solved:i%5===0?20:i%5===1?0:i%5===2?5:i%5===3?10:3,
 percent:i%5===0?100:i%5===1?0:i%5===2?25:i%5===3?50:15,
 period:i%7===0?1:0
}));
const summary=topicCoverageSummary(topics);
assert.equal(summary.topics,155);
assert.equal(summary.completed,31);
assert.equal(summary.practiced,124);
assert.equal(summary.total,3100);
assert.equal(summary.solved,topics.reduce((n,t)=>n+t.solved,0));
assert.deepEqual(topicCoverageSummary([]),{topics:0,practiced:0,completed:0,solved:0,total:0});

const page1=topicExplorerPage(topics);
assert.equal(page1.items.length,10,'Render at most 10 rows per page');
assert.equal(page1.count,155);
assert.equal(page1.pages,16);
assert.equal(page1.page,0);
assert.equal(page1.items[0].name,'Topic 001');
const last=topicExplorerPage(topics,{page:15});
assert.equal(last.items.length,5);
assert.equal(last.items[0].name,'Topic 151');
assert.equal(topicExplorerPage(topics,{page:999}).page,15);
assert.equal(topicExplorerPage(topics,{page:-20}).page,0);
assert.equal(topicExplorerPage(topics,{pageSize:100}).items.length,20,'Keep each render bounded even if caller requests 100');
const completed=topicExplorerPage(topics,{status:'completed'});
assert.equal(completed.count,31);
assert.ok(completed.items.every(t=>t.solved===t.total));
const progress=topicExplorerPage(topics,{status:'active'});
assert.equal(progress.count,93);
assert.ok(progress.items.every(t=>t.solved>0&&t.solved<t.total));
const notStarted=topicExplorerPage(topics,{status:'unstarted'});
assert.equal(notStarted.count,31);
assert.ok(notStarted.items.every(t=>t.solved===0));
const filtered=topicExplorerPage(topics,{query:'Topic 012'});
assert.equal(filtered.count,1);
assert.equal(filtered.items[0].name,'Topic 012');
const none=topicExplorerPage(topics,{query:'no such topic',page:12});
assert.equal(none.count,0);
assert.equal(none.items.length,0);
assert.equal(none.page,0);
assert.equal(topicExplorerPage(topics,{status:'not-valid'}).count,155);

const sub=readFileSync('dist/submissions.js','utf8');
const community=readFileSync('dist/community.js','utf8');
const html=readFileSync('dist/community.html','utf8');
const index=readFileSync('dist/index.html','utf8');
const studio=readFileSync('dist/studio.html','utf8');
const dashboard=readFileSync('dist/dashboard.js','utf8');
const topicsCss=readFileSync('dist/topic-directory.css','utf8');
const editorCss=readFileSync('dist/editor-cleanup.css','utf8');
assert.ok(sub.includes('<input name="shared" type="checkbox" checked>'),'Share accepted solution selected by default');
assert.ok(sub.includes("shared:f.get('shared')==='on'"),'User can uncheck to submit privately');
assert.ok(sub.includes('Uncheck to keep it private'),'Explain explicit opt-out');
assert.ok(community.includes("message('');"),'Nonessential profile success messages should be cleared');
assert.ok(!community.includes("message('Profile ready.')"),'Remove distracting top status text');
assert.ok(!community.includes("message('Your account is connected.')"));
assert.ok(community.includes("status.hidden=!text"),'Error and progress messages remain available');
assert.ok(topicsCss.includes('.community-page::before{display:none!important}'),'Remove distracting decorative background grid on profile');
assert.ok(topicsCss.includes('#communityMessage[hidden]'),'No phantom status-message spacing');
assert.ok(editorCss.includes('::-webkit-scrollbar:horizontal'),'Remove duplicate-looking horizontal scrollbar affordance');
assert.ok(editorCss.includes('.editor-resizer'),'Keep functional code height resizer');
assert.ok(index.includes('editor-cleanup.css?v=editor-cleanup-1'));
assert.ok(studio.includes('editor-cleanup.css?v=editor-cleanup-1'));
assert.ok(analyticsMarkup.includes('<h2>Topic coverage</h2>'));
assert.ok(!analyticsMarkup.includes('<h2>Patterns growing</h2>'));
assert.ok(dashboard.includes('topicCoverageSummary(rows)'),'Show compact cover-all summary');
assert.ok(dashboard.includes('topicExplorerPage(this.topicRows'),'Search and paginate through all topics');
assert.ok(dashboard.includes("pageSize:10"),'Never render an unbounded list');
assert.ok(dashboard.includes("this.topicQuery=event.target.value"),'Search without dropping focus');
assert.ok(dashboard.includes('topicProgress(catalog,this.topicInsights,events,opts)'),'Retain exact published catalog problem totals');
assert.ok(html.includes('topic-directory.css?v=topic-directory-1'));
assert.ok(html.includes('community.js?v=studio-auth-1'));
assert.ok(index.includes('app.js?v=studio-auth-1'),'Refresh cached Problems bundle');
assert.ok(index.includes('id="questGrid"'),'Keep Problems catalog screen and editor unchanged');
assert.ok(topicsCss.includes('@media(max-width:650px)'),'Work on mobile');
console.log('PASS: default shared accepted solution, profile/editor visual cleanup, and searchable bounded 155-topic directory.');
