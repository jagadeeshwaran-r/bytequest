import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// The same app entrypoint bootstraps both pages. A stale query version
// gives Studio an old cached app while Problems uses the newly deployed one.
const problems=readFileSync('dist/index.html','utf8');
const studio=readFileSync('dist/studio.html','utf8');
const script=html=>html.split('<script type="module" src="')[1]?.split('"')[0];
assert.ok(script(problems),'Problems page must load the app entrypoint');
assert.equal(script(studio),script(problems),'Studio and Problems must use identical cache-busted app entrypoint URLs');
assert.ok(studio.includes('<body data-page="studio">'),'The Studio route is selected by its page marker');
assert.ok(studio.includes('<section id="studioView" class="view">'),'Studio should show a usable title and sign-in gate even if JavaScript fails');
assert.ok(!studio.includes('<section id="studioView" class="view" hidden>'),'Do not leave Studio blank before module startup');
for(const id of ['studioGate','studioSignIn','studioWorkspace','studioStatus','problemForm','studioSelect','pHiddenTests','validateProblemBtn','saveProblemBtn']){
 assert.ok(studio.includes('id="'+id+'"'),id+' must remain available to the Studio controller');
}
const app=readFileSync('dist/app.js','utf8');
assert.ok(app.includes('document.body.dataset.page==="studio"'),'App must recognize the standalone Studio page');
assert.ok(app.includes('if(view==="studio")studio.open()'),'Studio route must open its controller');
const controller=readFileSync('dist/studio.js','utf8');
assert.ok(!controller.includes('this.judge.preload();'),'Do not start downloading the browser JVM while opening the library');
assert.ok(controller.includes('this.judge.run(problem.reference,problem,cases)'),'Validation must still compile Java on demand');
console.log('PASS: Studio entrypoint cache parity, visible startup gate and required editor DOM.');
