import {escapeHtml as h} from './community-model.js';
import {relativeTime} from './presence-model.js?v=social-1';
const symbols={solved:'<path d="m6 12 4 4 8-8"/><circle cx="12" cy="12" r="9"/>',points:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',streak:'<path d="M12 3c1 5-4 5-4 9 0 2 1 3 2 3-1-3 2-4 3-6 4 3 6 6 4 9a6 6 0 0 1-10-1C3 11 9 9 12 3Z"/>'};
const icon=kind=>'<span class="metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+symbols[kind]+'</svg></span>';
export function profileMetrics(stats,points,total){
 const solved=Number(stats.solved)||0,streak=Number(stats.streak)||0,count=Number(stats.total??total)||0,progress=count?Math.max(0,Math.min(100,solved/count*100)):0;
 return '<div class="social-stats profile-metrics"><section class="social-stat metric-solved">'+icon('solved')+'<span class="metric-label">Problems solved</span><b id="profileSolvedCount">'+solved+'<small> / '+count+'</small></b><span class="metric-caption">Published challenges</span><span class="metric-progress" aria-hidden="true"><i style="width:'+progress+'%"></i></span></section><section class="social-stat metric-points">'+icon('points')+'<span class="metric-label">Total points</span><b>'+Number(points||0).toLocaleString()+'</b><span class="metric-caption">Your problem-solving score</span></section><section class="social-stat metric-streak">'+icon('streak')+'<span class="metric-label">Daily streak</span><b class="streak-count'+(streak>0?' is-burning':'')+'">'+'<span class="streak-digits">'+streak+'</span><small> '+(streak===1?'day':'days')+'</small></b><span class="metric-caption">'+(stats.streakAdjusted?'Administratively adjusted streak':'Consecutive solve days')+'</span><div class="streak-reset" aria-label="Countdown to the next UTC streak day"><span>New day in</span><time data-streak-countdown role="timer" aria-live="off" title="UTC midnight · streaks reset daily at 00:00 UTC">--:--:--</time><small>UTC</small></div></section></div>';
}
// Problem numbers follow the current published catalog order, exactly as
// they do in the problem library. Missing metadata is never guessed.
export function profileCatalogNumbers(catalog=[]){
 const nums=new Map();
 if(!Array.isArray(catalog))return nums;
 catalog.forEach((problem,index)=>{
  if(typeof problem?.id==='string'&&!nums.has(problem.id))nums.set(problem.id,index+1);
 });
 return nums;
}
export function hydrateRecentProblemNumbers(container,catalog=[]){
 if(!container?.querySelectorAll)return;
 const nums=profileCatalogNumbers(catalog);
 container.querySelectorAll('[data-recent-problem-number]').forEach(node=>{
  const number=nums.get(node.getAttribute('data-recent-problem-number'));
  node.textContent=number?String(number).padStart(2,'0'):'—';
  node.setAttribute('aria-label',number?'Problem '+number:'Problem number unavailable');
 });
}
export function recentSolvesMarkup(items=[],catalog=[]){
 const rows=items.slice(0,25),numbers=profileCatalogNumbers(catalog);
 return '<section class="recent-solves"><header><div><h3>Recently solved</h3><p>Latest accepted solves · up to 25 problems</p></div>'+
  (rows.length>3?'<button type="button" class="recent-toggle" aria-expanded="false" aria-controls="recentSolvesList" data-recent-toggle>Show all '+rows.length+' <span aria-hidden="true">↗</span></button>':'')+
  '</header>'+(rows.length?'<ol id="recentSolvesList">'+rows.map((s,i)=>{
   const number=numbers.get(s.problemId),label=number?String(number).padStart(2,'0'):'—';
   return '<li '+(i>=3?'hidden ':'')+'data-recent-row><a href="./index.html?problem='+encodeURIComponent(s.problemId)+'#practice">'+
    '<span class="recent-problem-number" data-recent-problem-number="'+h(s.problemId)+'" aria-label="'+(number?'Problem '+number:'Problem number unavailable')+'">'+label+'</span>'+
    '<span class="recent-problem-title">'+h(s.title)+'</span>'+
    '<span class="recent-difficulty '+h(String(s.difficulty).toLowerCase())+'">'+h(s.difficulty)+'</span>'+
    '<time datetime="'+h(s.solvedAt)+'" title="'+h(s.solvedAt)+'">'+h(relativeTime(s.solvedAt)||'Solved')+'</time></a></li>';
  }).join('')+'</ol>':'<p class="recent-empty">Solved problems will appear here.</p>')+'</section>';
}
