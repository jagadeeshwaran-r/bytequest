import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canRevealEditorialSolution,editorialSolutionGateMarkup} from '../dist/editorial-access.js';

const problemId='middle-of-linked-list';
assert.equal(canRevealEditorialSolution({},problemId),false);
assert.equal(canRevealEditorialSolution({solved:{}},problemId),false);
assert.equal(canRevealEditorialSolution({solved:{[problemId]:0}},problemId),false);
assert.equal(canRevealEditorialSolution({solved:{[problemId]:'not accepted'}},problemId),false);
assert.equal(canRevealEditorialSolution({solved:{[problemId]:Infinity}},problemId),false);
assert.equal(canRevealEditorialSolution({solved:{'other-problem':Date.now()}},problemId),false);
assert.equal(canRevealEditorialSolution({solved:{[problemId]:Date.now()}},problemId),true);
assert.equal(canRevealEditorialSolution(null,problemId),false);
assert.equal(canRevealEditorialSolution({solved:{[problemId]:Date.now()}},''),false);

const locked=editorialSolutionGateMarkup(false);
const unlocked=editorialSolutionGateMarkup(true);
assert.match(locked,/Java answer/);
assert.match(locked,/Sign in and pass public tests to unlock/);
assert.ok(!locked.includes('id="referenceBtn"'),'Unsolved problems must not render a reveal control');
assert.ok(!locked.includes('<pre'),'Unsolved problems must not render reference source');
assert.ok(locked.includes('id="referenceContent"'),'Keep editor tab mounting consistent');
assert.match(unlocked,/View Java answer/);
assert.ok(unlocked.includes('id="referenceBtn"'));
assert.ok(!unlocked.includes('<pre'),'Reveal still requires an explicit click');
assert.ok(!unlocked.includes('reference-gate-icon')&&!locked.includes('reference-gate-icon'),'No decorative reference-access box or large icon');

const html=readFileSync('dist/index.html','utf8');
const app=readFileSync('dist/app.js','utf8');
const css=readFileSync('dist/catalog-refined.css','utf8');
assert.ok(html.includes('catalog-refined.css?v=catalog-1'));
assert.ok(html.includes('id="clearProblemSearch"'));
assert.ok(html.includes('id="visibleProblemCount"'));
assert.match(html, /<section id="mapView"[^>]*>\s*<div class="section-heading library-heading">\s*<h2 class="sr-only">Problems<\/h2>/, 'Keep an accessible but visually hidden Problems heading');
assert.ok(html.includes('role="search"'));
assert.ok(app.includes('editorialSolutionGateMarkup(canCheckJavaReference(current),Boolean(cloud.user))'));
assert.ok(app.includes('cloud.request("reference-read",{problemId:selected.id,revision:selected.revision},owner)'), 'Reference source must be fetched through authenticated API');
assert.ok(!app.includes('html(current.reference)'), 'No local reference solution may render from public data');
assert.ok(app.includes('if(tab==="learn"&&current.id===p.id)renderLearning();'),
  'Immediately show unlocked editorial state on accepted solve');
assert.ok(app.includes('if(event.key!=="/"'),'Slash shortcut should only operate in catalog');
assert.ok(app.includes('$("mapView").hidden'),'Do not steal editor keystrokes');
assert.ok(app.includes('$("visibleProblemCount").textContent='));
assert.ok(css.includes('#mapView .section-heading h2'));
assert.ok(css.includes('#mapView .catalog-search-wrap'));
assert.ok(css.includes('#practiceView :is(.reference-lock,.reference-unlocked)'));
assert.ok(css.includes('@media(max-width:620px)'));
assert.ok(css.includes('prefers-reduced-motion'));
console.log('PASS: Editorial frontend gate, authenticated reference fetch, catalog search and responsive presentation.');
