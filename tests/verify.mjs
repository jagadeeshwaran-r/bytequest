import "./profile-inbox.mjs";
import "./editor-operators.mjs";
import "./workbench.mjs";
import "./compiler-recovery.mjs";
import "./next-features.mjs";
import "./upgrades.mjs";
import "./presence.mjs";
import "./social.mjs";
import "./leaderboard.mjs";
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
import { validateProblem } from "../dist/catalog.js";
import { buildBenchmarkProgram } from "../supabase/functions/bytequest-firebase/benchmark.js";
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
  const structures = execute(
    "import java.util.*; class Solution { ListNode list(ListNode n){return n;} TreeNode tree(TreeNode n){return n;} GraphNode graph(GraphNode n){return n;} int[][] matrix(int[][] a){return a;} List<List<Integer>> nested(List<List<Integer>> a){return a;} }",
    [
      'check("Linked list", () -> new Solution().list(ListHelper.createList(new int[]{1,2,3})), ListHelper.createList(new int[]{1,2,3}));',
      'check("Cyclic linked list", () -> new Solution().list(ListHelper.createList(new int[]{3,2,0,-4},1)), ListHelper.createList(new int[]{3,2,0,-4},1));',
      'check("Binary tree", () -> new Solution().tree(TreeHelper.createTree(1,2,3,null,4)), TreeHelper.createTree(1,2,3,null,4));',
      'check("Graph adjacency", () -> new Solution().graph(GraphHelper.createGraph(new int[][]{{2},{1}})), GraphHelper.createGraph(new int[][]{{2},{1}}));',
      'check("Matrix", () -> new Solution().matrix(new int[][]{{1,2},{3,4}}), new int[][]{{1,2},{3,4}});',
      'check("Nested lists", () -> new Solution().nested(Arrays.asList(Arrays.asList(1,2),Arrays.asList(3))), Arrays.asList(Arrays.asList(1,2),Arrays.asList(3)));',
      'check("Wrong tree", () -> new Solution().tree(TreeHelper.createTree(1,2,3)), TreeHelper.createTree(1,2,4));'
    ].join("\n")
  );
  assert.equal(structures.status,"ok","Structure harness must compile and execute");
  assert.deepEqual(structures.cases.map(x=>x.passed),[true,true,true,true,true,true,false],"Structural comparisons must distinguish different trees");
  console.log("✓ Linked lists (including cycles), binary trees, graphs, matrices, and nested lists.");
  assert.equal(javaLiteral([[1,2],[3]],"int[][]"),"new int[][]{new int[]{1,2},new int[]{3}}");
  assert.equal(javaLiteral([1,2,3],"ListNode"),"ListHelper.createList(new int[]{1,2,3},-1)");
  assert.equal(javaLiteral([1,null,3],"TreeNode"),"TreeHelper.createTree(1,null,3)");
  assert.equal(javaLiteral([[2],[1]],"GraphNode"),"GraphHelper.createGraph(new int[][]{new int[]{2},new int[]{1}})");
  assert.throws(()=>javaLiteral({values:[1,2],pos:2},"ListNode"));
  // Regression: creator accepts ListNode and both client/server judges can execute cycle inputs.
  const cycleCases = [
    {args:[{values:[3,2,0,-4],pos:1}],expected:true,label:"cycle at second node"},
    {args:[{values:[1,2],pos:0}],expected:true,label:"cycle at head"},
    {args:[{values:[1],pos:-1}],expected:false,label:"no cycle"},
    {args:[null],expected:false,label:"null head"}
  ];
  const cycleSource = "class Solution { public boolean hasCycle(ListNode head) { ListNode slow=head,fast=head; while(fast!=null&&fast.next!=null){slow=slow.next;fast=fast.next.next;if(slow==fast)return true;}return false; } }";
  const cycleProblem = {
    ...problems[0],id:"linked-list-cycle",method:"hasCycle",
    returns:"boolean",normalize:undefined,params:[{name:"head",type:"ListNode"}],
    starter:cycleSource,reference:cycleSource,
    tests:cycleCases
  };
  assert.equal(validateProblem(cycleProblem).params[0].type,"ListNode");
  assert.throws(()=>validateProblem({...cycleProblem,tests:[{args:[{values:[1,2],pos:2}],expected:true},...cycleCases]}));
  const browserCycle=execute(cycleSource,buildTests(cycleProblem,cycleCases));
  assert.equal(browserCycle.status,"ok",JSON.stringify(browserCycle));
  assert.ok(browserCycle.cases.every(c=>c.passed),"Browser linked-list tests must pass: "+JSON.stringify(browserCycle));
  const benchJava=buildBenchmarkProgram(cycleSource,cycleProblem,cycleCases,"java","fixture");
  assert.ok(benchJava.includes("class ListNode"));
  writeFileSync("build/tests/Wandbox.java",benchJava);
  command(["com.sun.tools.javac.Main","-d","build/tests","build/tests/Wandbox.java"]);
  const benchmarkOutput=command(["-cp","build/tests","Wandbox"]);
  assert.equal((benchmarkOutput.match(/__BYTEQUEST_CASE_\d+__/g)||[]).length,cycleCases.length*4);
  assert.ok(benchmarkOutput.includes("__BYTEQUEST_BENCH_fixture__"));
  const wrongCycle=execute("class Solution { public boolean hasCycle(ListNode head) { return false; } }",buildTests(cycleProblem,cycleCases));
  assert.deepEqual(wrongCycle.cases.map(c=>c.passed),[false,false,true,true]);
  console.log("✓ ListNode catalog, cycle position inputs, browser verification, and server benchmark.");
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
