import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {publicCatalog, writeCatalog} from '../scripts/export-angular-catalog.mjs';

test('Angular preview catalog reuses real bundled public problems only', async()=>{
 const catalog=publicCatalog();
 assert.ok(catalog.length>=10);
 assert.equal(new Set(catalog.map(p=>p.id)).size,catalog.length);
 assert.ok(catalog.find(p=>p.id==='two-sum'));
 for(const problem of catalog){
  assert.equal(typeof problem.starter,'string');
  assert.ok(Array.isArray(problem.examples));
  for(const secret of ['reference','hidden','hiddenCases','hints','privateTests','ownerId','apiKey']) {
   assert.ok(!(secret in problem),'Do not export '+secret);
  }
 }
});
test('Angular preview exports JSON without touching the live catalog',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bytequest-angular-catalog-'));
 try {
  const path=join(dir,'public','catalog.json');
  const count=await writeCatalog(path);
  const saved=JSON.parse(await readFile(path,'utf8'));
  assert.equal(saved.length,count);
  assert.ok(saved.every(p=>typeof p.description==='string'&&Array.isArray(p.examples)));
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('Angular build and routes are isolated from production GitHub Pages',async()=>{
 const workspace=JSON.parse(await readFile('angular/angular.json','utf8'));
 const angularPackage=JSON.parse(await readFile('angular/package.json','utf8'));
 const pages=await readFile('.github/workflows/pages.yml','utf8');
 const preview=await readFile('.github/workflows/angular-preview.yml','utf8');
 const routes=await readFile('angular/src/app/app.routes.ts','utf8');
 const index=await readFile('angular/src/index.html','utf8');
 assert.equal(workspace.projects['bytequest-angular'].architect.build.builder,'@angular/build:application');
 assert.ok(angularPackage.dependencies['@angular/core'].startsWith('^22.'));
 assert.match(routes,/loadComponent:/);
 assert.match(routes,/problem\/:id/);
 assert.match(index,/<base href="\.\/">/);
 assert.match(preview,/upload-artifact/);
 assert.doesNotMatch(preview,/deploy-pages|write-all|push:/);
 assert.match(pages,/branches: \["main"\]/);
});
