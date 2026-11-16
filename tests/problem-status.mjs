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

const app=readFileSync("dist/app.js","utf8");
assert.ok(app.includes('problemStatusMarkup(Boolean(state.solved[p.id]))'),
  "Problem row completion is derived exclusively from persisted accepted-solution state.");
assert.ok(app.includes('if(view==="map"){if(previousView!==null&&previousView!=="map")$("questGrid").scrollLeft=0;renderMap();}'),
  "Navigating back from a practice problem must reset horizontal grid scrolling to the left.");
assert.ok(app.includes('if(first){state.solved[p.id]=Date.now()'),
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
  assert.ok(/app\\.js\\?v=[a-z0-9-]+/.test(html),"Page must refresh the app bundle.");
  assert.ok(html.includes('problem-alignment.css?v=align-2'),"Page must refresh the updated alignment rules.");
}
console.log("PASS: left-aligned problem grid after navigation and green check only for accepted solves.");
