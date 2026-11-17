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
 if(!result||typeof result!=='object'||(!Number.isInteger(result.status?.id)&&!validToken(result.token)))
  throw new HttpError(503,message);
 return result;
}

const validToken = token => typeof token === 'string' && /^[a-zA-Z0-9-]{8,128}$/.test(token);
const JUDGE_DEADLINE_MS=20000;
const pendingError='The private Java judge is still processing. No verdict was recorded. Retry shortly.';

// This adapter runs only on the server. No provider key, inputs, or expected outputs
// are returned to the learner. Configure an isolated, trusted Judge0 instance.
export function makePrivateJudge({url,apiKey='',languageId,fetchImpl=(...args)=>fetch(...args),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=Date.now}={}){
 let base;try{base=new URL(url);}catch{}
 const ready=!!base&&base.protocol==='https:'&&!base.username&&!base.password&&!base.search&&!base.hash&&Number.isSafeInteger(languageId)&&languageId>0;
 return {ready,async run(source,problem,cases,{visibility='private'}={}){
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
  // Judge0 recommends queue-and-poll instead of wait=true, which blocks a
  // server worker and is disabled on many hosted Judge0 deployments.
  const root=base.href.endsWith('/')?base.href:base.href+'/';
  const headers={'Content-Type':'application/json',...(apiKey?{'X-Auth-Token':apiKey}:{})};
  const started=now(),deadline=started+JUDGE_DEADLINE_MS;
  const request=async(target,options={})=>{
   let response;
   try{
    const remaining=deadline-now();
    if(remaining<=0)throw new Error('timeout');
    response=await fetchImpl(target,{...options,headers,signal:AbortSignal.timeout(Math.max(1,Math.floor(remaining)))});
   }catch{throw new HttpError(503,'The private Java judge is unavailable. No verdict was recorded.');}
   if(!response.ok)throw new HttpError(503,'The private Java judge is unavailable. No verdict was recorded.');
   return readPrivateJudgeReply(response);
  };
  const target=new URL('submissions?base64_encoded=false',root);
  let result=await request(target,{method:'POST',
    body:JSON.stringify({source_code:program,language_id:languageId,expected_output:expected,enable_network:false,cpu_time_limit:2,wall_time_limit:5,memory_limit:262144,max_file_size:256})});
  if(!Number.isInteger(result.status?.id)){
   const token=result.token;
   if(!validToken(token))throw new HttpError(503,'The private Java judge returned an invalid submission token. No verdict was recorded.');
   const pollUrl=new URL('submissions/'+encodeURIComponent(token)+'?base64_encoded=false&fields=status,time,memory',root);
   for(let attempt=0;attempt<30;attempt++){
    const remaining=deadline-now();
    if(remaining<100)throw new HttpError(503,pendingError);
    const delay=Math.min(1000,250+attempt*150,Math.max(1,remaining-50));
    await wait(delay);
    if(deadline-now()<=0)throw new HttpError(503,pendingError);
    result=await request(pollUrl);
    if(![1,2].includes(result.status?.id))break;
   }
  }
  const status=result.status?.id;
  if([1,2].includes(status)||status===undefined)throw new HttpError(503,pendingError);
  // An unknown or internal provider state is NOT a learner's wrong answer.
  if(![3,4,5,6,7,8,9,10,11].includes(status))
   throw new HttpError(503,'The private Java judge could not provide a trustworthy verdict. Retry shortly.');
  const verdict=status===3?'accepted':status===4?'wrong_answer':status===5?'time_limit_exceeded':status===6?'compile_error':'runtime_error';
  // Never return the provider's stdout, stderr, hidden inputs or compile output.
  return {accepted:status===3,status:verdict,runtimeMs:result.time!=null&&Number.isFinite(Number(result.time))&&Number(result.time)>=0?Number(result.time)*1000:null,memoryBytes:result.memory!=null&&Number.isFinite(Number(result.memory))&&Number(result.memory)>0?Number(result.memory)*1024:null,hiddenCount:visibility==='private'?cases.length:0,...(visibility==='public'?{passed:status===3?cases.length:0,total:cases.length}:{}),message:status===3?(visibility==='public'?'All '+cases.length+' public cases passed.':'All private cases passed.'):status===6?'Java compilation failed in the private judge. Check your code using Run.':status===5?'Java tests exceeded the time limit.':status>=7?'The Java tests could not finish due to a runtime error.':visibility==='public'?'Public tests did not pass. Recheck edge cases.':'Private tests did not pass. Recheck edge cases and constraints.'};
 }};
}
