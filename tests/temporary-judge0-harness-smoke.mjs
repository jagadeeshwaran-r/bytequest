import {makeBenchmarkJudge} from '../supabase/functions/bytequest-firebase/benchmark.js';
const p={id:'contains-duplicate',revision:2,method:'containsDuplicate',params:[{name:'nums',type:'int[]'}],returns:'boolean'};
const cases=[{args:[[1,2,3,1]],expected:true,label:'Duplicate'},{args:[[1,2,3]],expected:false,label:'Distinct'}];
const source='class Solution { boolean containsDuplicate(int[] nums){ java.util.Set<Integer> seen = new java.util.HashSet<>(); for (int n : nums) if (!seen.add(n)) return true; return false; } }';
const verdict=await makeBenchmarkJudge().run(source,p,cases,'java',{publicCasesOnly:true});
console.log('BYTEQUEST_JUDGE0_HARNESS_SMOKE '+JSON.stringify({status:verdict.status,accepted:verdict.accepted,passed:verdict.passed,total:verdict.total,compiler:verdict.compiler,version:verdict.benchmarkVersion,message:verdict.message?.slice(0,200)}));
