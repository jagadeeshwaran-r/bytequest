import {linkedListJavaSource,hasLinkedListType} from './domain/java-structures.js';
import {javaLiteral} from './domain/judge.js';
import {HttpError} from './handler.js';
// This adapter runs only on the server. No provider key, inputs, or expected outputs
// are returned to the learner. Configure an isolated, trusted Judge0 instance.
export function makePrivateJudge({url,apiKey='',languageId,fetchImpl=(...args)=>fetch(...args)}={}){
 let base;try{base=new URL(url);}catch{}
 const ready=!!base&&base.protocol==='https:'&&!base.username&&!base.password&&!base.search&&!base.hash&&Number.isSafeInteger(languageId)&&languageId>0;
 return {ready,async run(source,problem,cases){
  if(!ready)throw new HttpError(503,'Private Java judging is not connected yet. Use Run for public practice cases. Hidden inputs remain private.');
  if(typeof source!=='string'||source.length>60000)throw new HttpError(400,'Keep Java code under 60,000 characters.');
  const imports=(source.match(/^\s*import\s+[^;]+;\s*$/gm)||[]).join('\n');
  const solution=source.replace(/^\s*import\s+[^;]+;\s*$/gm,'').replace(/public\s+class\s+Solution\b/,'class Solution');
  const calls=cases.map(c=>{let call='new Solution().'+problem.method+'('+c.args.map((v,i)=>javaLiteral(v,problem.params[i].type)).join(',')+')';if(problem.normalize==='sort-int')call='sorted('+call+')';return 'System.out.println(repr('+call+'));';}).join('\n');
  const program=imports+'\n'+(hasLinkedListType(problem)?linkedListJavaSource:'')+'\n'+solution+`\npublic class Main {
 static int[] sorted(int[] x){if(x!=null)java.util.Arrays.sort(x);return x;}
 static String repr(Object x){if(x instanceof int[]){int[] a=(int[])x;StringBuilder b=new StringBuilder("[");for(int i=0;i<a.length;i++){if(i>0)b.append(',');b.append(a[i]);}return b.append(']').toString();}if(x instanceof String){StringBuilder b=new StringBuilder();b.append((char)34);for(char c:((String)x).toCharArray()){if(c==34||c==92)b.append((char)92).append(c);else if(c<32)b.append((char)92).append('u').append(String.format("%04x",(int)c));else b.append(c);}return b.append((char)34).toString();}return String.valueOf(x);}
 public static void main(String[] args)throws Exception{`+calls+'\n}}';
  const expected=cases.map(c=>JSON.stringify(problem.normalize==='sort-int'?[...c.expected].sort((a,b)=>a-b):c.expected)).join('\n')+'\n';
  const target=new URL('submissions?base64_encoded=false&wait=true',base.href.endsWith('/')?base.href:base.href+'/');
  const response=await fetchImpl(target,{method:'POST',headers:{'Content-Type':'application/json',...(apiKey?{'X-Auth-Token':apiKey}:{})},body:JSON.stringify({source_code:program,language_id:languageId,expected_output:expected,enable_network:false,cpu_time_limit:2,wall_time_limit:5,memory_limit:262144,max_file_size:256}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new HttpError(503,'The private Java judge is unavailable. No acceptance was recorded.');
  const result=await response.json(),status=result.status?.id;
  if([1,2].includes(status))throw new HttpError(503,'The judge is still processing. Retry your submission shortly.');
  // Diagnostics can contain hidden inputs: never echo stdout, stderr, or compile_output.
  return {accepted:status===3,runtimeMs:result.time!=null&&Number.isFinite(Number(result.time))&&Number(result.time)>=0?Number(result.time)*1000:null,memoryBytes:result.memory!=null&&Number.isFinite(Number(result.memory))&&Number(result.memory)>0?Number(result.memory)*1024:null,hiddenCount:cases.length,message:status===3?'All private cases passed.':status===6?'Java compilation failed in the private judge. Check your code using Run.':status===5?'Private tests exceeded the time limit.':'Private tests did not pass. Recheck edge cases and constraints.'};
 }};
}
