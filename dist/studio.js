import {JavaJudge,buildTests} from "./judge.js";
import {mountBulkImport} from "./bulk-import.js?v=community-1";
import {validateProblem} from "./catalog.js";
const $=id=>document.getElementById(id);
const fields=["Title","Id","Topic","Difficulty","Minutes","Description","Constraints","Method","Returns","Params","Starter","Reference","Tests","Idea","Invariant","Time","Space","Tradeoff","Hints","Frames","Position","Pattern","Techniques","HiddenTests","Correction"];
const sample={
  id:"array-sum",title:"Array sum",topic:"Arrays",difficulty:"Easy",minutes:20,method:"sum",returns:"int",params:[{name:"nums",type:"int[]"}],
  description:"Return the sum of all integers in nums. An empty array has a sum of zero.",constraints:"0 ≤ nums.length ≤ 10,000. −1,000 ≤ nums[i] ≤ 1,000.",
  starter:"class Solution {\n    public int sum(int[] nums) {\n        // Add the values one at a time.\n        throw new UnsupportedOperationException(\"Your turn\");\n    }\n}",
  reference:"class Solution {\n    public int sum(int[] nums) {\n        int total = 0;\n        for (int value : nums) total += value;\n        return total;\n    }\n}",
  tests:[{args:[[1,2,3]],expected:6,label:"A small sum"},{args:[[]],expected:0,label:"An empty array"},{args:[[-2,2,0]],expected:0,label:"Mixed signs"}],
  idea:"Keep a running total while visiting each value exactly once.",invariant:"After processing a prefix, total is its sum.",
  complexity:{time:"O(n)",space:"O(1)",tradeoff:"A single accumulator avoids copying the array or allocating another collection."},
  hints:["Start the accumulator at zero.","Add each value exactly once."],frames:[
    {values:[1,2,3],active:[],found:[],dim:[],message:"Start with an empty running total.",note:"total = 0"},
    {values:[1,2,3],active:[0],found:[],dim:[],message:"Add the first value.",note:"total = 1"},
    {values:[1,2,3],active:[1],found:[0],dim:[],message:"Add the second value.",note:"total = 3"},
    {values:[1,2,3],active:[2],found:[0,1],dim:[],message:"Add the final value and return the total.",note:"total = 6"}
  ]
};
export class Studio{
  constructor({cloud,notify,onCatalogChanged}){
    Object.assign(this,{cloud,notify,onCatalogChanged,rows:[],row:null,validated:null,running:false,epoch:0,loadedFor:null});
    this.bulk=mountBulkImport({cloud,notify,onChanged:onCatalogChanged});
    this.judge=new JavaJudge(message=>{$("studioStatus").textContent=message;if(message.startsWith("Compiling")){clearTimeout(this.watchdog);this.watchdog=setTimeout(()=>this.stop("Validation reached the 30-second limit."),30000);}});
    $("problemForm").addEventListener("input",()=>{this.validated=null;$("studioDirty").textContent="Unsaved changes";this.saveLocalDraft();});
    $("newProblemBtn").onclick=()=>{this.fill(sample);this.row=null;$("studioSelect").value="";$("pId").readOnly=false;};
    $("studioSelect").onchange=e=>{const row=this.rows.find(r=>r.id===e.target.value);this.row=row||null;this.fill(row?.content||sample,row);};
    $("validateProblemBtn").onclick=()=>this.validateJava();$("stopStudioBtn").onclick=()=>this.stop("Validation stopped. Your form is kept.");
    $("problemForm").onsubmit=e=>{e.preventDefault();this.save();};
    $("exportProblemBtn").onclick=()=>{try{const p=this.read(),url=URL.createObjectURL(new Blob([JSON.stringify(p,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=p.id+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){this.message(e.message);}};
    $("importProblemBtn").onclick=()=>$("importProblemFile").click();
    $("importProblemFile").onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>300000)throw new Error("Use a problem file under 300 KB.");const p=validateProblem(JSON.parse(await file.text()));this.row=null;this.fill(p);$("pId").readOnly=false;$("studioSelect").value="";$("studioDirty").textContent="Imported · not saved";}catch(error){this.message(error.message);}e.target.value="";};
  }
  message(message){$("studioStatus").textContent=message;}
  async open(){
    const allowed=!!this.cloud.user&&this.cloud.admin;
    $("studioGate").hidden=allowed;$("studioWorkspace").hidden=!allowed;$("newProblemBtn").hidden=!allowed;
    $("studioSignIn").hidden=!!this.cloud.user;
    if(!allowed){$("studioGate").querySelector("p").textContent=this.cloud.user?"Your account can practise and sync progress. Publishing is reserved for library editors.":"Sign in with an editor account to create and publish problems.";return;}
    if(this.loadedFor===this.cloud.user.id)return;
    const userId=this.cloud.user.id;this.message("Loading your problem library…");
    try{
      const rows=await this.cloud.adminCatalog();if(this.cloud.user?.id!==userId||!this.cloud.admin)return;
      this.rows=rows;this.loadedFor=userId;this.fillSelect();this.row=null;this.fill(sample);
      try{
        const local=JSON.parse(localStorage.getItem("bytequest.studio."+userId));
        if(local?.fields){for(const field of fields)if(typeof local.fields[field]==="string")$("p"+field).value=local.fields[field];
          $("pPublished").checked=!!local.published;this.row=this.rows.find(r=>r.id===local.rowId)||null;this.normalize=local.normalize||this.row?.content.normalize;
          $("pId").readOnly=!!this.row;$("studioSelect").value=this.row?.id||"";$("studioDirty").textContent="Draft restored from this device";}
      }catch{}
      this.message("Edit the challenge, validate its reference solution, then save.");
    }catch(error){this.message("Could not load the studio: "+error.message);this.loadedFor=null;}
  }
  accountChanged(){this.bulk.accountChanged();this.stop();this.loadedFor=null;this.rows=[];this.row=null;this.validated=null;this.fill(sample);$("studioSelect").replaceChildren();$("studioWorkspace").hidden=true;$("studioGate").hidden=false;}
  fillSelect(){
    $("studioSelect").replaceChildren(new Option("New problem",""));
    for(const row of this.rows)$("studioSelect").add(new Option(row.content.title+(row.published?" · published":" · draft"),row.id));
  }
  fill(p,row=null){
    this.normalize=p.normalize;
    const values={Title:p.title,Id:p.id,Topic:p.topic,Difficulty:p.difficulty,Minutes:p.minutes,Description:p.description,Constraints:p.constraints,Method:p.method,Returns:p.returns,Params:JSON.stringify(p.params),Starter:p.starter,Reference:p.reference,Tests:JSON.stringify(p.tests,null,2),Idea:p.idea,Invariant:p.invariant,Time:p.complexity.time,Space:p.complexity.space,Tradeoff:p.complexity.tradeoff,Hints:p.hints.join("\n"),Frames:JSON.stringify(p.frames||[],null,2),Position:row?.position??this.rows.length,Pattern:p.pattern||p.topic,Techniques:(p.techniques||[]).join(", "),HiddenTests:JSON.stringify(row?.hiddenTests||[],null,2),Correction:""};
    for(const field of fields)$("p"+field).value=values[field];
    $("pPublished").checked=!!row?.published;$("pId").readOnly=!!row;
    this.validated=null;$("studioValidation").replaceChildren();$("studioDirty").textContent=row?"Loaded from library":"New problem · not saved";
    this.message("Validate the reference solution before publishing.");
  }
  read(){
    const v=name=>$("p"+name).value;
    let params,tests,frames;try{params=JSON.parse(v("Params"));tests=JSON.parse(v("Tests"));frames=JSON.parse(v("Frames")||"[]");}catch{throw new Error("Parameters, tests, and animation steps must contain valid JSON.");}
    return validateProblem({pattern:v("Pattern")||v("Topic"),techniques:v("Techniques").split(",").map(s=>s.trim()).filter(Boolean),id:v("Id"),title:v("Title"),topic:v("Topic"),difficulty:v("Difficulty"),minutes:Number(v("Minutes")),description:v("Description"),constraints:v("Constraints"),method:v("Method"),returns:v("Returns"),params,tests,frames,starter:v("Starter"),reference:v("Reference"),idea:v("Idea"),invariant:v("Invariant"),complexity:{time:v("Time"),space:v("Space"),tradeoff:v("Tradeoff")},hints:v("Hints").split("\n").map(s=>s.trim()).filter(Boolean),...(this.normalize?{normalize:this.normalize}:{})});
  }
  saveLocalDraft(){
    if(!this.cloud.user)return;try{localStorage.setItem("bytequest.studio."+this.cloud.user.id,JSON.stringify({rowId:this.row?.id||null,normalize:this.normalize,published:$("pPublished").checked,fields:Object.fromEntries(fields.map(f=>[f,$("p"+f).value]))}));}catch{}
  }
  hiddenTests(problem){let cases;try{cases=JSON.parse($("pHiddenTests").value||"[]");}catch{throw new Error("Hidden cases must contain valid JSON.");}if(!Array.isArray(cases)||cases.length>100)throw new Error("Provide up to 100 hidden cases.");buildTests(problem,cases);return cases;}
  async validateJava(){
    if(this.running||!this.cloud.admin)return;
    let problem;try{problem=this.read();}catch(e){this.message(e.message);return;}
    const epoch=++this.epoch;this.running=true;$("studioFields").disabled=true;$("validateProblemBtn").disabled=true;$("saveProblemBtn").disabled=true;$("stopStudioBtn").hidden=false;
    $("studioValidation").replaceChildren();this.watchdog=setTimeout(()=>this.stop("Java startup timed out. Your draft is kept."),120000);
    try{
      const cases=[...problem.tests,...this.hiddenTests(problem)];
      const result=await this.judge.run(problem.reference,problem,cases);if(epoch!==this.epoch)return;
      if(result.status!=="ok")throw new Error(result.message);
      const failed=result.cases.filter(c=>!c.passed);
      if(failed.length){this.validated=null;this.message((result.cases.length-failed.length)+" / "+result.cases.length+" checks passed. Fix the reference code or expected results.");$("studioValidation").textContent=failed.map(c=>c.name+"\nExpected: "+c.expected+"\nActual: "+c.actual).join("\n\n");}
      else{this.validated=JSON.stringify({problem,hidden:this.hiddenTests(problem)});this.message("✓ All "+result.cases.length+" tests passed. Ready to publish.");this.notify("Reference solution verified in real Java.");}
    }catch(e){if(epoch===this.epoch){this.validated=null;this.message(e.message);}}
    finally{if(epoch===this.epoch){clearTimeout(this.watchdog);this.running=false;$("studioFields").disabled=false;$("validateProblemBtn").disabled=false;$("saveProblemBtn").disabled=false;$("stopStudioBtn").hidden=true;}}
  }
  stop(message){
    if(!this.running)return;this.epoch++;clearTimeout(this.watchdog);this.judge.stop();this.running=false;
    $("studioFields").disabled=false;$("validateProblemBtn").disabled=false;$("saveProblemBtn").disabled=false;$("stopStudioBtn").hidden=true;
    if(message)this.message(message);
  }
  async save(){
    if(!this.cloud.admin||!this.cloud.user||this.running)return;
    try{
      const problem=this.read(),published=$("pPublished").checked,userId=this.cloud.user.id;
      const position=Number($("pPosition").value);if(!Number.isInteger(position)||position<0||position>1000000)throw new Error("Library order must be a whole number from 0 to 1,000,000.");
      if(published&&this.validated!==JSON.stringify({problem,hidden:this.hiddenTests(problem)}))throw new Error("Validate this version of the reference Java solution before publishing.");
      $("saveProblemBtn").disabled=true;
      const hiddenTests=this.hiddenTests(problem),correction=$("pCorrection").value.trim();
      if(this.row?.published&&published&&!correction)throw new Error("Describe the correction before publishing a new revision.");
      const saved=await this.cloud.saveProblem(problem,{published,position,revision:this.row?.revision||0,hiddenTests,correction});if(this.cloud.user?.id!==userId)return;
      this.row={...saved,id:problem.id,content:{...problem,hiddenCount:hiddenTests.length},published,position,hiddenTests};
      this.rows=this.rows.filter(r=>r.id!==problem.id).concat(this.row).sort((a,b)=>a.position-b.position);this.fillSelect();$("studioSelect").value=problem.id;$("pId").readOnly=true;
      $("pCorrection").value="";this.saveLocalDraft();$("studioDirty").textContent="Saved to database";this.message(published?"Published. Learners can open this challenge from the problem library.":"Draft saved. Only editors can view it.");
      await this.onCatalogChanged();this.notify(published?"Problem published to the library.":"Problem draft saved.");
    }catch(error){this.message(error.message);}
    finally{$("saveProblemBtn").disabled=false;}
  }
}
