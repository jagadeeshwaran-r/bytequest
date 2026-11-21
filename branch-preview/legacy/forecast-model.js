/**
 * ByteQuest: non-ML, rolling-origin-validated forecasts for FIRST accepted
 * solves. Uses up to 180 complete UTC days, including no-solve days.
 *
 * Candidates (no remote calls / training / user-to-user data mixing):
 *  - trailing 28-day mean (stable)
 *  - exponentially weighted moving average, alpha=.18 (adaptive)
 *  - weekly seasonal EWMA (weekday effect shrunk toward zero)
 *  - damped Holt trend, phi=.8 (bounded, no runaway extrapolation)
 *
 * We choose a candidate via honest one-week-forward walk-forward MAE;
 * a more complex candidate wins only if materially better. Estimates are
 * expected solves/day, NOT integer achievements or calibrated guarantees.
 */
const DAY=86400000;
const MODEL_NAMES={
 mean:'28-day moving average',
 ewma:'EWMA',
 seasonal:'Weekly seasonal EWMA',
 holt:'Damped Holt'
};
const CANDIDATES=Object.keys(MODEL_NAMES);
const sum=a=>a.reduce((total,n)=>total+n,0);
const mean=a=>a.length?sum(a)/a.length:0;
const utcDate=d=>{
 if(typeof d!=='string'||! /^\d{4}-\d{2}-\d{2}$/.test(d))return NaN;
 const ms=Date.parse(d+'T00:00:00Z');
 return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===d?ms:NaN;
};
const round2=n=>Number(n.toFixed(2));
const range=(n,fn)=>Array.from({length:n},(_,i)=>fn(i));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function candidateForecast(history,method,horizon,startMs){
 const length=history.length;
 const last28=history.slice(-28),recent=mean(last28);
 const last56=history.slice(-56),overall=mean(last56);
 const upper=Math.max(1,2*recent+1,Math.max(...last56)*.6);
 const cap=n=>clamp(Number.isFinite(n)?n:0,0,upper);
 if(method==='mean')return range(horizon,()=>cap(recent));
 // Initialize EWMA from the first available week, then update in-order.
 const sample=history.slice(-90);
 let level=mean(sample.slice(0,Math.min(7,sample.length)));
 for(const observation of sample)level=.18*observation+.82*level;
 const baseline=.7*level+.3*recent;
 if(method==='ewma')return range(horizon,()=>cap(baseline));
 if(method==='seasonal'){
  const weekday=range(7,()=>[]);
  const start=length-last56.length;
  last56.forEach((v,i)=>{
   const dow=new Date(startMs+(start+i)*DAY).getUTCDay();
   weekday[dow].push(v);
  });
  return range(horizon,i=>{
   const dow=new Date(startMs+(length+i)*DAY).getUTCDay();
   const observations=weekday[dow];
   const shrink=observations.length/(observations.length+5);
   return cap(baseline+.75*shrink*(mean(observations)-overall));
  });
 }
 // Holt's linear exponential smoothing with damped trend; cap residual
 // momentum so a lucky spike cannot imply unlimited future productivity.
 let l=mean(sample.slice(0,Math.min(7,sample.length))),b=0;
 for(const observation of sample){
  const previous=l;
  l=.22*observation+.78*(l+.8*b);
  b=.04*(l-previous)+.96*.8*b;
 }
 const boundedTrend=clamp(b,-.12*(recent+1),.12*(recent+1));
 return range(horizon,i=>{
  const h=i+1;
  return cap(.75*(l+boundedTrend*.8*(1-Math.pow(.8,h))/.2)+.25*recent);
 });
}
function scoreCandidates(counts,startMs){
 // All folds train strictly before their seven held-out days, and are
 // spread across history rather than tuned to the same recent observations.
 const scores=CANDIDATES.map(id=>({id,error:0,count:0}));
 let folds=0;
 const first=Math.max(28,counts.length-91);
 for(let end=first;end+7<=counts.length;end+=7){
  const past=counts.slice(0,end),actual=counts.slice(end,end+7);
  for(const score of scores){
   const predicted=candidateForecast(past,score.id,7,startMs);
   score.error+=predicted.reduce((total,pred,i)=>total+Math.abs(pred-actual[i]),0);
   score.count+=7;
  }
  folds++;
 }
 if(folds<3)return {id:'mean',mae:null,folds};
 const scored=scores.map(s=>({id:s.id,mae:s.error/s.count}));
 let best=scored[0];
 // Prefer simpler methods when improvements are within typical daily
 // noise; no in-sample fit or data-leaking selection.
 for(const s of scored.slice(1)){
  if(s.mae<best.mae*.97-.02)best=s;
 }
 return {id:best.id,mae:round2(best.mae),folds};
}
export function forecastSolvePace(events=[],{
 today=new Date().toISOString().slice(0,10),topic='',horizon=7
}={}){
 const now=utcDate(today);
 if(!Number.isFinite(now))throw new Error('Choose a valid UTC forecast date.');
 const capDays=clamp(Math.floor(Number(horizon)||0),0,30);
 const countsByDay=new Map(),topicFilter=String(topic||'');
 for(const e of Array.isArray(events)?events:[]){
  if(!e||topicFilter&&e.topic!==topicFilter)continue;
  const time=utcDate(e.day);
  if(!Number.isFinite(time)||time>now)continue;
  countsByDay.set(time,(countsByDay.get(time)||0)+1);
 }
 const first=countsByDay.size?Math.max(Math.min(...countsByDay.keys()),now-179*DAY):now;
 const duration=Math.round((now-first)/DAY)+1;
 const counts=range(duration,i=>countsByDay.get(first+i*DAY)||0);
 const sample=sum(counts),activeDays=counts.filter(Boolean).length;
 const base={days:[],values:[],sample,historyDays:duration,activeDays,
  model:null,mae:null,backtests:0};
 // Six to eight weeks of actual history and multiple independent
 // accepted-solve days are essential; do not fabricate trend from one
 // burst of coding or just a couple of solves.
 if(duration<56||sample<10||activeDays<7||capDays===0)return base;
 const selected=scoreCandidates(counts,first);
 const values=candidateForecast(counts,selected.id,capDays,first).map(round2);
 const days=range(capDays,i=>new Date(now+(i+1)*DAY).toISOString().slice(0,10));
 return {...base,days,values,model:MODEL_NAMES[selected.id],mae:selected.mae,
  backtests:selected.folds};
}
