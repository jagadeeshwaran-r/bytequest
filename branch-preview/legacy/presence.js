import {IDLE_MS,isActive} from './presence-model.js';
// Activity is tab-local. Background network requests never extend this lease.
export function mountPresence(cloud,{win=window,doc=document,now=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout}={}){
 const page=crypto.randomUUID();let owner=null,sequence=0,lastInput=now(),lastSent=0,lastState=false,timer=null,trailing=null,stopped=false;
 const active=()=>!stopped&&isActive({visible:doc.visibilityState==='visible',focused:doc.hasFocus(),lastInput,now:now()});
 function payload(online){return {page,sequence:++sequence,active:online,idleForMs:Math.min(IDLE_MS,Math.max(0,Math.floor(now()-lastInput)))};}
 function send(force=false,leaving=false){if(!owner)return;const online=active();if(!force&&!online&&!lastState)return;lastState=online;lastSent=now();const data=payload(online);if(leaving)cloud.leavePresence(data,owner);else cloud.request('presence',data,owner).catch(()=>{});}
 function arm(){clearTimer(timer);if(!active())return;timer=setTimer(()=>{if(active())arm();else send(true);},Math.max(1,IDLE_MS-(now()-lastInput)));}
 function input(){if(doc.visibilityState!=='visible'||!doc.hasFocus()||stopped)return;lastInput=now();arm();if(!lastState||now()-lastSent>=5000)send(true);else if(!trailing)trailing=setTimer(()=>{trailing=null;if(active())send(true);},5000-(now()-lastSent));}
 function away(){clearTimer(timer);clearTimer(trailing);trailing=null;stopped=true;send(true,true);}
 function back(){stopped=false;input();}
 const listen=(target,type,fn,options)=>{target.addEventListener(type,fn,options);return()=>target.removeEventListener(type,fn,options);};
 const removers=['pointermove','pointerdown','keydown','touchstart','scroll','wheel'].map(e=>listen(doc,e,input,{passive:true}));
 removers.push(listen(win,'blur',away),listen(win,'pagehide',away),listen(win,'focus',back),listen(win,'pageshow',back),listen(doc,'visibilitychange',()=>doc.visibilityState==='visible'?back():away()));
 const heartbeat=win.setInterval(()=>{if(active())send(true);},10000);
 const priorSignOut=cloud.onBeforeSignOut;cloud.onBeforeSignOut=()=>{away();priorSignOut?.();};
 return{setOwner(user){const next=user?.id||null;if(next===owner)return;if(owner)away();owner=next;lastInput=now();stopped=false;lastState=false;if(owner){send(true);arm();}},dispose(){away();removers.forEach(f=>f());win.clearInterval(heartbeat);clearTimer(timer);clearTimer(trailing);}};
}
