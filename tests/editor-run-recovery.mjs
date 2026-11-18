import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectedProblemUrl} from '../dist/problem-navigation.js';

const base='https://example.github.io/bytequest/index.html?problem=two-sum&theme=dark#map';
assert.equal(
 selectedProblemUrl(base,'valid-parentheses'),
 '/bytequest/index.html?problem=valid-parentheses&theme=dark#practice',
 'Selecting a new problem replaces an old deep link without stripping unrelated query parameters'
);
assert.equal(
 selectedProblemUrl('https://example.github.io/bytequest/index.html#practice','longest-substring-without-repeating-characters'),
 '/bytequest/index.html?problem=longest-substring-without-repeating-characters#practice'
);
assert.throws(()=>selectedProblemUrl(base,'../malicious'));
assert.throws(()=>selectedProblemUrl(base,''));
assert.throws(()=>selectedProblemUrl(base,'two sum'));

const source=readFileSync('dist/app.js','utf8');
const busy=source.slice(source.indexOf('function setBusy(value)'),source.indexOf('function stopRun('));
assert.ok(busy.includes('readOnly=false'),'Compilation must never block typing while account data loads');
assert.ok(!busy.includes('readOnly=!accountReady')&&!busy.includes('readOnly=value||!accountReady'),'Run must not re-lock the editor');
const account=source.slice(source.indexOf('async function changeAccount(user)'),source.indexOf('async function syncCloud()'));
assert.match(account,/renderPractice\(\);\s*\$\("codeEditor"\)\.readOnly=false;/,'Account loading must not make the editor read-only');
assert.ok(!account.includes('readOnly=true'),'Account network requests must not strand editor input');
assert.ok(source.includes('Run passed. This is a test run, not a recorded solve.'),'Passing Run must clearly distinguish testing from recorded Submit');

const submit=source.slice(source.indexOf('async function submitOnline()'),source.indexOf('function logAttempt('));
assert.ok(submit.indexOf('await requestSubmission(')<submit.indexOf('setBusy(true)'),
 'Opening/cancelling submission confirmation should not lock the editor');
assert.ok(submit.includes('catch(error){notify('),
 'Unexpected dialog failures must not strand editor controls');
assert.ok(submit.indexOf('try{\n  results=null;renderTests()')>submit.indexOf('setBusy(true)'),
 'Initialization errors must be covered by the final unlock');

const run=source.slice(source.indexOf('async function run(submit,'),source.indexOf('async function submitOnline()'));
assert.ok(run.indexOf('try{\n    results=null;renderTests()')>run.indexOf('setBusy(true)'),
 'A rendering error after beginning a run must still reach finally/unlock');
assert.ok(run.includes('finally{if(epoch===runEpoch){clearTimeout(watchdog);setBusy(false)'));

assert.ok(source.includes('let current = deepLinkedProblem() || problems.find('),
 'A refresh should restore the deep-linked problem before account initialization finishes');
assert.equal(source.split('current=deepLinkedProblem()||problems.find(').length-1,1,
 'Restore the selected problem once; background cloud sync must not reset it to Two Sum');


const refresh=source.slice(source.indexOf('async function refreshCatalog('),source.indexOf('function revalidateCatalog('));
assert.ok(refresh.includes("get('problem')||state.current||current?.id"),
 'Full catalog load should restore the saved problem instead of bundled Two Sum');
assert.ok(refresh.includes("selectedProblemUrl(location.href,current.id)"),
 'A selected problem restored from cloud must be retained across refresh');
const quest=source.slice(source.indexOf('function completeQuest('),source.indexOf('function celebrate('));
assert.ok(quest.includes('updateStats();renderMap();'),
 'Accepted solutions must refresh the solved indicators without a page reload');

const choose=source.slice(source.indexOf('function changeProblem(id)'),source.indexOf('function nextProblem()'));
assert.ok(choose.includes('selectedProblemUrl(location.href,id)'),'Problem changes must update the actual URL');
assert.ok(choose.includes('renderPractice();route();'),
 'replaceState does not emit hashchange; navigation must render explicitly');
console.log('PASS: failed-run editor recovery, non-locking confirmation, and selected problem reload URL.');
