// A friend-online signal is an ephemeral toast, not an inbox message.
// Browser tabs share a short cooldown so live stream reconnects and page reloads
// cannot produce multiple alerts for the same friend's single arrival.
export const ONLINE_ALERT_THRESHOLD_MS=60_000;
function availableStorage(){try{return globalThis.localStorage||null;}catch{return null;}}
export function createOnlineAlertGate({storage=availableStorage(),now=()=>Date.now()}={}){
 let owner=null;
 const recent=new Map();
 const key=()=>owner?'bytequest.friend-online.v2:'+encodeURIComponent(owner):null;
 function load(){
  const item=key();
  try{
   if(!item)return;
   const rows=JSON.parse(storage?.getItem(item)||'{}');
   if(!rows||typeof rows!=='object'||Array.isArray(rows))return;
   for(const [actor,time] of Object.entries(rows)){
    const age=now()-Number(time);
    if(actor.length<=128&&Number.isFinite(age)&&age>=0&&age<ONLINE_ALERT_THRESHOLD_MS){
      recent.set(actor,Number(time));
    }
   }
  }catch{/* A disabled browser store must never break live messages. */}
 }
 return {
  setOwner(next){
   if(next===owner)return;
   owner=typeof next==='string'&&next?next:null;
   recent.clear();
   if(owner)load();
  },
  accept(actor){
   const id=actor?.public_id;
   if(!owner||typeof id!=='string'||!id||id.length>128)return false;
   // Re-read immediately so separate tabs share a near-real-time cooldown.
   load();
   const time=now(),last=recent.get(id),age=time-last;
   if(Number.isFinite(last)&&age>=0&&age<ONLINE_ALERT_THRESHOLD_MS)return false;
   for(const [who,at] of recent)if(time-at>=ONLINE_ALERT_THRESHOLD_MS||at>time)recent.delete(who);
   recent.set(id,time);
   while(recent.size>100)recent.delete(recent.keys().next().value);
   try{storage?.setItem(key(),JSON.stringify(Object.fromEntries(recent)));}catch{}
   return true;
  }
 };
}
