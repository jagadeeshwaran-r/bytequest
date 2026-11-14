import "./presence.mjs";
import "./social.mjs";
import "./online.mjs";
import "./firebase-auth.mjs";
import "./community.mjs";
import "./minimal.mjs";
import "./cloud-models.mjs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join, delimiter } from "node:path";
import { problems } from "../dist/problems.js";
import { buildTests, javaLiteral } from "../dist/judge.js";
import { traceFor } from "../dist/traces.js";
mkdirSync("build/tests", {recursive:true});
function command(args) {
  const p=spawnSync("java",args,{encoding:"utf8",timeout:25000});
  if(p.error)throw p.error;
  assert.equal(p.status,0,p.stderr||p.stdout);
  return p.stdout;
}
command(["com.sun.tools.javac.Main","-cp","dist/java-runner.jar","-d","build/tests","tests/RunnerCheck.java"]);
function execute(source,tests) {
  writeFileSync("build/tests/Solution.txt",source);
  writeFileSync("build/tests/cases.txt",tests);
  return JSON.parse(command(["-cp",["dist/java-runner.jar","build/tests"].join(delimiter),"RunnerCheck","build/tests/Solution.txt","build/tests/cases.txt"]));
}
const warm=execute("class Solution { public int warmup() { return 0; } }",'check("Compiler warm-up", () -> new Solution().warmup(), 0);');
assert.equal(warm.status,"ok");assert.ok(warm.cases.every(c=>c.passed),"Compiler warm-up must run successfully.");
let cases=0;
try {
  for(const p of problems) {
    const result=execute(p.reference,buildTests(p,p.tests));
    assert.equal(result.status,"ok",p.title+": "+result.message);
    assert.ok(result.cases.every(c=>c.passed),p.title+": "+JSON.stringify(result));
    assert.ok(traceFor(p).length>=3,p.id+" needs a useful walkthrough");
    cases+=result.cases.length;
    console.log("✓ "+p.title+" · "+result.cases.length+" cases");
  }
  const problem=problems[0],tests=buildTests(problem,problem.tests.slice(0,2));
  assert.equal(execute("class Solution { THIS IS NOT JAVA }",tests).status,"compile_error");
  const wrong=execute("class Solution { public int[] twoSum(int[] a,int t){return new int[]{0,0};} }",tests);
  assert.equal(wrong.status,"ok");
  assert.ok(wrong.cases.every(c=>!c.passed),"Wrong answers must fail");
  const thrown=execute(problem.starter,tests);
  assert.ok(thrown.cases.every(c=>!c.passed&&c.actual.includes("UnsupportedOperationException")));
  const reversed=execute("class Solution { public int[] twoSum(int[] a,int t){return new int[]{1,0};} }",buildTests(problem,[problem.tests[0]]));
  assert.equal(reversed.cases[0].passed,true,"Two Sum permits either index order");
  const literal=javaLiteral('a"b\\c\n\t',"String");
  const echo=execute('class Solution { public String echo(String s){System.out.println("console output");return s;} }',
    "check(\"escaped\", () -> new Solution().echo("+literal+"), "+literal+");");
  assert.equal(echo.cases[0].passed,true);
  assert.ok(echo.stdout.includes("console output"));
  assert.throws(()=>javaLiteral("oops","int"));
  assert.throws(()=>javaLiteral([1,"x"],"int[]"));
  assert.throws(()=>buildTests(problem,[{args:[[]],expected:[]}]));
  const index=readFileSync("dist/index.html","utf8");
  for(const f of ["style.css","app.js","judge.js","problems.js","runner.html","java-runner.jar","traces.js","favicon.svg"])assert.ok(existsSync(join("dist",f)),f+" is missing");
  for(const src of [...index.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map(m=>m[1]))assert.ok(existsSync(join("dist",decodeURIComponent(new URL(src,"https://bytequest.test/").pathname))),src+" reference is broken");
  console.log("✓ Compile diagnostics, wrong answers, runtime exceptions, index ordering, escaped strings, console capture, input validation and static assets.");
  console.log("PASS: "+problems.length+" real Java solutions / "+cases+" built-in test cases.");
} finally {rmSync("build",{recursive:true,force:true});}
