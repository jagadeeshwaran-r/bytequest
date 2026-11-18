import {mountChat} from './chat.js?v=workbench-1';
import {mountLiveEvents} from './live-events.js?v=profile-2';
import {mountAccountDeletion} from './account-deletion.js?v=next-1';
import {mountPresence} from './presence.js';
import {accountCard} from './presence-model.js?v=social-1';
import {createFriendToasts} from './friend-alerts.js?v=profile-2';
import {escapeHtml as h} from './community-model.js';
import {mountCloudHealthNotice} from './cloud-health.js?v=outage-1';
export function mountShell(){
 const toggle=document.getElementById('profileMenuToggle'),menu=document.getElementById('profileMenu'),slot=document.getElementById('menuAccountSlot');let cloud=null,identity=null,epoch=0,timer,tracker=null,friends=null,chat=null,card=null,painted=null,notificationOwner=null;
 const toasts=createFriendToasts();
 const cloudHealth=mountCloudHealthNotice(document);
 // All site pages share this navigation; only a server-verified library
 // admin role makes the link visible. The API checks that role again.
 const maintenanceLink=document.createElement('a');
 maintenanceLink.href='./maintenance.html';
 maintenanceLink.textContent='Site maintenance';
 maintenanceLink.dataset.adminLink='';
 maintenanceLink.hidden=true;
 menu.querySelector('a[href="./studio.html"]')?.after(maintenanceLink);
 // A narrowly scoped cache makes the recovery page available after a
 // connection drops; normal account/catalog/editor requests are never cached.
 if(typeof navigator!=='undefined'&&navigator.serviceWorker&&window.isSecureContext){
  navigator.serviceWorker.register('./runtime-sw.js?v=maintenance-1',{scope:'./'}).catch(()=>{});
 }
 // Administrator controls are hidden until authorization is confirmed by the server.
 function setAdmin(authorized){
  const show=Boolean(cloud?.user&&authorized===true);
  document.querySelectorAll('[data-admin-link]').forEach(link=>{link.hidden=!show;});
 }
 for(const id of ['accountBtn','exportBtn','communityAccount']){const item=document.getElementById(id);if(item)slot?.appendChild(item);}
 const cacheKey='bytequest.account-card';
 function paint(next){if(!next)return;const name=document.getElementById('menuName'),av=document.getElementById('menuAvatar');if(name.textContent!==next.name)name.textContent=next.name;
  if(!painted&&name.textContent===next.name&&av.firstElementChild?.getAttribute('src')===next.avatar){painted=next;return;}
  if(painted?.owner!==next.owner||painted?.avatarKey!==next.avatarKey){
   if(next.avatar){const img=document.createElement('img');img.src=next.avatar;img.alt='';img.referrerPolicy='no-referrer';img.onerror=()=>{if(av.firstChild===img)av.textContent=next.name.charAt(0).toUpperCase();};av.replaceChildren(img);}else av.textContent=next.name.charAt(0).toUpperCase();
  }painted=next;
 }
 try{const saved=JSON.parse(sessionStorage.getItem(cacheKey)||'null');if(saved&&typeof saved.owner==='string'&&typeof saved.name==='string'&&saved.name.length<=60&&Date.now()-(saved.capturedAt||saved.storedAt)<300000&&Date.now()>=saved.storedAt&&(!saved.avatar||/^https:\/\//.test(saved.avatar))){card=saved;identity=saved.owner;paint(card);}}catch{}
 document.documentElement.removeAttribute('data-account-pending');
 const tools=document.createElement('div');tools.className='header-tools';tools.innerHTML='<div class="friend-search"><input id="headerPeople" aria-label="Find friends by username or ID" placeholder="Find friends…" autocomplete="off" maxlength="50" aria-controls="headerResults" aria-expanded="false"><div id="headerResults" class="header-popover" hidden></div></div>';
 toggle.closest('.profile-dropdown').before(tools);
 const $=id=>document.getElementById(id),search=$('headerPeople'),results=$('headerResults');
 function close(){menu.hidden=true;toggle.setAttribute('aria-expanded','false');}
 function hidePanels(){results.hidden=true;search.setAttribute('aria-expanded','false');}
 function openInbox(){close();results.hidden=true;return chat?.openUpdates();}
 search.oninput=()=>{clearTimeout(timer);const query=search.value.trim(),ticket=++epoch;results.hidden=!query;search.setAttribute('aria-expanded',String(!!query));if(!query)return;results.textContent=!cloud?.user?'Sign in to find friends.':query.length<2?'Type at least two characters.':'Searching…';if(!cloud?.user||query.length<2)return;timer=setTimeout(async()=>{try{const r=await cloud.request('search',{query});if(ticket!==epoch)return;results.innerHTML=r.users.length?r.users.map(p=>'<a class="friend-result" href="./community.html#user/'+encodeURIComponent(p.username)+'"><strong>'+h(p.display_name)+'</strong><small>@'+h(p.username)+'</small></a>').join(''):'No matching profiles.';}catch(e){if(ticket===epoch)results.textContent=e.message;}},300);};
 toggle.onclick=()=>{hidePanels();menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden));};
 document.addEventListener('click',e=>{if(!e.target.closest('.profile-dropdown'))close();if(!e.target.closest('.header-tools'))hidePanels();});document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();hidePanels();}});
 menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));menu.querySelectorAll('[data-theme-choice]').forEach(b=>b.onclick=()=>{window.bytequestTheme(b.dataset.themeChoice);menu.querySelectorAll('[data-theme-choice]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
 return {connect(c){cloud=c;c.onHealth=signal=>cloudHealth.update(signal);setAdmin(false);mountAccountDeletion(c);tracker=mountPresence(c);chat=mountChat(c,{notify:(friend,options)=>typeof friend==='string'?alert(friend):toasts.show(friend,options)});friends=mountLiveEvents(c,{onBatch:batch=>{chat.unread(batch.unread,batch.updatesUnread);chat.signals(batch.chatSignals);for(const item of batch.announcements||[])chat.receiveAnnouncement(item);for(const event of batch.events||[]){if(event.kind==='friend_online')toasts.show(event.actor);else if(event.kind==='message')chat.receive(event);}},onResume:()=>chat.resume()});const before=c.onBeforeSignOut;c.onBeforeSignOut=()=>{before?.();friends.setOwner(null);chat.setOwner(null);toasts.clear();};},openChat(target){return chat?.open(target);},openInbox,focusSearch(){search.focus();},setAdmin,setAccount(user,profile){
  // Cached names/photos are presentation only; verified Firebase identity still gates every API call.
  const resolved=cloud?.loginReady||cloud?.session?.ready;if(!user&&!resolved)return;
  const owner=user?.id||null,changed=identity!==owner;cloudHealth.setOwner(owner);if(changed){identity=owner;epoch++;hidePanels();results.replaceChildren();if(card?.owner!==owner){card=null;painted=null;}}
  document.querySelectorAll(".delete-menu-button").forEach(b=>b.hidden=!user);tracker?.setOwner(user);
  chat?.setOwner(user);friends?.setOwner(user);if(changed||!user)toasts.clear();
  if(!user){setAdmin(false);card=null;painted=null;try{sessionStorage.removeItem(cacheKey);}catch{}$('menuName').textContent='Account';$('menuAvatar').textContent='A';return;}
  card=accountCard(user,profile,card);paint(card);try{sessionStorage.setItem(cacheKey,JSON.stringify(card));}catch{}
 }};
}
