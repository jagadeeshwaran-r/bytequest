// Temporary CI provider connectivity probe (no learner data or credentials).
const controller=new AbortController(),cancel=setTimeout(()=>controller.abort(),12000);
try {
 const res=await fetch('https://ce.judge0.com/submissions?base64_encoded=false&wait=true',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({language_id:91,source_code:'public class Main { public static void main(String[] args) { System.out.println(42); } }',cpu_time_limit:2,wall_time_limit:5,enable_network:false}),
   signal:controller.signal
 });
 const txt=await res.text();
 console.log('ALTERNATE_JAVA_PROBE status='+res.status+' body='+txt.slice(0,500).replace(/\s+/g,' '));
}catch(e){console.log('ALTERNATE_JAVA_PROBE error='+String(e?.message||e).slice(0,120));}
finally{clearTimeout(cancel);}
