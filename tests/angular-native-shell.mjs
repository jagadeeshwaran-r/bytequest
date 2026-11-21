import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(path,'utf8');
test('Native Angular workspace uses a persistent original-style ByteQuest shell, not the iframe',async()=>{
 const routes=await read('angular/src/app/app.routes.ts');
 const shell=await read('angular/src/app/native-shell.component.ts');
 assert.match(routes,/loadComponent:\(\)=>import\('\.\/native-shell\.component'\)/);
 assert.doesNotMatch(shell,/<iframe\b/);
 assert.match(shell,/class="minimal-header"/);
 assert.match(shell,/class="minimal-brand"/);
 assert.match(shell,/class="minimal-nav"/);
 assert.match(shell,/class="profile-dropdown"/);
 assert.match(shell,/changeDetection:ChangeDetectionStrategy.OnPush/);
 assert.match(shell,/RouterOutlet/);
 assert.match(shell,/style\.css/);
 assert.match(shell,/catalog-refined\.css/);
});
test('Native catalog retains individual problem rows and filters without DOM replacement',async()=>{
 const source=await read('angular/src/app/features/problems/problems.component.ts');
 const view=await read('angular/src/app/core/catalog-view-state.service.ts');
 assert.match(source,/@for\(problem of filtered\(\);track problem\.id\)/);
 assert.match(source,/class="quest-grid"/);
 assert.match(source,/class="problem-table"/);
 assert.match(source,/changeDetection:ChangeDetectionStrategy.OnPush/);
 assert.doesNotMatch(source,/\.innerHTML\s*=/);
 assert.match(view,/providedIn:'root'/);
 assert.match(view,/readonly query=signal/);
});
test('Native practice retains old split-pane classes and dedicated Java editor across signals',async()=>{
 const practice=await read('angular/src/app/features/practice/practice.component.ts');
 for(const cls of ['lab','problem-pane','learning-content','editor-pane','editor-top','test-panel','runbar']){
   assert.match(practice,new RegExp('class="[^"]*\\b'+cls+'\\b'));
 }
 assert.match(practice,/changeDetection:ChangeDetectionStrategy.OnPush/);
 assert.match(practice,/<bq-editor /);
 assert.match(practice,/readonly pane=signal/);
 assert.match(practice,/readonly selectedCase=signal/);
 assert.doesNotMatch(practice,/\.innerHTML\s*=/);
 assert.match(practice,/!canVerify\(\)/);
});
test('Classic original UI stays separately available while native workspace migrates',async()=>{
 const routes=await read('angular/src/app/app.routes.ts');
 assert.match(routes,/path:'',loadComponent:screen,data:\{screen:'index\.html'\}/);
 assert.match(routes,/path:'classic\/studio'/);
 assert.match(routes,/path:'angular',loadComponent:/);
});
