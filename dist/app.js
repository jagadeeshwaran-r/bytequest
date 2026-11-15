import {profileAvatar,publicProfileHref} from './profile-view.js?v=profile-2';
import {mountSubmissions,requestSubmission,runtimeLabel,memoryLabel} from './submissions.js?v=profile-2';
import {launchCelebration} from './celebration.js?v=next-1';
import {mountEditorTools} from './editor-tools.js?v=upgrade-2';
import {pointsFor,totalPoints} from './rewards.js?v=upgrade-2';
import {companyIcon} from './companies.js?v=social-1';
import {mountWorkspace} from './workspace.js';
import {mountShell} from "./shell.js?v=profile-2";
import {Dashboard} from "./dashboard.js?v=next-1";
import {languages,starterFor,NativeJudge} from "./languages.js?v=presence-1";
import {problems as bundledProblems} from "./problems.js";
import {Cloud} from "./cloud.js?v=cpp-1";
import {blankProgress, validateProgress, mergeProgress, solveStreak} from "./progress.js?v=next-1";
import {Studio} from "./studio.js?v=social-1";
const problems=[...bundledProblems];
const shell=mountShell();mountWorkspace();let language="java";try{const v=localStorage.getItem("bytequest.language");if(languages[v])language=v;}catch{}
const draftId=(id=current.id)=>language==="java"?id:id+"--"+language;
const currentStarter=()=>starterFor(current,language);
let topics=[...new Set(problems.map(p=>p.topic))];
import {JavaJudge, buildTests} from "./judge.js?v=presence-1";
import {traceFor} from "./traces.js";
const $ = id => document.getElementById(id);
const html = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const icon = name => '<svg aria-hidden="true"><use href="#i-' + name + '"/></svg>';
const guestStorageKey="bytequest.v1";
let storageKey=guestStorageKey;
const blank=blankProgress;
const validateBackup=validateProgress;
let state=blank(),storageOK=true;
function readLocal(key){try{const saved=JSON.parse(localStorage.getItem(key));return saved?validateProgress(saved):blank();}catch{return blank();}}
state=readLocal(storageKey);
let publicProfile=null;
let syncTimer,syncing=false,syncAgain=false,accountEpoch=0,accountOwner,accountReady=false;
const cloud=new Cloud(user=>changeAccount(user));shell.connect(cloud);
const studio=new Studio({cloud,notify:message=>notify(message),onCatalogChanged:()=>refreshCatalog()});
const submissions=mountSubmissions(cloud,{notify});
const dashboard=new Dashboard({cloud,getState:()=>state,getCatalog:()=>problems});
function touch(field,id){state.modified[id]??={};state.modified[id][field]=Date.now();}
let current = problems.find(p => p.id === state.current) || problems[0];
let tab = "problem", mode = "learn", hints = 0, selectedCase = 0, customCases = [], results = null;
let busy = false, runEpoch = 0, watchdog, toastTimer, traceTimer, traceStep = 0;
let timerStarted = null, timerUsed = 0, timerProblem = current.id, timerTick;
let referenceUsed = false,creditEpoch=0;
const reviewDays = [2,7,21];
const codeTools=mountEditorTools($("codeEditor"),{getLanguage:()=>language,getProblem:()=>current,notify});
const loadEditor=value=>codeTools.load((accountOwner||"guest")+":"+draftId(),value);
const topicEmoji = {"Hash maps":"🗂️","Strings":"🔤","Binary search":"🔎","Two pointers":"👉","Arrays":"🌿","Sliding window":"🪟","Stacks":"🧱","Dynamic programming":"🌱","Math":"✳️"};
const javaJudge = new JavaJudge(message => {
  $("runStatus").textContent = message;refreshJavaStatus();
  if (busy && message.startsWith("Compiling")) {
    clearTimeout(watchdog);
    watchdog=setTimeout(()=>stopRun("The run reached its 30-second limit. Try a smaller input or check for an infinite loop."),30000);
  }
});
let javaWarmScheduled=false;
const javaAvailability=document.createElement("span");javaAvailability.id="javaLoadStatus";javaAvailability.className="java-preload-status";javaAvailability.setAttribute("role","status");document.querySelector(".editor-status").append(javaAvailability);
function refreshJavaStatus(){if(!document.getElementById("javaLoadStatus"))return;javaAvailability.hidden=language!=="java";javaAvailability.classList.toggle("ready",javaJudge.phase==="ready");javaAvailability.textContent=javaJudge.phase==="ready"?"Java ready":javaJudge.phase==="loading"?"Preparing Java…":javaJudge.phase==="error"?"Run to retry Java":"Java loads on Run";}
function warmJavaSoon(){refreshJavaStatus();if(language!=="java"||javaWarmScheduled||javaJudge.phase!=="cold"||document.body.dataset.page==="studio"||navigator.connection?.saveData)return;javaWarmScheduled=true;const prepare=()=>{javaWarmScheduled=false;if(language==="java"&&document.visibilityState==="visible"&&javaJudge.phase==="cold")javaJudge.preload();};if(window.requestIdleCallback)requestIdleCallback(prepare,{timeout:1500});else setTimeout(prepare,500);}
addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")warmJavaSoon();});
const nativeJudge=new NativeJudge(message=>{$("runStatus").textContent=message;},cloud);
const judge={run:(source,p,cases)=>language==="java"?javaJudge.run(source,p,cases):nativeJudge.run(source,p,cases,language),stop:()=>{javaJudge.stop();nativeJudge.stop();}};
function setLanguage(v){if(!languages[v])return;if(busy)stopRun();language=v;try{localStorage.setItem("bytequest.language",v);}catch{}renderPractice();}
$("languageSelect").onchange=e=>setLanguage(e.target.value);
function persist() {
  try { localStorage.setItem(storageKey,JSON.stringify(state)); storageOK=true; $("saveStatus").textContent=cloud.user?"Draft saved · cloud sync queued":"Draft saved on this device"; }
  catch { storageOK=false; $("saveStatus").textContent="Storage full or unavailable — export a backup"; }
  if(accountReady&&cloud.user){clearTimeout(syncTimer);setSyncStatus("syncing","Changes saved here");syncTimer=setTimeout(()=>syncCloud(),1800);}
}
function notify(message) { clearTimeout(toastTimer); $("toast").textContent=message; $("toast").classList.add("show"); toastTimer=setTimeout(()=>$("toast").classList.remove("show"),4000); }
function dateKey(date = new Date()) { return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0"); }
function addDay() { const day=dateKey(); if(!state.days.includes(day))state.days.push(day); }
function streak(){return solveStreak(state);}
function xp() { return totalPoints(state,problems); }
function dueTime(id) { const r=state.reviews[id]; if(!r||r.step>=3)return Infinity; return r.anchor+reviewDays[r.step]*86400000; }
function due(id) { return dueTime(id)<=Date.now(); }
function updateStats() { $("solvedCount").textContent=problems.filter(p=>state.solved[p.id]).length; $("solvedTotal").textContent=problems.length; $("catalogCount").textContent=problems.length+" problems · "+topics.length+" topics"; $("xpCount").textContent=xp(); $("streak").textContent=streak(); $("level").textContent=1+Math.floor(xp()/300); }
function highlight(source) {
  const regex=/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(import|class|public|private|static|return|throw|new|for|while|if|else|int|boolean|void|true|false|null|long|double|char|continue|break|final|try|catch)\b|\b(String|Solution|Map|HashMap|Set|HashSet|Deque|ArrayDeque|Integer|Math|Arrays|Character|UnsupportedOperationException)\b|\b(\d+)\b/g;
  let out="", last=0;
  for(const m of source.matchAll(regex)) { out+=html(source.slice(last,m.index)); const type=m[1]?"comment":m[2]?"string":m[3]?"keyword":m[4]?"type":"number"; out+='<span class="tok-'+type+'">'+html(m[0])+"</span>"; last=m.index+m[0].length; }
  return out+html(source.slice(last))+"\n";
}
function updateEditor() { $("codeHighlight").firstElementChild.innerHTML=highlight($("codeEditor").value); $("lineNumbers").textContent=$("codeEditor").value.split("\n").map((_,i)=>i+1).join("\n"); syncScroll(); }
function syncScroll(){ $("codeHighlight").scrollTop=$("codeEditor").scrollTop; $("codeHighlight").scrollLeft=$("codeEditor").scrollLeft; $("lineNumbers").scrollTop=$("codeEditor").scrollTop; }
function saveDraft(){state.drafts[draftId()]=$("codeEditor").value;touch("drafts",draftId());persist();updateEditor();if(results){results=null;renderTests();$("resultOutput").replaceChildren();}}
$("codeEditor").addEventListener("input",saveDraft);
$("codeEditor").addEventListener("scroll",syncScroll);
$("codeEditor").addEventListener("keydown",event=>{
  if((event.ctrlKey||event.metaKey)&&event.key==="Enter"){event.preventDefault();run(false);}
});
function renderPractice() {
  warmJavaSoon();
  pauseTrace();
  $("languageSelect").value=language;$("languageSelect").disabled=busy;$("codeFilename").textContent=languages[language].file;$("runStatus").textContent=languages[language].name+(language==="java"?" · browser compiler":" · online via Wandbox");
  $("practiceView").classList.toggle("empty-catalog",!current);$("catalogEmpty").hidden=!!current;
  if(!current)return;
  $("questTitle").textContent=current.title; $("questTopic").textContent=current.topic;
  $("questNumber").textContent=String(problems.indexOf(current)+1).padStart(2,"0");
  $("difficulty").textContent=current.difficulty; $("difficulty").className="difficulty "+current.difficulty.toLowerCase();
  $("questMinutes").textContent=current.difficulty==="Easy"?"15–25 min":current.difficulty==="Medium"?"25–35 min":"35–50 min";
  $("problemSelect").value=current.id;
  $("learnMode").classList.toggle("active",mode==="learn"); $("challengeMode").classList.toggle("active",mode==="challenge");
  loadEditor(state.drafts[draftId()]??currentStarter()); updateEditor();
  $("hintText").textContent="Stuck? Take one small hint."; hints=0;
  $("hintBtn").textContent="Get a hint ↗"; $("hintBtn").disabled=false;
  renderLearning(); renderTests();
  $("resultOutput").replaceChildren();
}
function timerHtml() { return mode==="challenge"?'<div class="timer">'+icon("clock")+'<span id="timerDisplay" class="stopwatch-text">20:00</span><span>optional focus timer</span><button id="timerButton">Start</button></div>':""; }
function renderLearning(){
  pauseTrace();creditEpoch++;
  document.querySelectorAll("[data-tab]").forEach(b=>{b.classList.toggle("active",b.dataset.tab===tab);b.setAttribute("aria-selected",String(b.dataset.tab===tab));});
  submissions.close();
  if(tab==="submissions"){submissions.mount($("learningContent"),current,language);return;}
  let content=timerHtml();
  if(tab==="problem"){
    content+='<h3>'+html(current.title)+'</h3><div id="problemCredits" class="problem-credits"></div><p class="body-copy">'+html(current.description)+'</p><h4>Input</h4><p class="body-copy">'+html(current.inputGuide||current.params.map(p=>p.name+' ('+p.type+')').join(', '))+'</p><h4>Output</h4><p class="body-copy">'+html(current.outputGuide||('Return '+current.returns+' from '+current.method+'.'))+'</p><h4>Examples</h4>';
    current.tests.slice(0,2).forEach((c,i)=>{content+='<div class="example-card"><code>Input: <b>'+html(formatArgs(c.args))+'</b>\nOutput: <b>'+html(JSON.stringify(c.expected))+'</b></code><p>'+html(c.label)+'</p></div>';});
    content+='<h4>Constraints</h4><div class="constraints">'+html(current.constraints)+'</div><details class="concept-hint"><summary>Reveal the key concept</summary><p>'+html(current.topic)+(current.pattern&&current.pattern!==current.topic?' · '+html(current.pattern):'')+'</p></details>';
  } else if(tab==="learn"){
    content+='<span class="pattern-tag">EDITORIAL</span><h3>Approach</h3><p class="body-copy">'+html(current.idea)+'</p><div class="pattern-callout"><strong>Invariant</strong>'+html(current.invariant)+'</div><div class="complexity-row"><div class="complexity-box"><small>TIME</small><b>'+html(current.complexity.time)+'</b></div><div class="complexity-box"><small>EXTRA SPACE</small><b>'+html(current.complexity.space)+'</b></div></div><p class="tradeoff">'+html(current.complexity.tradeoff)+'</p><button id="referenceBtn" class="reference-button">Show Java solution</button><div id="referenceContent"></div>';
  } else {
    content+='<span class="pattern-tag">A LITTLE MOVING PICTURE</span><h3>Watch the idea click.</h3><p class="body-copy">A guided trace of the reference approach. Your code runs separately in the editor.</p><div id="traceBoard" class="trace-board"></div><p id="traceCaption" class="trace-caption"></p><div class="trace-controls"><button id="traceBack" aria-label="Previous animation step">←</button><button id="tracePlay" class="play-trace">▶ Play</button><button id="traceNext" aria-label="Next animation step">→</button><button id="traceReset" aria-label="Restart animation">↻</button><span id="traceCounter" class="trace-counter"></span></div><div class="code-note">Pause at any step. Say out loud: <i>“What do I know so far, and what changes next?”</i></div>';
  }
  if(tab==="learn")content+='<section class="language-guidance"><h4>'+html(languages[language].name)+' coding tips</h4><p>'+html(({java:'Use the provided method signature. HashMap and HashSet give expected O(1) lookup; use long when int can overflow.',python:'Keep the generated function and parameters. Return the result instead of printing or reading stdin. Use dict or set for lookup, enumerate for indexed iteration, and four spaces per indentation level.',c:'Keep the generated function signature. Check array lengths before indexing and free memory you allocate. Use long long for large sums.',cpp:'Keep the generated function signature. Return the result; do not add main or read stdin. Use std::vector, std::unordered_map and std::sort; prefer long long for large sums.'})[language])+'</p><small>Suggestions: Ctrl + Space · Accept: Tab · New line: auto-indent · Undo: Ctrl / ⌘ Z · Clipboard disabled in the editor</small></section>';
  $("learningContent").innerHTML=content;
  if(tab==="problem")loadCredits(current,creditEpoch);
  if($("timerButton")){$("timerButton").onclick=toggleTimer;updateTimer();}
  if($("referenceBtn"))$("referenceBtn").onclick=()=>{
    referenceUsed=true;
    $("referenceContent").innerHTML='<p class="reference-reveal-note">Trace the idea, then close this and try it yourself.</p><pre class="reference-code">'+html(current.reference)+'</pre>';
    $("referenceBtn").hidden=true;
  };
  if(tab==="visual"){
    traceStep=0;renderTrace();
    $("traceNext").onclick=()=>{pauseTrace();traceStep=Math.min(traceStep+1,traceFor(current).length-1);renderTrace();};
    $("traceBack").onclick=()=>{pauseTrace();traceStep=Math.max(0,traceStep-1);renderTrace();};
    $("traceReset").onclick=()=>{pauseTrace();traceStep=0;renderTrace();};
    $("tracePlay").onclick=()=>{
      if(traceTimer){pauseTrace();return;}
      const frames=traceFor(current);if(traceStep===frames.length-1)traceStep=0;renderTrace();
      $("tracePlay").textContent="Ⅱ Pause";
      traceTimer=setInterval(()=>{traceStep++;renderTrace();if(traceStep>=frames.length-1)pauseTrace();},1900);
    };
  }
}
async function loadCredits(problem,ticket){
 const container=$("problemCredits"),owner=cloud.user?.id;if(!container)return;
 if(!owner){container.textContent='Community library · Sign in to view contributor';return;}
 container.textContent='Loading contributor…';
 try{const r=await cloud.request('problem-authors',{problemId:problem.id},owner);if(ticket!==creditEpoch||cloud.user?.id!==owner||!container.isConnected)return;container.innerHTML=r.users?.length?'<span>Created by</span>'+r.users.map(p=>'<a class="problem-author" href="'+publicProfileHref(p)+'" aria-label="View '+html(p.display_name)+' profile">'+profileAvatar(p)+'<strong>'+html(p.display_name)+'</strong></a>').join(''):r.hasAuthor?'Contributor profile unavailable':'ByteQuest collection';}catch{if(ticket===creditEpoch&&container.isConnected)container.textContent='Community library';}
}
function renderTrace(){
  const frames=traceFor(current), f=frames[traceStep];
  if(!$("traceBoard"))return;
  $("traceBoard").innerHTML='<div class="trace-cells">'+f.values.map((v,i)=>'<span class="trace-cell'+(f.active.includes(i)?" active":"")+(f.found.includes(i)?" found":"")+(f.dim.includes(i)?" dim":"")+'">'+html(v)+'<small>'+i+'</small></span>').join("")+'</div><div class="trace-note">'+html(f.note)+'</div>';
  $("traceCaption").textContent=f.message;$("traceCounter").textContent=(traceStep+1)+" / "+frames.length;
  $("traceBack").disabled=traceStep===0;$("traceNext").disabled=traceStep===frames.length-1;
  $("tracePlay").disabled=frames.length<2;
}
function pauseTrace(){if(traceTimer)clearInterval(traceTimer);traceTimer=null;if($("tracePlay"))$("tracePlay").textContent="▶ Play";}
function formatArgs(args){return args.map((v,i)=>current.params[i].name+" = "+JSON.stringify(v)).join(", ");}
function allCases(){return [...current.tests.slice(0,2),...customCases];}
function renderTests(){
  const cases=allCases(); selectedCase=Math.min(selectedCase,cases.length-1);
  $("testTabs").innerHTML=cases.map((c,i)=>'<button data-case="'+i+'" class="'+(selectedCase===i?"active ":"")+(results?.cases?.[i]?(results.cases[i].passed?"pass":"fail"):"")+'">'+(i<2?"Case "+(i+1):"Custom "+(i-1))+(results?.cases?.[i]?(results.cases[i].passed?" ✓":" ×"):"")+'</button>').join("");
  $("testTabs").querySelectorAll("button").forEach(b=>b.onclick=()=>{selectedCase=Number(b.dataset.case);renderTests();});
  const test=cases[selectedCase],result=results?.cases?.[selectedCase];
  $("testDetail").innerHTML='<div><label>INPUT</label><code>'+html(formatArgs(test.args))+'</code></div><div><label>EXPECTED</label><code>'+html(JSON.stringify(test.expected))+'</code></div>'+(result?'<div><label>YOUR OUTPUT</label><code>'+html(result.actual)+'</code></div>':"")+'<p class="test-caption">'+html(test.label)+(selectedCase>=2?' <button id="removeCase" class="remove-case">Remove this case ×</button>':"")+'</p>';
  if($("removeCase"))$("removeCase").onclick=()=>{customCases.splice(selectedCase-2,1);selectedCase=0;results=null;$("resultOutput").replaceChildren();renderTests();};
}
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{tab=b.dataset.tab;renderLearning();});
$("hintBtn").onclick=()=>{
  $("hintText").textContent=current.hints[Math.min(hints,current.hints.length-1)];hints++;
  $("hintBtn").textContent=hints>=current.hints.length?"All hints shown":"Next hint "+hints+"/"+current.hints.length+" ↗";
  $("hintBtn").disabled=hints>=current.hints.length;
};
function toggleTimer(){
  if(timerProblem!==current.id){timerUsed=0;timerStarted=null;timerProblem=current.id;}
  if(timerStarted){timerUsed+=Date.now()-timerStarted;timerStarted=null;}
  else timerStarted=Date.now();
  clearInterval(timerTick);timerTick=setInterval(updateTimer,1000);updateTimer();
}
function updateTimer(){
  if(!$("timerDisplay"))return;
  const elapsed=timerUsed+(timerStarted?Date.now()-timerStarted:0);
  const remaining=Math.max(0,current.minutes*60-Math.floor(elapsed/1000));
  $("timerDisplay").textContent=String(Math.floor(remaining/60)).padStart(2,"0")+":"+String(remaining%60).padStart(2,"0");
  $("timerButton").textContent=timerStarted?"Pause":"Start";
  if(remaining===0&&timerStarted){timerUsed=elapsed;timerStarted=null;clearInterval(timerTick);notify("Focus session complete. Take a breath and explain your approach.");$("timerButton").textContent="Finished";}
}
$("learnMode").onclick=()=>{mode="learn";if(timerStarted){timerUsed+=Date.now()-timerStarted;timerStarted=null;}renderLearning();$("learnMode").classList.add("active");$("challengeMode").classList.remove("active");};
$("challengeMode").onclick=()=>{mode="challenge";renderLearning();$("challengeMode").classList.add("active");$("learnMode").classList.remove("active");};
function setBusy(value){busy=value;$("runBtn").disabled=value;$("submitBtn").disabled=value;$("customBtn").disabled=value;$("stopBtn").hidden=!value;$("problemSelect").disabled=value;$("codeEditor").readOnly=value||!accountReady;document.body.classList.toggle("busy",value);}
function stopRun(message="Run stopped. Your draft is saved."){
  runEpoch++;clearTimeout(watchdog);judge.stop();setBusy(false);$("runStatus").textContent=languages[language].name+(language==="java"?" · browser compiler":" · online via Wandbox");$("resultOutput").textContent=message;
}
async function run(submit){
  if(busy||!current)return;
  if(submit&&cloud.user){await submitOnline();return;}
  const epoch=++runEpoch,p=current,source=$("codeEditor").value;
  const cases=submit?[...p.tests,...customCases]:allCases();
  setBusy(true);results=null;renderTests();$("resultOutput").textContent="Starting your code…";
  watchdog=setTimeout(()=>stopRun(language==="java"?"Java startup timed out. Check your connection and allow cjrtnc.leaningtech.com, then try again.":"Online compilation is taking longer than expected. Your code is saved; please try again shortly."),language==="java"?120000:language==='cpp'?90000:60000);
  try{
    const result=await judge.run(source,p,cases);
    if(epoch!==runEpoch)return;
    if(result.status!=="ok"){$("resultOutput").textContent=(result.code==="compiler_timeout"?"Compiler request timed out\n":result.status==="unavailable"?"Compiler temporarily unavailable\n":result.status==="compile_error"?"Compile error\n":"Runtime error\n")+result.message;if(result.status!=="unavailable")logAttempt(p,0,cases.length);return;}
    results={...result,cases:submit?[...result.cases.slice(0,2),...result.cases.slice(p.tests.length)]:result.cases};
    renderTests();
    const passed=result.cases.filter(c=>c.passed).length, accepted=passed===cases.length;
    const output=$("resultOutput");output.replaceChildren();
    const summary=document.createElement("div");summary.className="result-summary"+(accepted?"":" failed");summary.textContent=(accepted?"✓ ":"↻ ")+passed+" / "+cases.length+" cases passed · "+result.elapsedMs+" ms "+(language==="java"?"browser execution":"online execution");output.append(summary);
    result.cases.filter(c=>!c.passed).slice(0,5).forEach(c=>{
      const detail=document.createElement("div");detail.textContent=c.name+"\nExpected: "+c.expected+"\nYour output: "+c.actual+"\n";output.append(detail);
    });
    if(result.stdout){const stdout=document.createElement("div");stdout.className="stdout";stdout.textContent="Console\n"+result.stdout;output.append(stdout);}
    logAttempt(p,passed,cases.length);
    if(accepted&&submit&&p.hiddenCount){
      if(language!=="java"){output.append(document.createTextNode(" Private submissions currently support Java only. No acceptance recorded."));return;}
      if(!cloud.user){notify("Public checks passed. Sign in for private-test submissions.");output.append(document.createTextNode(" Private tests are not checked; this quest is not yet accepted."));}
      else{try{const verdict=await cloud.request("hidden-submit",{problemId:p.id,source,revision:p.revision});output.append(document.createTextNode(" "+verdict.message));if(verdict.accepted)completeQuest(p);}catch(error){output.append(document.createTextNode(" "+error.message));}}
    }else if(accepted&&submit)completeQuest(p);
    else if(accepted)notify("Samples passed! Submit quest to check every built-in edge case.");
  }catch(error){if(epoch===runEpoch)$("resultOutput").textContent=language!=="java"&&error?.name==='TimeoutError'?"Compiler request timed out. Your code is saved. Please try again shortly.":String(error.message||error);}
  finally{if(epoch===runEpoch){clearTimeout(watchdog);setBusy(false);$("runStatus").textContent=languages[language].name+(language==="java"?" · browser compiler":" · online via Wandbox");updateStats();persist();}}
}
async function submitOnline(){
 const p=current,lang=language,source=$("codeEditor").value,user=cloud.user?.id,account=accountEpoch;
 setBusy(true);
 const options=await requestSubmission({problem:p,language:languages[lang].name});
 if(!options||current.id!==p.id||language!==lang||cloud.user?.id!==user||account!==accountEpoch){setBusy(false);return;}
 const epoch=++runEpoch;results=null;renderTests();$("resultOutput").textContent='Running and measuring your solution…';
 watchdog=setTimeout(()=>stopRun('The submission is taking longer than expected. Your code is saved. Check My submissions before retrying.'),lang==='cpp'?105000:70000);
 try{
  const result=await cloud.request('submission-create',{...options,problemId:p.id,revision:p.revision,source,language:lang},user);
  if(epoch!==runEpoch||account!==accountEpoch||cloud.user?.id!==user)return;
  if(result.status!=='unavailable')logAttempt(p,result.passed||0,result.total||p.tests.length);
  const output=$("resultOutput");output.replaceChildren();const summary=document.createElement('div');summary.className='result-summary'+(result.status==='unavailable'?' unavailable':result.accepted?'':' failed');summary.textContent=(result.code==='compiler_timeout'?'Compiler timed out · ':result.status==='unavailable'?'Compiler unavailable · ':result.accepted?'✓ Accepted · ':'')+(result.message||'Submission finished.');output.append(summary);
  if(result.accepted){const metrics=document.createElement('p');metrics.className='benchmark-note';metrics.textContent=runtimeLabel(result.runtimeMs??result.submission?.runtime_ms)+' · '+memoryLabel(result.memoryBytes??result.submission?.memory_bytes)+' · measured test suite';output.append(metrics);const link=document.createElement('button');link.className='reference-button';link.textContent='View submissions →';link.onclick=()=>{tab='submissions';renderLearning();};output.append(link);completeQuest(p);if(tab==='submissions')submissions.refresh();}
 }catch(e){if(epoch===runEpoch&&account===accountEpoch)$("resultOutput").textContent=e?.name==='TimeoutError'?'The submission request timed out. Your code is saved. Check My submissions before retrying.':e.message;}
 finally{if(epoch===runEpoch&&account===accountEpoch){clearTimeout(watchdog);setBusy(false);$("runStatus").textContent=languages[language].name+' · ready';persist();updateStats();}}
}
function logAttempt(p,passed,total){
  state.attempts[p.id]=(state.attempts[p.id]||0)+1;
  state.activity.push({id:p.id,at:Date.now(),type:"attempt",passed,total});
  state.activity=state.activity.slice(-200);persist();updateStats();
}
function completeQuest(p){
  const solvedDay=new Date().toISOString().slice(0,10);state.acceptedDays??=[];if(!state.acceptedDays.includes(solvedDay))state.acceptedDays.push(solvedDay);
  const first=!state.solved[p.id],isReview=!first&&due(p.id);
  if(first){state.solved[p.id]=Date.now();state.reviews[p.id]={anchor:Date.now(),step:0};}
  else if(isReview){state.reviews[p.id].step++;}
  if(first||isReview)state.activity.push({id:p.id,at:Date.now(),type:first?"solved":"review",passed:p.tests.length,total:p.tests.length});
  $("successTitle").textContent=first?"Aha! Quest complete.":isReview?"That pattern is sticking.":"Another good repetition.";
  $("successCopy").textContent=(first?"+"+pointsFor(p.difficulty)+" points! ":isReview?"Review complete! ":"")+p.title+" passed the problem test suite. "+(first?"Your first review is in 2 days.":isReview?"Review progress saved.":"Try explaining why your approach works.");
  $("successNote").value=state.notes[p.id]||"";
  document.querySelectorAll("[data-confidence]").forEach(b=>b.classList.toggle("selected",Number(b.dataset.confidence)===state.confidence[p.id]));
  persist();updateStats();$("successDialog").showModal();celebrate();
}
function celebrate(){launchCelebration();}
$("successNote").addEventListener("input",()=>{state.notes[current.id]=$("successNote").value.slice(0,4000);touch("notes",current.id);persist();});
document.querySelectorAll("[data-confidence]").forEach(b=>b.onclick=()=>{state.confidence[current.id]=Number(b.dataset.confidence);touch("confidence",current.id);document.querySelectorAll("[data-confidence]").forEach(x=>x.classList.toggle("selected",x===b));persist();});
$("runBtn").onclick=()=>run(false);$("submitBtn").onclick=()=>run(true);$("stopBtn").onclick=()=>stopRun();
$("problemSelect").innerHTML=problems.map(p=>'<option value="'+p.id+'">'+html(p.title)+'</option>').join("");
$("problemSelect").onchange=e=>changeProblem(e.target.value);
function changeProblem(id){
  const target=problems.find(p=>p.id===id);if(!target)return;
  if(busy)stopRun();pauseTrace();clearInterval(timerTick);timerUsed=0;timerStarted=null;timerProblem=id;
  current=target;state.current=id;state.currentUpdated=Date.now();customCases=[];selectedCase=0;results=null;tab="problem";referenceUsed=false;persist();renderPractice();location.hash="practice";
}
function nextProblem(){
  if(!problems.length)return;
  const review=problems.find(p=>due(p.id));
  if(review&&review.id!==current.id){changeProblem(review.id);return;}
  const position=problems.indexOf(current);
  const next=problems.slice(position+1).concat(problems.slice(0,position)).find(p=>!state.solved[p.id])||problems[(position+1)%problems.length];
  changeProblem(next.id);
}
$("nextBtn").onclick=nextProblem;$("successNext").onclick=()=>{$("successDialog").close();nextProblem();};
$("customBtn").onclick=()=>{$("customArgs").value=JSON.stringify(current.tests[0].args);$("customExpected").value=JSON.stringify(current.tests[0].expected);$("customError").textContent="";$("customDialog").showModal();};
$("customForm").onsubmit=event=>{
  event.preventDefault();try{
    if(customCases.length>=8)throw new Error("Keep up to 8 custom cases per quest session.");
    const c={args:JSON.parse($("customArgs").value),expected:JSON.parse($("customExpected").value),label:"Your experiment"};
    buildTests(current,[c]);customCases.push(c);selectedCase=allCases().length-1;results=null;renderTests();$("customDialog").close();notify("Custom case added. Run it with your samples.");
  }catch(error){$("customError").textContent=error.message;}
};
$("resetCode").onclick=()=>$("resetDialog").showModal();
$("confirmReset").onclick=()=>{state.drafts[draftId()]=currentStarter();touch("drafts",draftId());loadEditor(currentStarter());persist();updateEditor();results=null;renderTests();$("resultOutput").replaceChildren();$("resetDialog").close();notify("A fresh starter is ready.");};
document.querySelectorAll(".dialog-close,.dialog-close-button").forEach(b=>b.onclick=()=>b.closest("dialog").close());
document.querySelectorAll("dialog").forEach(d=>d.addEventListener("click",event=>{if(event.target===d){const r=d.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)d.close();}}));
$("aboutBtn").onclick=()=>$("aboutDialog").showModal();
let previousView=null;
function route(){
  const view=document.body.dataset.page==="studio"?"studio":(["dashboard","practice","map","progress","studio"].includes(location.hash.slice(1))?location.hash.slice(1):"map");
  if(view==="studio"&&document.body.dataset.page!=="studio"){location.href="./studio.html";return;}
  ["dashboard","practice","map","progress","studio"].forEach(name=>$(name+"View").hidden=view!==name);
  document.querySelectorAll("[data-view]").forEach(a=>a.classList.toggle("active",a.dataset.view===view));
  $("breadcrumb").textContent=({dashboard:"Dashboard",practice:"Practice",map:"Problem library",progress:"My progress",studio:"Problem studio"})[view];
  if(view!=="practice"){pauseTrace();if(busy)stopRun();}if(view!=="studio")studio.stop();if(view==="studio")studio.open();if(view==="dashboard"){location.hash="map";return;}if(view==="map")renderMap();if(view==="progress")renderProgress();
  if(previousView!==null&&previousView!==view)window.scrollTo({top:0,left:0,behavior:"instant"});previousView=view;
}
addEventListener("hashchange",route);
$("patternFilter").replaceChildren(new Option("All problem patterns",""),...[...new Set(problems.map(p=>p.pattern||p.topic))].sort().map(v=>new Option(v,v)));
$("topicFilter").innerHTML+=[...topics].map(t=>'<option>'+html(t)+'</option>').join("");
["topicFilter","patternFilter","techniqueFilter","difficultyFilter","statusFilter"].forEach(id=>$(id).onchange=renderMap);$("searchInput").oninput=renderMap;
function renderMap(){
  const pattern=$("patternFilter").value,technique=$("techniqueFilter").value;
  const query=$("searchInput").value.toLowerCase(),topic=$("topicFilter").value,level=$("difficultyFilter").value,status=$("statusFilter").value;
  const list=problems.filter(p=>(p.title+" "+String(problems.indexOf(p)+1)).toLowerCase().includes(query)&&(!topic||p.topic===topic)&&(!pattern||(p.pattern||p.topic)===pattern)&&(!technique||(p.techniques||[]).includes(technique))&&(!level||p.difficulty===level)&&(!status||(status==="solved"?state.solved[p.id]:status==="new"?!state.solved[p.id]:due(p.id))));
  $("questGrid").innerHTML=list.length?'<table class="problem-table"><thead><tr><th>No.</th><th>Title</th><th>Companies</th><th>Difficulty</th><th>Status</th></tr></thead><tbody>'+list.map(p=>'<tr><td>'+String(problems.indexOf(p)+1).padStart(2,'0')+'</td><td><button class="problem-title" data-problem="'+p.id+'">'+html(p.title)+'</button></td><td>'+((p.companies||[]).map(companyIcon).join('')||'<span class="muted">—</span>')+'</td><td><span class="difficulty '+p.difficulty.toLowerCase()+'">'+html(p.difficulty)+'</span><small class="problem-points">'+pointsFor(p.difficulty)+' pts</small></td><td>'+ (state.solved[p.id]?'Solved':'Unsolved')+'</td></tr>').join('')+'</tbody></table><p class="company-note">Company tags are community-reported historical associations, not employer endorsements. <a href="https://github.com/duanehutchins/leetcode-questions-by-company" target="_blank" rel="noopener">Tag source</a></p>':'<p class="empty-state">No matching problems.</p>';
  $("questGrid").querySelectorAll("[data-problem]").forEach(b=>b.onclick=()=>changeProblem(b.dataset.problem));
}
function renderProgress(){
  const solved=problems.filter(p=>state.solved[p.id]).length, dueCount=problems.filter(p=>due(p.id)).length;
  const stats=[["QUESTS SOLVED",solved+" / "+problems.length,"One idea at a time."],["POINTS EARNED",xp(),"Level "+(1+Math.floor(xp()/300))+" Java explorer"],["DAY STREAK",streak(),"A small daily win counts."],["READY TO REVISIT",dueCount,"Reviews at 2 / 7 / 21 days"]];
  $("progressCards").innerHTML=stats.map(c=>'<div class="progress-stat"><small>'+c[0]+'</small><b>'+c[1]+'</b><p>'+c[2]+'</p></div>').join("");
  $("topicProgress").innerHTML=topics.map(topic=>{
    const list=problems.filter(p=>p.topic===topic),done=list.filter(p=>state.solved[p.id]).length;
    const retries=list.reduce((sum,p)=>sum+Math.max(0,(state.attempts[p.id]||0)-(state.solved[p.id]?1:0)),0);
    return '<div class="topic-row"><div class="topic-label"><span>'+html(topic)+' '+(retries>2?"· revisit this pattern":"")+'</span><span>'+done+" / "+list.length+(retries?" · "+retries+" extra attempts":"")+'</span></div><div class="progress-track"><div style="width:'+(done/list.length*100)+'%"></div></div></div>';
  }).join("");
  const reviewList=problems.filter(p=>state.solved[p.id]&&state.reviews[p.id]?.step<3).sort((a,b)=>dueTime(a.id)-dueTime(b.id));
  $("reviewQueue").innerHTML=reviewList.length?reviewList.map(p=>'<div class="review-item"><div><strong>'+html(p.title)+'</strong><small>'+ (due(p.id)?"Ready now":"Next: "+new Date(dueTime(p.id)).toLocaleDateString(undefined,{month:"short",day:"numeric"}))+' · review '+(state.reviews[p.id].step+1)+'/3</small></div><button data-review="'+p.id+'">'+(due(p.id)?"Review ↗":"Practise ↗")+'</button></div>').join(""):'<div class="empty-state">'+(solved?"Your scheduled reviews are complete. Keep exploring!":"Solve your first quest to plant a review reminder here.")+'</div>';
  $("reviewQueue").querySelectorAll("[data-review]").forEach(b=>b.onclick=()=>changeProblem(b.dataset.review));
  $("activityList").innerHTML=state.activity.length?[...state.activity].reverse().slice(0,12).map(a=>{
    const p=problems.find(p=>p.id===a.id);
    return '<div class="activity-row"><span class="activity-icon">'+(a.type==="solved"?"✦":a.type==="review"?"↻":"⌘")+'</span><div><strong>'+html(p?.title||a.id)+'</strong> · '+(a.type==="solved"?"Quest completed · +"+pointsFor(p?.difficulty)+" points":a.type==="review"?"Review complete":a.passed+"/"+a.total+" tests passed")+'</div><time>'+new Date(a.at).toLocaleDateString(undefined,{month:"short",day:"numeric"})+'</time></div>';
  }).join(""):'<div class="empty-state">Your story starts with one attempt. Head to the practice lab.</div>';
}
$("exportBtn").onclick=()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="bytequest-progress-"+dateKey()+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify("Progress backup downloaded. Keep it somewhere safe.");
};
$("importBtn").onclick=()=>$("importFile").click();
$("importFile").onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  try{
    if(file.size>2000000)throw new Error("Choose a backup smaller than 2 MB.");
    const incoming=validateBackup(JSON.parse(await file.text()));
    state=mergeProgress(state,incoming);
    persist();updateStats();renderProgress();notify("Backup merged with your progress. Newer edits kept.");
  }catch(error){notify("Could not restore: "+error.message);}event.target.value="";
};
function setSyncStatus(kind,label){$("syncBadge").className="sync-badge "+kind;$("syncLabel").textContent=label;}
function refreshAccountUi(){
  shell.setAccount(cloud.user,publicProfile);
  const user=cloud.user,meta=user?.user_metadata||{},name=String(meta.full_name||meta.name||"Java explorer");
  $("accountLabel").textContent=user?String(name).split(" ")[0]:"Sign in with Google";
  $("profileName").textContent=user?name:"Java explorer";$("profileAvatar").textContent=user?name.charAt(0).toUpperCase():"J";
  $("studioNav").hidden=!cloud.canCreate;
  $("accountTitle").textContent=user?"Your learning, connected.":"A little more connected.";
  $("accountDescription").textContent=user?"Your drafts, notes, and progress sync to this Google account.":"Sign in with Google to keep your progress, drafts, and review schedule across devices.";
  $("googleSignInBtn").hidden=!!user;$("signOutBtn").hidden=!user;$("syncNowBtn").hidden=!user;$("importGuestBtn").hidden=!user;
  $("guestContinue").hidden=!!user;$("accountIdentity").hidden=!user;
  $("accountIdentity").className="account-identity";
  $("accountIdentity").innerHTML=user?"<strong>"+html(name)+"</strong>"+html(user.email||""):"";
  if(!cloud.enabled)$("authMessage").textContent="Cloud accounts are being connected. You can keep practising on this device.";
  else if(!user&&!cloud.loginReady&&!$("authMessage").textContent)$("authMessage").textContent="Loading secure sign-in…";
}
async function changeAccount(user){
  const owner=user?.id||null;if(owner===accountOwner&&accountReady)return;
  const epoch=++accountEpoch;publicProfile=null;accountOwner=owner;accountReady=false;clearTimeout(syncTimer);syncing=false;syncAgain=false;
  document.querySelectorAll('.submit-confirm[open],#successDialog[open]').forEach(d=>d.close());
  if(busy)stopRun();studio.accountChanged();dashboard.accountChanged();storageKey=owner?"bytequest.user."+owner:guestStorageKey;
  state=readLocal(storageKey);current=problems.find(p=>p.id===state.current)||problems[0]||null;
  renderPractice();$("codeEditor").readOnly=true;updateStats();refreshAccountUi();
  let needsSync=false;
  if(owner){
    setSyncStatus("syncing","Loading your progress");
    const loaded=await Promise.allSettled([cloud.loadProgress(owner),cloud.checkAdmin(owner),cloud.request("self")]);
    if(epoch!==accountEpoch)return;
    if(loaded[0].status==="fulfilled"){
      const remote=loaded[0].value;state=mergeProgress(state,remote.state);needsSync=JSON.stringify(state)!==JSON.stringify(remote.state);
      setSyncStatus("synced",remote.revision?"Saved to cloud":"Cloud connected");
    }else{setSyncStatus("failed","Saved on this device");$("authMessage").textContent="Could not load cloud progress. Your account’s local work is kept. Use Sync now to retry.";}
    if(loaded[1].status==="rejected")cloud.admin=false;
    if(loaded[2].status==="fulfilled")publicProfile=loaded[2].value.profile;
  }else setSyncStatus("","On this device");
  if(epoch!==accountEpoch)return;
  current=problems.find(p=>p.id===state.current)||problems[0]||null;
  persist();accountReady=true;$("codeEditor").readOnly=false;refreshAccountUi();renderPractice();updateStats();route();
  if(needsSync)syncTimer=setTimeout(()=>syncCloud(),500);
}
async function syncCloud(){
  clearTimeout(syncTimer);if(!cloud.user||!accountReady)return;
  if(syncing){syncAgain=true;return;}
  if(!navigator.onLine){setSyncStatus("failed","Offline · saved here");return;}
  const owner=cloud.user.id,epoch=accountEpoch,snapshot=JSON.stringify(state);syncing=true;setSyncStatus("syncing","Syncing progress");
  try{
    const merged=await cloud.syncProgress(owner,JSON.parse(snapshot),mergeProgress);if(epoch!==accountEpoch||cloud.user?.id!==owner)return;
    const changedWhileSaving=JSON.stringify(state)!==snapshot;state=mergeProgress(state,merged);
    try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{}
    if(current&&document.activeElement!==$("codeEditor")){loadEditor(state.drafts[draftId()]??currentStarter());updateEditor();}
    updateStats();if(location.hash==="#progress")renderProgress();
    $("saveStatus").textContent=changedWhileSaving?"New edits saved here · sync queued":"Draft saved to your account";
    setSyncStatus("synced",changedWhileSaving?"New changes queued":"Saved to cloud");$("authMessage").textContent="";
    if(changedWhileSaving)syncAgain=true;
  }catch(error){if(epoch===accountEpoch){setSyncStatus("failed","Saved here · retry sync");$("authMessage").textContent=error.message;}}
  finally{if(epoch===accountEpoch){syncing=false;if(syncAgain){syncAgain=false;syncTimer=setTimeout(()=>syncCloud(),1000);}}}
}
async function refreshCatalog(){
  if(!cloud.enabled)return;
  try{
    const next=await cloud.publicCatalog();if(next===null)return;
    const selected=current?.id;problems.splice(0,problems.length,...next);topics=[...new Set(problems.map(p=>p.topic))];
    $("problemSelect").replaceChildren(...problems.map(p=>new Option(p.title,p.id)));
    for(const [id,values,label] of [["patternFilter",[...new Set(problems.map(p=>p.pattern||p.topic))],"All problem patterns"],["techniqueFilter",[...new Set(problems.flatMap(p=>p.techniques||[]))],"All techniques"]]){const selected=$(id).value;$(id).replaceChildren(new Option(label,""),...values.sort().map(v=>new Option(v,v)));if(values.includes(selected))$(id).value=selected;}
    const oldTopic=$("topicFilter").value;$("topicFilter").replaceChildren(new Option("All patterns",""),...topics.map(t=>new Option(t,t)));if(topics.includes(oldTopic))$("topicFilter").value=oldTopic;
    current=problems.find(p=>p.id===selected)||problems[0]||null;
    renderPractice();updateStats();route();
  }catch(error){notify("The offline library is available while the connection recovers.");}
}
function openAccount(){refreshAccountUi();$("accountDialog").showModal();}
$("accountBtn").onclick=openAccount;$("profileBtn").onclick=()=>{location.href="./community.html#me";};$("syncBadge").onclick=openAccount;$("studioSignIn").onclick=openAccount;
$("googleSignInBtn").onclick=async()=>{const button=$("googleSignInBtn");button.disabled=true;try{$("authMessage").textContent="Opening Google sign-in…";await cloud.signIn();$("authMessage").textContent="";$("accountDialog").close();}catch(error){$("authMessage").textContent=error.message;}finally{button.disabled=false;}};
$("syncNowBtn").onclick=async()=>{await syncCloud();};
$("signOutBtn").onclick=async()=>{try{await syncCloud();await cloud.signOut();$("accountDialog").close();await changeAccount(null);notify("Signed out on this device. Your account progress is kept.");}catch(error){$("authMessage").textContent=error.message;}};
$("importGuestBtn").onclick=()=>{if(!cloud.user)return;state=mergeProgress(state,readLocal(guestStorageKey));persist();renderPractice();updateStats();notify("Guest progress added to this account. Cloud sync queued.");};
addEventListener("online",()=>{if(cloud.user)syncCloud();else setSyncStatus("","On this device");});
addEventListener("offline",()=>setSyncStatus("failed",cloud.user?"Offline · saved here":"On this device"));
async function bootCloud(){
  refreshAccountUi();
  try{await cloud.init();$("authMessage").textContent="";}catch(error){$("authMessage").textContent=error.message;setSyncStatus("failed","Account connection paused");}
  await refreshCatalog();await changeAccount(cloud.user);const requested=new URLSearchParams(location.search).get("problem");if(requested&&problems.some(p=>p.id===requested))changeProblem(requested);
}
renderPractice();updateStats();route();bootCloud();
if(!storageOK){$("saveStatus").textContent="Storage unavailable — use Save progress";notify("Local storage is unavailable. Export your progress before leaving.");}


