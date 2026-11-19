import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Run the actual maintenance gate with the dynamic import replaced by a fake
// application loader. No network access, browser storage, or global DOM needed.
const source=readFileSync('dist/maintenance-gate.js','utf8')
 .replace(/^import[^\n]+\n/gm,'')
 .replace('await import(appSource);','await loadApp(appSource);');
function scenario(responses,now=Date.parse('2026-11-19T11:00:00Z')){
 const handlers={},winHandlers={},navigation=[],styles={};
 let launched=0,time=now,readIndex=0,poll=null;
 const script={getAttribute:name=>name==='data-bq-app'?'./app.js?v=quiet-test':null};
 const document={
  hidden:false,documentElement:{dataset:styles,removeAttribute:()=>{}},
  querySelector:selector=>selector==='script[data-bq-app]'?script:null,
  addEventListener:(name,fn)=>handlers[name]=fn,
  body:{prepend(){}},
  createElement:()=>({style:{},append(){},setAttribute(){},remove(){}})
 };
 const window={addEventListener:(name,fn)=>winHandlers[name]=fn};
 const context={document,window,navigator:{onLine:true},
  location:{pathname:'/bytequest/index.html',replace:x=>navigation.push(x)},
  loadApp:async()=>{launched++;},
  fetchMaintenanceStatus:async()=>{const result=responses[Math.min(readIndex++,responses.length-1)];if(result instanceof Error)throw result;return result;},
  istDisplay:()=>'',console:{info(){}},
  Date:class extends Date{static now(){return time;}},
  setInterval:fn=>{poll=fn;return 7;},clearInterval(){},
  setTimeout:()=>1,clearTimeout(){}
 };
 runInNewContext(source,context,{filename:'maintenance-gate.js'});
 const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
 return{navigation,handlers,winHandlers,flush,
  get launched(){return launched;},get readIndex(){return readIndex;},
  get poll(){return poll;},setNow:x=>{time=x;},styles};
}
const ready={active:false,upcoming:false,startsAt:null,endsAt:null,serverTime:'2026-11-19T11:00:00Z'};
const open=scenario([ready,new Error('status timeout'),new Error('network lost'),{...ready,active:true}]);
await open.flush();
assert.equal(open.launched,1,'Editor boots after a confirmed healthy maintenance preflight');
open.handlers.visibilitychange();
await open.flush();
assert.deepEqual(open.navigation,[],'Background status failures must not eject an existing editor');
open.winHandlers.pageshow({persisted:true});
await open.flush();
assert.deepEqual(open.navigation,[],'Browser tab/BFCache restore must not show the full-page connection screen');
assert.equal(open.styles.bqMaintenanceCheck,undefined,'Browser resume must not blank the editing workspace');
open.handlers.visibilitychange();
await open.flush();
assert.ok(open.navigation[0]?.includes('issue=maintenance'),'Confirmed maintenance still blocks all app pages');

const unverified=scenario([new Error('status unavailable')]);
await unverified.flush();
assert.ok(unverified.navigation[0]?.includes('issue=unreachable'),'A first visit must still require the maintenance status preflight');
const start=Date.parse('2026-11-19T11:00:05Z');
const scheduled=scenario([
 {...ready,upcoming:true,startsAt:new Date(start).toISOString(),endsAt:new Date(start+3600000).toISOString()},
 new Error('maintenance status network failure')
]);
await scheduled.flush();
scheduled.setNow(start+1000);
scheduled.handlers.visibilitychange();
await scheduled.flush();
assert.ok(scheduled.navigation[0]?.includes('issue=maintenance'),'A known armed maintenance window remains strictly enforced when polling fails');

const css=readFileSync('dist/cloud-health.css','utf8');
const health=readFileSync('dist/cloud-health.js','utf8');
const shell=readFileSync('dist/shell.js','utf8');
assert.ok(css.includes('.bq-cloud-health-panel')&&!css.includes('position:sticky'),
  'Sync status must be a user-opened header disclosure, never a sticky global banner');
assert.ok(health.includes("doc.createElement('details')"),'A full status panel should open only on explicit click');
assert.ok(shell.includes('mountCloudHealthNotice(document,tools)'), 'Sync status lives inside top navigation rather than inserting another row');
assert.ok(!health.includes('doc.defaultView?.location?.replace'),'A cloud health signal must never navigate away from the editor');
console.log('PASS: quiet tab resume, transient network tolerance, strict confirmed maintenance, and non-modal sync status.');
