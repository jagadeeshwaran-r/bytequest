import {javaLiteral} from './domain/judge.js';
import {buildNativeProgram,nativeResults} from './domain/languages.js';
export const benchmarkVersion='bq-v1';
export const benchmarkCompilers={java:'openjdk-jdk-21+35',python:'cpython-3.11.10',c:'gcc-13.2.0-c',cpp:'gcc-13.2.0'};
function javaProgram(source,p,cases,nonce){
 const imports=(source.match(/^\s*import\s+[^;]+;\s*$/gm)||[]).join('\n'),solution=source.replace(/^\s*import\s+[^;]+;\s*$/gm,'').replace(/public\s+class\s+Solution\b/,'class Solution');
 const calls=cases.map((c,i)=>'System.out.println("\\n__BYTEQUEST_CASE_'+i+'__{\\\"ok\\\":true,\\\"actual\\\":"+repr(new Solution().'+p.method+'('+c.args.map((v,j)=>javaLiteral(v,p.params[j].type)).join(',')+'))+"}");').join('\n');
 return imports+'\n'+solution+`\nclass Wandbox {
 static String repr(Object x){if(x instanceof int[]){int[] a=(int[])x;StringBuilder b=new StringBuilder("[");for(int i=0;i<a.length;i++){if(i>0)b.append(',');b.append(a[i]);}return b.append(']').toString();}if(x instanceof String){StringBuilder b=new StringBuilder();b.append((char)34);for(char c:((String)x).toCharArray()){if(c==34||c==92)b.append((char)92).append(c);else if(c<32)b.append((char)92).append('u').append(String.format("%04x",(int)c));else b.append(c);}return b.append((char)34).toString();}return String.valueOf(x);}
 static long peakRss(){try{for(String line:java.nio.file.Files.readAllLines(java.nio.file.Path.of("/proc/self/status"))){if(line.startsWith("VmHWM:"))return Long.parseLong(line.replaceAll("[^0-9]",""))*1024;}}catch(Exception ignored){}return -1;}
 static void suite() throws Exception {`+calls+`}
 public static void main(String[] args) throws Exception {suite();double[] trials=new double[3];for(int i=0;i<3;i++){long at=System.nanoTime();suite();trials[i]=(System.nanoTime()-at)/1000000.0;}java.util.Arrays.sort(trials);System.out.println("\\n__BYTEQUEST_BENCH_`+nonce+`__{\\\"runtimeMs\\\":"+trials[1]+",\\\"memoryBytes\\\":"+peakRss()+"}");}
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
export function makeBenchmarkJudge({fetchImpl=fetch,makeNonce=()=>crypto.randomUUID().replaceAll('-','')}={}){
 return {async run(source,p,cases,language){
  if(!benchmarkCompilers[language])throw new Error('Unsupported benchmark language');
  const nonce=makeNonce(),code=buildBenchmarkProgram(source,p,cases,language,nonce);if(code.length>300000)return {accepted:false,status:'compile_error',message:'This suite is too large for the public benchmark.'};
  let response;try{response=await fetchImpl('https://wandbox.org/api/compile.json',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({compiler:benchmarkCompilers[language],code,save:false,options:language==='cpp'?'c++17':language==='c'?'c11':''}),signal:AbortSignal.timeout(45000)});}catch{return{accepted:false,status:'unavailable',message:'The benchmark service could not finish. Your solution is saved in the editor; retry shortly.'};}
  if(!response.ok)return{accepted:false,status:'unavailable',message:'The benchmark service is busy. Please retry shortly.'};const raw=await response.text();if(raw.length>1000000)return{accepted:false,status:'compile_error',message:'Too much output. Remove debug printing before submitting.'};let r;try{r=JSON.parse(raw);}catch{return{accepted:false,status:'unavailable',message:'The benchmark service returned an unreadable response.'};}
  if(String(r.status)!=='0'||r.signal)return{accepted:false,status:'compile_error',message:String(r.compiler_message||r.compiler_error||r.program_error||r.signal||'Compilation or execution failed.').slice(0,10000)};
  const output=String(r.program_output||''),results=nativeResults(output,p,cases),observations=output.split(/\r?\n/).filter(l=>/^__BYTEQUEST_CASE_\d+__/.test(l));const consistent=observations.length===cases.length*4&&Array.from({length:4},(_,i)=>nativeResults(observations.slice(i*cases.length,(i+1)*cases.length).join('\n'),p,cases).every(c=>c.passed)).every(Boolean),passed=consistent?cases.length:results.filter(c=>c.passed).length;
  const line=output.split(/\r?\n/).filter(l=>l.startsWith('__BYTEQUEST_BENCH_'+nonce+'__')).at(-1);let metric;try{metric=JSON.parse(line.slice(('__BYTEQUEST_BENCH_'+nonce+'__').length));}catch{}
  if(!consistent)return{accepted:false,status:'wrong_answer',passed,total:cases.length,message:passed+' / '+cases.length+' public cases passed.',cases:results.filter(c=>!c.passed).slice(0,3)};
  if(!metric||!Number.isFinite(metric.runtimeMs)||metric.runtimeMs<0||metric.runtimeMs>60000)return{accepted:false,status:'unavailable',message:'Tests ran, but a valid benchmark measurement was not returned. Retry to record this submission.'};
  return{accepted:true,status:'accepted',passed,total:cases.length,runtimeMs:metric.runtimeMs,memoryBytes:Number.isSafeInteger(metric.memoryBytes)&&metric.memoryBytes>0&&metric.memoryBytes<2147483648?metric.memoryBytes:null,memoryMetric:'process_peak_rss',compiler:benchmarkCompilers[language],benchmarkVersion,message:'All '+cases.length+' public cases passed.'};
 }};
}
