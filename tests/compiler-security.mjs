import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeBenchmarkJudge} from '../supabase/functions/bytequest-firebase/benchmark.js';
import {makeOnlineJudge} from '../supabase/functions/bytequest-firebase/online-judge.js';
import {makePrivateJudge} from '../supabase/functions/bytequest-firebase/private-judge.js';
import {starterFor} from '../supabase/functions/bytequest-firebase/domain/languages.js';
import {submitSolution} from '../supabase/functions/bytequest-firebase/submissions.js';
import {problems} from '../dist/problems.js';

const problem=problems[0],one=problem.tests.slice(0,1),two=problem.tests.slice(0,2);
const marker=(i,c)=>'__BYTEQUEST_CASE_'+i+'__'+JSON.stringify({ok:true,actual:c.expected});
const case0=marker(0,one[0]),metric='__BYTEQUEST_BENCH_securityfixture__{"runtimeMs":0.8,"memoryBytes":1200000}';
const provider=output=>async()=>new Response(JSON.stringify({status:'0',program_output:output}));
const benchmark=(output,cases=one,language='java')=>makeBenchmarkJudge({
  makeNonce:()=> 'securityfixture',fetchImpl:provider(output)
}).run(problem.reference,problem,cases,language);

assert.equal((await benchmark(case0+'\n'+metric+'\n')).accepted,true,'A complete, measured run is accepted');
const invalid=async(output,status='runtime_error',cases=one,language='java')=>{
  const result=await benchmark(output,cases,language);
  assert.equal(result.accepted,false,JSON.stringify(result));
  assert.equal(result.status,status,JSON.stringify(result));
};
await invalid(case0+'\n'+case0+'\n'+metric+'\n');
await invalid(metric+'\n');
await invalid('__BYTEQUEST_CASE_0__not-json\n'+metric+'\n');
await invalid(marker(1,two[1])+'\n'+marker(0,two[0])+'\n'+metric+'\n','runtime_error',two);
await invalid(case0+'\n'+case0+'\n'+case0+'\n'+case0+'\n'+case0+'\n'+metric+'\n','runtime_error',one,'python');
await invalid(case0+'\n'+metric+'\n'+metric+'\n','unavailable');
await invalid(case0+'\n','unavailable');
await invalid(case0+'\n__BYTEQUEST_BENCH_wrongnonce__{"runtimeMs":0.5}\n','unavailable');
await invalid('__BYTEQUEST_CASE_0__{"ok":true,"actual":null}\n'+metric+'\n','wrong_answer');

const runFailure=async(fields)=>makeOnlineJudge({fetchImpl:async()=>new Response(JSON.stringify({status:'1',...fields}))})
  .run(starterFor(problem,'cpp'),problem,one,'cpp');
assert.equal((await runFailure({program_error:'Segmentation fault'})).status,'runtime_error');
assert.equal((await runFailure({compiler_error:'invalid syntax'})).status,'compile_error');
assert.equal((await makeBenchmarkJudge({fetchImpl:async()=>new Response(JSON.stringify({status:'1',program_error:'SIGKILL'}))})
  .run(problem.reference,problem,one,'java')).status,'runtime_error');

const trusted=makePrivateJudge({url:'https://judge.example.invalid',languageId:62,
 fetchImpl:async()=>new Response(JSON.stringify({status:{id:5},time:'0.1'}))});
assert.equal(trusted.ready,true);
const timeout=await trusted.run(problem.reference,problem,one);
assert.equal(timeout.accepted,false);
assert.equal(timeout.status,'time_limit_exceeded','Private timeouts must not be reported as wrong answers');
let saved=0;
const verdict=await submitSolution({
 owner:'test-user',
 body:{problemId:problem.id,revision:1,language:'java',source:problem.reference,nonce:'11111111-1111-4111-8111-111111111111',shared:false},
 db:{
  existingSubmission:async()=>null,
  privateProblem:async()=>({revision:1,content:{...problem,hiddenCount:1},hidden:one}),
  claimOnlineRun:async()=>true,
  recordSubmission:async()=>{saved++;throw Error('Must never record a timed-out private verdict');}
 },
 privateJudge:trusted
});
assert.equal(verdict.status,'time_limit_exceeded');
assert.equal(saved,0);
assert.match(readFileSync('supabase/functions/bytequest-firebase/index.ts','utf8'),
 /Deno\.env\.get\('BYTEQUEST_ALLOW_EXTERNAL_HIDDEN_JUDGE'\) === 'true'/,
 'Private suite forwarding must require explicit environment opt-in');
assert.match(readFileSync('dist/judge.js','utf8'),/watchdog = setTimeout\(/,
 'Browser Java runs need a deadline that resets the stuck iframe');

console.log('PASS: compiler failure classification, exact benchmark output records, hidden-suite opt-in, private timeouts and browser watchdog.');
