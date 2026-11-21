import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareAngularLegacy} from '../scripts/prepare-angular-legacy.mjs';

test('Angular compatibility keeps ByteQuest production UI pixel-identical, except Java-only controls',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bq-angular-ui-'));
 try {
  await prepareAngularLegacy(dir);
  for(const path of ['style.css','theme.css','green.css','minimal.css','community.css','gloss.css','leaderboard.css','favicon.svg','profile-streak-awards.css']){
   assert.equal(await readFile(join(dir,path),'utf8'),await readFile('dist/'+path,'utf8'),'Never rewrite original presentation: '+path);
  }
  for(const page of ['index.html','studio.html']){
   const source=await readFile(join(dir,page),'utf8');
   assert.match(source,/<option value="java">Java 17<\/option><\/select>/);
   assert.doesNotMatch(source,/<option value="(?:python|cpp|c)">/);
   assert.match(source,/id="languageSelect"/);
  }
  for(const page of ['community.html','leaderboard.html']){
   assert.equal(await readFile(join(dir,page),'utf8'),await readFile('dist/'+page,'utf8'),'Social UI markup remains original');
  }
  const app=await readFile(join(dir,'app.js'),'utf8');
  assert.match(app,/let language="java";/);
  assert.match(app,/function setLanguage\(v\)\{if\(v!=="java"\)return;/);
  assert.match(app,/const judge=\{run:\(source,p,cases\)=>javaJudge\.run\(source,p,cases\)/);
  assert.doesNotMatch(app,/nativeJudge\.run\(/);
  const gate=await readFile(join(dir,'maintenance-gate.js'),'utf8');
  assert.match(gate,/staging/i);
  assert.match(gate,/import\(entry\)/);
  await stat(join(dir,'java-runner.jar'));
  await stat(join(dir,'runner.html'));
  await assert.rejects(stat(join(dir,'native-runner-core.js')));
  await assert.rejects(stat(join(dir,'native-runner.html')));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Default Angular route keeps the familiar ByteQuest screens while TS migration remains available',async()=>{
 const routes=await readFile('angular/src/app/app.routes.ts','utf8');
 const component=await readFile('angular/src/app/legacy-screen.component.ts','utf8');
 const scripts=JSON.parse(await readFile('angular/package.json','utf8')).scripts;
 assert.match(routes,/path:'',loadComponent:screen,data:\{screen:'index\.html'\}/);
 assert.match(routes,/path:'classic\/community'/);
 assert.match(routes,/path:'classic\/leaderboard'/);
 assert.match(routes,/path:'classic\/studio'/);
 assert.match(routes,/path:'angular',loadComponent:/);
 assert.match(component,/bypassSecurityTrustResourceUrl/);
 assert.match(component,/allowed\.includes/);
 assert.match(scripts.build,/prepare:legacy/);
 assert.match(scripts.start,/prepare:legacy/);
});
