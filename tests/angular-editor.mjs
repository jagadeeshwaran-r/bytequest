import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchingCurly,syntaxHighlight} from '../angular/src/app/features/editor/editor-highlight.ts';

test('opening and closing braces match at both caret positions',()=>{
 const source='class Solution { void run() { if (true) { return; } } }';
 const open=source.indexOf('{');
 const close=source.lastIndexOf('}');
 const pair={open,close};
 assert.deepEqual(matchingCurly(source,open),pair);
 assert.deepEqual(matchingCurly(source,open+1),pair);
 assert.deepEqual(matchingCurly(source,close),pair);
 assert.deepEqual(matchingCurly(source,close+1),pair);
 const nested=source.indexOf('{',open+1);
 assert.equal(matchingCurly(source,nested+1)?.open,nested);
});
test('comments strings and incomplete pairs do not highlight',()=>{
 const source='class S { String s="}"; // { } \n /* { } */ void test(){} }';
 const first=source.indexOf('{'),last=source.lastIndexOf('}');
 assert.deepEqual(matchingCurly(source,first+1),{open:first,close:last});
 const quoted=source.indexOf('}',source.indexOf('"'));
 assert.equal(matchingCurly(source,quoted+1),null);
 assert.equal(matchingCurly(source,source.indexOf('{',source.indexOf('//'))+1),null);
 assert.equal(matchingCurly('class S {',9),null);
 assert.equal(matchingCurly('{ }',1,3),null);
 assert.deepEqual(matchingCurly('{}',1),{open:0,close:1});
});
test('markup escapes user code and marks only active pair',()=>{
 const source='class S { String literal="<script>"; }';
 const pair=matchingCurly(source,source.indexOf('{')+1);
 const html=syntaxHighlight(source,pair);
 assert.equal((html.match(/class="matching-brace"/g)||[]).length,2);
 assert.ok(!html.includes('<script>'));
 assert.ok(html.includes('&lt;script&gt;'));
});
