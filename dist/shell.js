import {mountPresence} from './presence.js';
import {accountCard} from './presence-model.js?v=presence-2';
import {escapeHtml as h} from './community-model.js';
export function mountShell(){
 const toggle=document.getElementById('profileMenuToggle'),menu=document.getElementById('profileMenu'),slot=document.getElementById('menuAccountSlot');let cloud=null,identity=null,epoch=0,timer,tracker=null,card=null,painted=null,notificationOwner=null;
 for(const id of ['accountBtn','exportBtn','communityAccount']){const item=document.getElementById(id);if(item)slot?.appendChild(item);}
 const cacheKey='bytequest.account-card';
 function paint(next){if(!next)return;const name=document.getElementById('menuName'),av=document.getElementById('menuAvatar');if(name.textContent!==next.name)name.textContent=next.name;
  if(painted?.owner!==next.owner||painted?.avatarKey!==next.avatarKey){
   if(next.avatar){const img=document.createElement('img');img.src=next.avatar;img.alt='';img.referrerPolicy='no-referrer';img.onerror=()=>{if(av.firstChild===img)av.textContent=next.name.charAt(0).toUpperCase();};av.replaceChildren(img);}else av.textContent=next.name.charAt(0).toUpperCase();
  }painted=next;
 }
 try{const saved=JSON.parse(sessionStorage.getItem(cacheKey)||'null');if(saved&&typeof saved.owner==='string'&&typeof saved.name==='string'&&saved.name.length<=60&&Date.now()-(saved.capturedAt||saved.storedAt)<300000&&Date.now()>=saved.storedAt&&(!saved.avatar||/^https:\/\//.test(saved.avatar))){card=saved;identity=saved.owner;paint(card);}}catch{}
 document.documentElement.removeAttribute('data-account-pending');
 const tools=document.createElement('div');tools.className='header-tools';tools.innerHTML='<div class="friend-search"><input id="headerPeople" aria-label="Find friends by username or ID" placeholder="Find friends…" autocomplete="off" maxlength="50" aria-controls="headerResults" aria-expanded="false"><div id="headerResults" class="header-popover" hidden></div></div><div class="inbox-dropdown"><button id="inboxToggle" class="message-button" aria-label="Inbox" aria-expanded="false" aria-controls="headerInbox"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 5h16v12H9l-5 4V5Z"/><path d="M8 9h8M8 13h5"/></svg><span id="headerUnread"></span></button><div id="headerInbox" class="header-popover" hidden><div class="inbox-heading"><strong>Inbox</strong><button id="headerRead">Mark all read</button></div><div id="headerNotifications"></div></div></div>';
 toggle.closest('.profile-dropdown').before(tools);
 const $=id=>document.getElementById(id),search=$('headerPeople'),results=$('headerResults'),inbox=$('headerInbox');let latest=0;
 function close(){menu.hidden=true;toggle.setAttribute('aria-expanded','false');}
 function hidePanels(){results.hidden=true;inbox.hidden=true;search.setAttribute('aria-expanded','false');$('inboxToggle').setAttribute('aria-expanded','false');}
 async function notifications(){const ticket=epoch;if(!cloud?.user){$('headerNotifications').textContent='Sign in to see new problems and corrections.';return;}try{const r=await cloud.request('notifications');if(ticket!==epoch)return;latest=r.items[0]?.id||0;const n=r.items.filter(x=>x.id>r.lastRead).length;$('headerUnread').textContent=n||'';$('headerNotifications').innerHTML=r.items.length?r.items.map(x=>'<a class="inbox-item '+(x.id>r.lastRead?'unread':'')+'" href="./index.html?problem='+encodeURIComponent(x.problem_id)+'#practice"><small>'+h(x.kind==='new'?'New problem':'Correction')+' · '+h(new Date(x.created_at).toLocaleDateString())+'</small><strong>'+h(x.title)+'</strong><span>'+h(x.message)+'</span></a>').join(''):'<p>No updates yet.</p>';}catch(e){if(ticket===epoch)$('headerNotifications').textContent=e.message;}}
 function openInbox(){close();results.hidden=true;inbox.hidden=!inbox.hidden;$('inboxToggle').setAttribute('aria-expanded',String(!inbox.hidden));if(!inbox.hidden)notifications();}
 $('inboxToggle').onclick=openInbox;
 $('headerRead').onclick=async()=>{if(!cloud?.user)return;try{await cloud.request('notifications-read',{id:latest});await notifications();}catch(e){$('headerNotifications').textContent=e.message;}};
 search.oninput=()=>{clearTimeout(timer);const query=search.value.trim(),ticket=++epoch;results.hidden=!query;search.setAttribute('aria-expanded',String(!!query));if(!query)return;results.textContent=!cloud?.user?'Sign in to find friends.':query.length<2?'Type at least two characters.':'Searching…';if(!cloud?.user||query.length<2)return;timer=setTimeout(async()=>{try{const r=await cloud.request('search',{query});if(ticket!==epoch)return;results.innerHTML=r.users.length?r.users.map(p=>'<a class="friend-result" href="./community.html#user/'+encodeURIComponent(p.username)+'"><strong>'+h(p.display_name)+'</strong><small>@'+h(p.username)+'</small></a>').join(''):'No matching profiles.';}catch(e){if(ticket===epoch)results.textContent=e.message;}},300);};
 toggle.onclick=()=>{hidePanels();menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden));};
 document.addEventListener('click',e=>{if(!e.target.closest('.profile-dropdown'))close();if(!e.target.closest('.header-tools'))hidePanels();});document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();hidePanels();}});
 menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));menu.querySelectorAll('[data-theme-choice]').forEach(b=>b.onclick=()=>{window.bytequestTheme(b.dataset.themeChoice);menu.querySelectorAll('[data-theme-choice]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
 return {connect(c){cloud=c;tracker=mountPresence(c);},openInbox,focusSearch(){search.focus();},setAccount(user,profile){
  // Cached names/photos are presentation only; verified Firebase identity still gates every API call.
  const resolved=cloud?.loginReady||cloud?.session?.ready;if(!user&&!resolved)return;
  const owner=user?.id||null;if(identity!==owner){identity=owner;epoch++;hidePanels();results.replaceChildren();$('headerNotifications').replaceChildren();$('headerUnread').textContent='';notificationOwner=null;if(card?.owner!==owner){card=null;painted=null;}}
  tracker?.setOwner(user);
  if(!user){card=null;painted=null;try{sessionStorage.removeItem(cacheKey);}catch{}$('menuName').textContent='Account';$('menuAvatar').textContent='A';return;}
  card=accountCard(user,profile,card);paint(card);try{sessionStorage.setItem(cacheKey,JSON.stringify(card));}catch{}
  if(notificationOwner!==owner){notificationOwner=owner;notifications();}
 }};
}
