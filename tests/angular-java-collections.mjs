import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareJavaForJudge} from '../angular/src/app/core/java-source.ts';

const duplicate='class Solution { public boolean containsDuplicate(int[] nums) { Set<Integer> s = new HashSet<>(); for (int n : nums) if (!s.add(n)) return true; return false; }}';

test('Missing Set / HashSet imports are supplied before Solution',()=>{
 const compiled=prepareJavaForJudge(duplicate);
 assert.ok(compiled.startsWith('import java.util.*;\nclass Solution'));
 assert.match(compiled,/Set<Integer> s = new HashSet<>\(\)/);
 assert.equal(duplicate.startsWith('class Solution'),true,'Original editor draft stays unmodified');
});
test('Manual imports are preserved without duplicate wildcard',()=>{
 const source='import java.util.*;\n'+duplicate;
 assert.equal(prepareJavaForJudge(source),source);
 assert.equal(prepareJavaForJudge('import java.util.List;\n'+duplicate),
  'import java.util.*;\nimport java.util.List;\n'+duplicate);
});
test('A package cannot evade the default-package runner contract',()=>{
 assert.throws(()=>prepareJavaForJudge('package com.example;\n'+duplicate),/Remove the package/);
});
test('The augmented source respects the same 60 KB Java limit',()=>{
 assert.throws(()=>prepareJavaForJudge('x'.repeat(59990)),/60,000/);
 assert.equal(prepareJavaForJudge(duplicate).length,duplicate.length+'import java.util.*;\n'.length);
});
test('Both Run and verified Submit use exactly the same collections import helper',async()=>{
 const guest=await readFile('angular/src/app/core/java-guest.service.ts','utf8');
 const submit=await readFile('angular/src/app/core/verified-java.service.ts','utf8');
 assert.match(guest,/judge\.run\(prepareJavaForJudge\(source\)/);
 assert.match(submit,/makeJavaSubmission\(problem,prepareJavaForJudge\(source\)/);
 const editor=await readFile('angular/src/app/features/practice/practice.component.ts','utf8');
 assert.match(editor,/this\.code\.set\(value\)/,'Editor must keep the literal user draft');
});
