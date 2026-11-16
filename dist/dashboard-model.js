export function solveEvents(progress,catalog,now=Date.now()){const map=new Map(catalog.map(p=>[p.id,p]));return Object.entries(progress.solved||{}).filter(([id,at])=>map.has(id)&&Number.isFinite(at)&&at>0&&at<=now).map(([id,at])=>({day:new Date(at).toISOString().slice(0,10),topic:map.get(id).topic}));}
export function bucketSolves(events,{mode='daily',month=new Date().toISOString().slice(0,7),year=new Date().getUTCFullYear(),topic='',now=Date.now()}={}){year=Number(year);if(!Number.isInteger(year)||year<2000||year>2200||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Choose a valid date.');const keys=mode==='daily'?Array.from({length:new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate()},(_,i)=>month+'-'+String(i+1).padStart(2,'0')):mode==='monthly'?Array.from({length:12},(_,i)=>year+'-'+String(i+1).padStart(2,'0')):Array.from({length:5},(_,i)=>String(year-4+i));const counts=new Map(keys.map(k=>[k,0])),topics=new Map();for(const e of events){if(!/^\d{4}-\d{2}-\d{2}$/.test(e.day)||!Number.isFinite(Date.parse(e.day+'T00:00:00Z'))||new Date(e.day+'T00:00:00Z').toISOString().slice(0,10)!==e.day||e.day>new Date(now).toISOString().slice(0,10)||topic&&e.topic!==topic)continue;const key=e.day.slice(0,mode==='daily'?10:mode==='monthly'?7:4);if(!counts.has(key))continue;counts.set(key,counts.get(key)+1);topics.set(e.topic,(topics.get(e.topic)||0)+1);}return{keys,values:keys.map(k=>counts.get(k)),topics:[...topics].sort((a,b)=>b[1]-a[1]),total:[...counts.values()].reduce((a,b)=>a+b,0)};}

// Monotone cubic interpolation keeps a smooth line inside each pair of data values.
export function smoothPath(points){
 if(!points.length)return '';const f=n=>Number(n.toFixed(2));if(points.length===1)return 'M'+points[0].map(f).join(',');
 const slopes=points.slice(1).map((p,i)=>(p[1]-points[i][1])/(p[0]-points[i][0]));
 const tangents=points.map((_,i)=>i===0?slopes[0]:i===points.length-1?slopes.at(-1):slopes[i-1]*slopes[i]<=0?0:2/(1/slopes[i-1]+1/slopes[i]));
 for(let i=0;i<slopes.length;i++){if(slopes[i]===0){tangents[i]=tangents[i+1]=0;continue;}const a=tangents[i]/slopes[i],b=tangents[i+1]/slopes[i],r=Math.hypot(a,b);if(r>3){tangents[i]=3*a/r*slopes[i];tangents[i+1]=3*b/r*slopes[i];}}
 let path='M'+points[0].map(f).join(',');for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],dx=(b[0]-a[0])/3;path+=' C'+[a[0]+dx,a[1]+dx*tangents[i],b[0]-dx,b[1]-dx*tangents[i+1],...b].map(f).join(',');}return path;
}


// Chart display helpers; data stays an integer number of accepted solves.
// Cumulative mode starts at zero at the beginning of the chosen window,
// never silently representing lifetime totals.
export function chartValues(values,measure='period'){
 if(measure!=='cumulative')return [...values];
 let running=0;return values.map(n=>(running+=n));
}
export function chartDomain(maxValue){
 const peak=Math.max(0,Math.ceil(Number(maxValue)||0));
 const step=Math.max(1,Math.ceil(peak/4));
 const ticks=Math.max(1,Math.ceil(peak/step));
 return {max:step*ticks,step,ticks};
}
export function straightPath(points){
 if(!points.length)return '';
 const f=n=>Number(n.toFixed(2));
 return points.map((p,i)=>(i?'L':'M')+p.map(f).join(',')).join(' ');
}
export function visiblePeriodCount(keys,mode='daily',now=Date.now()){
 const today=new Date(now).toISOString().slice(0,10);
 const bound=mode==='daily'?today:mode==='monthly'?today.slice(0,7):today.slice(0,4);
 return keys.filter(k=>k<=bound).length;
}
const topicKey=t=>String(t||'').trim().toLocaleLowerCase();
export function topicProgress(catalog=[],skills=[],events=[],opts={}){
 // Count each currently published problem once. The matching insights
 // represent accepted distinct problems, not attempts or arbitrary chart scale.
 const totals=new Map(),seen=new Set();
 for(const p of catalog){
  if(!p?.id||seen.has(p.id)||!p.topic)continue;
  seen.add(p.id);
  const key=topicKey(p.topic);
  if(!totals.has(key))totals.set(key,{name:p.topic,total:0});
  totals.get(key).total++;
 }
 const counts=new Map();
 for(const s of skills){
  const key=topicKey(s.name||s.topic);
  if(key&&Number.isFinite(Number(s.solved))){
   counts.set(key,Math.max(counts.get(key)||0,Math.max(0,Math.floor(Number(s.solved)))));
  }
 }
 const recent=bucketSolves(events,{...opts,topic:''}).topics;
 const period=new Map(recent.map(([topic,n])=>[topicKey(topic),n]));
 return [...totals].map(([key,{name,total}])=>{
  const solved=Math.min(total,counts.get(key)||0);
  const gain=Math.min(solved,Math.max(0,period.get(key)||0));
  return {name,solved,total,period:gain,percent:total?Math.round(100*solved/total):0};
 }).sort((a,b)=>b.percent-a.percent||b.solved-a.solved||a.name.localeCompare(b.name));
}


/**
 * Seven-day *illustrative* expected solve pace, never a claim of actual
 * future completions. Source is only the learner's existing first-accepted
 * solve events; no model API or remote data is required.
 *
 * Require >=3 accepted solves in the last 14 UTC days. This intentionally
 * avoids fabricating a prediction from no/very little history.
 */
export function forecastSolvePace(events=[],{today=new Date().toISOString().slice(0,10),topic='',horizon=7}={}){
 if(typeof today!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(today)||
    !Number.isFinite(Date.parse(today+'T00:00:00Z'))||
    new Date(today+'T00:00:00Z').toISOString().slice(0,10)!==today){
  throw new Error('Choose a valid UTC forecast date.');
 }
 const at=Date.parse(today+'T00:00:00Z'),counts=Array(14).fill(0),selected=String(topic||'');
 for(const event of events||[]){
  if(!event||typeof event.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(event.day)||
     selected&&event.topic!==selected)continue;
  const time=Date.parse(event.day+'T00:00:00Z');
  if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==event.day)continue;
  const daysAgo=Math.round((at-time)/86400000);
  if(daysAgo>=0&&daysAgo<14)counts[13-daysAgo]++;
 }
 const total=counts.reduce((sum,count)=>sum+count,0);
 if(total<3)return {days:[],values:[],sample:total};
 const recent=counts.slice(7).reduce((a,b)=>a+b,0)/7;
 const older=counts.slice(0,7).reduce((a,b)=>a+b,0)/7;
 const baseline=recent*.65+older*.35;
 const drift=(recent-older)*.25;
 const ceiling=Math.max(1,2*baseline,Math.max(...counts.slice(7))*.75);
 const numberOfDays=Math.max(0,Math.min(7,Math.floor(Number(horizon)||0)));
 const days=[],values=[];
 for(let step=1;step<=numberOfDays;step++){
  days.push(new Date(at+step*86400000).toISOString().slice(0,10));
  values.push(Number(Math.min(ceiling,Math.max(0,baseline+drift*(1-Math.exp(-step/4)))).toFixed(2)));
 }
 return {days,values,sample:total};
}
