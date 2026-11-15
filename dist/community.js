import {companies} from './companies.js?v=social-1';
import {profileMarkup,profileAvatar,publicProfileHref} from './profile-view.js?v=profile-2';
import {profileDetails} from './profile-fields.js?v=profile-2';
import {rankCup} from './rewards.js?v=upgrade-2';
import {receivedPresence,presenceOnline,relativeTime,profilePreferences} from './presence-model.js?v=social-1';
import {Dashboard} from './dashboard.js?v=next-1';
import {analyticsMarkup} from './profile-analytics.js?v=profile-2';
import {mountShell} from './shell.js?v=profile-2';
import {prepareAvatar} from './avatar-upload.js';
import {Cloud} from './cloud.js?v=cpp-1';
import {activityStats,escapeHtml as h} from './community-model.js';
const shell=mountShell();let pendingPhoto=null;let analytics=null,catalog=[],viewedTarget=null,viewedPresence=null,presenceReading=false;
const $=id=>document.getElementById(id);let epoch=0,self=null,latest=0;
const cloud=new Cloud(()=>boot());shell.connect(cloud);
$('organizationNames').replaceChildren(...companies.map(c=>new Option(c.name,c.name)));
function message(text,error=false){$('communityMessage').textContent=text;$('communityMessage').classList.toggle('error',error);}
async function act(action,body={}){return cloud.request(action,body);}
function people(users){return users.length?users.map(p=>'<article class="person-card"><a class="person-avatar-link" href="'+publicProfileHref(p)+'" aria-label="View '+h(p.display_name)+' profile">'+profileAvatar(p)+'</a><div><a href="#user/'+encodeURIComponent(p.username)+'">'+h(p.display_name)+'</a><small>@'+h(p.username)+'</small></div></article>').join(''):'<p class="muted">No users found.</p>';}
async function boot(){const ticket=++epoch;self=null;pendingPhoto=null;$('profilePhotoFile').value='';shell.setAccount(cloud.user);$('signedOut').hidden=!!cloud.user;$('signedIn').hidden=!cloud.user;$('communityAccount').textContent=cloud.user?'Sign out':'Sign in with Google';
 if(!cloud.user){message('Your next good idea starts with one small step.');return;}
 try{const own=await act('self');if(ticket!==epoch)return;self=own;shell.setAccount(cloud.user,self.profile);await route();await refreshInbox(false);message('Your account is connected.');}catch(e){if(ticket===epoch)message(e.message,true);}}
async function route(){if(!self||!cloud.user)return;const ticket=++epoch,hash=location.hash.slice(1)||'me';for(const id of ['discover','profile','edit','inbox','roles'])$(id+'Panel').hidden=true;$('connections').replaceChildren();$('connectionsDialog').close();
 try{
  if(hash==='discover'){shell.focusSearch();location.hash='me';return;}
  if(hash==='edit'||hash==='me'&&!self.profile){$('editPanel').hidden=false;fillProfile();return;}
  if(hash==='inbox'){shell.openInbox();location.hash='me';return;}
  if(hash==='roles'){if(!self.admin)throw new Error('Only library administrators can manage creator access.');$('rolesPanel').hidden=false;await loadRoles();return;}
  const target=hash.startsWith('user/')?decodeURIComponent(hash.slice(5)):self.profile?.username;
  if(!target){location.hash='edit';return;}
  const result=await act('profile',{target});if(ticket!==epoch)return;renderProfile(result);$('profilePanel').hidden=false;
 }catch(e){if(ticket===epoch)message(e.message,true);}}
function fillProfile(){const p=self.profile||{};for(const key of ['organization_type','organization_name','organization_url','linkedin_url'])document.getElementById('detail_'+key).value=p[key]||'';$('profileUsername').value=p.username||'';$('profileName').value=p.display_name||cloud.user?.user_metadata?.full_name||'';$('profileBio').value=p.bio||'';$('profileAvatar').value=p.uploadedAvatar?'':p.avatar_url||'';$('photoPreview').hidden=!p.avatar_url;$('photoPreview').src=p.avatar_url||'';const preferences=profilePreferences(self.profile);$('profileDiscoverable').checked=preferences.discoverable;$('profilePresence').checked=preferences.show_presence;}
function renderProfile(r){viewedTarget=r.profile.public_id;if(analytics)analytics.epoch++;const p=r.profile;$('profileContent').innerHTML=profileMarkup(r,{catalogCount:catalog.length,admin:self.admin,canFollow:Boolean(self.profile?.discoverable)});
 viewedPresence=receivedPresence(r.presence);paintPresence($('profilePresenceStatus'),viewedPresence);$('profileContent').insertAdjacentHTML('beforeend',analyticsMarkup);analytics=new Dashboard({cloud,getState:()=>({solved:{},days:r.stats.days||[]}),getCatalog:()=>catalog,getEvents:()=>r.stats.solves||[],summary:{solved:r.stats.solved,active:(r.stats.days||[]).length},allowCompare:r.isOwn,name:r.isOwn?'You':'@'+p.username,profile:p});analytics.open();
 $('messageFriend')?.addEventListener('click',()=>shell.openChat(p.public_id));
 $('followBtn')?.addEventListener('click',async e=>{e.target.disabled=true;try{const fresh=await act('follow',{target:p.public_id,following:!r.isFollowing});renderProfile(fresh);}catch(err){message(err.message,true);e.target.disabled=false;}});
 $('profileContent').querySelectorAll('[data-connections]').forEach(b=>b.onclick=async()=>{const ticket=epoch,dialog=$('connectionsDialog'),kind=b.dataset.connections;$('connectionsTitle').textContent=(kind==='followers'?'Followers':'Following')+' ('+Number(kind==='followers'?r.followers:r.following)+')';$('connectionsList').textContent='Loading…';dialog.showModal();try{const list=await act(kind,{target:p.public_id});if(ticket===epoch&&dialog.open)$('connectionsList').innerHTML=list.users.length?people(list.users):'<p class="muted">'+(kind==='followers'?'No followers yet.':'Not following anyone yet.')+'</p>';}catch(e){if(ticket===epoch)$('connectionsList').textContent=e.message;}});
}
$('closeConnections').onclick=()=>$('connectionsDialog').close();$('connectionsList').addEventListener('click',e=>{if(e.target.closest('a'))$('connectionsDialog').close();});
async function refreshInbox(render){const r=await act('notifications');latest=r.items[0]?.id||0;const unread=r.items.filter(n=>n.id>r.lastRead).length;$('unreadBadge').textContent=unread||'';if(render)$('notifications').innerHTML=r.items.length?r.items.map(n=>'<article class="notification '+(n.id>r.lastRead?'unread':'')+'"><small>'+h(n.kind==='new'?'NEW QUEST 🐞':'CORRECTION ↻')+' · '+h(new Date(n.created_at).toLocaleDateString())+'</small><h3>'+h(n.title)+'</h3><p>'+h(n.message)+'</p><a href="./index.html?problem='+encodeURIComponent(n.problem_id)+'#practice">Let’s squash this bug ↗</a></article>').join(''):'<p class="muted">All quiet in the garden. New problems and corrections will arrive here.</p>';}
async function loadRoles(){const r=await act('roles');$('creatorList').innerHTML=r.creators.length?r.creators.map(p=>'<article class="person-card"><div><b>'+h(p.display_name)+'</b><small>@'+h(p.username)+'</small></div><button class="button secondary" data-revoke="'+h(p.public_id)+'">Revoke</button></article>').join(''):'<p class="muted">No delegated creators yet.</p>';$('creatorList').querySelectorAll('[data-revoke]').forEach(b=>b.onclick=async()=>{if(!confirm('Revoke this account’s creator access?'))return;try{await act('role-set',{target:b.dataset.revoke,creator:false});await loadRoles();message('Creator access revoked.');}catch(e){message(e.message,true);}});}
$('profilePhotoFile').onchange=async e=>{try{pendingPhoto=await prepareAvatar(e.target.files[0]);$('photoPreview').src='data:image/jpeg;base64,'+pendingPhoto;$('photoPreview').hidden=false;message('Photo ready. Save your profile to upload it.');}catch(err){pendingPhoto=null;e.target.value='';message(err.message,true);}};
$('findForm').onsubmit=async e=>{e.preventDefault();const ticket=epoch;try{const r=await act('search',{query:$('peopleQuery').value.trim()});if(ticket===epoch)$('peopleResults').innerHTML=people(r.users);}catch(err){message(err.message,true);}};
$('profileForm').onsubmit=async e=>{e.preventDefault();try{self=await act('profile-save',{username:$('profileUsername').value.trim().toLowerCase(),display_name:$('profileName').value.trim(),bio:$('profileBio').value,avatar_url:$('profileAvatar').value.trim(),discoverable:$('profileDiscoverable').checked,show_presence:$('profilePresence').checked,...profileDetails(Object.fromEntries(['organization_type','organization_name','organization_url','linkedin_url'].map(k=>[k,document.getElementById('detail_'+k).value])))});if(pendingPhoto){message('Uploading your photo…');self=await act('avatar-upload',{image:pendingPhoto});pendingPhoto=null;$('profilePhotoFile').value='';}shell.setAccount(cloud.user,self.profile);message('Your profile is saved.');if(location.hash==='#me')await route();else location.hash='me';}catch(err){message(err.message,true);}};
$('creatorForm').onsubmit=async e=>{e.preventDefault();if(!confirm('Grant this account permission to create, change and publish all library problems and access private tests?'))return;try{await act('role-set',{target:$('creatorId').value.trim(),creator:true});await loadRoles();message('Creator access granted.');}catch(err){message(err.message,true);}};
$('readAll').onclick=async()=>{try{await act('notifications-read',{id:latest});await refreshInbox(true);}catch(e){message(e.message,true);}};
async function login(){try{message('Opening Google sign-in…');await cloud.signIn();}catch(e){message(e.message,true);}}
$('communitySignIn').onclick=login;$('communityAccount').onclick=async()=>{try{if(cloud.user)await cloud.signOut();else await login();}catch(e){message(e.message,true);}};
addEventListener('hashchange',route);addEventListener('focus',()=>{if(cloud.user&&self)refreshInbox(location.hash==='#inbox').catch(()=>{});});
cloud.init().then(async()=>{try{catalog=await cloud.publicCatalog()||[];}catch{}await boot();}).catch(e=>{message(e.message,true);$('signedOut').hidden=false;});

// Status polls do not recreate the profile, charts or header avatar.
async function refreshPresence(){if(presenceReading||!cloud.user||!viewedTarget||(document.visibilityState!=='visible'||!document.hasFocus())||$('profilePanel').hidden)return;presenceReading=true;const target=viewedTarget,ticket=epoch;try{const r=await act('profile-presence',{target});if(ticket===epoch&&target===viewedTarget){viewedPresence=receivedPresence(r.presence);paintPresence($('profilePresenceStatus'),viewedPresence);}}catch{}finally{presenceReading=false;}}
setInterval(refreshPresence,5000);addEventListener('focus',refreshPresence);
setInterval(()=>{if(document.visibilityState==='visible'&&!$('profilePanel').hidden)paintPresence($('profilePresenceStatus'),viewedPresence);},1000);
function paintPresence(el,p){if(!el)return;const online=presenceOnline(p);const ago=relativeTime(p?.lastSeenMs??p?.lastSeen);const text=p?.visible?(ago?'Last seen '+ago:'Not active yet'):'Online status is private';const key=online?'online':text;if(el.dataset.status===key)return;el.dataset.status=key;el.className='presence'+(online?' online':'');el.replaceChildren();if(online){const dot=document.createElement('span');dot.className='presence-radar';dot.setAttribute('role','img');dot.setAttribute('aria-label','Online');dot.title='Online';el.append(dot);}else el.textContent=text;}
