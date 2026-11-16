import {javaInputStructures} from './domain/java-structures.js';
import {javaLiteral} from './domain/judge.js';
import {HttpError} from './handler.js';
// Never trust or return an unbounded Judge0 response: stdout/compile diagnostics
// may include the private test suite. Reject oversize/malformed replies safely.
const MAX_JUDGE_REPLY_BYTES=131072;
async function readPrivateJudgeReply(response){
 const message='The private Java judge returned an invalid response. No verdict was recorded.';
 const declared=Number(response.headers.get('content-length'));
 if(Number.isFinite(declared)&&declared>MAX_JUDGE_REPLY_BYTES)throw new HttpError(503,message);
 if(!response.body)throw new HttpError(503,message);
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let size=0,raw='';
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;
   if(size>MAX_JUDGE_REPLY_BYTES){await reader.cancel();throw new HttpError(503,message);}
   raw+=decoder.decode(value,{stream:true});
  }
  raw+=decoder.decode();
 }catch{throw new HttpError(503,message);}finally{reader.releaseLock();}
 let result;
 try{result=JSON.parse(raw);}catch{throw new HttpError(503,message);}
 if(!result||typeof result!=='object'||!Number.isInteger(result.status?.id))
  throw new HttpError(503,message);
 return result;
}

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
  const calls=cases.map(c=>{
    let call='new Solution().'+problem.method+'('+c.args.map((v,i)=>javaLiteral(v,problem.params[i].type)).join(',')+')';
    if(problem.normalize==='listnode-index') call='ListHelper.indexOfReturned('+javaLiteral(c.args[0],'ListNode')+', head -> new Solution().'+problem.method+'(head))';
    else if(problem.returns==='ListNode') call='ListHelper.toArray('+call+')';
    if(problem.normalize==='sort-int')call='sorted('+call+')';
    return 'System.out.println(repr('+call+'));';
  }).join('\n');
  const program=imports+'\n'+javaInputStructures(problem)+'\n'+solution+`\npublic class Main {
 static int[] sorted(int[] x){if(x!=null)java.util.Arrays.sort(x);return x;}
 static String repr(Object x){if(x instanceof int[][])return java.util.Arrays.deepToString((int[][])x);if(x instanceof int[]){int[] a=(int[])x;StringBuilder b=new StringBuilder("[");for(int i=0;i<a.length;i++){if(i>0)b.append(',');b.append(a[i]);}return b.append(']').toString();}if(x instanceof String){StringBuilder b=new StringBuilder();b.append((char)34);for(char c:((String)x).toCharArray()){if(c==34||c==92)b.append((char)92).append(c);else if(c<32)b.append((char)92).append('u').append(String.format("%04x",(int)c));else b.append(c);}return b.append((char)34).toString();}return String.valueOf(x);}
 public static void main(String[] args)throws Exception{`+calls+'\n}}';
  const expected=cases.map(c=>JSON.stringify(problem.normalize==='sort-int'?[...c.expected].sort((a,b)=>a-b):problem.returns==='ListNode'&&problem.normalize!=='listnode-index'&&c.expected===null?[]:c.expected)).join('\n')+'\n';
  const target=new URL('submissions?base64_encoded=false&wait=true',base.href.endsWith('/')?base.href:base.href+'/');
  let response;
  try{
   response=await fetchImpl(target,{method:'POST',headers:{'Content-Type':'application/json',...(apiKey?{'X-Auth-Token':apiKey}:{})},body:JSON.stringify({source_code:program,language_id:languageId,expected_output:expected,enable_network:false,cpu_time_limit:2,wall_time_limit:5,memory_limit:262144,max_file_size:256}),signal:AbortSignal.timeout(20000)});
  }catch{throw new HttpError(503,'The private Java judge is unavailable. No verdict was recorded.');}
  if(!response.ok)throw new HttpError(503,'The private Java judge is unavailable. No verdict was recorded.');
  const result=await readPrivateJudgeReply(response),status=result.status.id;
  if([1,2].includes(status))throw new HttpError(503,'The private judge is still processing. Retry shortly; no verdict was recorded.');
  // An unknown or internal provider state is NOT a learner's wrong answer.
  if(![3,4,5,6,7,8,9,10,11].includes(status))
   throw new HttpError(503,'The private Java judge could not provide a trustworthy verdict. Retry shortly.');
  const verdict=status===3?'accepted':status===4?'wrong_answer':status===5?'time_limit_exceeded':status===6?'compile_error':'runtime_error';
  // Never return the provider's stdout, stderr, hidden inputs or compile output.
  return {accepted:status===3,status:verdict,runtimeMs:result.time!=null&&Number.isFinite(Number(result.time))&&Number(result.time)>=0?Number(result.time)*1000:null,memoryBytes:result.memory!=null&&Number.isFinite(Number(result.memory))&&Number(result.memory)>0?Number(result.memory)*1024:null,hiddenCount:cases.length,message:status===3?'All private cases passed.':status===6?'Java compilation failed in the private judge. Check your code using Run.':status===5?'Private tests exceeded the time limit.':status>=7?'The private tests could not finish due to a runtime error.':'Private tests did not pass. Recheck edge cases and constraints.'};
 }};
}
