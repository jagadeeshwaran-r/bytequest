import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publicCatalog} from '../scripts/export-angular-catalog.mjs';
import {companyLogo} from '../angular/src/app/features/problems/company-logos.ts';

test('Original problem and company metadata are retained without injecting private tests',()=>{
 const catalog=publicCatalog();
 assert.ok(catalog.length>15);
 assert.ok(catalog.every(p=>Array.isArray(p.companies)));
 assert.ok(catalog.every(p=>Array.isArray(p.tests)));
 assert.ok(catalog.some(p=>p.companies.length),'Bundled canonical catalog must retain published company tags');
 assert.equal(companyLogo('Google'),'legacy/assets/companies/google-color.svg');
 assert.equal(companyLogo('Amazon'),'legacy/assets/companies/amazon.svg');
 assert.equal(companyLogo('Apple'),'legacy/assets/companies/apple.svg');
 assert.equal(companyLogo('Not a real logo'),null);
 assert.doesNotMatch(JSON.stringify(catalog),/privateCases|hidden_cases|service_role/i);
});
test('Angular library gets progress from authenticated staging backend; guest status is never claimed',async()=>{
 const [source,api]=await Promise.all([
  readFile('angular/src/app/features/problems/problems.component.ts','utf8'),
  readFile('angular/src/app/core/readonly-api.service.ts','utf8')
 ]);
 assert.match(api,/'self','profile','progress'/);
 assert.match(source,/api\.request<StagingProgress>\('progress'\)/);
 assert.match(source,/this\.auth\.user\(\)\?\.id!==owner/);
 assert.match(source,/this\.solved\.set\(new Set\(validIds\)\)/);
 assert.match(source,/Number\.isFinite\(value\)&&value>0&&value<=now/);
 assert.match(source,/@if\(progressReady\(\)\)/);
 assert.match(source,/class="problem-status catalog-unknown"/);
 assert.match(source,/class="problem-status catalog-solved"/);
 assert.match(source,/class="problem-status catalog-unsolved"/);
 assert.match(source,/completion==='solved'\?solved\.has\(problem\.id\):!solved\.has\(problem\.id\)/);
 assert.match(source,/@for\(problem of filtered\(\);track problem\.id\)/);
 assert.match(source,/class="quest-grid"/);
 assert.match(source,/class="problem-table"/);
});
test('Screenshot dark mode is scoped to the catalog route, preserving white/light app and main',async()=>{
 const [styles,shell,catalogCss]=await Promise.all([
  readFile('angular/src/styles.css','utf8'),
  readFile('angular/src/app/native-shell.component.ts','utf8'),
  readFile('angular/src/app/features/problems/problems.component.css','utf8')
 ]);
 assert.match(styles,/Angular-only premium dark Problem Library/);
 assert.match(styles,/html\[data-theme="dark"\] bq-root:has\(\.native-catalog\)/);
 assert.match(styles,/background-size:71px 71px,71px 71px,100% 100%/);
 assert.match(styles,/\.minimal-header[\s\S]*border-radius:39px!important/);
 assert.match(styles,/\.problem-table[\s\S]*background:#101014!important/);
 assert.match(styles,/\.problem-title\.is-solved/);
 assert.match(styles,/\.filters select/);
 assert.match(shell,/auth\.user\(\)\?\.avatarUrl/);
 assert.match(catalogCss,/company-overflow-panel/);
 assert.doesNotMatch(styles,/data-theme="light"\][^\n]*Problem Library/);
});
