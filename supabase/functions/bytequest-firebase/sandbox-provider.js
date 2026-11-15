const endpoint='https://wandbox.org/api/compile.json';
const maxOutputBytes=1000000;
const transientContainerError=/(?:OCI runtime (?:error|create failed)[^\n]*(?:crun|runc|clone|resource temporarily unavailable|cannot allocate memory)|(?:crun|runc):[^\n]*(?:clone|fork)[^\n]*resource temporarily unavailable|failed to (?:create|start) (?:the )?(?:container|sandbox)[^\n]*(?:resource temporarily unavailable|temporarily unavailable))/i;
export function sandboxDiagnostics(result){return ['compiler_message','compiler_error','program_error','error','message'].map(k=>typeof result?.[k]==='string'?result[k]:'').filter(Boolean).join('\n');}
export function sandboxUnavailable({busy=false,retried=false,retryAfterMs=5000}={}){
 return{status:'unavailable',accepted:false,retryable:true,code:busy?'compiler_busy':'compiler_unavailable',retryAfterMs,message:busy?'The online compiler could not start its sandbox because it is temporarily busy.'+(retried?' An automatic retry also could not finish.':'')+' Your code is saved. No solution verdict was recorded; please try again shortly.':'The online compiler is temporarily unavailable. Your code is saved. No solution verdict was recorded; please try again shortly.'};
}
async function readLimited(response){
 if(!response.body)return '';const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,text='';
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxOutputBytes){await reader.cancel();return null;}text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}finally{reader.releaseLock();}
}
// Retry a known sandbox-start/HTTP capacity failure once. Syntax errors and executed programs are never retried.
// Both attempts share one deadline and exactly the same compiler/code; no account data enters the payload.
export async function requestSandbox(payload,{fetchImpl=fetch,timeoutMs=45000,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=Date.now,random=Math.random}={}){
 const deadline=now()+timeoutMs,body=JSON.stringify(payload);let retried=false;
 for(let attempt=0;attempt<2;attempt++){
  const remaining=deadline-now();if(remaining<=0)return{ok:false,result:sandboxUnavailable({retried})};let response;
  try{response=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body,signal:AbortSignal.timeout(Math.max(1,Math.floor(remaining)))});}catch{return{ok:false,result:sandboxUnavailable({retried})};}
  let busy=false,retryDelay=800+Math.floor(random()*400),value;
  if(!response.ok){
   const temporary=[429,500,502,503,504].includes(response.status);busy=temporary;
   const after=response.headers.get('retry-after');if(after){const seconds=Number(after);const delay=Number.isFinite(seconds)?seconds*1000:Date.parse(after)-now();if(Number.isFinite(delay))retryDelay=Math.max(retryDelay,delay);}
   await response.body?.cancel().catch(()=>{});
   if(!temporary)return{ok:false,result:sandboxUnavailable()};
  }else{
   let raw;try{raw=await readLimited(response);}catch{return{ok:false,result:sandboxUnavailable({retried})};}
   if(raw===null)return{ok:false,result:{status:'compile_error',accepted:false,message:'Output exceeds the online compiler limit. Remove excessive printing.'}};
   try{value=JSON.parse(raw);}catch{if(transientContainerError.test(raw))busy=true;else return{ok:false,result:sandboxUnavailable({retried})};}
   if(value&&typeof value==='object'&&!Array.isArray(value)){
    busy=transientContainerError.test(sandboxDiagnostics(value));
    if(!busy){if(value.status===undefined||value.status===null)return{ok:false,result:sandboxUnavailable({retried})};return{ok:true,value,attempts:attempt+1};}
   }else if(!busy)return{ok:false,result:sandboxUnavailable({retried})};
  }
  if(attempt===1||deadline-now()-retryDelay<1000)return{ok:false,result:sandboxUnavailable({busy,retried,retryAfterMs:Math.max(5000,Math.min(retryDelay,600000))})};
  await wait(retryDelay);retried=true;
 }
 return{ok:false,result:sandboxUnavailable({retried})};
}
