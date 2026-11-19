import {profileAvatar,publicProfileHref} from './profile-view.js?v=workbench-1';
import {mountSubmissions,requestSubmission,runtimeLabel,memoryLabel} from './submissions.js?v=verification-evidence-1&public-unlock=2&public-default=1';
import {launchCelebration} from './celebration.js?v=next-1';
import {mountEditorTools} from './editor-tools.js?v=copy-enabled-1';
import {mountWorkspaceLayout} from './workspace-layout.js?v=workspace-1';
import {submissionFeedback} from './submission-feedback.js?v=reliability-1&public-unlock=2';
import {usesRemoteSubmit,browserSubmissionCases,browserSubmissionVerdict,privateJavaJudgeUnavailable} from './browser-submit.js?v=verified-java-1';
import {privateJudgeUnavailableSummary} from './verification-evidence.js?v=1';
import {createPracticeSubmission,addPracticeSubmission,reconcilePracticeProgress} from './practice-history.js?v=practice-history-2';
import {shouldRunCodeShortcut} from './run-shortcut.js?v=ctrl-run-1';
import {selectedProblemUrl} from './problem-navigation.js?v=1';
import {readSafeProgress,writeSafeProgress} from './reliable-storage.js?v=reliability-1';
import {pointsFor,totalPoints} from './rewards.js?v=upgrade-2';
import {companyIcons} from './companies.js?v=company-tooltips-1';
import {problemStatusMarkup} from './problem-status.js?v=auth-ready-1';
import {canRevealEditorialSolution,editorialSolutionGateMarkup} from './editorial-access.js?v=editorial-1&public-unlock=2&quiet=2';
import {mountWorkspace} from './workspace.js';
import {mountShell} from "./shell.js?v=quiet-2";
import {Dashboard} from "./dashboard.js?v=topic-directory-1";
import {languages,starterFor,NativeJudge} from "./languages.js?v=structural-2";
import {problems as bundledProblems} from "./problems.js?v=private-reference-1";
import {Cloud} from "./cloud.js?v=outage-1";
import {createViewCache,prefetchCommunityViews} from "./view-cache.js?v=avatar-1";
import {blankProgress, validateProgress, mergeProgress, solveStreak} from "./progress.js?v=practice-history-1";
import {recoverOwnProfileSolves} from "./profile-solve-recovery.js?v=1";
// Problem Studio runs solely in studio.html. Never initialize its form on Problems.
const problems=[...bundledProblems];
const shell=mountShell();mountWorkspace();let language="java";try{const v=localStorage.getItem("bytequest.language");if(languages[v])language=v;}catch{}
const draftId=(id=current.id)=>language==="java"?id:id+"--"+language;
const currentStarter=()=>starterFor(current,language);
let topics=[...new Set(problems.map(p=>p.topic))];
import {JavaJudge, buildTests} from "./judge.js?v=security-2";
import {traceFor} from "./traces.js";
const $ = id => document.getElementById(id);
const html = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const icon = name => '<svg aria-hidden="true"><use href="#i-' + name + '"/></svg>';
const guestStorageKey="bytequest.v1";
let storageKey=guestStorageKey;
const blank=blankProgress;
const validateBackup=validateProgress;
let state=blank(),storageOK=true,accountHistoryStatus="loading";
const storageTargets=new Map(),storageWarnings=new Map();
function readLocal(key){
  let result;
  try{result=readSafeProgress(localStorage,key,validateProgress,blank);}
  catch{result={state:blank(),saveKey:null,warning:"Browser storage could not be accessed. Export your work before closing this page."};}
  storageTargets.set(key,result.saveKey);
  if(result.warning)storageWarnings.set(key,result.warning);
  return result.state;
}
function writeLocalProgress(key,value){
  writeSafeProgress(localStorage,storageTargets.has(key)?storageTargets.get(key):key,value);
}
state=reconcilePracticeProgress(readLocal(storageKey));
let publicProfile=null;
const communityCache=createViewCache();
const serverAcceptedRevisions=new Set();
const canCheckJavaReference=p=>canRevealEditorialSolution(state,p.id)||
 serverAcceptedRevisions.has((cloud.user?.id||'')+':'+p.id+':'+p.revision);
let communityWarmupTimer=null;
function scheduleCommunityWarmup(owner,profile){
  clearTimeout(communityWarmupTimer);
  if(!owner||!cloud.enabled||navigator.connection?.saveData)return;
  communityWarmupTimer=setTimeout(()=>{
    if(cloud.user?.id!==owner||!accountReady||busy||document.hidden||!navigator.onLine)return;
    // Non-blocking, best-effort fetch of only ranking and own profile snapshots.
    void prefetchCommunityViews(cloud,{owner,profile,cache:communityCache});
  },350);
}

let syncTimer,syncing=false,syncAgain=false,syncFailures=0,accountEpoch=0,accountOwner,accountReady=false,pendingProfileRefresh=false;
const cloud=new Cloud(user=>changeAccount(user));shell.connect(cloud);
const studio={accountChanged(){},stop(){},open(){}}; // Standalone studio-page.js owns Studio.
const submissions=mountSubmissions(cloud,{notify,getPracticeSubmissions:()=>state.practiceSubmissions||[],getSolvedAt:id=>state.solved[id]||null});
const dashboard=new Dashboard({cloud,getState:()=>state,getCatalog:()=>problems});
function touch(field,id){state.modified[id]??={};state.modified[id][field]=Date.now();}
const deepLinkedProblem=()=>problems.find(p=>p.id===new URLSearchParams(location.search).get("problem"))||null;
let current = deepLinkedProblem() || problems.find(p => p.id === state.current) || problems[0];
let tab = "problem", mode = "learn", hints = 0, selectedCase = 0, customCases = [], results = null;
let busy = false, runEpoch = 0, watchdog, toastTimer, traceTimer, traceStep = 0;
let timerStarted = null, timerUsed = 0, timerProblem = current.id, timerTick;
let referenceUsed = false,creditEpoch=0;
const reviewDays = [2,7,21];
const codeTools=mountEditorTools($("codeEditor"),{getLanguage:()=>language,getProblem:()=>current,notify});
mountWorkspaceLayout($("practiceView"));
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
const javaOnlyProblem=p=>Boolean(p?.params?.some(param=>param.type==="ListNode"||param.type==="TreeNode"||param.type==="int[][]")||["ListNode","int[][]"].includes(p?.returns));
function setLanguage(v){if(!languages[v])return;if(javaOnlyProblem(current)&&v!=="java"){notify("Linked-list and tree problems currently support Java 17 only.");return;}if(busy)stopRun();language=v;try{localStorage.setItem("bytequest.language",v);}catch{}renderPractice();}
$("languageSelect").onchange=e=>setLanguage(e.target.value);
function persist({scheduleSync=true}={}) {
  try{
    writeLocalProgress(storageKey,state);storageOK=true;
    $("saveStatus").textContent=storageWarnings.has(storageKey)?"Recovery copy saved · damaged original preserved":
      cloud.user?"Draft saved · cloud sync queued":"Draft saved on this device";
  }catch{
    storageOK=false;$("saveStatus").textContent="Not saved · storage unavailable — export a backup";
  }
  // Surface unsynced local work on all ByteQuest pages, including Profile.
  if(cloud.user||!storageOK)cloud.onHealth?.({kind:storageOK?'pending':'storage-failed',localSaved:storageOK});
  if(scheduleSync&&accountReady&&cloud.user){clearTimeout(syncTimer);setSyncStatus("syncing",storageOK?"Changes saved here":"Local save failed · cloud sync queued");syncTimer=setTimeout(()=>syncCloud(),1800);}
  return storageOK;
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
// Ctrl+R runs the current code on the practice screen only. Preserve normal
// browser refresh on the library/other pages and when an input or dialog is active.
document.addEventListener("keydown",event=>{
  if(!shouldRunCodeShortcut(event,{
    practiceVisible:!$("practiceView").hidden,
    dialogOpen:Boolean(document.querySelector('dialog[open]'))
  }))return;
  event.preventDefault();
  if(busy){notify("A run is already in progress.");return;}
  run(false);
});
function renderPractice() {
  if(javaOnlyProblem(current)&&language!=="java"){language="java";try{localStorage.setItem("bytequest.language","java");}catch{}}
  for(const option of $("languageSelect").options)option.disabled=javaOnlyProblem(current)&&option.value!=="java";
  warmJavaSoon();
  pauseTrace();
  $("submitBtn").title=language==="java"?"Submit published Java tests on the server and unlock the Java answer when accepted. Private hidden cases require a separate judge.":"Submit to the online judge for a verified result.";$("languageSelect").value=language;$("languageSelect").disabled=busy;$("codeFilename").textContent=languages[language].file;$("editorProblemNumber").textContent="#"+String(problems.indexOf(current)+1).padStart(2,"0");$("runStatus").textContent=languages[language].name+(language==="java"?" · browser compiler":" · online via Wandbox");
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
function problemIllustrationMarkup(problem){
  const src=String(problem.illustration||"");
  if(!src||!(/^(?:\.\/assets\/problem-illustrations\/[a-z0-9-]+\.svg)$/.test(src)||/^https:\/\/[^\s<>"']+$/.test(src)))return "";
  const alt=problem.illustrationAlt||("Visual illustration for "+problem.title);
  const caption=problem.illustrationCaption||"";
  return '<figure class="problem-illustration"><img src="'+html(src)+'" alt="'+html(alt)+'" loading="lazy" decoding="async" referrerpolicy="no-referrer">'+(caption?'<figcaption>'+html(caption)+'</figcaption>':'')+'</figure>';
}
function renderLearning(){
  pauseTrace();creditEpoch++;
  document.querySelectorAll("[data-tab]").forEach(b=>{b.classList.toggle("active",b.dataset.tab===tab);b.setAttribute("aria-selected",String(b.dataset.tab===tab));});
  submissions.close();
  if(tab==="submissions"){submissions.mount($("learningContent"),current,language);return;}
  let content=timerHtml();
  if(tab==="problem"){
    content+='<div class="problem-heading"><p class="problem-eyebrow">Coding challenge</p><div class="problem-title-row"><h3>'+String(problems.indexOf(current)+1)+'. '+html(current.title)+'</h3><div class="problem-badges"><span class="problem-difficulty '+html(current.difficulty.toLowerCase())+'">'+html(current.difficulty)+'</span>'+(state.solved[current.id]?'<span class="problem-solved"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>Solved</span>':'')+'</div></div></div><div id="problemCredits" class="problem-credits"></div><div class="problem-statement-copy">'+html(current.description).split(/\n\n+/).map(paragraph=>'<p class="body-copy">'+paragraph+'</p>').join('')+'</div>'+problemIllustrationMarkup(current)+'<h4>Input</h4><p class="body-copy">'+html(current.inputGuide||current.params.map(p=>p.name+' ('+p.type+')').join(', '))+'</p><h4>Output</h4><p class="body-copy">'+html(current.outputGuide||('Return '+current.returns+' from '+current.method+'.'))+'</p><h4>Examples</h4>';
    current.tests.slice(0,2).forEach((c,i)=>{const explanation=Array.isArray(current.exampleExplanations)?String(current.exampleExplanations[i]||"").trim():"";content+='<div class="example-card"><div class="example-label">Example '+(i+1)+'</div><code>Input: <b>'+html(formatArgs(c.args))+'</b>\nOutput: <b>'+html(JSON.stringify(c.expected))+'</b></code>'+(explanation?'<div class="example-explanation"><strong>Explanation</strong><p>'+html(explanation)+'</p></div>':(c.label&&!/^Example \d+$/.test(c.label)?'<p>'+html(c.label)+'</p>':''))+'</div>';});
    content+='<h4>Constraints</h4><div class="constraints">'+html(current.constraints)+'</div><details class="concept-hint"><summary>Reveal the key concept</summary><p>'+html(current.topic)+(current.pattern&&current.pattern!==current.topic?' · '+html(current.pattern):'')+'</p></details>';
  } else if(tab==="learn"){
    content+='<span class="pattern-tag">EDITORIAL</span><h3>Approach</h3><p class="body-copy">'+html(current.idea)+'</p><div class="pattern-callout"><strong>Invariant</strong>'+html(current.invariant)+'</div><div class="complexity-row"><div class="complexity-box"><small>TIME</small><b>'+html(current.complexity.time)+'</b></div><div class="complexity-box"><small>EXTRA SPACE</small><b>'+html(current.complexity.space)+'</b></div></div><p class="tradeoff">'+html(current.complexity.tradeoff)+'</p>'+editorialSolutionGateMarkup(canCheckJavaReference(current))+'';
  } else {
    content+='<span class="pattern-tag">A LITTLE MOVING PICTURE</span><h3>Watch the idea click.</h3><p class="body-copy">A guided trace of the reference approach. Your code runs separately in the editor.</p><div id="traceBoard" class="trace-board"></div><p id="traceCaption" class="trace-caption"></p><div class="trace-controls"><button id="traceBack" aria-label="Previous animation step">←</button><button id="tracePlay" class="play-trace">▶ Play</button><button id="traceNext" aria-label="Next animation step">→</button><button id="traceReset" aria-label="Restart animation">↻</button><span id="traceCounter" class="trace-counter"></span></div><div class="code-note">Pause at any step. Say out loud: <i>“What do I know so far, and what changes next?”</i></div>';
  }
  if(tab==="learn")content+='<section class="language-guidance"><h4>'+html(languages[language].name)+' coding tips</h4><p>'+html(({java:'Use the provided method signature. HashMap and HashSet give expected O(1) lookup; use long when int can overflow.',python:'Keep the generated function and parameters. Return the result instead of printing or reading stdin. Use dict or set for lookup, enumerate for indexed iteration, and four spaces per indentation level.',c:'Keep the generated function signature. Check array lengths before indexing and free memory you allocate. Use long long for large sums.',cpp:'Keep the generated function signature. Return the result; do not add main or read stdin. Use std::vector, std::unordered_map and std::sort; prefer long long for large sums.'})[language])+'</p><small>Suggestions: Ctrl + Space · Accept: Tab · New line: auto-indent · Undo: Ctrl / ⌘ Z · Copy allowed · Paste disabled in the editor</small></section>';
  $("learningContent").innerHTML=content;
  if(tab==="problem")loadCredits(current,creditEpoch);
  if($("timerButton")){$("timerButton").onclick=toggleTimer;updateTimer();}
  if($("referenceBtn"))$("referenceBtn").onclick=async()=>{
    // A locally stored practice solve is only a UI hint. The verified
    // Firebase identity and accepted-submission row control actual access.
    if(!canCheckJavaReference(current)||!cloud.user)return;
    const selected=current,owner=cloud.user.id,ticket=creditEpoch;
    const button=$("referenceBtn"),output=$("referenceContent");
    button.disabled=true;button.textContent="Checking verified access…";
    output.textContent="Loading the private Java reference…";
    try{
      const result=await cloud.request("reference-read",{problemId:selected.id,revision:selected.revision},owner);
      if(current!==selected||creditEpoch!==ticket||tab!=="learn"||cloud.user?.id!==owner)return;
      if(typeof result.reference!=="string"||!result.reference||result.revision!==selected.revision)
        throw new Error("The private reference response is invalid.");
      referenceUsed=true;
      output.innerHTML='<p class="reference-reveal-note">Compare your verified solution with this reference.</p><pre class="reference-code">'+html(result.reference)+'</pre>';
      button.hidden=true;
    }catch(error){
      if(current!==selected||creditEpoch!==ticket||tab!=="learn"||cloud.user?.id!==owner)return;
      output.textContent=error?.message||"Reference unavailable. Retry after a verified accepted submission.";
      button.disabled=false;button.textContent="Retry verified reference";
    }
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
function setBusy(value){
 busy=value;
 $("runBtn").disabled=value;$("submitBtn").disabled=value;$("customBtn").disabled=value;
 $("stopBtn").hidden=!value;$("problemSelect").disabled=value;
 // Compilation uses a captured source snapshot. The account/progress API can
 // still be loading when users press Run. Never lock typing on either condition.
 $("codeEditor").readOnly=false;
 document.body.classList.toggle("busy",value);
}
function stopRun(message="Run stopped. Your draft is saved."){
  runEpoch++;clearTimeout(watchdog);judge.stop();setBusy(false);$("runStatus").textContent=languages[language].name+(language==="java"?" · browser compiler":" · online via Wandbox");$("resultOutput").textContent=message;
}
function rememberJavaSubmit(problem,source,status,passed,total,elapsedMs,customCount){
  try{
    const allowed=["practice_accepted","wrong_answer","compile_error","runtime_error","time_limit_exceeded","unavailable"];
    const entry=createPracticeSubmission({problem,source,status:allowed.includes(status)?status:"runtime_error",
      passed,total,elapsedMs,customCount});
    state.practiceSubmissions=addPracticeSubmission(state,entry);
    persist();submissions.refresh();
    return storageOK;
  }catch(error){
    notify("The result was shown, but the practice history could not be saved: "+error.message);
    return false;
  }
}
function openMySubmissions(output){
  const button=document.createElement("button");
  button.type="button";button.className="button secondary";
  button.textContent="View My submissions";
  button.onclick=()=>{tab="submissions";renderLearning();};
  output.append(button);
}
async function run(submit,{forceBrowser=false,sourceOverride=null}={}){
  if(busy||!current)return;
  if(!forceBrowser&&usesRemoteSubmit(language,Boolean(cloud.user),submit)){await submitOnline();return;}
  const epoch=++runEpoch,p=current,source=sourceOverride??codeTools.prepare();
  const cases=submit?browserSubmissionCases(p,customCases):allCases();
  setBusy(true);
  try{
    results=null;renderTests();$("resultOutput").textContent="Starting your code…";
    watchdog=setTimeout(()=>stopRun(language==="java"?"Java startup timed out. Check your connection and allow cjrtnc.leaningtech.com, then try again.":"Online compilation is taking longer than expected. Your code is saved; please try again shortly."),language==="java"?120000:language==='cpp'?90000:60000);
    const result=await judge.run(source,p,cases);
    if(epoch!==runEpoch)return;
    if(result.status!=="ok"){if(submit&&language==="java")rememberJavaSubmit(p,source,result.status,0,cases.length,result.elapsedMs??null,customCases.length);$("resultOutput").textContent=(result.code==="compiler_timeout"?"Compiler request timed out\n":result.status==="unavailable"?"Compiler temporarily unavailable\n":result.status==="compile_error"?"Compile error\n":"Runtime error\n")+result.message;if(submit){const feedback=submissionFeedback({...result,accepted:false});$("resultOutput").innerHTML=feedback.html;openMySubmissions($("resultOutput"));notify(feedback.announcement);}else notify(result.status==="compile_error"?"Compilation failed. Review the compiler output.":"Run failed. Review the test results.");if(result.status!=="unavailable")logAttempt(p,0,cases.length);return;}
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
    if(submit&&language==="java"){
      // Java Submit follows Run in the browser: no unavailable hosted compiler,
      // and no private-suite or server-benchmark claims for this practice solve.
      const verdict=browserSubmissionVerdict(p,passed,cases.length,customCases.length);
      const saved=rememberJavaSubmit(p,source,verdict.status,passed,cases.length,result.elapsedMs??null,customCases.length);
      if(!saved&&verdict.accepted){
        verdict.accepted=false;verdict.status="save_failed";
        verdict.message="All "+cases.length+" browser cases passed, but storage did not save the attempt. Your solve is NOT recorded. Export your work before leaving.";
      }else verdict.message+=saved?" Saved privately under My submissions.":" The attempt was not saved; export your backup.";
      const feedback=submissionFeedback(verdict);
      output.insertAdjacentHTML("afterbegin",feedback.html);
      openMySubmissions(output);
      notify(feedback.announcement);
      if(verdict.accepted&&saved)completeQuest(p,true);
    }else if(submit&&!accepted){
      const feedback=submissionFeedback({...result,accepted:false,status:"wrong_answer",passed,total:cases.length});
      output.innerHTML=feedback.html;notify(feedback.announcement);
    }else if(accepted&&submit&&p.hiddenCount){
      output.append(document.createTextNode(" Hidden cases require a server-verified Java submission. No non-Java acceptance was recorded."));
      notify("Private test acceptance currently supports Java only.");
    }else if(accepted&&submit)completeQuest(p);
    else if(accepted){
      const note=document.createElement("p");note.className="run-sample-note";
      note.textContent="Run passed. This is a test run, not a recorded solve. Choose Submit to save your solution and update your profile.";
      output.append(note);
      notify("Samples passed! Use Submit to record your solve.");
    }
  }catch(error){if(epoch===runEpoch){if(submit&&language==="java")rememberJavaSubmit(p,source,"runtime_error",0,cases.length,null,customCases.length);const message=language!=="java"&&error?.name==='TimeoutError'?"Compiler request timed out. Your code is saved. Please try again shortly.":String(error.message||error);$("resultOutput").textContent=message;notify(message);}}
  finally{if(epoch===runEpoch){clearTimeout(watchdog);setBusy(false);$("runStatus").textContent=languages[language].name+(language==="java"?" · browser compiler":" · online via Wandbox");updateStats();persist();}}
}
async function submitOnline(resume=null){
 const p=current,lang=language,source=resume?.source??codeTools.prepare(),user=cloud.user?.id,account=accountEpoch;
 if(resume&&(resume.problemId!==p?.id||resume.revision!==p.revision||resume.lang!==lang||resume.user!==user||resume.account!==account)){
  notify('Your code, problem or account changed. Start a new submission.');return;
 }
 // Choosing submission options is not a compiler run and must never lock the editor.
 let options;
 try{options=resume?.options??await requestSubmission({problem:p,language:languages[lang].name,allowPublicPractice:lang==='java'});}
 catch(error){notify(error?.message||'Could not open the submission dialog. Please try again.');return;}
 if(!options||current?.id!==p.id||language!==lang||cloud.user?.id!==user||account!==accountEpoch)return;
 // Explicit server-verified public-suite request, never hidden-test acceptance.
 const publicOnly=options.mode==='public-practice'||options.scope==='public';
 if(publicOnly&&(lang!=='java'||codeTools.prepare()!==source)){
  notify('Your code changed. Submit the new version instead.');return;
 }
 if(publicOnly&&options.mode==='public-practice'){
  options={...options,scope:'public',nonce:options.nonce||crypto.randomUUID(),shared:false};
  delete options.mode;
 }
 const epoch=++runEpoch;
 let browserFallback=false,verificationFailure="";
 setBusy(true);
 try{
  results=null;renderTests();$("resultOutput").textContent='Running and measuring your solution…';
  watchdog=setTimeout(()=>stopRun('The submission is taking longer than expected. Your code is saved. Check My submissions before retrying.'),lang==='cpp'?105000:70000);
  const result=await cloud.request('submission-create',{...options,problemId:p.id,revision:p.revision,source,language:lang},user);
  if(epoch!==runEpoch||account!==accountEpoch||cloud.user?.id!==user)return;
  if(lang==="java"&&result.status==="unavailable"){
   browserFallback=true;
   verificationFailure=String(result.message||"Both Java execution providers are unavailable. No accepted submission was recorded.");
  }else{
  if(result.status!=='unavailable')logAttempt(p,result.passed||0,result.total||p.tests.length);
  const output=$("resultOutput"),feedback=submissionFeedback(result);output.innerHTML=feedback.html;notify(feedback.announcement);output.tabIndex=-1;output.focus({preventScroll:true});output.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  if(result.accepted){const header=output.querySelector('.submission-verdict>header');const metrics=document.createElement('div');metrics.className='verdict-metrics';const runtime=document.createElement('span');runtime.textContent=runtimeLabel(result.runtimeMs??result.submission?.runtime_ms);const memory=document.createElement('span');memory.textContent=memoryLabel(result.memoryBytes??result.submission?.memory_bytes);metrics.append(runtime,memory);const link=document.createElement('button');link.className='verdict-link';link.textContent='View submissions';link.onclick=()=>{tab='submissions';renderLearning();};(header||output).append(metrics,link);
   serverAcceptedRevisions.add(user+':'+p.id+':'+p.revision);
   completeQuest(p,result.verificationScope==='public'&&Number(p.hiddenCount)>0?'public':false);
   if(tab==='submissions')submissions.refresh();
   const answer=document.createElement('button');answer.type='button';answer.className='verdict-link';
   answer.textContent='View unlocked Java answer';
   answer.onclick=()=>{if(current?.id!==p.id||cloud.user?.id!==user)return;
     tab='learn';renderLearning();$('referenceBtn')?.click();};
   (header||output).append(answer);}
  }
 }catch(e){
  if(epoch===runEpoch&&account===accountEpoch&&cloud.user?.id===user){
   if(lang==="java"&&(privateJavaJudgeUnavailable(e)||(publicOnly&&/unavailable|not connected|temporarily|timed out|network|failed to fetch/i.test(String(e?.message||''))))){
    browserFallback=true;
    verificationFailure=String(e?.message||(publicOnly?"Public server verification could not complete.":"The private Java judge is not configured for this problem."));
   }else{
    const text=e?.name==='TimeoutError'?'The submission request timed out. Your code is saved. Check My submissions before retrying.':e.message;
    const feedback=submissionFeedback({status:'error',message:text});
    $("resultOutput").innerHTML=feedback.html;notify(feedback.announcement+': '+text);$("resultOutput").scrollIntoView({block:'nearest'});
   }
  }
 }
 finally{
  if(epoch===runEpoch&&account===accountEpoch){clearTimeout(watchdog);setBusy(false);$("runStatus").textContent=languages[language].name+' · ready';persist();updateStats();}
 }
 if(browserFallback&&epoch===runEpoch&&account===accountEpoch&&cloud.user?.id===user&&current?.id===p.id&&language===lang){
  // Fail closed: a Submit request must never silently become a browser-only
  // practice acceptance. That previously made 30/30 public tests look like
  // successful execution of 70 private hidden cases.
  const summary=privateJudgeUnavailableSummary(p),output=$("resultOutput");
  const notice=document.createElement("section");notice.className="submission-verification-unavailable";
  const title=document.createElement("strong");title.textContent=publicOnly||!Number(p.hiddenCount)?"Public Java execution unavailable":summary.title;
  const counts=document.createElement("p");counts.textContent=Number(p.hiddenCount)>0?summary.hidden:"No server acceptance was recorded";
  const detail=document.createElement("p");detail.textContent=publicOnly||!Number(p.hiddenCount)?
   "Neither public Java runner completed verification. Your code remains saved. Browser-only practice cannot unlock the Java answer.":summary.explanation;
  const cause=document.createElement("p");cause.textContent=verificationFailure;
  const actions=document.createElement("div");actions.className="submission-verification-actions";
  const practice=document.createElement("button");practice.type="button";
  practice.className="button secondary";practice.textContent="Run public practice (not verified)";
  const retry=document.createElement("button");retry.type="button";
  retry.className="button secondary";retry.textContent=publicOnly?"Retry public verification":"Retry server verification";
  const publicSubmit=document.createElement("button");publicSubmit.type="button";
  publicSubmit.className="button primary";publicSubmit.textContent="Submit public tests instead";
  const unchanged=()=>current?.id===p.id&&language===lang&&accountEpoch===account&&
    cloud.user?.id===user&&codeTools.prepare()===source;
  practice.onclick=()=>{
    if(!unchanged()){notify("Your code or account changed. Submit the new version instead.");return;}
    void run(true,{forceBrowser:true,sourceOverride:source});
  };
  retry.onclick=()=>{
    if(!unchanged()){notify("Your code or account changed. Submit the new version instead.");return;}
    void submitOnline({problemId:p.id,revision:p.revision,lang,user,account,source,options});
  };
  // A learner who deliberately tried the full hidden suite can recover
  // directly without reopening the dialog or accidentally rerunning hidden cases.
  if(!publicOnly&&lang==="java"){
    publicSubmit.onclick=()=>{
      if(!unchanged()){notify("Your code or account changed. Submit the new version instead.");return;}
      void submitOnline({problemId:p.id,revision:p.revision,lang,user,account,source,
        options:{...options,scope:"public",shared:false,nonce:crypto.randomUUID()}});
    };
    actions.append(publicSubmit);
  }
  actions.append(practice,retry);
  notice.append(title,counts,detail,cause,actions);
  output.replaceChildren(notice);
  notify(publicOnly||!Number(p.hiddenCount)?"Public Java providers unavailable. Your code is saved; retry or use browser practice.":"Private verification unavailable. Your code is saved. No hidden-test acceptance was recorded.");
 }
}
function logAttempt(p,passed,total){
  state.attempts[p.id]=(state.attempts[p.id]||0)+1;
  state.activity.push({id:p.id,at:Date.now(),type:"attempt",passed,total});
  state.activity=state.activity.slice(-200);persist();updateStats();
}
function completeQuest(p,practice=false){
  const previous=structuredClone(state);
  const solvedDay=new Date().toISOString().slice(0,10);state.acceptedDays??=[];if(!state.acceptedDays.includes(solvedDay))state.acceptedDays.push(solvedDay);
  const first=!state.solved[p.id],isReview=!first&&due(p.id);
  if(first){state.solved[p.id]=Date.now();state.reviews[p.id]={anchor:Date.now(),step:0};}
  else if(isReview){state.reviews[p.id].step++;}
  if(first||isReview)state.activity.push({id:p.id,at:Date.now(),type:first?"solved":"review",passed:p.tests.length,total:p.tests.length});
  $("successTitle").textContent=first?"Aha! Quest complete.":isReview?"That pattern is sticking.":"Another good repetition.";
  $("successCopy").textContent=(first?"+"+pointsFor(p.difficulty)+" points! ":isReview?"Review complete! ":"")+p.title+(practice==='public'?" passed published public cases on the server. Hidden cases were NOT checked.":practice?" passed the browser practice cases. No server submission was recorded.":" passed the problem test suite.")+" "+(first?"Your first review is in 2 days.":isReview?"Review progress saved.":"Try explaining why your approach works.");
  $("successNote").value=state.notes[p.id]||"";
  document.querySelectorAll("[data-confidence]").forEach(b=>b.classList.toggle("selected",Number(b.dataset.confidence)===state.confidence[p.id]));
  if(!persist()){
    state=previous;
    updateStats();
    notify("Tests passed, but the solve was not saved. Export your work and retry.");
    return false;
  }
  updateStats();renderMap();if(tab==="learn"&&current.id===p.id)renderLearning();$("successDialog").showModal();celebrate();
  // Clear stale profile/leaderboard snapshots and flush a new accepted solve
  // immediately, rather than waiting for the debounced draft sync.
  if(accountReady&&cloud.user?.id===accountOwner){
   pendingProfileRefresh=true;
   communityCache.clearOwner(accountOwner);
   void syncCloud();
  }
  return true;
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
  current=target;state.current=id;state.currentUpdated=Date.now();customCases=[];selectedCase=0;results=null;tab="problem";referenceUsed=false;
  persist();
  // replaceState alone does not fire hashchange. Update the URL and route
  // explicitly so reload/back-to-this-page restores the same problem.
  try{history.replaceState(history.state,"",selectedProblemUrl(location.href,id));}
  catch{location.hash="practice";}
  renderPractice();route();
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
  if(view!=="practice"){pauseTrace();if(busy)stopRun();}if(view!=="studio")studio.stop();if(view==="studio")studio.open();if(view==="dashboard"){location.hash="map";return;}if(view==="map"){if(previousView!==null&&previousView!=="map")$("questGrid").scrollLeft=0;renderMap();}if(view==="progress")renderProgress();
  if(previousView!==null&&previousView!==view)window.scrollTo({top:0,left:0,behavior:"instant"});previousView=view;
}
addEventListener("hashchange",route);
$("patternFilter").replaceChildren(new Option("All problem patterns",""),...[...new Set(problems.map(p=>p.pattern||p.topic))].sort().map(v=>new Option(v,v)));
$("topicFilter").innerHTML+=[...topics].map(t=>'<option>'+html(t)+'</option>').join("");
["topicFilter","patternFilter","techniqueFilter","difficultyFilter","statusFilter"].forEach(id=>$(id).onchange=renderMap);
$("searchInput").oninput=renderMap;
$("clearProblemSearch").onclick=()=>{
  $("searchInput").value="";
  renderMap();
  $("searchInput").focus();
};
// Quick '/' search works only in the catalog, never in the code editor or dialogs.
document.addEventListener("keydown",event=>{
  const search=$("searchInput");
  if(event.key==="Escape"&&document.activeElement===search&&search.value){
    event.preventDefault();search.value="";renderMap();return;
  }
  if(event.key!=="/"||event.ctrlKey||event.metaKey||event.altKey||
     $("mapView").hidden||document.querySelector("dialog[open]")||
     event.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  event.preventDefault();search.focus();
});
function renderMap(){
  const pattern=$("patternFilter").value,technique=$("techniqueFilter").value;
  const query=$("searchInput").value.trim().toLowerCase(),topic=$("topicFilter").value,level=$("difficultyFilter").value,status=$("statusFilter").value;
  const list=problems.filter(p=>(p.title+" "+String(problems.indexOf(p)+1)).toLowerCase().includes(query)&&(!topic||p.topic===topic)&&(!pattern||(p.pattern||p.topic)===pattern)&&(!technique||(p.techniques||[]).includes(technique))&&(!level||p.difficulty===level)&&(!status||(status==="solved"?state.solved[p.id]:status==="new"?accountHistoryStatus==="ready"&&!state.solved[p.id]:due(p.id))));
  $("clearProblemSearch").hidden=!$("searchInput").value;
  $("visibleProblemCount").textContent=list.length===problems.length?"Showing all "+problems.length+" problems":"Showing "+list.length+" of "+problems.length+" problems";
  $("questGrid").innerHTML=list.length?'<table class="problem-table"><thead><tr><th>No.</th><th>Title</th><th>Companies</th><th>Difficulty</th><th>Status</th></tr></thead><tbody>'+list.map(p=>'<tr><td>'+String(problems.indexOf(p)+1).padStart(2,'0')+'</td><td><button class="problem-title" data-problem="'+p.id+'">'+html(p.title)+'</button></td><td>'+(companyIcons(p.companies)||'<span class="muted">—</span>')+'</td><td><span class="difficulty '+p.difficulty.toLowerCase()+'">'+html(p.difficulty)+'</span><small class="problem-points">'+pointsFor(p.difficulty)+' pts</small></td><td>'+ problemStatusMarkup(Boolean(state.solved[p.id]),{complete:accountHistoryStatus==="ready",failed:accountHistoryStatus==="failed"})+'</td></tr>').join('')+'</tbody></table><p class="company-note">Company tags are community-reported historical associations, not employer endorsements. <a href="https://github.com/duanehutchins/leetcode-questions-by-company" target="_blank" rel="noopener">Tag source</a></p>':'<p class="empty-state">No matching problems.</p>';
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
    state=reconcilePracticeProgress(mergeProgress(state,incoming));
    persist();updateStats();renderProgress();notify("Backup merged with your progress. Newer edits kept.");
  }catch(error){notify("Could not restore: "+error.message);}event.target.value="";
};
function setSyncStatus(kind,label){$("syncBadge").className="sync-badge "+kind;$("syncLabel").textContent=label;}
const progressAccountLabel=document.createElement("span");
progressAccountLabel.className="muted";
progressAccountLabel.id="catalogAccountProgress";
progressAccountLabel.setAttribute("role","status");
progressAccountLabel.setAttribute("aria-live","polite");
$("catalogSyncStatus").after(progressAccountLabel);
function showAccountProgress(label){progressAccountLabel.textContent=label;}
function refreshAccountUi(){
  shell.setAccount(cloud.user,publicProfile);
  shell.setAdmin(cloud.admin);
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
// Independent authenticated profile fallback. The profile RPC provides
// server-recorded problem IDs and solve timestamps (up to 25 recent solves).
// We use them only when the response certifies it belongs to this exact
// Firebase user's own public profile. Never use someone else's leaderboard.
async function restoreOwnProfileHistory(owner,epoch,ownerProfile){
  if(epoch!==accountEpoch||cloud.user?.id!==owner||
    typeof ownerProfile?.public_id!=="string"||!ownerProfile?.username)return false;
  try{
    const response=await cloud.request("profile",{target:ownerProfile.username},owner);
    if(epoch!==accountEpoch||cloud.user?.id!==owner)return false;
    const recovery=recoverOwnProfileSolves(state,response,ownerProfile.public_id);
    const own=response.isOwn===true&&response.profile?.public_id===ownerProfile.public_id;
    if(own){
      showAccountProgress("Account @"+ownerProfile.username+" · "+Number(response.stats?.solved||0)+" cloud-recorded solves");
      // Recent solves are capped at 25. Treat the own profile as complete only
      // when it accounts for all server-reported solves; otherwise keep unknown
      // problems in a non-misleading Checking state.
      const total=Number(response.stats?.solved);
      if(Number.isSafeInteger(total)&&total>=0&&
         Object.keys(recovery.state.solved||{}).length>=total&&
         (response.insights?.recentSolves?.length||0)>=Math.min(total,25)&&
         total<=25)accountHistoryStatus="ready";
    }
    if(!recovery.restored){renderMap();return false;}
    state=reconcilePracticeProgress(recovery.state);
    if(!persist({scheduleSync:false})){
      $("authMessage").textContent="Your older solves were found on the server but could not be backed up locally. Export a backup before leaving.";
    }
    pendingProfileRefresh=true;
    communityCache.clearOwner(owner);
    updateStats();renderMap();
    if(location.hash==="#progress")renderProgress();
    $("authMessage").textContent="Restored "+recovery.restored+" previously saved solve"+(recovery.restored===1?"":"s")+" from your own cloud profile. Syncing the complete account progress…";
    return true;
  }catch(error){
    if(epoch===accountEpoch&&cloud.user?.id===owner&&
      !Object.keys(state.solved).length){
      $("authMessage").textContent="Could not cross-check saved solves against your profile: "+String(error?.message||error)+". Your local drafts are unchanged.";
    }
    return false;
  }
}
// Read progress independently of writes. On a new phone the server may have
// accepted solves even if this device has never saved a local account snapshot.
// A failed upload must not hide data already successfully downloaded.
let progressRefreshInFlight=null,lastProgressRefreshAt=0;
async function refreshCloudProgress(owner=accountOwner,epoch=accountEpoch){
  if(!owner||!accountReady||cloud.user?.id!==owner||epoch!==accountEpoch)return false;
  if(progressRefreshInFlight)return progressRefreshInFlight;
  lastProgressRefreshAt=Date.now();
  const selectedProblem=current?.id,selectedLanguage=language;
  const selectedDraftKey=current?draftId():null;
  const editorAtRequest=$("codeEditor").value;
  const task=(async()=>{
    try{
      const remote=await cloud.request("progress",{},owner);
      if(epoch!==accountEpoch||cloud.user?.id!==owner)return false;
      const cloudState=validateProgress(remote.payload||blank());
      accountHistoryStatus="ready";
      showAccountProgress("Cloud history loaded · "+Object.keys(cloudState.solved).length+" saved solves");
      // Merge using the most recent in-memory edits, not a snapshot from before
      // the request. Never discard the code currently open in the editor.
      const recovered=reconcilePracticeProgress(mergeProgress(state,cloudState));
      const needsUpload=JSON.stringify(recovered)!==JSON.stringify(cloudState);
      const newlyRestored=Object.keys(recovered.solved).some(id=>!state.solved[id]);
      const hadUnsyncedEditorDraft=selectedDraftKey&&Object.hasOwn(state.drafts,selectedDraftKey);
      state=recovered;
      // An untouched starter on a new phone may receive the saved cloud code.
      // Never overwrite current code if the learner typed or switched problems
      // while the cloud request was in flight.
      if(selectedDraftKey&&!hadUnsyncedEditorDraft&&
         current?.id===selectedProblem&&language===selectedLanguage&&!busy&&
         $("codeEditor").value===editorAtRequest&&
         editorAtRequest===currentStarter()&&
         typeof state.drafts[selectedDraftKey]==="string"){
        $("codeEditor").value=state.drafts[selectedDraftKey];
        updateEditor();
      }
      if(newlyRestored)communityCache.clearOwner(owner);
      try{writeLocalProgress(storageKey,state);storageOK=true;}
      catch{storageOK=false;$("saveStatus").textContent="Cloud progress loaded · local backup unavailable";}
      updateStats();renderMap();
      if(tab==="problem"||tab==="learn")renderLearning();
      if(location.hash==="#progress")renderProgress();
      if(needsUpload){
        setSyncStatus("syncing","Cloud progress loaded · saving local changes");
        $("saveStatus").textContent=storageOK?"Cloud history restored · local changes awaiting sync":"Cloud history restored · local backup unavailable";
        clearTimeout(syncTimer);
        syncTimer=setTimeout(()=>{
          if(epoch===accountEpoch&&cloud.user?.id===owner)void syncCloud();
        },100);
      }else{
        setSyncStatus("synced","Cloud progress loaded");
        $("saveStatus").textContent=storageOK?"Cloud progress loaded on this device":"Cloud progress loaded · local backup unavailable";
        if(storageOK)cloud.onHealth?.({kind:"synced"});
      }
      return true;
    }catch(error){
      if(epoch!==accountEpoch||cloud.user?.id!==owner)return false;
      setSyncStatus("failed","Cloud progress could not load · retrying");
      if(accountHistoryStatus!=="ready")accountHistoryStatus="failed";
      renderMap();
      showAccountProgress("Account progress unavailable · solved ticks may be outdated");
      $("saveStatus").textContent="Your cloud history is not loaded on this device";
      $("authMessage").textContent="Cloud progress could not load: "+String(error?.message||error)+". Your local drafts have not been deleted.";
      cloud.onHealth?.({kind:"sync-failed",localSaved:storageOK});
      // A later save or foreground refresh retries without erasing local work.
      clearTimeout(syncTimer);
      syncTimer=setTimeout(()=>{
        if(epoch===accountEpoch&&cloud.user?.id===owner)void syncCloud();
      },10000);
      return false;
    }
  })();
  progressRefreshInFlight=task;
  try{return await task;}finally{if(progressRefreshInFlight===task)progressRefreshInFlight=null;}
}
async function changeAccount(user){
  const owner=user?.id||null;
  // The local account is ready as soon as its owner-scoped progress is read.
  // Remote account/profile/permissions requests must NEVER gate synchronization.
  if(owner===accountOwner&&accountReady)return;
  const previousOwner=accountOwner;
  const epoch=++accountEpoch;
  clearTimeout(communityWarmupTimer);
  if(previousOwner&&previousOwner!==owner)communityCache.clearOwner(previousOwner);
  publicProfile=null;
  pendingProfileRefresh=false;
  accountOwner=owner;
  accountHistoryStatus=owner?"loading":"ready";
  showAccountProgress(owner?"Checking your saved solves…":"Sign in to load your solved problems");
  accountReady=false;
  progressRefreshInFlight=null;
  lastProgressRefreshAt=0;
  clearTimeout(syncTimer);
  syncing=false;
  syncAgain=false;
  syncFailures=0;
  document.querySelectorAll('.submit-confirm[open],#successDialog[open]').forEach(d=>d.close());
  if(busy)stopRun();
  // Progress initialization is a critical path; optional Studio/dashboard
  // components must not be allowed to abort it. Studio has its own entrypoint.
  storageKey=owner?"bytequest.user."+owner:guestStorageKey;
  state=reconcilePracticeProgress(readLocal(storageKey));
  if(owner&&Object.keys(state.solved).length)pendingProfileRefresh=true;
  current=deepLinkedProblem()||problems.find(p=>p.id===state.current)||problems[0]||null;
  accountReady=true;
  // Do not attempt a cloud write with a blank local snapshot before fetching
  // the account's existing remote progress and merging it first.
  persist({scheduleSync:false});
  if(owner){
    clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>{
      if(epoch===accountEpoch&&cloud.user?.id===owner)void refreshCloudProgress(owner,epoch);
    },100);
  }
  try{dashboard.accountChanged();}
  catch(error){console.warn("ByteQuest: noncritical dashboard initialization failed",error);}
  try{
    renderPractice();
    $("codeEditor").readOnly=false;
    updateStats();
    refreshAccountUi();
    route();
  }catch(error){
    console.error("ByteQuest: account UI could not finish rendering",error);
    $("authMessage").textContent="Account UI needs attention, but your local drafts are preserved and cloud progress recovery is running: "+String(error?.message||error);
  }

  if(!owner){
    cloud.accessChecking=false;
    cloud.accessError=null;
    setSyncStatus("","On this device");
    return;
  }
  cloud.accessChecking=true;
  cloud.accessError=null;
  setSyncStatus("syncing","Preparing cloud sync");
  // Account metadata and creator permissions are optional, non-blocking UI.
  void cloud.checkAdmin(owner).then(()=>{
    if(epoch!==accountEpoch||cloud.user?.id!==owner)return;
    cloud.accessChecking=false;
    cloud.accessError=null;
    refreshAccountUi();
    if(document.body.dataset.page==="studio")route();
  }).catch(error=>{
    if(epoch!==accountEpoch||cloud.user?.id!==owner)return;
    cloud.accessChecking=false;
    cloud.accessError=error.message;
    cloud.admin=false;
    cloud.canCreate=false;
    refreshAccountUi();
    if(document.body.dataset.page==="studio")route();
  });
  void cloud.request("self",{},owner).then(value=>{
    if(epoch!==accountEpoch||cloud.user?.id!==owner)return;
    cloud.admin=value.admin===true;
    publicProfile=value.profile;
    communityCache.saveSelf(owner,value);
    refreshAccountUi();
    // This server-backed path restores accepted status even when the separate
    // account progress endpoint remains unavailable to the Problems page.
    void restoreOwnProfileHistory(owner,epoch,value.profile);
    scheduleCommunityWarmup(owner,publicProfile);
  }).catch(()=>{if(epoch===accountEpoch)cloud.admin=false;});
  // The first cloud read was already scheduled immediately after the
  // owner-scoped local progress became ready, before noncritical UI work.
}

async function syncCloud(){
  clearTimeout(syncTimer);
  if(!cloud.user){
    setSyncStatus("failed","Sign in to sync");
    $("authMessage").textContent="Sign in with Google before syncing. Local drafts remain on this device.";
    return false;
  }
  if(!accountReady){
    // Repair a boot interrupted by a nonessential UI failure. A valid Firebase
    // owner has enough information to restore owner-local progress immediately.
    try{await changeAccount(cloud.user);}
    catch(error){
      console.error("ByteQuest: account bootstrap recovery failed",error);
      $("authMessage").textContent="Account setup failed: "+String(error?.message||error)+". Your saved drafts are preserved; export a backup before reloading.";
    }
    if(!accountReady){
      setSyncStatus("failed","Account setup could not complete");
      if(!$("authMessage").textContent)$("authMessage").textContent="Could not initialize account progress. Your local drafts have not been removed; export a backup.";
      return false;
    }
  }
  if(syncing){
    syncAgain=true;
    setSyncStatus("syncing","Save in progress · another queued");
    $("authMessage").textContent="A cloud save is already in progress. Another sync has been queued; your local progress remains untouched.";
    return false;
  }
  if(!navigator.onLine){
    setSyncStatus("failed","Offline · saved here");
    $("authMessage").textContent="You appear offline. Cloud sync was not attempted; reconnect and retry. Your drafts are kept on this device.";
    return false;
  }
  const owner=cloud.user.id,epoch=accountEpoch,snapshot=JSON.stringify(state);syncing=true;setSyncStatus("syncing","Syncing progress");
  try{
    const merged=await cloud.syncProgress(owner,JSON.parse(snapshot),mergeProgress);if(epoch!==accountEpoch||cloud.user?.id!==owner)return;
    const changedWhileSaving=JSON.stringify(state)!==snapshot;state=reconcilePracticeProgress(mergeProgress(state,merged));
    accountHistoryStatus="ready";
    try{writeLocalProgress(storageKey,state);storageOK=true;}
    catch{storageOK=false;$("saveStatus").textContent="Saved to cloud · local cache unavailable";}
    // Never overwrite or remount the active code editor when background sync
    // finishes. Runs and submissions deliberately use source snapshots.
    syncFailures=0;
    // Cloud merges can restore accepted solves from another tab or device.
    // Refresh the catalog's solved ticks and editorial gate without remounting
    // the code editor or navigating away from the selected problem.
    updateStats();renderMap();
    if(tab==="problem"||tab==="learn")renderLearning();
    if(location.hash==="#progress")renderProgress();
    $("saveStatus").textContent=!storageOK?"Cloud synced · local cache unavailable":
      changedWhileSaving?"New edits saved here · sync queued":"Draft saved to your account";
    setSyncStatus("synced",changedWhileSaving?"New changes queued":"Saved to cloud");$("authMessage").textContent="";
    if(pendingProfileRefresh){communityCache.clearOwner(owner);pendingProfileRefresh=false;}
    if(changedWhileSaving)syncAgain=true;
    cloud.onHealth?.({kind:changedWhileSaving?'pending':'synced',localSaved:storageOK});
    return !changedWhileSaving;
  }catch(error){if(epoch===accountEpoch){
    cloud.onHealth?.({kind:'sync-failed',localSaved:storageOK});
    syncFailures++;
    setSyncStatus("failed","Cloud sync failed · retrying");
    $("saveStatus").textContent="Saved on this device · cloud sync not confirmed";
    $("authMessage").textContent=error.message;
    if(navigator.onLine&&cloud.user?.id===owner){
      const backoff=Math.min(60000,10000*Math.pow(2,Math.min(syncFailures-1,3)));
      syncTimer=setTimeout(()=>{if(epoch===accountEpoch)void syncCloud();},backoff);
    }
  }return false;}
  finally{if(epoch===accountEpoch){syncing=false;if(syncAgain){syncAgain=false;syncTimer=setTimeout(()=>syncCloud(),1000);}}}
}
// Public catalog loading must never depend on Firebase sign-in or profile requests.
// Start with the cached library for instant paint, then revalidate in the background.
let lastCatalogRevalidation=0;
async function refreshCatalog({force=false}={}){
  const status=$("catalogSyncStatus"),button=$("refreshProblemCatalog");
  if(!cloud.enabled){
    status.textContent="Catalog connection is not configured";
    status.dataset.state="error";
    return false;
  }
  if(force){button.disabled=true;status.textContent="Updating problem library…";status.dataset.state="loading";}
  try{
    const next=await cloud.publicCatalog({force});
    if(!Array.isArray(next)||!next.length)throw new Error("The public catalog was empty.");
    // Before the remote catalog loads, current may be the bundled Two Sum
    // placeholder. Prefer the deep link or saved problem rather than losing it.
    const selected=new URLSearchParams(location.search).get('problem')||state.current||current?.id;
    problems.splice(0,problems.length,...next);
    topics=[...new Set(problems.map(p=>p.topic))];
    $("problemSelect").replaceChildren(...problems.map(p=>new Option(p.title,p.id)));
    for(const [id,values,label] of [["patternFilter",[...new Set(problems.map(p=>p.pattern||p.topic))],"All problem patterns"],["techniqueFilter",[...new Set(problems.flatMap(p=>p.techniques||[]))],"All techniques"]]){
      const selected=$(id).value;
      $(id).replaceChildren(new Option(label,""),...values.sort().map(v=>new Option(v,v)));
      if(values.includes(selected))$(id).value=selected;
    }
    const oldTopic=$("topicFilter").value;
    $("topicFilter").replaceChildren(new Option("All patterns",""),...topics.map(t=>new Option(t,t)));
    if(topics.includes(oldTopic))$("topicFilter").value=oldTopic;
    current=problems.find(p=>p.id===selected)||problems.find(p=>p.id===current?.id)||problems[0]||null;
    if(current&&location.hash==='#practice'&&new URLSearchParams(location.search).get('problem')!==current.id){
      try{history.replaceState(history.state,'',selectedProblemUrl(location.href,current.id));}catch{}
    }
    renderPractice();updateStats();route();
    status.textContent=force?"Published catalog updated":"Problem catalog loaded";
    status.dataset.state="ready";
    return true;
  }catch(error){
    // Keep the last working catalog, even when the public endpoint is offline.
    console.warn("ByteQuest: published catalog refresh failed",error);
    status.textContent="Showing saved problems · Refresh to retry";
    status.dataset.state="error";
    return false;
  }finally{
    if(force)button.disabled=false;
  }
}
function revalidateCatalog({manual=false}={}){
  if(!cloud.enabled)return Promise.resolve(false);
  const now=Date.now();
  if(!manual&&now-lastCatalogRevalidation<60000)return Promise.resolve(false);
  lastCatalogRevalidation=now;
  return refreshCatalog({force:true});
}
$("refreshProblemCatalog").onclick=()=>{void revalidateCatalog({manual:true});};
document.addEventListener("visibilitychange",()=>{if(!document.hidden)void revalidateCatalog();});
window.addEventListener("focus",()=>{if(!document.hidden)void revalidateCatalog();});
function openAccount(){refreshAccountUi();$("accountDialog").showModal();}
$("accountBtn").onclick=openAccount;$("profileBtn").onclick=()=>{location.href="./community.html#me";};$("syncBadge").onclick=openAccount;
async function signInWithGoogle(button){
 if(!cloud.loginReady){$("authMessage").textContent="Google sign-in is still connecting. Please retry once the account is ready.";return;}
 button.disabled=true;
 try{
   $("authMessage").textContent="Opening Google sign-in…";
   await cloud.signIn();cloud.loginError=null;$("authMessage").textContent="";
   if($("accountDialog").open)$("accountDialog").close();
 }catch(error){
   $("authMessage").textContent=error.message;
   if(document.body.dataset.page==="studio"){cloud.loginError=error.message;route();}
 }finally{button.disabled=false;}
}
$("googleSignInBtn").onclick=()=>signInWithGoogle($("googleSignInBtn"));
let studioAuthBusy=false;
$("studioSignIn").onclick=async()=>{
 if(studioAuthBusy)return;
 studioAuthBusy=true;const button=$("studioSignIn");button.disabled=true;
 try{
   if(!cloud.loginReady){
     // Retry restoring the SAME persisted Firebase identity. No new account.
     cloud.loginError=null;route();
     await cloud.init();cloud.loginError=null;
     refreshAccountUi();await changeAccount(cloud.user);
     // A signed-out session can now use the regular Google button on the next click.
   }else if(cloud.user){
     // Retry only the creator permission check; never ask to sign in twice.
     const owner=cloud.user.id;cloud.accessChecking=true;cloud.accessError=null;route();
     try{await cloud.checkAdmin(owner);if(cloud.user?.id===owner)cloud.accessError=null;}
     catch(error){if(cloud.user?.id===owner){cloud.accessError=error.message;cloud.admin=false;cloud.canCreate=false;}}
     finally{cloud.accessChecking=false;refreshAccountUi();}
   }else await signInWithGoogle(button);
 }catch(error){cloud.loginError=error.message;$("authMessage").textContent=error.message;}
 finally{button.disabled=false;studioAuthBusy=false;route();}
};
$("syncNowBtn").onclick=async()=>{
  const button=$("syncNowBtn"),status=$("authMessage");
  if(button.disabled)return;
  button.disabled=true;button.textContent="Syncing…";
  const working="Checking the cloud connection and saving your existing progress…";
  status.textContent=working;
  try{
    const confirmed=await syncCloud();
    if(confirmed){
      const message="Progress saved to cloud at "+new Date().toLocaleTimeString()+". Check your profile for the latest recorded solves.";
      status.textContent=message;notify("Cloud sync confirmed.");
    }else if(status.textContent===working){
      status.textContent="Cloud save is not yet confirmed. Keep this tab open and preserve your backup; see the sync indicator for details.";
    }
  }catch(error){
    const message="Cloud sync failed: "+String(error?.message||error||"Unknown error");
    status.textContent=message;
    setSyncStatus("failed","Cloud sync failed");
  }finally{
    button.disabled=false;button.textContent="Sync now";
  }
};
$("signOutBtn").onclick=async()=>{
 const button=$("signOutBtn");if(button.disabled)return;button.disabled=true;
 try{
   const synced=await syncCloud();
   if(!synced){
     const message="Your latest changes are not confirmed in the cloud. They remain on this device only. Sign out anyway?";
     $("authMessage").textContent="Cloud sync did not finish. Local work will remain on this device if you sign out.";
     if(!window.confirm(message))return;
   }
   await cloud.signOut();$("accountDialog").close();await changeAccount(null);
   notify(synced?"Signed out. Your latest progress was confirmed in the cloud.":
     "Signed out. Unsynced work remains on this device; sign back in here to retry syncing.");
 }catch(error){$("authMessage").textContent=error.message;}
 finally{button.disabled=false;}
};
$("importGuestBtn").onclick=()=>{if(!cloud.user)return;state=reconcilePracticeProgress(mergeProgress(state,readLocal(guestStorageKey)));persist();renderPractice();updateStats();notify("Guest progress added to this account. Cloud sync queued.");};
function recheckCloudProgress(){
  if(!accountReady||!cloud.user||busy||Date.now()-lastProgressRefreshAt<30000)return;
  void refreshCloudProgress(cloud.user.id,accountEpoch);
}
addEventListener("online",()=>{
  if(cloud.user)void refreshCloudProgress(cloud.user.id,accountEpoch);
  else setSyncStatus("","On this device");
});
addEventListener("focus",recheckCloudProgress);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)recheckCloudProgress();});
addEventListener("offline",()=>setSyncStatus("failed",cloud.user?"Offline · saved here":"On this device"));
async function bootCloud(){
  refreshAccountUi();
  // Public problems require no login. Do NOT wait for Firebase restoration,
  // account progress, creator permissions or profile responses to load them.
  const hadCachedCatalog=Boolean(cloud.readCatalogCache());
  const catalogLoading=refreshCatalog();
  if(hadCachedCatalog){
    // An old cached 16-problem catalog must not masquerade as the full library.
    void catalogLoading.then(()=>revalidateCatalog());
  }else{
    lastCatalogRevalidation=Date.now();
  }
  try{
    await cloud.init();cloud.loginError=null;$("authMessage").textContent="";
  }catch(error){
    cloud.loginError=error.message;$("authMessage").textContent=error.message;
    accountHistoryStatus="failed";renderMap();
    setSyncStatus("failed","Account connection paused");
  }
  // Firebase remains the source of truth for account data only.
  refreshAccountUi();
  if(document.body.dataset.page==="studio")route();
  await changeAccount(cloud.user);
  if(document.body.dataset.page!=="studio"){
    await catalogLoading;
    const requested=new URLSearchParams(location.search).get("problem");
    if(requested&&problems.some(p=>p.id===requested))changeProblem(requested);
  }
}
renderPractice();updateStats();route();bootCloud();
if(!storageOK){$("saveStatus").textContent="Storage unavailable — use Save progress";notify("Local storage is unavailable. Export your progress before leaving.");}


