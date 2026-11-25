import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {problemStatusMarkup} from "../dist/problem-status.js";

const solved=problemStatusMarkup(true);
const unsolved=problemStatusMarkup(false);
assert.ok(solved.includes('class="problem-status is-solved"'));
assert.ok(solved.includes('aria-label="Solved"'));
assert.ok(solved.includes('aria-hidden="true"'));
assert.ok(solved.includes('<svg')&&solved.includes('<path'),"Accepted solutions display a green check icon.");
assert.ok(solved.includes('>Solved</span>'));
assert.ok(unsolved.includes('class="problem-status is-unsolved"'));
assert.ok(unsolved.includes('Unsolved'));
assert.ok(!unsolved.includes('<svg'),"Unsolved or merely visited problems must not have a checkmark.");
assert.equal(problemStatusMarkup(false),unsolved);
assert.ok(problemStatusMarkup(false,{complete:false}).includes('Checking…'),
  'Unloaded account progress must not falsely show Unsolved');
assert.ok(problemStatusMarkup(false,{complete:false,failed:true}).includes('Status unavailable'),
  'Cloud account failures must show status unavailable, not Unsolved');
assert.ok(problemStatusMarkup(true,{complete:false}).includes('is-solved'),
  'Existing locally accepted solves remain visible while cloud loads');

const app=readFileSync("dist/app.js","utf8");
assert.ok(app.includes('problemStatusMarkup(Boolean(state.solved[p.id]),{complete:accountHistoryStatus==="ready",failed:accountHistoryStatus==="failed",compact:true})'),
  "Problem rows derive accepted status from saved solves but never label unconfirmed account progress as unsolved.");
assert.ok(app.includes('if(view==="map"){if(previousView!==null&&previousView!=="map")$("questGrid").scrollLeft=0;renderMap();}'),
  "Navigating back from a practice problem must reset horizontal grid scrolling to the left.");
assert.ok(app.includes('state.solved[p.id]=now;state.reviews[p.id]={anchor:now,step:0}'),
  "First successful accepted solution must still update solved state.");

const css=readFileSync("dist/problem-alignment.css","utf8");
assert.ok(css.includes('#mapView #questGrid{display:block!important;width:100%'),
  "Problem grid must be a full-width, left-aligned block instead of a multi-column card grid.");
assert.ok(css.includes('#mapView .problem-table :is(th,td):nth-child(5){text-align:left}'),
  "Status header and row text must align on the same left edge.");
assert.ok(css.includes(".problem-status.is-solved"),"Green completion style must be defined.");
assert.ok(css.includes("color:#118357"),"Solved green must contrast against the light theme.");
assert.ok(css.includes('stroke:currentColor'),"Checkmark icon must follow its solved color.");
assert.ok(css.includes('max-width:100%'),"Checkmark status should not overflow fixed-width columns.");

for(const page of ["index.html","studio.html"]){
  const html=readFileSync("dist/"+page,"utf8");
  assert.ok(html.includes(page==="studio.html"?'studio-page.js?v=':'app.js?v='),"Page must refresh its correct entrypoint bundle.");
  assert.ok(html.includes('problem-alignment.css?v=align-2'),"Page must refresh the updated alignment rules.");
}
assert.match(problemStatusMarkup(true,{compact:true}),/aria-label="Solved"/);
assert.match(problemStatusMarkup(false,{compact:true}),/aria-label="Unsolved"/);
assert.ok(!problemStatusMarkup(false,{compact:true}).includes('<path'),'Unsolved compact indicator is not a check');
assert.match(problemStatusMarkup(false,{compact:true,complete:false}),/aria-label="Checking account progress"/);
assert.match(problemStatusMarkup(false,{compact:true,complete:false,failed:true}),/aria-label="Solve status unavailable"/);
assert.match(problemStatusMarkup(true,{compact:true,complete:false}),/aria-label="Solved"/);
console.log("PASS: left-aligned problem grid after navigation and green check only for accepted solves.");
