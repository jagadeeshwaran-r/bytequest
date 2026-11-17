import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Dashboard} from '../dist/dashboard.js';

// Regression for the November 2026 blank problem catalog: Dashboard is
// imported and instantiated by the Problems page, whose legacy markup never
// had the Profile-only graphMeasure selector.
const docBefore=globalThis.document;
const controls={};
const pickerFilter={value:'',oninput:null};
const pickerList={innerHTML:'',querySelectorAll(){return []}};
const pickerCount={textContent:''};
const picker={
 querySelector(selector){
  if(selector==='input')return pickerFilter;
  if(selector==='.friend-checks')return pickerList;
  if(selector==='.compare-count')return pickerCount;
  throw new Error('Unexpected picker selector '+selector);
 }
};
const compareControl={
 innerHTML:'',hidden:false,
 querySelector(selector){
  if(selector==='.friend-picker')return picker;
  if(selector==='input')return pickerFilter;
  if(selector==='[data-all]'||selector==='[data-clear]')return controls[selector]??={onclick:null};
  throw new Error('Unexpected comparison selector '+selector);
 }
};
const crosshair={setAttribute(){}};
const chart={
 innerHTML:'',
 closest(selector){
  if(selector==='section')return{querySelector:s=>{
   assert.equal(s,'.comparison-controls');return compareControl;
  }};
  if(selector==='.graph-scroll')return{append(){}};
  throw new Error('Unexpected closest '+selector);
 },
 querySelector(selector){assert.equal(selector,'#chartCrosshair');return crosshair;},
 setAttribute(){},getBoundingClientRect(){return{left:0,width:900}}
};
const controlsById=new Map([
 ['graphMonth',{value:'',hidden:false}],
 ['graphYear',{value:'',hidden:false}],
 ['graphMode',{value:'daily'}],
 ['graphTopic',{value:''}],
 ['frequencyChart',chart],
 ['graphLegend',{innerHTML:''}],
 ['dashboardMessage',{textContent:'',hidden:false}],
 ['topicBreakdown',{innerHTML:'',querySelector(){return null}}]
]);
globalThis.document={
 getElementById:id=>controlsById.get(id)||null,
 createElement:()=>({innerHTML:'',hidden:false,setAttribute(){},querySelector(){return{onclick:null}}})
};
try{
 const dashboard=new Dashboard({
  cloud:{user:null},getState:()=>({solved:{}}),getCatalog:()=>[],allowCompare:false
 });
 assert.equal(typeof controlsById.get('graphMode').onchange,'function');
 assert.equal(controlsById.has('graphMeasure'),false,'Problems page must not need Profile-only controls');
 const today=new Date().toISOString().slice(0,10);
 dashboard.draw([{name:'You',profile:{username:'test'},color:'#16a477',
  data:{keys:[today],values:[2],total:2}}]);
 assert.ok(chart.innerHTML.includes('graph-curve'));
 assert.ok(!chart.innerHTML.includes('NaN'));
 assert.equal(chart.innerHTML.includes('undefined'),false);
}finally{
 if(docBefore===undefined)delete globalThis.document;
 else globalThis.document=docBefore;
}
const index=readFileSync('dist/index.html','utf8');
const app=readFileSync('dist/app.js','utf8');
const dashboard=readFileSync('dist/dashboard.js','utf8');
assert.ok(index.includes('id="questGrid"'),'Main problem grid must remain present');
assert.ok(!index.includes('id="graphMeasure"'),'Legacy layout has no measure control');
assert.ok(index.includes('app.js?v=creator-admin-1'),'Bust cached startup script');
assert.ok(app.includes('dashboard.js?v=topic-directory-1'),'Load compatible dashboard module');
assert.ok(app.includes('renderMap();'),'Problem catalog should still be rendered');
assert.ok(dashboard.includes("this.$(id)"),'Chart checks optional controls');
assert.ok(dashboard.includes("if(control)control.onchange"));
assert.ok(dashboard.includes("const $=this.$,chart=$('frequencyChart')"));
assert.ok(dashboard.includes("$('graphMeasure')?.value"),'Measure remains optional for legacy Problems page');
console.log('PASS: Problems page boots with legacy chart markup; profile measure selector remains optional.');
