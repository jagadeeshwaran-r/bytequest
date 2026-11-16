import {requiresJavaStructures} from './domain/java-structures.js';
import {HttpError} from './handler.js';
export function validateSubmission(body){
 if(typeof body.problemId!=='string'||!/^[a-z][a-z0-9-]{1,63}$/.test(body.problemId)||!['java','python','c','cpp'].includes(body.language)||typeof body.source!=='string'||!body.source.trim()||body.source.length>60000||!Number.isSafeInteger(body.revision)||body.revision<1)throw new HttpError(400,'Choose a current problem, language and solution under 60 KB.');
 if(typeof body.nonce!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.nonce)||typeof body.shared!=='boolean')throw new HttpError(400,'Confirm your submission and sharing preference.');
 const data={problemId:body.problemId,language:body.language,source:body.source,revision:body.revision,nonce:body.nonce,shared:body.shared};
 for(const [key,max] of [['approach',5000],['timeComplexity',80],['spaceComplexity',80]]){if(typeof (body[key]??'')!=='string'||(body[key]||'').length>max)throw new HttpError(400,'Keep your explanation and complexity notes within their limits.');data[key]=(body[key]||'').trim();}return data;
}
export async function submitSolution({owner,body,db,benchmarkJudge,privateJudge,allowExternalHiddenJudge=false}){
 const data=validateSubmission(body),existing=await db.existingSubmission(owner,data.nonce);
 if(existing){if(existing.problem_id!==data.problemId||existing.source!==data.source||existing.language!==data.language)throw new HttpError(409,'This retry does not match the original submission.');return{accepted:true,status:'accepted',submission:publicOwn(existing),message:'Your accepted submission is already saved.'};}
 const row=await db.privateProblem(data.problemId);if(!row)throw new HttpError(404,'Problem not found.');if(row.revision!==data.revision)throw new HttpError(409,'This problem changed. Reload it before submitting.');
 if(requiresJavaStructures(row.content)&&data.language!=='java')throw new HttpError(400,'Linked-list and tree problems currently support Java submissions only.');
 const hasHidden=(row.hidden||[]).length>0||Number(row.content.hiddenCount)>0;
 if(hasHidden&&!privateJudge?.ready&&!allowExternalHiddenJudge)throw new HttpError(503,'This problem requires a configured private Java judge. Hidden cases remain private by default.');
 if(hasHidden&&data.language!=='java')throw new HttpError(400,'Private test submissions currently support Java only.');
 if(hasHidden&&!row.hidden?.length)throw new HttpError(503,'The private suite is unavailable. No acceptance was recorded.');
 if(!await db.claimOnlineRun(owner))throw new HttpError(429,'Wait 5 seconds between submissions. Online execution allows up to 60 runs per hour.');
 let result;
 // Prefer a configured trusted Java judge for *all* Java submissions,
 // including public-only problems. It avoids the shared Wandbox queue and
 // compiler startup; acceptance still requires the server-owned full suite.
 // Without a configured trusted judge, public Java keeps its Wandbox fallback.
 if(data.language==='java'&&privateJudge?.ready){
  const verdict=await privateJudge.run(data.source,row.content,[...row.content.tests,...row.hidden]);
  if(!verdict.accepted)return{...verdict,status:['compile_error','runtime_error','time_limit_exceeded','wrong_answer','unavailable'].includes(verdict.status)?verdict.status:'wrong_answer'};
  result={accepted:true,status:'accepted',runtimeMs:verdict.runtimeMs??null,memoryBytes:verdict.memoryBytes??null,memoryMetric:'process_peak_rss',compiler:'trusted-private-java',benchmarkVersion:'bq-private-v1',total:row.content.tests.length+row.hidden.length,message:verdict.message};
 }else if(hasHidden&&allowExternalHiddenJudge){
  // Hosted compiler fallback: the full suite runs ONLY on the server, not in the
  // browser. Hidden inputs are transmitted to Wandbox, the existing compiler
  // provider; do not expose diagnostics, outputs, expected values, or failures.
  const verdict=await benchmarkJudge.run(data.source,row.content,[...row.content.tests,...row.hidden],'java');
  if(!verdict.accepted){
   // Do not ever forward private cases, actual output, or remote diagnostics.
   const status=['unavailable','compile_error','runtime_error','time_limit_exceeded','wrong_answer'].includes(verdict.status)?verdict.status:'unavailable';
   return{accepted:false,status,message:status==='unavailable'?'The server-side Java judge is temporarily unavailable. Retry shortly.':status==='compile_error'?'Java could not compile in the hosted judge. Check your code using Run.':status==='runtime_error'?'The private suite stopped on a runtime error.':status==='time_limit_exceeded'?'The private suite exceeded the execution time limit.':'The submission did not pass every test. Recheck edge cases.'};
  }
  result={accepted:true,status:'accepted',runtimeMs:verdict.runtimeMs??null,memoryBytes:verdict.memoryBytes??null,memoryMetric:verdict.memoryMetric||'process_peak_rss',compiler:verdict.compiler,benchmarkVersion:verdict.benchmarkVersion,total:row.content.tests.length+row.hidden.length,message:'All server-side tests passed.'};
 }else result=await benchmarkJudge.run(data.source,row.content,row.content.tests,data.language);
 if(!result.accepted)return result;
 const submission=await db.recordSubmission(owner,{...data,runtimeMs:result.runtimeMs,memoryBytes:result.memoryBytes,memoryMetric:result.memoryMetric,compiler:result.compiler,benchmarkVersion:result.benchmarkVersion,suiteKind:hasHidden?'private':'public',testCount:result.total});
 return{...result,submission};
}
function publicOwn(s){return{id:s.id,language:s.language,runtime_ms:s.runtime_ms,memory_bytes:s.memory_bytes,compiler:s.compiler,shared:s.shared,created_at:s.created_at};}
