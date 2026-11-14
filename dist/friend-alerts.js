import {receivedPresence,presenceOnline} from './presence-model.js?v=social-1';

// A complete snapshot is the baseline. New follows and already-online friends stay quiet.
export function friendTransitions(previous,users,now=Date.now()){
 const state=new Map(),arrivals=[];
 for(const friend of users){
  if(!friend?.public_id||!friend.username||!friend.presence?.visible)continue;
  const online=presenceOnline(receivedPresence(friend.presence,now),now),before=previous.get(friend.public_id);
  let notifiedAt=before?.notifiedAt??-Infinity;
  if(online&&before&&!before.online&&now-notifiedAt>=60000){arrivals.push(friend);notifiedAt=now;}
  state.set(friend.public_id,{online,notifiedAt});
 }
 return{state,arrivals};
}

export function mountFriendAlerts(cloud,{notify,clear=()=>{},win=window,doc=document,now=Date.now}={}){
 let owner=null,state=new Map(),generation=0,busy=false,lastRead=0;
 const visible=()=>doc.visibilityState==='visible'&&doc.hasFocus();
 async function poll(){
  if(!owner||busy||!visible())return;
  const ticket=generation,user=owner;busy=true;
  try{
   const result=await cloud.request('friend-presence',{},user);
   if(ticket!==generation||user!==owner||!visible())return;
   const at=now();if(lastRead&&at-lastRead>45000)state=new Map();
   const update=friendTransitions(state,result.users||[],at);state=update.state;lastRead=at;
   for(const friend of update.arrivals)notify(friend);
  }catch{}finally{if(ticket===generation)busy=false;}
 }
 function suspend(){if(!visible()){generation++;busy=false;clear();}}
 const interval=win.setInterval(poll,10000);
 const visibility=()=>{if(visible())poll();else suspend();};
 win.addEventListener('focus',poll);win.addEventListener('blur',suspend);doc.addEventListener('visibilitychange',visibility);
 return{setOwner(user){const next=user?.id||null;if(next===owner)return;owner=next;generation++;busy=false;lastRead=0;state=new Map();clear();if(owner)poll();},dispose(){generation++;owner=null;win.clearInterval(interval);win.removeEventListener('focus',poll);win.removeEventListener('blur',suspend);doc.removeEventListener('visibilitychange',visibility);clear();}};
}

export function createFriendToasts(doc=document,{setTimer=setTimeout,clearTimer=clearTimeout}={}){
 const region=doc.createElement('aside');region.className='friend-alerts';region.setAttribute('aria-label','Friend activity');region.setAttribute('aria-live','polite');region.setAttribute('aria-relevant','additions');doc.body.append(region);
 const timers=new Map();
 function remove(toast){clearTimer(timers.get(toast));timers.delete(toast);toast.remove();}
 return{show(friend){
  while(region.children.length>=3)remove(region.firstElementChild);
  const toast=doc.createElement('div');toast.className='friend-alert';
  const dot=doc.createElement('span');dot.className='friend-alert-avatar';dot.setAttribute('aria-hidden','true');dot.textContent=(friend.display_name||friend.username||'?').charAt(0).toUpperCase();if(friend.avatar_url&&/^https:\/\//.test(friend.avatar_url)){const img=doc.createElement('img');img.src=friend.avatar_url;img.alt='';img.referrerPolicy='no-referrer';dot.replaceChildren(img);}
  const link=doc.createElement('a');link.href='./community.html#user/'+encodeURIComponent(friend.username);
  const name=doc.createElement('strong');name.textContent=friend.display_name||'@'+friend.username;
  const detail=doc.createElement('span');detail.textContent='is online now';link.append(name,detail);
  const close=doc.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Dismiss friend notification');close.onclick=()=>remove(toast);
  toast.append(dot,link,close);region.append(toast);timers.set(toast,setTimer(()=>remove(toast),5000));
 },clear(){for(const toast of [...region.children])remove(toast);}};
}
