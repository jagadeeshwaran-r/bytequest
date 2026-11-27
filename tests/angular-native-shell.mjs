import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(path,'utf8');
test('Native Angular workspace has a persistent ByteQuest shell and does not use an iframe',async()=>{
 const routes=await read('angular/src/app/app.routes.ts');
 const shell=await read('angular/src/app/native-shell.component.ts');
 assert.match(routes,/import\('\.\/native-shell\.component'\)/);
 assert.doesNotMatch(shell,/<iframe\b/);
 for(const cls of ['minimal-header','minimal-brand','minimal-nav','profile-dropdown'])
   assert.ok(shell.includes('class="'+cls+'"'));
 assert.match(shell,/changeDetection:ChangeDetectionStrategy.OnPush/);
 assert.match(shell,/RouterOutlet/);
 assert.doesNotMatch(shell,/document\.head\.append|ngOnDestroy|HTMLLinkElement/);
});
test('Native catalog has keyed problem rows and persistent filters, without DOM replacement',async()=>{
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
test('Native practice has dedicated Java editor and split-pane without full re-render',async()=>{
 const practice=await read('angular/src/app/features/practice/practice.component.ts');
 for(const cls of ['lab','problem-pane','learning-content','editor-pane','editor-top','test-panel','runbar'])
   assert.ok(practice.includes(cls),cls);
 assert.match(practice,/changeDetection:ChangeDetectionStrategy.OnPush/);
 assert.match(practice,/<bq-editor /);
 assert.match(practice,/readonly pane=signal/);
 assert.match(practice,/readonly selectedCase=signal/);
 assert.doesNotMatch(practice,/\.innerHTML\s*=/);
 assert.match(practice,/!canVerify\(\)/);
});
test('Staging root is native Angular; legacy UI remains separately accessible',async()=>{
 const routes=await read('angular/src/app/app.routes.ts');
 assert.ok(routes.includes("path:'',pathMatch:'full',redirectTo:'angular'"));
 assert.ok(routes.includes("path:'classic/problems',loadComponent:screen"));
 assert.ok(routes.includes("path:'classic/studio'"));
 assert.ok(routes.includes("path:'angular',loadComponent:"));
 assert.ok(!routes.includes("path:'',loadComponent:screen"));
});
test('Route transitions cannot create repeated CSS links or dark theme placeholders',async()=>{
 const index=await read('angular/src/index.html');
 const global=await read('angular/src/styles.css');
 const shell=await read('angular/src/app/native-shell.component.ts');
 const bootstrap=await read('angular/src/main.ts');
 assert.match(index,/<body>[\s\S]*<script>[\s\S]*bqStaticStyle[\s\S]*<bq-root>/);
 assert.match(index,/if\(document\.querySelector\('\[data-bq-static-style="/);
 assert.match(index,/catalog-refined\.css/);
 assert.match(index,/profile-reference\.css/);
 assert.match(global,/html\[data-theme="light"\] bq-root/);
 assert.match(global,/background:var\(--page\)/);
 assert.match(bootstrap,/withPreloading\(PreloadAllModules\)/);
 assert.doesNotMatch(shell,/document\.head\.append|HTMLLinkElement|ngOnDestroy/);
 assert.doesNotMatch(index,/data-bq-maintenance-check="pending"/);
});
