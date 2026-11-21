// Pure request coalescing: duplicate read calls made while an identical
// request is still in flight share its result. No private responses are cached.
// Presence, chat, notifications, auth, progress and any write are excluded.
export const COALESCED_READS=new Set([
 'self','profile','leaderboard','search','followers','following','friend-analytics',
 'submission-list','submission-history','submission-read','problem-authors'
]);
export function createRequestCoordinator({clock=()=>globalThis.performance?.now?.()??Date.now()}={}){
 const pending=new Map(),samples=new Map();
 let avoided=0;
 const keyFor=(owner,action,body)=>{
  if(!owner||!COALESCED_READS.has(action)||!body||typeof body!=='object'||Array.isArray(body))return null;
  let pairs;
  try{pairs=Object.entries(body).sort(([a],[b])=>a.localeCompare(b));
   if(pairs.some(([,v])=>v&&typeof v==='object'&&!Array.isArray(v)||Array.isArray(v)&&v.some(x=>typeof x==='object')))return null;
   return JSON.stringify([owner,action,pairs]);
  }catch{return null;}
 };
 const record=(action,elapsed,success)=>{
  if(!Number.isFinite(elapsed)||elapsed<0)return;
  const values=samples.get(action)||[];
  values.push(Math.round(elapsed));
  if(values.length>50)values.shift();
  samples.set(action,values);
 };
 function run(action,body,owner,task){
  const key=keyFor(owner,action,body);
  if(key&&pending.has(key)){avoided++;return pending.get(key);}
  const start=clock();
  const work=Promise.resolve().then(task);
  const monitored=work.then(result=>{record(action,clock()-start,true);return result;},error=>{record(action,clock()-start,false);throw error;});
  if(!key)return monitored;
  // Clear on settle (success or failure). A later manual Refresh always
  // hits the network, and a follower/profile update is never hidden by TTL.
  const shared=monitored.finally(()=>{if(pending.get(key)===shared)pending.delete(key);});
  pending.set(key,shared);
  return shared;
 }
 function metrics(){
  const out={avoided,active:pending.size,actions:{}};
  for(const [action,items] of samples){
   const sorted=[...items].sort((a,b)=>a-b);
   out.actions[action]={count:items.length,p50:sorted[Math.floor((sorted.length-1)*.5)],
    p95:sorted[Math.floor((sorted.length-1)*.95)]};
  }
  return out;
 }
 return {run,metrics,clear(){pending.clear();samples.clear();avoided=0;}};
}
