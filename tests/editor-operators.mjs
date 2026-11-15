import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {comparisonEdit} from '../dist/code-operators.js';

const repair=(value,language='java')=>comparisonEdit(value,value.length,value.length,language);
for(const language of ['java','python','c','cpp']){
 const ascii='a == b; a != b; a <= b; a >= b; a << b; a >> b; a <=> b';
 assert.equal(repair(ascii,language).value,ascii);assert.equal(repair(ascii,language).count,0);
 assert.equal(repair('a ≡ b; a ≠ b; a ≤ b; a ≥ b; a ⩵ b',language).value,'a == b; a != b; a <= b; a >= b; a == b');
 const quoted='"≤ ≥ ≠ ≡" + \'≠\' + "escaped \\" ≤"';
 assert.equal(repair(quoted,language).value,quoted,'Quoted characters are data, not operators');
}
assert.equal(repair('if（a）', 'java').value,'if（a）','Only the supported comparison symbols are changed');
assert.equal(repair('a ＜＝ b; a ＞＝ b; a ！＝ b; a ＝＝ b').value,'a <= b; a >= b; a != b; a == b');
assert.equal(repair('// a ≤ b\na ≥ b /* ≠ */').value,'// a ≤ b\na >= b /* ≠ */');
assert.equal(repair('# a ≤ b\na ≥ b', 'python').value,'# a ≤ b\na >= b');
assert.equal(repair('/* not closed ≤ a ≥ b').count,0);
for(const [language,text] of [['java','"""\n≤ ≥ ≠\n"""'],['python',"r'''≤ ≠ ≥'''"],['cpp','u8R"bq(≤ ")" ≠ ≥)bq"']])assert.equal(repair(text+'; a≤b',language).value,text+'; a<=b');
assert.equal(repair("auto n=0xA'B; auto c=u8'a'; n≥2;",'cpp').value,"auto n=0xA'B; auto c=u8'a'; n>=2;");
const continued='// ≤ \\\n ≥\na ≠ b';assert.equal(repair(continued,'cpp').value,'// ≤ \\\n ≥\na != b');
const selected=comparisonEdit('🙂a≤b',4,5,'java');assert.equal(selected.start,5);assert.equal(selected.end,6);assert.equal(repair(selected.value).count,0,'Repair is idempotent');

// Compile and execute the repaired source, not a duplicated operator implementation.
const directory=mkdtempSync(join(tmpdir(),'bytequest-operators-'));
const run=(cmd,args)=>{const p=spawnSync(cmd,args,{cwd:directory,encoding:'utf8',timeout:20000});if(p.error)throw p.error;assert.equal(p.status,0,p.stderr||p.stdout);return p.stdout.trim();};
const expected='1011\n0110\n0101';
try{
 const programs={
  java:'class OperatorFixture { public static void main(String[] args){String literal="≤ ≥ ≠ ≡"; int[] a={2,2,3},b={2,3,2}; for(int i=0;i<3;i++)System.out.printf("%d%d%d%d%n",a[i]≡b[i]?1:0,a[i]≠b[i]?1:0,a[i]≤b[i]?1:0,a[i]≥b[i]?1:0);}}',
  python:'literal="≤ ≥ ≠ ≡"\nfor a,b in [(2,2),(2,3),(3,2)]:\n    print(*(int(x) for x in (a≡b,a≠b,a≤b,a≥b)),sep="")\n',
  c:'#include <stdio.h>\nint main(void){const char* literal="≤ ≥ ≠ ≡"; int a[]={2,2,3},b[]={2,3,2}; for(int i=0;i<3;i++)printf("%d%d%d%d\\n",a[i]≡b[i],a[i]≠b[i],a[i]≤b[i],a[i]≥b[i]);return 0;}',
  cpp:'#include <iostream>\nint main(){const char* literal=R"bq(≤ ≥ ≠ ≡)bq"; int a[]={2,2,3},b[]={2,3,2}; for(int i=0;i<3;i++)std::cout<<(a[i]≡b[i])<<(a[i]≠b[i])<<(a[i]≤b[i])<<(a[i]≥b[i])<<"\\n";}'
 };
 const names={java:'OperatorFixture.java',python:'fixture.py',c:'fixture.c',cpp:'fixture.cpp'};
 for(const [language,source] of Object.entries(programs)){
  const fixed=repair(source,language);assert.equal(fixed.count,4);assert.ok(fixed.value.includes('≤ ≥ ≠ ≡'));writeFileSync(join(directory,names[language]),fixed.value);
 }
 run('java',['com.sun.tools.javac.Main','-encoding','UTF-8','OperatorFixture.java']);assert.equal(run('java',['OperatorFixture']),expected);
 assert.equal(run('python3',['fixture.py']),expected);
 run('gcc',['-std=c11','fixture.c','-o','c-fixture']);assert.equal(run(join(directory,'c-fixture'),[]),expected);
 run('g++',['-std=c++17','fixture.cpp','-o','cpp-fixture']);assert.equal(run(join(directory,'cpp-fixture'),[]),expected);
}finally{rmSync(directory,{recursive:true,force:true});}
console.log('PASS: literal ASCII operators, safe math-symbol repair, strings/comments/raw literals, selection positions and real Java/Python/C/C++ comparison results.');
