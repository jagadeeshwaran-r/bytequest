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
import "./public-catalog-cache.mjs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join, delimiter } from "node:path";
import { problems } from "../dist/problems.js";
import { buildTests, javaLiteral } from "../dist/judge.js";
import { validateProblem } from "../dist/catalog.js";
import { buildBenchmarkProgram } from "../supabase/functions/bytequest-firebase/benchmark.js";
import { nativeResults } from "../supabase/functions/bytequest-firebase/domain/languages.js";
import { submitSolution } from "../supabase/functions/bytequest-firebase/submissions.js";
import { traceFor } from "../dist/traces.js";

for (const page of ["index.html", "studio.html"]) {
  const markup = readFileSync("dist/" + page, "utf8");
  const select = markup.split('<select id="pReturns">')[1]?.split("</select>")[0];
  assert.ok(select, page + " must contain the problem return type selector");
  const options = select.split("<option>").slice(1).map(option => option.split("</option>")[0]);
  assert.deepEqual(options, ["int", "int[]", "int[][]", "boolean", "String", "ListNode"],
    page + " return types must match supported Java catalog contracts");
}
console.log("✓ Studio return type selector supports ListNode and int[][] on both pages.");
for(const page of ["index.html","studio.html"]){
  const html=readFileSync("dist/"+page,"utf8");
  assert.ok(!html.includes('id="authGate"'),page+" must not show a full-screen sign-in gate");
  assert.ok(!html.includes('data-bytequest-auth'),page+" must not show a Firebase loading overlay");
  assert.ok(html.includes('id="accountDialog"'),page+" must keep the original account sign-in dialog");
  assert.ok(html.includes('id="googleSignInBtn"'),page+" must keep Google sign-in");
  assert.ok(html.includes('id="guestContinue"'),page+" must keep optional sign-in");
}
const appSource=readFileSync("dist/app.js","utf8");
assert.ok(!appSource.includes('mountSignInGate'),"Problem page must not block navigation on account login");
assert.ok(appSource.includes('googleSignInBtn'),"Google sign-in handler must remain available");
console.log("✓ Original optional Google sign-in restored without a loading or login overlay.");


// A consistent header brand across the practice, Studio and community pages.
for (const page of ["index.html", "studio.html", "leaderboard.html", "community.html"]) {
  const html = readFileSync("dist/" + page, "utf8");
  assert.ok(html.includes('<span class="wordmark-byte">Byte</span><span class="wordmark-quest">Quest</span>'), page + " must show the joined ByteQuest wordmark");
  assert.ok(html.includes('reference-style.css?v=brand-20261116'), page + " must refresh branded styles");
}
console.log("✓ ByteQuest wordmark and branding styles across all four pages.");
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
  // Keep the benchmark ListNode.class out of RunnerCheck\'s classpath.
  // The browser runner generates an independent ListNode class per submission.
  mkdirSync("build/benchmark",{recursive:true});
  writeFileSync("build/benchmark/Wandbox.java",benchJava);
  command(["com.sun.tools.javac.Main","-d","build/benchmark","build/benchmark/Wandbox.java"]);
  const benchmarkOutput=command(["-cp","build/benchmark","Wandbox"]);
  assert.equal((benchmarkOutput.match(/__BYTEQUEST_CASE_\d+__/g)||[]).length,cycleCases.length);
  assert.ok(benchmarkOutput.includes("__BYTEQUEST_BENCH_fixture__"));
  const wrongCycle=execute("class Solution { public boolean hasCycle(ListNode head) { return false; } }",buildTests(cycleProblem,cycleCases));
  assert.equal(wrongCycle.status,"ok",JSON.stringify(wrongCycle));
  assert.deepEqual(wrongCycle.cases.map(c=>c.passed),[false,false,true,true]);
  console.log("✓ ListNode catalog, cycle position inputs, browser verification, and server benchmark.");
  // TreeNode problems are configured through the UI using LeetCode level-order arrays.
  const depthSource = "class Solution { public int maxDepth(TreeNode root){return root==null?0:1+Math.max(maxDepth(root.left),maxDepth(root.right));} }";
  const depthCases = [
    {args:[[3,9,20,null,null,15,7]],expected:3,label:"balanced and deep"},
    {args:[[1,null,2]],expected:2,label:"one-sided tree"},
    {args:[[]],expected:0,label:"empty tree"},
    {args:[[1]],expected:1,label:"single node"},
    {args:[[1,2,3,4,null,null,5]],expected:3,label:"sparse level order"}
  ];
  const depthProblem = {
    ...problems[0],id:"maximum-depth-of-binary-tree",method:"maxDepth",
    returns:"int",normalize:undefined,params:[{name:"root",type:"TreeNode"}],
    starter:depthSource,reference:depthSource,tests:depthCases
  };
  assert.equal(validateProblem(depthProblem).params[0].type,"TreeNode");
  assert.throws(()=>validateProblem({...depthProblem,tests:[{args:[["not an integer"]],expected:1},...depthCases]}));
  const browserDepth=execute(depthSource,buildTests(depthProblem,depthCases));
  assert.equal(browserDepth.status,"ok",JSON.stringify(browserDepth));
  assert.ok(browserDepth.cases.every(c=>c.passed),"Browser tree verification failed: "+JSON.stringify(browserDepth));
  const wrongDepth=execute("class Solution { public int maxDepth(TreeNode root){return 0;} }",buildTests(depthProblem,depthCases));
  assert.equal(wrongDepth.status,"ok",JSON.stringify(wrongDepth));
  assert.deepEqual(wrongDepth.cases.map(c=>c.passed),[false,false,true,false,false]);
  const benchmarkTree=buildBenchmarkProgram(depthSource,depthProblem,depthCases,"java","treefixture");
  assert.ok(benchmarkTree.includes("class TreeNode"));
  mkdirSync("build/tree-benchmark",{recursive:true});
  writeFileSync("build/tree-benchmark/Wandbox.java",benchmarkTree);
  command(["com.sun.tools.javac.Main","-d","build/tree-benchmark","build/tree-benchmark/Wandbox.java"]);
  const treeOutput=command(["-cp","build/tree-benchmark","Wandbox"]);
  assert.equal((treeOutput.match(/__BYTEQUEST_CASE_\d+__/g)||[]).length,depthCases.length);
  assert.ok(treeOutput.includes("__BYTEQUEST_BENCH_treefixture__"));
  console.log("✓ TreeNode studio validation, sparse/empty level-order trees, browser judge, and server benchmark.");

  // A Studio problem with hidden cases must be submittable even without a
  // configured Judge0 instance, without leaking private expected values.
  const privateCases=[{args:[{values:[1,2],pos:0}],expected:true,label:"private cycle"}];
  const serverProblem={...cycleProblem,hiddenCount:privateCases.length,revision:1};
  const submissionInput={problemId:serverProblem.id,revision:1,language:'java',source:cycleSource,nonce:'3b2f24dd-18e9-4b6b-9a9d-57f4f485ce1a',shared:false};
  const seen=[],records=[];
  const fakeDb={
    existingSubmission:async()=>null,
    privateProblem:async()=>({content:serverProblem,revision:1,hidden:privateCases}),
    claimOnlineRun:async()=>true,
    recordSubmission:async(owner,data)=>{records.push(data);return {id:42,owner};}
  };
  const submitOptions={owner:'test-owner',body:submissionInput,db:fakeDb,privateJudge:{ready:false},allowExternalHiddenJudge:true};
  await assert.rejects(()=>submitSolution({...submitOptions,allowExternalHiddenJudge:false,benchmarkJudge:{run:async()=>{throw new Error('Must not send private cases to public compiler');}}}),error=>error.status===503);
  const acceptedHidden=await submitSolution({...submitOptions,benchmarkJudge:{run:async(source,p,cases,language)=>{seen.push({cases,language});return{accepted:true,status:'accepted',runtimeMs:1,memoryBytes:1024,memoryMetric:'process_peak_rss',compiler:'test-java',benchmarkVersion:'test',total:cases.length};}}});
  assert.equal(acceptedHidden.accepted,true);
  assert.equal(acceptedHidden.total,cycleCases.length+privateCases.length);
  assert.deepEqual(seen[0].cases,[...cycleCases,...privateCases]);
  assert.equal(seen[0].language,'java');
  assert.equal(records.length,1);
  assert.equal(records[0].suiteKind,'private');
  const rejectedHidden=await submitSolution({...submitOptions,benchmarkJudge:{run:async()=>({accepted:false,status:'wrong_answer',cases:[{name:'SECRET CASE',expected:'SECRET EXPECTED',actual:'SECRET ACTUAL'}],message:'PRIVATE EXPECTED VALUE'})}});
  assert.equal(rejectedHidden.accepted,false);
  assert.equal(rejectedHidden.status,'wrong_answer');
  assert.ok(!JSON.stringify(rejectedHidden).includes('SECRET'),'Never reveal hidden expected values or case names');
  assert.equal(records.length,1,'Failed hidden tests must never record acceptance');
  console.log('✓ Server-side hidden-case fallback accepts valid Java and redacts private diagnostics.');
  // Creator + browser + compiled server judging for the seven new interview challenges.
  const extendedFixtures=[
    {
      id:"reverse-linked-list",method:"reverseList",params:[{name:"head",type:"ListNode"}],returns:"ListNode",
      source:"class Solution { public ListNode reverseList(ListNode head){ListNode prev=null;while(head!=null){ListNode next=head.next;head.next=prev;prev=head;head=next;}return prev;} }",
      cases:[{args:[[1,2,3,4]],expected:[4,3,2,1]},{args:[[]],expected:[]},{args:[null],expected:null},{args:[[7]],expected:[7]}]
    },
    {
      id:"merge-intervals",method:"merge",params:[{name:"intervals",type:"int[][]"}],returns:"int[][]",
      source:"import java.util.*; class Solution { public int[][] merge(int[][] intervals){if(intervals.length==0)return new int[0][];Arrays.sort(intervals,(a,b)->Integer.compare(a[0],b[0]));List<int[]> out=new ArrayList<>();for(int[] in:intervals){if(out.isEmpty()||out.get(out.size()-1)[1]<in[0])out.add(new int[]{in[0],in[1]});else out.get(out.size()-1)[1]=Math.max(out.get(out.size()-1)[1],in[1]);}return out.toArray(new int[0][]);} }",
      cases:[{args:[[[1,3],[2,6],[8,10],[15,18]]],expected:[[1,6],[8,10],[15,18]]},{args:[[[1,4],[4,5]]],expected:[[1,5]]},{args:[[]],expected:[]},{args:[[[-5,-1],[-2,1]]],expected:[[-5,1]]}]
    },
    {
      id:"middle-of-linked-list",method:"middleNode",params:[{name:"head",type:"ListNode"}],returns:"ListNode",normalize:"listnode-index",
      source:"class Solution { public ListNode middleNode(ListNode head){ListNode slow=head,fast=head;while(fast!=null&&fast.next!=null){slow=slow.next;fast=fast.next.next;}return slow;} }",
      cases:[{args:[[1,2,3,4,5]],expected:2},{args:[[1,2,3,4,5,6]],expected:3},{args:[[7,7,7,7]],expected:2},{args:[[]],expected:-1}]
    },
    {
      id:"merge-two-sorted-lists",method:"mergeTwoLists",params:[{name:"list1",type:"ListNode"},{name:"list2",type:"ListNode"}],returns:"ListNode",
      source:"class Solution { public ListNode mergeTwoLists(ListNode list1,ListNode list2){ListNode dummy=new ListNode(0),tail=dummy;while(list1!=null&&list2!=null){if(list1.val<=list2.val){tail.next=list1;list1=list1.next;}else{tail.next=list2;list2=list2.next;}tail=tail.next;}tail.next=list1!=null?list1:list2;return dummy.next;} }",
      cases:[{args:[[1,2,4],[1,3,4]],expected:[1,1,2,3,4,4]},{args:[[],[]],expected:[]},{args:[[],[0]],expected:[0]},{args:[[-3,-1,0],[2,3]],expected:[-3,-1,0,2,3]}]
    },
    {
      id:"remove-nth-node-from-end",method:"removeNthFromEnd",params:[{name:"head",type:"ListNode"},{name:"n",type:"int"}],returns:"ListNode",
      source:"class Solution { public ListNode removeNthFromEnd(ListNode head,int n){ListNode dummy=new ListNode(0,head),fast=dummy,slow=dummy;for(int i=0;i<=n;i++)fast=fast.next;while(fast!=null){fast=fast.next;slow=slow.next;}slow.next=slow.next.next;return dummy.next;} }",
      cases:[{args:[[1,2,3,4,5],2],expected:[1,2,3,5]},{args:[[1],1],expected:[]},{args:[[1,2],2],expected:[2]},{args:[[1,2],1],expected:[1]}]
    },
    {
      id:"linked-list-cycle-ii",method:"detectCycle",params:[{name:"head",type:"ListNode"}],returns:"ListNode",normalize:"listnode-index",
      source:"class Solution { public ListNode detectCycle(ListNode head){ListNode slow=head,fast=head;while(fast!=null&&fast.next!=null){slow=slow.next;fast=fast.next.next;if(slow==fast){ListNode entry=head;while(entry!=slow){entry=entry.next;slow=slow.next;}return entry;}}return null;} }",
      cases:[{args:[{values:[3,2,0,-4],pos:1}],expected:1},{args:[{values:[1,2],pos:0}],expected:0},{args:[{values:[1],pos:-1}],expected:-1},{args:[{values:[7,7,7,7],pos:3}],expected:3}]
    },
    {
      id:"add-two-numbers",method:"addTwoNumbers",params:[{name:"l1",type:"ListNode"},{name:"l2",type:"ListNode"}],returns:"ListNode",
      source:"class Solution { public ListNode addTwoNumbers(ListNode l1,ListNode l2){ListNode dummy=new ListNode(0),tail=dummy;int carry=0;while(l1!=null||l2!=null||carry!=0){int sum=carry;if(l1!=null){sum+=l1.val;l1=l1.next;}if(l2!=null){sum+=l2.val;l2=l2.next;}tail.next=new ListNode(sum%10);tail=tail.next;carry=sum/10;}return dummy.next;} }",
      cases:[{args:[[2,4,3],[5,6,4]],expected:[7,0,8]},{args:[[0],[0]],expected:[0]},{args:[[9,9,9,9,9,9,9],[9,9,9,9]],expected:[8,9,9,9,0,0,0,1]},{args:[[5],[5]],expected:[0,1]}]
    }
  ];
  for(let i=0;i<extendedFixtures.length;i++){
    const x=extendedFixtures[i],testProblem={...problems[0],...x,normalize:x.normalize,starter:x.source,reference:x.source,tests:x.cases};
    assert.equal(validateProblem(testProblem).returns,x.returns,x.id+" catalog return type");
    const browser=execute(x.source,buildTests(testProblem,x.cases));
    assert.equal(browser.status,"ok",x.id+": "+JSON.stringify(browser));
    assert.ok(browser.cases.every(c=>c.passed),x.id+" browser checks: "+JSON.stringify(browser));
    const bench=buildBenchmarkProgram(x.source,testProblem,x.cases,"java","extended"+i);
    const folder="build/extended-"+i;
    mkdirSync(folder,{recursive:true});
    writeFileSync(folder+"/Wandbox.java",bench);
    command(["com.sun.tools.javac.Main","-d",folder,folder+"/Wandbox.java"]);
    const output=command(["-cp",folder,"Wandbox"]);
    const graded=nativeResults(output,testProblem,x.cases);
    assert.ok(graded.every(c=>c.passed),x.id+" server results: "+JSON.stringify(graded));
    assert.equal((output.match(/__BYTEQUEST_CASE_\d+__/g)||[]).length,x.cases.length);
  }
  const cycleIndex=extendedFixtures[5],cycleIdentityProblem={...problems[0],...cycleIndex,starter:cycleIndex.source,reference:cycleIndex.source,tests:cycleIndex.cases};
  const fakeEntry=execute("class Solution { public ListNode detectCycle(ListNode head){return new ListNode(head==null?0:head.val);} }",buildTests(cycleIdentityProblem,cycleIndex.cases));
  assert.equal(fakeEntry.status,"ok");
  assert.ok(fakeEntry.cases.some(c=>!c.passed),"Returning a new equal-valued node must fail identity checking");
  console.log("✓ Seven extended Java contracts compile and pass browser and server grading.");
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
