import {makeBenchmarkJudge,buildBenchmarkProgram} from '../supabase/functions/bytequest-firebase/benchmark.js';
const p={id:'contains-duplicate',revision:2,method:'containsDuplicate',params:[{name:'nums',type:'int[]'}],returns:'boolean'};
const cases=[{args:[[1,2,3,1]],expected:true,label:'Duplicate'},{args:[[1,2,3]],expected:false,label:'Distinct'}];
const source='class Solution { boolean containsDuplicate(int[] nums){ java.util.Set<Integer> seen = new java.util.HashSet<>(); for (int n : nums) if (!seen.add(n)) return true; return false; } }';
const verdict=await makeBenchmarkJudge().run(source,p,cases,'java',{publicCasesOnly:true});
console.log('BYTEQUEST_JUDGE0_HARNESS_SMOKE '+JSON.stringify({status:verdict.status,accepted:verdict.accepted,passed:verdict.passed,total:verdict.total,compiler:verdict.compiler,version:verdict.benchmarkVersion,message:verdict.message?.slice(0,200)}));

try {
 const generated=buildBenchmarkProgram(source,p,cases,'java','raw').replace(/\nclass Wandbox \{/,'\npublic class Main {');
 const r=await fetch('https://ce.judge0.com/submissions?base64_encoded=false&wait=true',{method:'POST',
   headers:{'Content-Type':'application/json'},body:JSON.stringify({source_code:generated,language_id:91,enable_network:false,cpu_time_limit:3,wall_time_limit:9,memory_limit:262144,max_file_size:256}),signal:AbortSignal.timeout(15000)});
 const raw=await r.text();
 console.log('BYTEQUEST_JUDGE0_RAW '+r.status+' '+raw.slice(0,1000).replace(/\s+/g,' '));
}catch(e){console.log('BYTEQUEST_JUDGE0_RAW_ERROR '+String(e?.message||e).slice(0,250));}
