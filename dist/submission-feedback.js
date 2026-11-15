import {escapeHtml as h} from './community-model.js';
export function submissionFeedback(result={}){
 const accepted=result.accepted===true,status=result.status||'error',passed=Number.isFinite(result.passed)?result.passed:null,total=Number.isFinite(result.total)?result.total:null;
 const contract=status==='compile_error'&&String(result.message||'').includes('ByteQuest return contract');
 const title=accepted?'Accepted':contract?'Return type mismatch':status==='wrong_answer'?'Wrong answer':status==='compile_error'?'Compilation failed':status==='runtime_error'?'Runtime error':result.code==='compiler_timeout'?'Compiler timed out':status==='unavailable'?'Compiler unavailable':'Submission failed';
 const count=passed!==null&&total!==null?' · '+passed+' / '+total+' tests passed':'';
 const message=String(result.message|| (accepted?'Your accepted solution is saved.':'The submission could not be accepted.')).slice(0,12000);
 const cases=(result.cases||[]).filter(c=>c.passed===false).slice(0,3);
 return{accepted,title,tone:accepted?'success':status==='unavailable'?'warning':'error',announcement:title+count,message,
  html:'<section class="submission-verdict '+(accepted?'success':status==='unavailable'?'warning':'error')+'" role="'+(accepted?'status':'alert')+'"><header><span class="verdict-mark" aria-hidden="true">'+(accepted?'✓':status==='unavailable'?'!':'×')+'</span><div><h3>'+h(title)+'</h3>'+(count?'<p>'+h(count.slice(3))+'</p>':'')+'</div></header><pre class="verdict-message">'+h(message)+'</pre>'+cases.map(c=>'<details class="failed-public-case" open><summary>'+h(c.name||'Public test failed')+'</summary><dl><div><dt>Expected</dt><dd><code>'+h(c.expected??'Not supplied')+'</code></dd></div><div><dt>Your output</dt><dd><code>'+h(c.actual??'No output')+'</code></dd></div></dl></details>').join('')+'</section>'};
}
