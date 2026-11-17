import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nextStreakDayCountdown,bindStreakCountdown} from '../dist/streak-countdown.js';
import {shouldRunCodeShortcut} from '../dist/run-shortcut.js';
import {profileMetrics} from '../dist/profile-extras.js';

const day=(h,m,s,ms=0)=>Date.UTC(2026,10,17,h,m,s,ms);
assert.equal(nextStreakDayCountdown(day(12,0,0)),'12:00:00');
assert.equal(nextStreakDayCountdown(day(23,59,58)),'00:00:02');
assert.equal(nextStreakDayCountdown(day(23,59,59,1)),'00:00:01');
assert.equal(nextStreakDayCountdown(Date.UTC(2026,10,18,0,0,0)),'24:00:00');
assert.equal(nextStreakDayCountdown(day(0,0,0,500)),'24:00:00');
assert.equal(nextStreakDayCountdown(day(0,0,1)),'23:59:59');
assert.throws(()=>nextStreakDayCountdown(NaN),/valid timestamp/);

let now=day(23,59,59),tick=null,cleared=[];
const node={textContent:'',isConnected:true};
const off=bindStreakCountdown({querySelector:()=>node},{
  now:()=>now,every:(fn,ms)=>{assert.equal(ms,1000);tick=fn;return 43;},stop:id=>cleared.push(id)
});
assert.equal(node.textContent,'00:00:01');
now=Date.UTC(2026,10,18,0,0,0);
tick();
assert.equal(node.textContent,'24:00:00','Countdown must restart at the real UTC boundary');
now+=3600000;
tick();
assert.equal(node.textContent,'23:00:00','Countdown recalculates from absolute time after tab sleeps');
off();
assert.deepEqual(cleared,[43]);
node.isConnected=false;
tick();
assert.deepEqual(cleared,[43],'Detached timer is not cleared twice');
assert.equal(typeof bindStreakCountdown({querySelector:()=>null}), 'function');

const event={key:'r',ctrlKey:true,metaKey:false,altKey:false,shiftKey:false,repeat:false,defaultPrevented:false,isComposing:false,
  target:{closest:()=>({id:'codeEditor'})}};
const can=(e,options={practiceVisible:true,dialogOpen:false})=>shouldRunCodeShortcut(e,options);
assert.equal(can(event),true,'Ctrl+R in editor runs code');
assert.equal(can({...event,key:'R'}),true);
assert.equal(can({...event,target:{closest:()=>null}}),true,'Ctrl+R on problem screen runs code');
assert.equal(can(event,{practiceVisible:false,dialogOpen:false}),false,'Browser refresh is preserved on problem list');
assert.equal(can(event,{practiceVisible:true,dialogOpen:true}),false,'Never steal shortcuts from modal dialogs');
assert.equal(can({...event,metaKey:true}),false,'Cmd+R still reloads the browser');
assert.equal(can({...event,ctrlKey:false}),false);
assert.equal(can({...event,altKey:true}),false);
assert.equal(can({...event,shiftKey:true}),false);
assert.equal(can({...event,repeat:true}),false,'Holding shortcut must not queue runs');
assert.equal(can({...event,target:{closest:()=>({id:'searchInput'})}}),false,'Other editable inputs are unaffected');
assert.equal(can({...event,defaultPrevented:true}),false);

const markup=profileMetrics({solved:7,total:31,streak:4},70,31);
assert.match(markup,/streak-reset/);
assert.match(markup,/data-streak-countdown/);
assert.match(markup,/New day in/);
assert.match(markup,/UTC/);
assert.ok(!markup.includes('🔥'),'Streak remains number-only without a flame icon');

const community=readFileSync('dist/community.js','utf8');
const html=readFileSync('dist/community.html','utf8');
const app=readFileSync('dist/app.js','utf8');
const problems=readFileSync('dist/index.html','utf8');
const style=readFileSync('dist/profile-breathing.css','utf8');
assert.match(community,/stopStreakCountdown\(\);stopStreakCountdown=\(\)=>\{\}/,'Old profile timer must be stopped on rerender');
assert.match(community,/bindStreakCountdown\(\$\('profileContent'\),\{onDayChange:/,'Tick on the rendered profile and update calendar at midnight');
assert.ok(html.includes('profile-breathing.css?v=timer-visible-1'),'Refresh updated profile spacing stylesheet');
assert.ok(style.includes('position:static!important;top:auto!important'),'Timer remains in-flow and visible');
assert.ok(style.includes('margin-top:6px!important'),'Use a smaller margin on narrow screens');
assert.ok(html.includes('community.js?v=lifetime-awards-1'),'Refresh cached profile code');
assert.match(style,/profile-calendar-section/);
assert.match(style,/recent-solves/);
assert.match(style,/grid-template-rows:18px 62px minmax\(32px,auto\) auto/);
assert.match(app,/shouldRunCodeShortcut\(event/);
assert.match(app,/event\.preventDefault\(\);\s*if\(busy\)/,'Do not refresh while a run is already in progress');
assert.ok(problems.includes('aria-keyshortcuts="Control+R"'));
assert.ok(problems.includes('run-shortcut.css?v=ctrl-run-1'));
assert.ok(problems.includes('app.js?v=ctrl-run-1'));
console.log('PASS: UTC streak-day rollover, timer cleanup, scoped Ctrl+R and profile spacing.');
