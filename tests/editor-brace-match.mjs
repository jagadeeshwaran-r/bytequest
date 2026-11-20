import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {matchingCurlyBraces} from '../dist/brace-match.js';

for(const language of ['java','c','cpp','python']){
 const source='class A { void m() { int[] values = {1, 2}; } }';
 const outer=source.indexOf('{'),last=source.lastIndexOf('}');
 const middle=source.indexOf('{',outer+1),middleClose=source.lastIndexOf('}',last-1);
 const inner=source.indexOf('{',middle+1),innerClose=source.indexOf('}',inner);
 for(const [open,close] of [[outer,last],[middle,middleClose],[inner,innerClose]]){
  for(const caret of [open,open+1,close+1]){
   assert.deepEqual(matchingCurlyBraces(source,caret,language),{open,close},language+' caret '+caret);
  }
 }
 assert.deepEqual(matchingCurlyBraces('{}',1,language),{open:0,close:1},'Auto-inserted braces are matched');
 assert.equal(matchingCurlyBraces(source,source.indexOf('values'),language),null);
 assert.equal(matchingCurlyBraces(source,middle,language,middle+1),null,'Selected text does not show a stale pair');
 assert.equal(matchingCurlyBraces('{ missing',1,language),null,'Unmatched opening brace is ignored');
 assert.equal(matchingCurlyBraces('missing }',9,language),null,'Unmatched closing brace is ignored');
}
for(const [language,source] of [
 ['java','class A { String text="}"; /* { } */ void m(){ return; } }'],
 ['cpp','int main(){ auto text=R"raw({ } )raw"; /* } */ return 0; }'],
 ['python','def f(): # { }\n    value = {"key": "}" } # }\n']
]){
 const first=source.indexOf('{'),last=source.lastIndexOf('}');
 if(language!=='python')assert.deepEqual(matchingCurlyBraces(source,first+1,language),{open:first,close:last});
 const quoted=source.indexOf('"');
 const internal=source.indexOf('}',quoted);
 assert.equal(matchingCurlyBraces(source,internal,language),null,'Braces inside strings must not match');
 assert.equal(matchingCurlyBraces(source,internal+1,language),null,'Braces inside strings must not match after caret');
}
assert.equal(matchingCurlyBraces('// { }\n{}',3,'java'),null);
assert.deepEqual(matchingCurlyBraces('// { }\n{}',9,'java'),{open:7,close:8});
assert.equal(matchingCurlyBraces('{}',-1),null);
assert.equal(matchingCurlyBraces('{}',3),null);

const app=readFileSync('dist/app.js','utf8');
const html=readFileSync('dist/index.html','utf8');
const css=readFileSync('dist/brace-match.css','utf8');
assert.match(app,/matchingCurlyBraces/);
assert.match(app,/selectionchange/,'Caret movement must refresh the pair without modifying source');
assert.match(app,/matching-curly-brace/);
assert.match(html,/brace-match\.css\?v=brace-1/);
assert.match(css,/#codeHighlight \.matching-curly-brace/);
console.log('PASS: nested curly matching, caret movement, auto-pairs, selection and string/comment safety across Java/C/C++/Python.');
