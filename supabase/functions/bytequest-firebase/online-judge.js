import {buildNativeProgram,nativeResults} from './domain/languages.js';
// A fixed remote sandbox provider; no arbitrary URLs, credentials or profile data leave this API.
export function makeOnlineJudge({fetchImpl=fetch}={}){
 const compiler={python:'cpython-3.11.10',c:'gcc-13.2.0-c',cpp:'gcc-13.2.0'};
 return {async run(source,p,cases,language){const start=Date.now(),code=buildNativeProgram(source,p,cases,language);if(code.length>300000)return{status:'compile_error',message:'Generated test program exceeds 300 KB. Use smaller public inputs.'};
 try{
  const response=await fetchImpl('https://wandbox.org/api/compile.json',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({compiler:compiler[language],code,save:false,options:language==='cpp'?'c++17':language==='c'?'c11':''}),signal:AbortSignal.timeout(30000)});
  if(!response.ok)return{status:'compile_error',message:response.status===429?'The online compiler is busy. Try again shortly.':'The online compiler is temporarily unavailable (HTTP '+response.status+'). Your code is saved.'};
  const raw=await response.text();if(raw.length>1000000)return{status:'compile_error',message:'Output exceeds the online compiler limit. Remove excessive printing.'};const r=JSON.parse(raw);
  if(String(r.status)!=='0'||r.signal)return{status:'compile_error',message:String(r.compiler_message||r.compiler_error||r.program_error||r.signal||'Compilation or execution failed.').slice(0,12000)};
  const output=String(r.program_output||'');return{status:'ok',cases:nativeResults(output,p,cases),stdout:output.replace(/^__BYTEQUEST_CASE_.*$/gm,'').trim().slice(0,12000),elapsedMs:Date.now()-start};
 }catch(e){return{status:'compile_error',message:e?.name==='TimeoutError'?'Online compilation timed out after 30 seconds. Your code is saved.':'Could not reach the online compiler. Your code is saved; try again shortly.'};}}
 };
}
