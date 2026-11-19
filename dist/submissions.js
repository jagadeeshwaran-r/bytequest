import {profileAvatar,profileIcon,publicProfileHref} from './profile-view.js?v=workbench-1';
import {languageNames} from './profile-fields.js?v=profile-2';
import {escapeHtml as h} from './community-model.js';
import {recentPracticeSubmissions} from './practice-history.js?v=practice-history-1';
import {practiceVerificationSummary} from './verification-evidence.js?v=1';
export const runtimeLabel=value=>value===null||value===undefined?'Not measured':Number(value)<.001?'< 0.001 ms':Number(value).toFixed(3)+' ms';
export const memoryLabel=value=>value===null||value===undefined?'Not measured':(Number(value)/1048576).toFixed(2)+' MB';
const benchmarkNote='Practice benchmarks: Java submissions time one complete test-suite pass for faster verdicts; Python, C and C++ use a median of three warmed passes. Runtime includes the test harness and output; memory is whole-process peak RSS, including the language runtime. Compare results from the same benchmark version because measurements can differ. These timings do not determine Big-O complexity.';
const practiceTitles={
 practice_accepted:'Practice accepted',wrong_answer:'Wrong answer',
 compile_error:'Compilation failed',runtime_error:'Runtime error',
 time_limit_exceeded:'Time limit exceeded',unavailable:'Compiler unavailable'
};
export function mountSubmissions(cloud,{notify=()=>{},getPracticeSubmissions=()=>[],getSolvedAt=()=>null}={}){
 let generation=0,root=null,problem=null,language='all',sort='runtime',page=0,history=true,owner=null;
 const dialog=document.createElement('dialog');
 dialog.className='submission-dialog';dialog.setAttribute('aria-labelledby','submissionTitle');
 document.body.append(dialog);
 function valid(ticket,user){return ticket===generation&&cloud.user?.id===user&&root?.isConnected;}
 function closeDialog(){const button=dialog.querySelector('.dialog-close');if(button)button.onclick=()=>dialog.close();dialog.showModal();}
 function localRows(){
  return recentPracticeSubmissions({practiceSubmissions:getPracticeSubmissions()},problem.id,25);
 }
 function openPractice(id){
  const row=localRows().find(entry=>entry.id===id);if(!row)return;
  dialog.innerHTML='<button class="dialog-close" aria-label="Close practice submission">×</button>'+
   '<span class="eyebrow">BROWSER PRACTICE · NOT SERVER VERIFIED</span>'+
   '<h2 id="submissionTitle">'+h(practiceTitles[row.status]||'Practice submission')+'</h2>'+
   '<p class="muted">'+h(new Date(row.at).toLocaleString())+' · Java 17 · revision '+row.revision+
   ' · '+row.passed+' / '+row.total+' public/custom cases</p>'+
   '<p class="submission-approach">Saved privately with your practice progress. '+
   (row.hiddenSkipped?'Hidden tests were not executed. ':'')+
   'This result is not a verified submission and does not unlock community rankings.</p>'+
   '<h3>Submitted code</h3><pre class="submission-source"><code>'+h(row.source)+'</code></pre>'+
   (row.sourceTruncated?'<p class="muted">The submitted source exceeded the synced history limit; the full draft may still be in your editor.</p>':'')+
   '<p class="benchmark-note">Browser execution time is not a verified benchmark; no peer ranking, memory benchmark or shared solution was created.</p>';
  closeDialog();
 }
 async function read(id){
  const ticket=generation,user=cloud.user?.id;
  try{
   const r=await cloud.request('submission-read',{id},user);
   if(!valid(ticket,user))return;
   const s=r.submission,a=r.author;
   dialog.innerHTML='<button class="dialog-close" aria-label="Close solution">×</button>'+
    '<span class="eyebrow">ACCEPTED SOLUTION · '+h(s.suite_kind==='private'?'FULL SUITE':'PUBLIC SUITE')+'</span>'+
    '<h2 id="submissionTitle">'+h(a.display_name||a.username||'Your solution')+(a.username?profileIcon(a):'')+'</h2>'+
    '<p class="muted">'+h(languageNames[s.language]||s.language)+' · '+h(runtimeLabel(s.runtime_ms))+' · '+h(memoryLabel(s.memory_bytes))+'</p>'+
    '<div class="complexity-row"><div><small>Author-stated time</small><b>'+h(s.time_complexity||'Not supplied')+'</b></div>'+
    '<div><small>Author-stated space</small><b>'+h(s.space_complexity||'Not supplied')+'</b></div></div>'+
    '<h3>Approach</h3><p class="submission-approach">'+h(s.approach||'No approach explanation was supplied.')+'</p>'+
    '<h3>Solution</h3><pre class="submission-source"><code>'+h(s.source)+'</code></pre>'+
    '<p class="benchmark-note">'+h(s.suite_kind==='private'?'Private-judge execution time and peak memory for the full suite. Complexity notes are author-stated.':benchmarkNote)+'</p>';
   closeDialog();
  }catch(e){if(valid(ticket,user))notify(e.message);}
 }
 function heading(){
  return '<div class="submission-heading"><div><span class="eyebrow">SUBMISSION HISTORY</span><h3>'+
   (history?'My submissions':'Community submissions')+'</h3>'+
   '<p class="submission-view-note">'+(history?
   'Your latest 25 submissions for this problem. Java browser practice and server-verified solutions are labeled separately.':
   'Shared solutions unlocked after accepted server verification of all published public cases or the full private suite.')+
   '</p></div><button class="button secondary" data-history>'+
   (history?'Community rankings':'My submissions')+'</button></div>';
 }
 function bindSwitch(){
  root.querySelector('[data-history]')?.addEventListener('click',()=>{history=!history;page=0;load();});
 }
 function renderHistory(verified=[],{loading=false,error=null}={}){
  if(!root?.isConnected||!problem)return;
  const browser=localRows().map(entry=>({...entry,local:true,created_at:new Date(entry.at).toISOString()}));
  const server=verified.map(entry=>({...entry,local:false}));
  // Older Java practice solves never captured a source snapshot. Show the
  // existing solved timestamp honestly rather than fabricating an attempt.
  const solvedAt=Number(getSolvedAt(problem.id));
  const legacy=!loading&&!browser.length&&!server.length&&Number.isFinite(solvedAt)&&solvedAt>946684800000?
    [{local:false,legacy:true,id:'legacy-'+problem.id,language:'java',created_at:new Date(solvedAt).toISOString()}]:[];
  const rows=[...browser,...server,...legacy].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,25);
  let content=heading();
  content+='<p class="submission-view-note">Browser practice is private and not verified; it does not unlock shared solutions. '+(cloud.user?'Saved with your account progress.':'Guest practice stays on this device until imported into an account.')+'</p>';
  if(loading)content+='<p class="muted">Checking server-verified submissions…</p>';
  if(error)content+='<p class="muted" role="status">Verified history is temporarily unavailable: '+h(error)+'. Your saved browser submissions are shown below.</p>';
  content+='<div class="submission-table-wrap"><table class="submission-table"><thead><tr>'+
   '<th>Date</th><th>Result / privacy</th><th>Language</th><th>Runtime</th><th>Memory</th>'+
   '</tr></thead><tbody>'+rows.map(row=>{
    const isLocal=row.local,legacy=Boolean(row.legacy),at=new Date(row.created_at);
    const date=Number.isNaN(at.getTime())?'—':at.toLocaleDateString();
    const publicOnly=Number(problem?.hiddenCount)>0&&row.suite_kind==='public';
    const label=legacy?'Earlier solved progress':isLocal?(practiceTitles[row.status]||'Practice attempt'):publicOnly?'Public tests accepted · private':(row.shared?'Verified · shared':'Verified · private');
    const status=legacy?'Original submission code was not recorded':isLocal?row.passed+' / '+row.total+' public/custom tests':'Accepted';
    const metric=legacy?'Not recorded':isLocal?(row.elapsedMs===null?'Not measured':'Browser '+Math.round(row.elapsedMs)+' ms'):runtimeLabel(row.runtime_ms);
    return '<tr><td>'+h(date)+'</td><td><div class="submission-user"><button type="button" class="submission-open" '+
     (legacy?'disabled':(isLocal?'data-local="':'data-sub="')+h(row.id)+'"')+'><span><strong>'+h(label)+'</strong><small>'+h(status)+'</small></span></button></div></td>'+
     '<td><span class="submission-language">'+h(languageNames[row.language]||row.language)+'</span></td>'+
     '<td>'+h(metric)+'</td><td>'+h(legacy||isLocal?'Not measured':memoryLabel(row.memory_bytes))+'</td></tr>';
   }).join('')+'</tbody></table></div>';
  if(!rows.length&&!loading)content+='<p class="muted">No submissions recorded for this problem yet. Submit Java with the browser compiler to save a private practice attempt here.</p>';
  if(legacy.length)content+='<p class="muted">This older solve was recovered from your progress. Past submission code was never saved and cannot be reconstructed.</p>';
  content+='<p class="benchmark-note">Accepted server-checked public suites unlock learning materials. Private-suite benchmarks remain separate; browser-only practice is personal progress and cannot unlock shared solutions.</p>';
  root.innerHTML=content;bindSwitch();
  root.querySelectorAll('[data-local]').forEach(button=>button.onclick=()=>openPractice(button.dataset.local));
  root.querySelectorAll('[data-sub]').forEach(button=>button.onclick=()=>read(button.dataset.sub));
 }
 function renderCommunity(response){
  let content=heading();
  if(!response.unlocked){
   const attempt=localRows().find(row=>row.status==='practice_accepted'&&row.revision===problem.revision);
   const evidence=attempt?practiceVerificationSummary(problem,attempt):null;
   root.innerHTML=content+'<div class="submission-locked"><strong>'+
    (evidence?h(evidence.title):'Server-verified solution required')+'</strong>'+
    (evidence?'<p><strong>'+h(evidence.tests)+'</strong> · <strong>'+h(evidence.hidden)+'</strong></p><p>'+h(evidence.explanation)+'</p>':
      '<p>Community rankings unlock only after a server-verified accepted submission for this problem revision. Browser-only practice does not run private hidden tests.</p>')+
    '<button type="button" class="button secondary" data-verify-submit>Try server verification</button></div>';
   bindSwitch();
   root.querySelector('[data-verify-submit]')?.addEventListener('click',()=>document.getElementById('submitBtn')?.click());
   return;
  }
  content+='<div class="submission-filters"><label>Language<select data-sub-language>'+
   [['all','All languages'],['java','Java'],['python','Python 3.11'],['c','C 11'],['cpp','C++ 17']].map(([value,name])=>
    '<option value="'+value+'" '+(value===language?'selected':'')+'>'+name+'</option>').join('')+
   '</select></label><label>Rank by<select data-sub-sort>'+
   '<option value="runtime" '+(sort==='runtime'?'selected':'')+'>Runtime</option>'+
   '<option value="memory" '+(sort==='memory'?'selected':'')+'>Peak memory</option></select></label></div>';
  const rows=response.users||response.items||response.submissions||[];
  const note=rows.some(s=>s.suite_kind==='private')?
   'Private-judge measurements cover the full public and hidden suite. Runtime and peak memory include that judge’s overhead.':benchmarkNote;
  content+='<div class="submission-table-wrap"><table class="submission-table"><thead><tr><th>Rank</th><th>Learner</th><th>Language</th><th>Runtime</th><th>Memory</th></tr></thead><tbody>'+
   rows.map(s=>'<tr><td>'+ (s.rank<=3?['🥇','🥈','🥉'][s.rank-1]:'#'+Number(s.rank))+'</td>'+
   '<td><div class="submission-user"><a class="submission-avatar-link" href="'+publicProfileHref(s)+'" aria-label="View '+h(s.display_name||s.username)+' profile">'+profileAvatar(s)+'</a>'+
   '<button type="button" class="submission-open" data-sub="'+h(s.id)+'"><span><strong>'+h(s.display_name||s.username)+'</strong><small>@'+h(s.username)+'</small></span></button>'+
   profileIcon(s)+'</div></td><td><span class="submission-language">'+h(languageNames[s.language]||s.language)+'</span></td>'+
   '<td>'+h(runtimeLabel(s.runtime_ms))+'</td><td>'+h(memoryLabel(s.memory_bytes))+'</td></tr>').join('')+'</tbody></table></div>';
  if(!rows.length)content+='<p class="muted">No shared accepted solutions for this revision yet. Private submissions appear under My submissions.</p>';
  content+='<div class="submission-pager"><button data-prev '+(page===0?'disabled':'')+'>← Previous</button><span>Page '+(page+1)+'</span><button data-next '+(rows.length<25?'disabled':'')+'>Next →</button></div>';
  content+='<p class="benchmark-note">'+h(note)+' Each learner’s best shared result for the current revision appears; compare runtimes within the same language.</p>';
  root.innerHTML=content;bindSwitch();
  root.querySelectorAll('[data-sub]').forEach(button=>button.onclick=()=>read(button.dataset.sub));
  root.querySelector('[data-sub-language]')?.addEventListener('change',e=>{language=e.target.value;page=0;load();});
  root.querySelector('[data-sub-sort]')?.addEventListener('change',e=>{sort=e.target.value;page=0;load();});
  root.querySelector('[data-prev]')?.addEventListener('click',()=>{page=Math.max(0,page-1);load();});
  root.querySelector('[data-next]')?.addEventListener('click',()=>{page++;load();});
 }
 async function load(){
  const ticket=++generation,user=cloud.user?.id;owner=user;
  if(history){
   // Instant local paint: a new problem never waits on the API to show
   // submissions, and online failures cannot erase saved practice attempts.
   renderHistory([],{loading:Boolean(user)});
   if(!user)return;
   try{
    const response=await cloud.request('submission-history',{problemId:problem.id,language,sort,page},user);
    if(valid(ticket,user)&&history)renderHistory(response.users||response.items||response.submissions||[]);
   }catch(error){
    if(valid(ticket,user)&&history)renderHistory([],{error:error.message||'Connection failed'});
   }
   return;
  }
  if(!user){
   root.innerHTML=heading()+'<div class="submission-locked"><strong>Sign in to view community rankings.</strong></div>';
   bindSwitch();return;
  }
  root.innerHTML=heading()+'<p class="muted">Loading community rankings…</p>';bindSwitch();
  try{
   const response=await cloud.request('submission-list',{problemId:problem.id,language,sort,page},user);
   if(valid(ticket,user)&&!history)renderCommunity(response);
  }catch(error){
   if(valid(ticket,user)&&!history){root.innerHTML=heading()+'<p class="muted">'+h(error.message||'Could not load community rankings.')+'</p>';bindSwitch();}
  }
 }
 return{
  mount(element,p,lang){generation++;root=element;problem=p;language='all';sort='runtime';page=0;history=true;load();},
  close(){generation++;root=null;if(dialog.open)dialog.close();},
  refresh(){if(root?.isConnected&&cloud.user?.id===owner)load();}
 };
}
export function requestSubmission({problem,language,allowPublicPractice=false}){
 return new Promise(resolve=>{
  const publicDefault=allowPublicPractice&&Number(problem?.hiddenCount)>0;
  const dialog=document.createElement('dialog');
  dialog.className='submission-dialog submit-confirm';dialog.setAttribute('aria-labelledby','submitTitle');
  const explanation=publicDefault?
   'Public Java verification checks the published cases on the server. If they all pass, your solution is saved and the Java answer unlocks. The '+Number(problem.hiddenCount)+' hidden cases are NOT checked.':
   'Your '+h(languageNames[language]||language)+' solution will request server verification.';
  dialog.innerHTML='<button class="dialog-close" type="button" aria-label="Cancel submission">×</button>'+
   '<span class="eyebrow">READY TO SUBMIT</span><h2 id="submitTitle">'+h(problem.title)+'</h2>'+
   '<p class="body-copy">'+explanation+'</p>'+
   '<form><label>Explain your approach <small>optional</small><textarea name="approach" rows="3" maxlength="5000" placeholder="What idea makes your solution work?"></textarea></label>'+
   '<div class="submission-complexity"><label>Time complexity<input name="time" maxlength="80" placeholder="e.g. O(n)"></label>'+
   '<label>Extra space complexity<input name="space" maxlength="80" placeholder="e.g. O(n)"></label></div>'+
   '<label class="share-solution" '+(publicDefault?'hidden':'')+'><input name="shared" type="checkbox" checked><span>Share my accepted solution'+
   '<small>Only full-suite accepted solutions can be shared and ranked. Public-only submissions stay private.</small></span></label>'+
   '<p class="benchmark-note">'+(publicDefault?
    'Full private-suite verification is a separate option. It needs a configured private judge and may be unavailable. Public-only acceptance does not earn hidden-suite rankings.':
    'Runtime comparisons are meaningful only for matching benchmark versions. Complexity notes are author-stated.')+'</p>'+
   '<div class="submission-actions"><button type="button" class="button secondary" data-cancel>Cancel</button>'+
   (publicDefault?'<button type="button" class="button secondary" data-full-verify>Try private suite</button>':'')+
   '<button class="button primary" type="submit">'+(publicDefault?'Submit public tests →':'Submit solution →')+'</button></div></form>';
  document.body.append(dialog);
  let result=null;
  const collect=scope=>{
    const fields=new FormData(dialog.querySelector('form'));
    return{approach:fields.get('approach'),timeComplexity:fields.get('time'),
     spaceComplexity:fields.get('space'),shared:scope==='complete'&&fields.get('shared')==='on',
     scope,nonce:crypto.randomUUID()};
  };
  dialog.querySelector('form').onsubmit=e=>{
    e.preventDefault();
    result=collect(publicDefault?'public':'complete');
    dialog.close();
  };
  const full=dialog.querySelector('[data-full-verify]');
  if(full)full.onclick=()=>{result=collect('complete');dialog.close();};
  dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
  dialog.querySelector('.dialog-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{dialog.remove();resolve(result);},{once:true});
  dialog.showModal();
 });
}
