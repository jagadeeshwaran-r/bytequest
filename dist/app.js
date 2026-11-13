import {problems, topics} from "./problems.js";
import {JavaJudge, buildTests} from "./judge.js";
import {traceFor} from "./traces.js";
const $ = id => document.getElementById(id);
const html = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const icon = name => '<svg aria-hidden="true"><use href="#i-' + name + '"/></svg>';
const storageKey = "bytequest.v1";
const blank = () => ({version:1,current:"two-sum",drafts:{},solved:{},notes:{},confidence:{},activity:[],days:[],reviews:{},attempts:{}});
let state = blank(), storageOK = true;
try { const saved = JSON.parse(localStorage.getItem(storageKey)); if (saved) state = validateBackup(saved); } catch { storageOK = false; }
function validateBackup(value) {
  if (!value || value.version !== 1 || typeof value !== "object") throw new Error("This is not a ByteQuest v1 backup.");
  const clean = blank();
  for (const p of problems) {
    if (typeof value.drafts?.[p.id] === "string" && value.drafts[p.id].length <= 60000) clean.drafts[p.id] = value.drafts[p.id];
    if (typeof value.notes?.[p.id] === "string") clean.notes[p.id] = value.notes[p.id].slice(0,4000);
    if ([1,2,3].includes(value.confidence?.[p.id])) clean.confidence[p.id] = value.confidence[p.id];
    if (Number.isFinite(value.solved?.[p.id]) && value.solved[p.id] > 0) clean.solved[p.id] = value.solved[p.id];
    const r = value.reviews?.[p.id];
    if (r && Number.isFinite(r.anchor) && Number.isInteger(r.step) && r.step >= 0 && r.step <= 3) clean.reviews[p.id] = {anchor:r.anchor,step:r.step};
    const tries = value.attempts?.[p.id];
    if (Number.isInteger(tries) && tries >= 0 && tries <= 100000) clean.attempts[p.id] = tries;
  }
  clean.activity = Array.isArray(value.activity) ? value.activity.filter(a => a && problems.some(p=>p.id===a.id) && Number.isFinite(a.at) && ["attempt","solved","review"].includes(a.type)).slice(-200).map(a=>({id:a.id,at:a.at,type:a.type,passed:Math.max(0,Number(a.passed)||0),total:Math.max(0,Number(a.total)||0)})) : [];
  clean.days = Array.isArray(value.days) ? [...new Set(value.days.filter(d=>typeof d==="string" && /^\d{4}-\d{2}-\d{2}$/.test(d)))].slice(-1000) : [];
  if (problems.some(p=>p.id===value.current)) clean.current=value.current;
  return clean;
}
let current = problems.find(p => p.id === state.current) || problems[0];
let tab = "problem", mode = "learn", hints = 0, selectedCase = 0, customCases = [], results = null;
let busy = false, runEpoch = 0, watchdog, toastTimer, traceTimer, traceStep = 0;
let timerStarted = null, timerUsed = 0, timerProblem = current.id, timerTick;
let referenceUsed = false;
const reviewDays = [2,7,21];
const topicEmoji = {"Hash maps":"🗂️","Strings":"🔤","Binary search":"🔎","Two pointers":"👉","Arrays":"🌿","Sliding window":"🪟","Stacks":"🧱","Dynamic programming":"🌱","Math":"✳️"};
const judge = new JavaJudge(message => {
  $("runStatus").textContent = message;
  if (message.startsWith("Compiling")) {
    clearTimeout(watchdog);
    watchdog=setTimeout(()=>stopRun("The run reached its 30-second limit. Try a smaller input or check for an infinite loop."),30000);
  }
});
function persist() {
  try { localStorage.setItem(storageKey,JSON.stringify(state)); storageOK=true; $("saveStatus").textContent="Draft saved on this device"; }
  catch { storageOK=false; $("saveStatus").textContent="Storage full or unavailable — export a backup"; }
}
function notify(message) { clearTimeout(toastTimer); $("toast").textContent=message; $("toast").classList.add("show"); toastTimer=setTimeout(()=>$("toast").classList.remove("show"),4000); }
function dateKey(date = new Date()) { return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0"); }
function addDay() { const day=dateKey(); if(!state.days.includes(day))state.days.push(day); }
function streak() {
  const dates=new Set(state.days); const d=new Date();
  if(!dates.has(dateKey(d)))d.setDate(d.getDate()-1);
  let count=0; while(dates.has(dateKey(d))){count++;d.setDate(d.getDate()-1);} return count;
}
function xp() { return Object.keys(state.solved).length*100 + Object.values(state.reviews).reduce((sum,r)=>sum+r.step*20,0); }
function dueTime(id) { const r=state.reviews[id]; if(!r||r.step>=3)return Infinity; return r.anchor+reviewDays[r.step]*86400000; }
function due(id) { return dueTime(id)<=Date.now(); }
function updateStats() { $("solvedCount").textContent=Object.keys(state.solved).length; $("xpCount").textContent=xp(); $("streak").textContent=streak(); $("level").textContent=1+Math.floor(xp()/300); }
function highlight(source) {
  const regex=/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(import|class|public|private|static|return|throw|new|for|while|if|else|int|boolean|void|true|false|null|long|double|char|continue|break|final|try|catch)\b|\b(String|Solution|Map|HashMap|Set|HashSet|Deque|ArrayDeque|Integer|Math|Arrays|Character|UnsupportedOperationException)\b|\b(\d+)\b/g;
  let out="", last=0;
  for(const m of source.matchAll(regex)) { out+=html(source.slice(last,m.index)); const type=m[1]?"comment":m[2]?"string":m[3]?"keyword":m[4]?"type":"number"; out+='<span class="tok-'+type+'">'+html(m[0])+"</span>"; last=m.index+m[0].length; }
  return out+html(source.slice(last))+"\n";
}
function updateEditor() { $("codeHighlight").firstElementChild.innerHTML=highlight($("codeEditor").value); $("lineNumbers").textContent=$("codeEditor").value.split("\n").map((_,i)=>i+1).join("\n"); syncScroll(); }
function syncScroll(){ $("codeHighlight").scrollTop=$("codeEditor").scrollTop; $("codeHighlight").scrollLeft=$("codeEditor").scrollLeft; $("lineNumbers").scrollTop=$("codeEditor").scrollTop; }
function saveDraft(){state.drafts[current.id]=$("codeEditor").value;persist();updateEditor();if(results){results=null;renderTests();$("resultOutput").replaceChildren();}}
$("codeEditor").addEventListener("input",saveDraft);
$("codeEditor").addEventListener("scroll",syncScroll);
$("codeEditor").addEventListener("keydown",event=>{
  if(event.key==="Tab"){event.preventDefault();const e=event.target;const start=e.selectionStart,end=e.selectionEnd;e.setRangeText("    ",start,end,"end");saveDraft();}
  if((event.ctrlKey||event.metaKey)&&event.key==="Enter"){event.preventDefault();run(false);}
});
function renderPractice() {
  pauseTrace();
  $("questTitle").textContent=current.title; $("questTopic").textContent=current.topic;
  $("questNumber").textContent=String(problems.indexOf(current)+1).padStart(2,"0");
  $("difficulty").textContent=current.difficulty; $("difficulty").className="difficulty"+(current.difficulty==="Medium"?" medium":"");
  $("questMinutes").textContent=current.difficulty==="Easy"?"15–25 min":"25–35 min";
  $("problemSelect").value=current.id;
  $("learnMode").classList.toggle("active",mode==="learn"); $("challengeMode").classList.toggle("active",mode==="challenge");
  $("codeEditor").value=state.drafts[current.id]??current.starter; updateEditor();
  $("hintText").textContent="Stuck? Take one small hint."; hints=0;
  $("hintBtn").textContent="Get a hint ↗"; $("hintBtn").disabled=false;
  renderLearning(); renderTests();
  $("resultOutput").replaceChildren();
}
function timerHtml() { return mode==="challenge"?'<div class="timer">'+icon("clock")+'<span id="timerDisplay" class="stopwatch-text">20:00</span><span>optional focus timer</span><button id="timerButton">Start</button></div>':""; }
function renderLearning(){
  pauseTrace();
  document.querySelectorAll("[data-tab]").forEach(b=>{b.classList.toggle("active",b.dataset.tab===tab);b.setAttribute("aria-selected",String(b.dataset.tab===tab));});
  let content=timerHtml();
  if(tab==="problem"){
    content+='<span class="pattern-tag">'+html(current.topic)+'</span><h3>'+html(current.title)+'</h3><p class="body-copy">'+html(current.description)+'</p><h4>Let’s make it concrete <span>↙</span></h4>';
    current.tests.slice(0,2).forEach((c,i)=>{content+='<div class="example-card"><code>Input: <b>'+html(formatArgs(c.args))+'</b>\nOutput: <b>'+html(JSON.stringify(c.expected))+'</b></code><p>'+html(c.label)+'</p></div>';});
    content+='<h4>A few ground rules</h4><div class="constraints">'+html(current.constraints)+'</div>';
  } else if(tab==="learn"){
    content+='<span class="pattern-tag">THE '+html(current.topic.toUpperCase())+' PATTERN</span><h3>Find the idea first.</h3><p class="body-copy">'+html(current.idea)+'</p><div class="pattern-callout"><strong>The thing that stays true</strong>'+html(current.invariant)+'</div><div class="complexity-row"><div class="complexity-box"><small>TIME</small><b>'+html(current.complexity.time)+'</b></div><div class="complexity-box"><small>EXTRA SPACE</small><b>'+html(current.complexity.space)+'</b></div></div><p class="tradeoff">'+html(current.complexity.tradeoff)+'</p><button id="referenceBtn" class="reference-button">Peek at the Java walkthrough ↗</button><div id="referenceContent"></div>';
  } else {
    content+='<span class="pattern-tag">A LITTLE MOVING PICTURE</span><h3>Watch the idea click.</h3><p class="body-copy">A guided trace of the reference approach. Your code runs separately in the editor.</p><div id="traceBoard" class="trace-board"></div><p id="traceCaption" class="trace-caption"></p><div class="trace-controls"><button id="traceBack" aria-label="Previous animation step">←</button><button id="tracePlay" class="play-trace">▶ Play</button><button id="traceNext" aria-label="Next animation step">→</button><button id="traceReset" aria-label="Restart animation">↻</button><span id="traceCounter" class="trace-counter"></span></div><div class="code-note">Pause at any step. Say out loud: <i>“What do I know so far, and what changes next?”</i></div>';
  }
  $("learningContent").innerHTML=content;
  if($("timerButton")){$("timerButton").onclick=toggleTimer;updateTimer();}
  if($("referenceBtn"))$("referenceBtn").onclick=()=>{
    referenceUsed=true;
    $("referenceContent").innerHTML='<p class="reference-reveal-note">Trace the idea, then close this and try it yourself.</p><pre class="reference-code">'+html(current.reference)+'</pre><button id="copyReference" class="reference-button">Try this code in the editor</button>';
    $("referenceBtn").hidden=true;
    $("copyReference").onclick=()=>{state.drafts[current.id]=current.reference;$("codeEditor").value=current.reference;persist();updateEditor();notify("Walkthrough loaded. Try changing one line and predict what happens.");};
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
function renderTrace(){
  const frames=traceFor(current), f=frames[traceStep];
  if(!$("traceBoard"))return;
  $("traceBoard").innerHTML='<div class="trace-cells">'+f.values.map((v,i)=>'<span class="trace-cell'+(f.active.includes(i)?" active":"")+(f.found.includes(i)?" found":"")+(f.dim.includes(i)?" dim":"")+'">'+html(v)+'<small>'+i+'</small></span>').join("")+'</div><div class="trace-note">'+html(f.note)+'</div>';
  $("traceCaption").textContent=f.message;$("traceCounter").textContent=(traceStep+1)+" / "+frames.length;
  $("traceBack").disabled=traceStep===0;$("traceNext").disabled=traceStep===frames.length-1;
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
function setBusy(value){busy=value;$("runBtn").disabled=value;$("submitBtn").disabled=value;$("customBtn").disabled=value;$("stopBtn").hidden=!value;$("problemSelect").disabled=value;$("codeEditor").readOnly=value;document.body.classList.toggle("busy",value);}
function stopRun(message="Run stopped. Your draft is saved."){
  runEpoch++;clearTimeout(watchdog);judge.stop();setBusy(false);$("runStatus").textContent="Real Java. Right here.";$("resultOutput").textContent=message;
}
async function run(submit){
  if(busy)return;
  const epoch=++runEpoch,p=current,source=$("codeEditor").value;
  const cases=submit?[...p.tests,...customCases]:allCases();
  setBusy(true);results=null;renderTests();$("resultOutput").textContent="Starting a real Java run…";
  watchdog=setTimeout(()=>stopRun("Java startup timed out. Check your connection and allow cjrtnc.leaningtech.com, then try again."),120000);
  try{
    const result=await judge.run(source,p,cases);
    if(epoch!==runEpoch)return;
    if(result.status!=="ok"){$("resultOutput").textContent=(result.status==="compile_error"?"Compile error\n":"Runtime error\n")+result.message;logAttempt(p,0,cases.length);return;}
    results={...result,cases:submit?[...result.cases.slice(0,2),...result.cases.slice(p.tests.length)]:result.cases};
    renderTests();
    const passed=result.cases.filter(c=>c.passed).length, accepted=passed===cases.length;
    const output=$("resultOutput");output.replaceChildren();
    const summary=document.createElement("div");summary.className="result-summary"+(accepted?"":" failed");summary.textContent=(accepted?"✓ ":"↻ ")+passed+" / "+cases.length+" cases passed · "+result.elapsedMs+" ms local execution";output.append(summary);
    result.cases.filter(c=>!c.passed).slice(0,5).forEach(c=>{
      const detail=document.createElement("div");detail.textContent=c.name+"\nExpected: "+c.expected+"\nYour output: "+c.actual+"\n";output.append(detail);
    });
    if(result.stdout){const stdout=document.createElement("div");stdout.className="stdout";stdout.textContent="Console\n"+result.stdout;output.append(stdout);}
    logAttempt(p,passed,cases.length);
    if(accepted&&submit)completeQuest(p);
    else if(accepted)notify("Samples passed! Submit quest to check every built-in edge case.");
  }catch(error){if(epoch===runEpoch)$("resultOutput").textContent=String(error.message||error);}
  finally{if(epoch===runEpoch){clearTimeout(watchdog);setBusy(false);$("runStatus").textContent="Real Java. Right here.";updateStats();persist();}}
}
function logAttempt(p,passed,total){
  state.attempts[p.id]=(state.attempts[p.id]||0)+1;
  state.activity.push({id:p.id,at:Date.now(),type:"attempt",passed,total});
  state.activity=state.activity.slice(-200);addDay();persist();updateStats();
}
function completeQuest(p){
  const first=!state.solved[p.id],isReview=!first&&due(p.id);
  if(first){state.solved[p.id]=Date.now();state.reviews[p.id]={anchor:Date.now(),step:0};}
  else if(isReview){state.reviews[p.id].step++;}
  if(first||isReview)state.activity.push({id:p.id,at:Date.now(),type:first?"solved":"review",passed:p.tests.length,total:p.tests.length});
  $("successTitle").textContent=first?"Aha! Quest complete.":isReview?"That pattern is sticking.":"Another good repetition.";
  $("successCopy").textContent=(first?"+100 XP! ":isReview?"+20 review XP! ":"")+p.title+" passed all built-in cases and your custom checks. "+(first?"Your first review is in 2 days.":isReview?"Review progress saved.":"Try explaining why your approach works.");
  $("successNote").value=state.notes[p.id]||"";
  document.querySelectorAll("[data-confidence]").forEach(b=>b.classList.toggle("selected",Number(b.dataset.confidence)===state.confidence[p.id]));
  persist();updateStats();$("successDialog").showModal();celebrate();
}
function celebrate(){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const colors=["#a58ace","#c9dba7","#e6c682","#e4b8c6"];
  $("confetti").innerHTML=Array.from({length:30},(_,i)=>'<i style="left:'+Math.random()*100+'%;background:'+colors[i%4]+';animation-delay:'+Math.random()*.6+'s;transform:rotate('+Math.random()*180+'deg)"></i>').join("");
  setTimeout(()=>$("confetti").replaceChildren(),3800);
}
$("successNote").addEventListener("input",()=>{state.notes[current.id]=$("successNote").value.slice(0,4000);persist();});
document.querySelectorAll("[data-confidence]").forEach(b=>b.onclick=()=>{state.confidence[current.id]=Number(b.dataset.confidence);document.querySelectorAll("[data-confidence]").forEach(x=>x.classList.toggle("selected",x===b));persist();});
$("runBtn").onclick=()=>run(false);$("submitBtn").onclick=()=>run(true);$("stopBtn").onclick=()=>stopRun();
$("problemSelect").innerHTML=problems.map(p=>'<option value="'+p.id+'">'+html(p.title)+'</option>').join("");
$("problemSelect").onchange=e=>changeProblem(e.target.value);
function changeProblem(id){
  const target=problems.find(p=>p.id===id);if(!target)return;
  if(busy)stopRun();pauseTrace();clearInterval(timerTick);timerUsed=0;timerStarted=null;timerProblem=id;
  current=target;state.current=id;customCases=[];selectedCase=0;results=null;tab="problem";referenceUsed=false;persist();renderPractice();location.hash="practice";
}
function nextProblem(){
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
$("confirmReset").onclick=()=>{state.drafts[current.id]=current.starter;$("codeEditor").value=current.starter;persist();updateEditor();results=null;renderTests();$("resultOutput").replaceChildren();$("resetDialog").close();notify("A fresh starter is ready.");};
document.querySelectorAll(".dialog-close,.dialog-close-button").forEach(b=>b.onclick=()=>b.closest("dialog").close());
document.querySelectorAll("dialog").forEach(d=>d.addEventListener("click",event=>{if(event.target===d){const r=d.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)d.close();}}));
$("aboutBtn").onclick=()=>$("aboutDialog").showModal();
function route(){
  const view=["map","progress"].includes(location.hash.slice(1))?location.hash.slice(1):"practice";
  ["practice","map","progress"].forEach(name=>$(name+"View").hidden=view!==name);
  document.querySelectorAll("[data-view]").forEach(a=>a.classList.toggle("active",a.dataset.view===view));
  $("breadcrumb").textContent=({practice:"Practice lab",map:"Quest map",progress:"My progress"})[view];
  if(view!=="practice")pauseTrace();if(view==="map")renderMap();if(view==="progress")renderProgress();
}
addEventListener("hashchange",route);
$("topicFilter").innerHTML+=[...topics].map(t=>'<option>'+html(t)+'</option>').join("");
["topicFilter","difficultyFilter","statusFilter"].forEach(id=>$(id).onchange=renderMap);$("searchInput").oninput=renderMap;
function renderMap(){
  const query=$("searchInput").value.toLowerCase(),topic=$("topicFilter").value,level=$("difficultyFilter").value,status=$("statusFilter").value;
  const list=problems.filter(p=>(p.title+" "+p.topic).toLowerCase().includes(query)&&(!topic||p.topic===topic)&&(!level||p.difficulty===level)&&(!status||(status==="solved"?state.solved[p.id]:status==="new"?!state.solved[p.id]:due(p.id))));
  $("questGrid").innerHTML=list.length?list.map(p=>'<article class="quest-card">'+(state.solved[p.id]?'<span class="solved-badge">'+(due(p.id)?"↻ Review due":"✓ Solved")+"</span>":"")+'<div class="card-icon">'+topicEmoji[p.topic]+'</div><h3>'+html(p.title)+'</h3><p>'+html(p.topic)+'</p><div class="card-meta"><span class="difficulty'+(p.difficulty==="Medium"?" medium":"")+'">'+p.difficulty+'</span><span>~'+p.minutes+' min</span><span class="card-xp">✧ 100 XP</span></div><button data-problem="'+p.id+'">'+(state.solved[p.id]?"Revisit this quest":"Let's explore")+icon("arrow")+'</button></article>').join(""):'<div class="empty-state">No quests here yet. Try another filter.</div>';
  $("questGrid").querySelectorAll("[data-problem]").forEach(b=>b.onclick=()=>changeProblem(b.dataset.problem));
}
function renderProgress(){
  const solved=Object.keys(state.solved).length, dueCount=problems.filter(p=>due(p.id)).length;
  const stats=[["QUESTS SOLVED",solved+" / 16","One idea at a time."],["XP EARNED",xp(),"Level "+(1+Math.floor(xp()/300))+" Java explorer"],["DAY STREAK",streak(),"A small daily win counts."],["READY TO REVISIT",dueCount,"Reviews at 2 / 7 / 21 days"]];
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
    return '<div class="activity-row"><span class="activity-icon">'+(a.type==="solved"?"✦":a.type==="review"?"↻":"⌘")+'</span><div><strong>'+html(p.title)+'</strong> · '+(a.type==="solved"?"Quest completed · +100 XP":a.type==="review"?"Review complete · +20 XP":a.passed+"/"+a.total+" tests passed")+'</div><time>'+new Date(a.at).toLocaleDateString(undefined,{month:"short",day:"numeric"})+'</time></div>';
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
    // Merge known records so restoring a backup cannot erase newer local work.
    for(const p of problems){if(!state.drafts[p.id]&&incoming.drafts[p.id])state.drafts[p.id]=incoming.drafts[p.id];if(!state.notes[p.id]&&incoming.notes[p.id])state.notes[p.id]=incoming.notes[p.id];if(incoming.solved[p.id]&&!state.solved[p.id])state.solved[p.id]=incoming.solved[p.id];if(incoming.reviews[p.id]&&(!state.reviews[p.id]||incoming.reviews[p.id].step>state.reviews[p.id].step))state.reviews[p.id]=incoming.reviews[p.id];if(!state.confidence[p.id]&&incoming.confidence[p.id])state.confidence[p.id]=incoming.confidence[p.id];state.attempts[p.id]=Math.max(state.attempts[p.id]||0,incoming.attempts[p.id]||0);}
    state.days=[...new Set([...state.days,...incoming.days])];state.activity=[...new Map([...state.activity,...incoming.activity].map(a=>[a.id+"-"+a.type+"-"+a.at,a])).values()].sort((a,b)=>a.at-b.at).slice(-200);
    persist();updateStats();renderProgress();notify("Backup merged with your progress. Current drafts kept.");
  }catch(error){notify("Could not restore: "+error.message);}event.target.value="";
};
renderPractice();updateStats();route();
if(!storageOK){$("saveStatus").textContent="Storage unavailable — use Save progress";notify("Local storage is unavailable. Export your progress before leaving.");}
