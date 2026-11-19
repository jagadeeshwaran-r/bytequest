import {javaInputStructures,requiresJavaStructures} from './domain/java-structures.js';
import {requestSandbox,sandboxExecutionFailure} from './sandbox-provider.js';
import {javaLiteral} from './domain/judge.js';
import {buildNativeProgram,nativeResults} from './domain/languages.js';
export const benchmarkVersion='bq-v1';
export const benchmarkCompilers={java:'openjdk-jdk-21+35',python:'cpython-3.11.10',c:'gcc-13.2.0-c',cpp:'gcc-13.2.0'};
function javaProgram(source,p,cases,nonce){
 const imports=(source.match(/^\s*import\s+[^;]+;\s*$/gm)||[]).join('\n'),solution=source.replace(/^\s*import\s+[^;]+;\s*$/gm,'').replace(/public\s+class\s+Solution\b/,'class Solution');
 const calls=cases.map((c,i)=>{
  let call='new Solution().'+p.method+'('+c.args.map((v,j)=>javaLiteral(v,p.params[j].type)).join(',')+')';
  if(p.normalize==='listnode-index') call='ListHelper.indexOfReturned('+javaLiteral(c.args[0],'ListNode')+', head -> new Solution().'+p.method+'(head))';
  else if(p.returns==='ListNode') call='ListHelper.toArray('+call+')';
  return 'System.out.println("\\n__BYTEQUEST_CASE_'+i+'__{\\\"ok\\\":true,\\\"actual\\\":"+repr('+call+')+"}");';
 }).join('\n');
 return imports+'\n'+javaInputStructures(p)+'\n'+solution+`\nclass Wandbox {
 static String repr(Object x){if(x instanceof int[][])return java.util.Arrays.deepToString((int[][])x);if(x instanceof int[]){int[] a=(int[])x;StringBuilder b=new StringBuilder("[");for(int i=0;i<a.length;i++){if(i>0)b.append(',');b.append(a[i]);}return b.append(']').toString();}if(x instanceof String){StringBuilder b=new StringBuilder();b.append((char)34);for(char c:((String)x).toCharArray()){if(c==34||c==92)b.append((char)92).append(c);else if(c<32)b.append((char)92).append('u').append(String.format("%04x",(int)c));else b.append(c);}return b.append((char)34).toString();}return String.valueOf(x);}
 static long peakRss(){try{for(String line:java.nio.file.Files.readAllLines(java.nio.file.Path.of("/proc/self/status"))){if(line.startsWith("VmHWM:"))return Long.parseLong(line.replaceAll("[^0-9]",""))*1024;}}catch(Exception ignored){}return -1;}
 static void suite() throws Exception {`+calls+`}
 public static void main(String[] args) throws Exception {long started=System.nanoTime();suite();double runtimeMs=(System.nanoTime()-started)/1000000.0;System.out.println("\\n__BYTEQUEST_BENCH_`+nonce+`__{\\\"runtimeMs\\\":"+runtimeMs+",\\\"memoryBytes\\\":"+peakRss()+"}");}
}`;
}
export function buildBenchmarkProgram(source,p,cases,language,nonce){
 if(language==='java')return javaProgram(source,p,cases,nonce);
 const normal=buildNativeProgram(source,p,cases,language);
 if(language==='python'){
  const divider='\nimport json as _bqjson\n',index=normal.lastIndexOf(divider);if(index<0)throw new Error('Invalid Python harness');
  const pre=normal.slice(0,index),harness=normal.slice(index+1).split('\n').map(l=>'    '+l).join('\n');
  return pre+'\nimport time as _bqtime, resource as _bqresource, statistics as _bqstats, json as _bqjson\ndef _bq_suite():\n'+harness+'\n_bq_suite()\n_bq_times=[]\nfor _bq_t in range(3):\n    _bq_at=_bqtime.perf_counter_ns()\n    _bq_suite()\n    _bq_times.append((_bqtime.perf_counter_ns()-_bq_at)/1000000)\nprint("\\n__BYTEQUEST_BENCH_'+nonce+'__"+_bqjson.dumps({"runtimeMs":_bqstats.median(_bq_times),"memoryBytes":_bqresource.getrusage(_bqresource.RUSAGE_SELF).ru_maxrss*1024}))\n';
 }
 const cpp=language==='cpp',main=cpp?'int main(){':'int main(void){',i=normal.lastIndexOf(main);if(i<0)throw new Error('Invalid native harness');
 const prefix=normal.slice(0,i),body=normal.slice(i+main.length).replace(/return 0;}\s*$/,'');
 return '#define _POSIX_C_SOURCE 200809L\n#include <sys/resource.h>\n#include <time.h>\n#include <stdio.h>\n'+prefix+'\nstatic void _bq_suite(void){'+body+'}\nint main(void){struct timespec a,b;struct rusage usage;double trials[3];_bq_suite();for(int t=0;t<3;t++){clock_gettime(CLOCK_MONOTONIC,&a);_bq_suite();clock_gettime(CLOCK_MONOTONIC,&b);trials[t]=(b.tv_sec-a.tv_sec)*1000.0+(b.tv_nsec-a.tv_nsec)/1000000.0;}for(int x=0;x<3;x++)for(int y=x+1;y<3;y++)if(trials[x]>trials[y]){double tmp=trials[x];trials[x]=trials[y];trials[y]=tmp;}getrusage(RUSAGE_SELF,&usage);printf("\\n__BYTEQUEST_BENCH_'+nonce+'__{\\\"runtimeMs\\\":%.9f,\\\"memoryBytes\\\":%ld}\\n",trials[1],usage.ru_maxrss*1024L);return 0;}';
}
// Alternative for PUBLISHED PUBLIC Java cases only. Never invoke with private cases:
// Judge0's public CE instance is shared infrastructure, not a trusted hidden judge.
async function runJudge0PublicJava(code,{fetchImpl,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),url,key,languageId=91}){
 const unavailable=message=>({ok:false,status:'unavailable',accepted:false,message,retryable:true});
 let base;
 try{base=new URL(url);}catch{}
 if(!base||base.protocol!=='https:'||base.username||base.password||base.search||base.hash||!Number.isSafeInteger(languageId)||languageId<1)
  return unavailable('An alternate Java judge is not configured correctly.');
 const target=new URL('submissions?base64_encoded=false&wait=true',base.href.endsWith('/')?base.href:base.href+'/');
 const headers={'Content-Type':'application/json',...(key?{'X-Auth-Token':key}:{})};
 const body=JSON.stringify({source_code:code.replace(/\nclass Wandbox \{/,'\npublic class Main {'),
  language_id:languageId,enable_network:false,cpu_time_limit:3,wall_time_limit:9,
  memory_limit:262144,max_file_size:256});
 const read=async response=>{
  const declared=Number(response.headers?.get?.('content-length'));
  if(Number.isFinite(declared)&&declared>200000)return null;
  if(!response.body)return null;
  const reader=response.body.getReader();let bytes=0,result='',decoder=new TextDecoder();
  try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;
   if(bytes>200000){await reader.cancel();return null;}result+=decoder.decode(value,{stream:true});}
   result+=decoder.decode();return JSON.parse(result);
  }catch{return null;}finally{reader.releaseLock();}
 };
 const perform=async (method,requestUrl,sendBody)=>{
  try{const response=await fetchImpl(requestUrl,{method,headers, ...(sendBody?{body}:{}),signal:AbortSignal.timeout(15000)});
   if(!response.ok){await response.body?.cancel?.().catch(()=>{});return {error:response.status};}
   return{value:await read(response)};
  }catch{return{error:0};}
 };
 let reply=await perform('POST',target,true);
 if(reply.error||!reply.value)return unavailable('Alternate Java execution is unavailable ('+(reply.error||'invalid response')+').');
 for(let attempt=0;[1,2].includes(Number(reply.value?.status?.id))&&attempt<4;attempt++){
  const token=String(reply.value.token||'');
  if(!/^[0-9a-f-]{36}$/i.test(token))break;
  await wait(900);
  reply=await perform('GET',new URL('submissions/'+token+'?base64_encoded=false',base.href.endsWith('/')?base.href:base.href+'/'),false);
  if(reply.error||!reply.value)break;
 }
 const response=reply.value,status=Number(response?.status?.id);
 if(status===3&&typeof response.stdout==='string')return{ok:true,stdout:response.stdout};
 if(status===6)return{ok:false,status:'compile_error',accepted:false,
   message:String(response.compile_output||'Java compilation failed in the alternate judge.').slice(0,8000)};
 if(status===5)return{ok:false,status:'time_limit_exceeded',accepted:false,message:'Java exceeded the alternate judge time limit.'};
 if([7,8,9,10,11,12].includes(status))return{ok:false,status:'runtime_error',accepted:false,
   message:'Java could not finish executing. Check Run for compiler and runtime details.'};
 return unavailable('Alternate Java execution could not provide a completed verdict.');
}

export function makeBenchmarkJudge({fetchImpl=fetch,makeNonce=()=>crypto.randomUUID().replaceAll('-',''),wait,now,random}={}){
 return {async run(source,p,cases,language,{publicCasesOnly=false}={}){
  if(!benchmarkCompilers[language])throw new Error('Unsupported benchmark language');
  if(requiresJavaStructures(p)&&language!=='java')return {accepted:false,status:'unavailable',message:'Linked-list and tree problems currently support Java submissions only.'};
  const nonce=makeNonce(),code=buildBenchmarkProgram(source,p,cases,language,nonce);if(code.length>300000)return {accepted:false,status:'compile_error',message:'This suite is too large for the public benchmark.'};
  // Execute Java public cases on a different provider first. The caller must
  // explicitly assert that NO private hidden cases are in this request.
  let response=null,alternateFailed=false,compiler=benchmarkCompilers[language],alternateVersion=null;
  if(publicCasesOnly&&language==='java'){
   const url=typeof Deno!=='undefined'?Deno.env.get('BYTEQUEST_PUBLIC_JUDGE0_URL')||'https://ce.judge0.com':'https://ce.judge0.com';
   const key=typeof Deno!=='undefined'?Deno.env.get('BYTEQUEST_PUBLIC_JUDGE0_KEY')||'':'';
   const languageId=Number((typeof Deno!=='undefined'?Deno.env.get('BYTEQUEST_PUBLIC_JAVA_LANGUAGE_ID'):null)||91);
   const alt=await runJudge0PublicJava(code,{fetchImpl,wait,url,key,languageId});
   if(alt.ok){response={ok:true,value:{status:0,program_output:alt.stdout}};compiler='judge0-java-17';alternateVersion='bq-judge0-public-v1';}
   else if(alt.status==='unavailable'){alternateFailed=true;}
   else return alt;
  }
  if(!response)response=await requestSandbox({compiler:benchmarkCompilers[language],code,save:false,options:language==='cpp'?'c++17':language==='c'?'c11':''},{fetchImpl,timeoutMs:language==='cpp'?75000:45000,wait,now,random});
  if(!response.ok)return alternateFailed&&response.result?.status==='unavailable'?
   {...response.result,message:'Both Java execution providers are unavailable. The submitted code is saved; no accepted result was recorded.'}:response.result;
  const r=response.value;
  if(String(r.status)!=='0'||r.signal)return sandboxExecutionFailure(r);
  const output=String(r.program_output||'');
  const lines=output.split(/\r?\n/),executions=language==='java'?1:4;
  const observations=lines.filter(line=>line.startsWith('__BYTEQUEST_CASE_'));
  const protocolValid=observations.length===cases.length*executions&&observations.every((line,index)=>{
   const match=/^__BYTEQUEST_CASE_(\d+)__(.*)$/.exec(line);
   if(!match||Number(match[1])!==index%cases.length)return false;
   try{const value=JSON.parse(match[2]);return value&&typeof value==='object'&&!Array.isArray(value)&&typeof value.ok==='boolean';}catch{return false;}
  });
  // User code can print arbitrary stdout, so never accept duplicate, missing,
  // reordered or malformed harness records as proof that a case was run.
  if(!protocolValid)return{accepted:false,status:'runtime_error',message:'The compiler returned incomplete or malformed case results. Check for an early exit, crash, or reserved output markers.'};
  const results=nativeResults(observations.slice(0,cases.length).join('\n'),p,cases);
  const rounds=Array.from({length:executions},(_,i)=>nativeResults(observations.slice(i*cases.length,(i+1)*cases.length).join('\n'),p,cases));
  const consistent=rounds.every(round=>round.every(c=>c.passed));
  const passed=results.filter(c=>c.passed).length;
  if(!consistent)return{accepted:false,status:'wrong_answer',passed,total:cases.length,message:passed+' / '+cases.length+' public cases passed.',cases:results.filter(c=>!c.passed).slice(0,3)};
  const measurementPrefix='__BYTEQUEST_BENCH_'+nonce+'__';
  const nonempty=lines.filter(line=>line.trim());
  const measurementLines=nonempty.filter(line=>line.startsWith('__BYTEQUEST_BENCH_'));
  if(measurementLines.length!==1||!measurementLines[0].startsWith(measurementPrefix)||nonempty.at(-1)!==measurementLines[0])
   return{accepted:false,status:'unavailable',message:'The compiler returned an invalid benchmark record. No submission was saved.'};
  let metric;try{metric=JSON.parse(measurementLines[0].slice(measurementPrefix.length));}catch{}
  if(!metric||typeof metric!=='object'||!Number.isFinite(metric.runtimeMs)||metric.runtimeMs<0||metric.runtimeMs>60000)
   return{accepted:false,status:'unavailable',message:'Tests ran, but a valid benchmark measurement was not returned. Retry to record this submission.'};
  return{accepted:true,status:'accepted',passed,total:cases.length,runtimeMs:metric.runtimeMs,memoryBytes:Number.isSafeInteger(metric.memoryBytes)&&metric.memoryBytes>0&&metric.memoryBytes<2147483648?metric.memoryBytes:null,memoryMetric:'process_peak_rss',compiler,benchmarkVersion:alternateVersion||(language==='java'?'bq-v2-single-pass':benchmarkVersion),message:'All '+cases.length+' public cases passed.'};
 }};
}
