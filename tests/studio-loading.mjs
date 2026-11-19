import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const problems=readFileSync('dist/index.html','utf8');
const studio=readFileSync('dist/studio.html','utf8');
const studioBoot=readFileSync('dist/studio-page.js','utf8');
const scripts=html=>[...html.matchAll(/<script type="module" src="([^"]+)"/g)].map(x=>x[1]);
const deferred=html=>html.match(/data-bq-app="([^"]+)"/)?.[1];
const appScript=deferred(problems),studioScript=deferred(studio);
assert.ok(appScript?.startsWith('./app.js?v='),'Problems must preserve their workbench app but defer boot');
assert.ok(studioScript?.startsWith('./studio-page.js?v=creator-admin-1'),'Studio must preserve its own lightweight entrypoint');
assert.notEqual(studioScript,appScript,'Studio must not initialize the Problems workspace bundle');
assert.ok(scripts(problems).some(x=>x.startsWith('./maintenance-gate.js?v=strict-')),'Problems must use strict maintenance preflight');
assert.ok(scripts(studio).some(x=>x.startsWith('./maintenance-gate.js?v=strict-')),'Studio must use strict maintenance preflight');
assert.ok(!scripts(problems).some(x=>x.startsWith('./app.js')),'Problems cannot initialize before maintenance authorization');
assert.ok(!scripts(studio).some(x=>x.startsWith('./studio-page.js')),'Studio cannot initialize before maintenance authorization');
assert.ok(studio.includes('<body data-page="studio">'));
assert.ok(studio.includes('<section id="studioView" class="view">'));
assert.ok(!studio.includes('<section id="studioView" class="view" hidden>'));
for(const id of ['studioGate','studioGateTitle','studioGateMessage','studioSignIn','studioWorkspace','studioStatus','problemForm','studioSelect','pHiddenTests','validateProblemBtn','saveProblemBtn','accountDialog','googleSignInBtn','signOutBtn','authMessage']){
 assert.ok(studio.includes('id="'+id+'"'),id+' must remain available for the Studio bootstrap');
}
assert.match(studioBoot,/const cloud=new Cloud\(/,'Dedicated Studio must use the existing Firebase Cloud client');
assert.match(studioBoot,/const studio=new Studio\(/,'Dedicated Studio must mount the existing creator/editor logic');
assert.match(studioBoot,/await cloud\.init\(\)/,'Restore the existing Firebase session');
assert.match(studioBoot,/await cloud\.checkAdmin\(owner\)/,'Verify server-side creator access');
assert.match(studioBoot,/cloud\.signIn\(\)/,'Reuse the normal Firebase popup');
for(const forbidden of ['mountWorkspace(', 'mountEditorTools(', 'renderPractice(', 'refreshCatalog(', 'new Dashboard(', 'new JavaJudge(']){
 assert.ok(!studioBoot.includes(forbidden),'Studio bootstrap must not initialize workbench code: '+forbidden);
}
assert.match(studio,/if\(window\.__bytequestStudioStarted\)return/,'Module load failure should not show an endless spinner');
assert.match(studioBoot,/setTimeout\(\(\)=>\{/,'Slow Firebase restoration must offer a retry');
const controller=readFileSync('dist/studio.js','utf8');
assert.ok(!controller.includes('this.judge.preload();'),'Do not eagerly start Java VM during Studio loading');
assert.ok(controller.includes('this.judge.run(problem.reference,problem,cases)'),'Validate compiles Java only when requested');
console.log('PASS: independent Studio bootstrap, restored Firebase and bounded failure recovery.');
