const endpoint='https://wandbox.org/api/compile.json';
const maxOutputBytes=1000000;
const transientContainerError=/(?:OCI runtime (?:error|create failed)[^\n]*(?:crun|runc|clone|resource temporarily unavailable|cannot allocate memory)|(?:crun|runc):[^\n]*(?:clone|fork)[^\n]*resource temporarily unavailable|failed to (?:create|start) (?:the )?(?:container|sandbox)[^\n]*(?:resource temporarily unavailable|temporarily unavailable))/i;
export function sandboxDiagnostics(result){return ['compiler_message','compiler_error','program_error','error','message'].map(k=>typeof result?.[k]==='string'?result[k]:'').filter(Boolean).join('\n');}
// Distinguish code compilation failures from execution failures. Infrastructure
// outages are never classified as a wrong answer or a learner syntax error.
export function sandboxExecutionFailure(result,{maxMessage=10000}={}){
 const compiler=typeof result?.compiler_error==='string'&&result.compiler_error.trim()
  ?result.compiler_error:typeof result?.compiler_message==='string'&&result.compiler_message.trim()?result.compiler_message:'';
 const runtime=typeof result?.program_error==='string'&&result.program_error.trim()?result.program_error:'';
 const signal=result?.signal;
 if(compiler)return{status:'compile_error',accepted:false,message:String(compiler).slice(0,maxMessage)};
 if(runtime||signal)return{status:'runtime_error',accepted:false,message:String(runtime||'Program exited after receiving a runtime signal.').slice(0,maxMessage)};
 return{status:'runtime_error',accepted:false,message:'Program execution did not complete successfully. Check for an uncaught exception or nonzero exit.'};
}
export function sandboxUnavailable({busy=false,timedOut=false,retried=false,retryAfterMs=5000}={}){
 return{status:'unavailable',accepted:false,retryable:true,code:timedOut?'compiler_timeout':busy?'compiler_busy':'compiler_unavailable',retryAfterMs,message:timedOut?'The online compiler did not finish within the request time limit. Your code is saved. No solution verdict was recorded; please try again shortly.':busy?'The shared compiler is temporarily at capacity.'+(retried?' Automatic retries could not start a sandbox.':'')+' Your code is saved. No verdict was recorded; you can safely submit again later.':'The online compiler is temporarily unavailable. Your code is saved. No solution verdict was recorded; please try again shortly.'};
}
async function readLimited(response){
 if(!response.body)return '';const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,text='';
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxOutputBytes){await reader.cancel();return null;}text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}finally{reader.releaseLock();}
}
// Retry only known transient sandbox-start/HTTP capacity failures at most twice.
// Syntax errors, executed programs, network timeouts and unknown failures are never retried.
// Both attempts share one deadline and exactly the same compiler/code; no account data enters the payload.
export async function requestSandbox(payload,{fetchImpl=fetch,timeoutMs=45000,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=Date.now,random=Math.random,onDiagnostic=event=>console.warn(JSON.stringify(event))}={}){
 const started=now(),deadline=started+timeoutMs,body=JSON.stringify(payload);let retried=false;
 const diagnostic=(reason,attempt,httpStatus)=>{try{onDiagnostic({event:'bytequest_compiler_transport',compiler:String(payload.compiler||'unknown').slice(0,80),reason,attempt,elapsedMs:Math.max(0,now()-started),...(httpStatus===undefined?{}:{httpStatus})});}catch{}};
 for(let attempt=0;attempt<3;attempt++){
  const remaining=deadline-now();if(remaining<=0){diagnostic('timeout',attempt+1);return{ok:false,result:sandboxUnavailable({timedOut:true,retried})};}let response;
  try{response=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body,signal:AbortSignal.timeout(Math.max(1,Math.floor(remaining)))});}catch(error){const timedOut=error?.name==='TimeoutError'||error?.name==='AbortError';diagnostic(timedOut?'timeout':'network',attempt+1);return{ok:false,result:sandboxUnavailable({timedOut,retried})};}
  let busy=false,retryDelay=800*(2**attempt)+Math.floor(random()*400),value;
  if(!response.ok){
   diagnostic('http',attempt+1,response.status);
   const temporary=[429,500,502,503,504].includes(response.status);busy=temporary;
   const after=response.headers.get('retry-after');if(after){const seconds=Number(after);const delay=Number.isFinite(seconds)?seconds*1000:Date.parse(after)-now();if(Number.isFinite(delay))retryDelay=Math.max(retryDelay,delay);}
   await response.body?.cancel().catch(()=>{});
   if(!temporary)return{ok:false,result:sandboxUnavailable()};
  }else{
   let raw;try{raw=await readLimited(response);}catch(error){const timedOut=error?.name==='TimeoutError'||error?.name==='AbortError';diagnostic(timedOut?'body_timeout':'body_read',attempt+1,response.status);return{ok:false,result:sandboxUnavailable({timedOut,retried})};}
   if(raw===null)return{ok:false,result:{status:'compile_error',accepted:false,message:'Output exceeds the online compiler limit. Remove excessive printing.'}};
   try{value=JSON.parse(raw);}catch{if(transientContainerError.test(raw))busy=true;else{diagnostic('invalid_json',attempt+1,response.status);return{ok:false,result:sandboxUnavailable({retried})};}}
   if(value&&typeof value==='object'&&!Array.isArray(value)){
    busy=transientContainerError.test(sandboxDiagnostics(value));
    if(!busy){if(value.status===undefined||value.status===null){diagnostic('missing_status',attempt+1,response.status);return{ok:false,result:sandboxUnavailable({retried})};}diagnostic('success',attempt+1,response.status);return{ok:true,value,attempts:attempt+1};}
   }else if(!busy){diagnostic('invalid_response',attempt+1,response.status);return{ok:false,result:sandboxUnavailable({retried})};}
  }
  if(busy)diagnostic('capacity',attempt+1,response.status);
  if(attempt===2||deadline-now()-retryDelay<1000)return{ok:false,result:sandboxUnavailable({busy,retried,retryAfterMs:Math.max(5000,Math.min(retryDelay,600000))})};
  await wait(retryDelay);retried=true;
 }
 return{ok:false,result:sandboxUnavailable({retried})};
}
