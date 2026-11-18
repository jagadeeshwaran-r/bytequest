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
assert.ok(busy.includes('readOnly=!accountReady'),'Running tests should not disable typing');
assert.ok(!busy.includes('readOnly=value||!accountReady'),'Running tests must not re-lock the editor');

const submit=source.slice(source.indexOf('async function submitOnline()'),source.indexOf('function logAttempt('));
assert.ok(submit.indexOf('await requestSubmission(')<submit.indexOf('setBusy(true)'),
 'Opening/cancelling submission confirmation should not lock the editor');
assert.ok(submit.includes('catch(error){notify('),
 'Unexpected dialog failures must not strand editor controls');
assert.ok(submit.indexOf('try{\n  results=null;renderTests()')>submit.indexOf('setBusy(true)'),
 'Initialization errors must be covered by the final unlock');

const run=source.slice(source.indexOf('async function run(submit)'),source.indexOf('async function submitOnline()'));
assert.ok(run.indexOf('try{\n    results=null;renderTests()')>run.indexOf('setBusy(true)'),
 'A rendering error after beginning a run must still reach finally/unlock');
assert.ok(run.includes('finally{if(epoch===runEpoch){clearTimeout(watchdog);setBusy(false)'));

const choose=source.slice(source.indexOf('function changeProblem(id)'),source.indexOf('function nextProblem()'));
assert.ok(choose.includes('selectedProblemUrl(location.href,id)'),'Problem changes must update the actual URL');
assert.ok(choose.includes('renderPractice();route();'),
 'replaceState does not emit hashchange; navigation must render explicitly');
console.log('PASS: failed-run editor recovery, non-locking confirmation, and selected problem reload URL.');
