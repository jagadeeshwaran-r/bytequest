import {validateProblem} from './catalog.js';
import {JavaJudge,buildTests} from './judge.js';
export function mountBulkImport({cloud,notify,onChanged}){
 const panel=document.getElementById('bulkImport');let stopped=false,running=false,judge;
 document.getElementById('bulkStop').onclick=()=>{stopped=true;judge?.stop();};
 document.getElementById('bulkRun').onclick=async()=>{
  if(running||!cloud.admin)return;const output=document.getElementById('bulkStatus'),file=document.getElementById('bulkFile').files[0];
  try{
   if(!file||file.size>25000000)throw new Error('Choose a JSON problem pack under 25 MB.');
   const input=JSON.parse(await file.text());if(!Array.isArray(input)||!input.length||input.length>500)throw new Error('A pack must be an array of 1–500 original or licensed problem definitions.');
   const seen=new Set(),pack=input.map(row=>{const problem=validateProblem(row.problem||row),hiddenTests=row.hiddenTests||[];if(seen.has(problem.id))throw new Error('Duplicate ID: '+problem.id);seen.add(problem.id);if(!Array.isArray(hiddenTests)||hiddenTests.length>100)throw new Error('Invalid hidden cases: '+problem.id);buildTests(problem,hiddenTests);return {problem,hiddenTests};});
   const existing=new Set((await cloud.adminCatalog()).map(p=>p.id));for(const {problem} of pack)if(existing.has(problem.id))throw new Error('ID already exists: '+problem.id+'. Use the editor for corrections.');
   const owner=cloud.user.id,published=document.getElementById('bulkPublished').checked;running=true;stopped=false;document.getElementById('bulkRun').disabled=true;document.getElementById('bulkStop').hidden=false;let saved=0;
   judge=new JavaJudge(status=>{output.textContent=(saved+1)+' / '+pack.length+' · '+status;});
   for(const {problem,hiddenTests} of pack){
    if(stopped||cloud.user?.id!==owner)break;
    const timeout=setTimeout(()=>{stopped=true;judge.stop();},120000);
    let result;try{result=await judge.run(problem.reference,problem,[...problem.tests,...hiddenTests]);}finally{clearTimeout(timeout);}
    if(stopped||cloud.user?.id!==owner)break;
    if(result.status!=='ok'||result.cases.some(c=>!c.passed))throw new Error('Validation failed for '+problem.title+'. '+saved+' earlier problems were saved; this one was not.');
    await cloud.saveProblem(problem,{published,position:existing.size+saved,revision:0,hiddenTests});saved++;
    output.textContent=saved+' / '+pack.length+' verified and saved · '+problem.title;
   }
   output.textContent=(stopped?'Stopped. ':'Complete. ')+saved+' / '+pack.length+' verified problems saved. Earlier saves are retained.';
   await onChanged();notify(saved+' validated problems added.');
  }catch(error){output.textContent=error.message;}finally{judge?.stop();running=false;document.getElementById('bulkRun').disabled=false;document.getElementById('bulkStop').hidden=true;}
 };
 return {accountChanged(){stopped=true;judge?.stop();},setVisible(visible){panel.hidden=!visible;}};
}
