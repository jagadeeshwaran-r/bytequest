import {mountCreatorAccess} from './creator-access.js?v=workbench-1';
import {companies} from './companies.js?v=social-1';
import {profileMarkup,profileAvatar,publicProfileHref} from './profile-view.js?v=profile-compact-1';
import {hydrateRecentProblemNumbers} from './profile-extras.js?v=profile-compact-1';
import {profileDetails} from './profile-fields.js?v=profile-2';
import {rankCup} from './rewards.js?v=upgrade-2';
import {receivedPresence,presenceOnline,relativeTime,profilePreferences} from './presence-model.js?v=social-1';
import {Dashboard} from './dashboard.js?v=forecast-1';
import {analyticsMarkup} from './profile-analytics.js?v=accurate-1';
import {mountShell} from './shell.js?v=workbench-1';
import {prepareAvatar} from './avatar-upload.js';
import {Cloud} from './cloud.js?v=catalog-1';
import {createViewCache} from './view-cache.js?v=avatar-1';
import {activityStats,escapeHtml as h} from './community-model.js';
const shell=mountShell();let pendingPhoto=null;let analytics=null,catalog=[],viewedTarget=null,viewedPresence=null,presenceReading=false;
const $=id=>document.getElementById(id);let epoch=0,bootEpoch=0,self=null,latest=0,lastOwner=null;
const viewCache=createViewCache();
const cloud=new Cloud(()=>boot());shell.connect(cloud);
const creatorAccess=mountCreatorAccess(cloud,{refresh:loadRoles,notify:message,isActive:()=>self?.admin&&!$('rolesPanel').hidden});
$('organizationNames').replaceChildren(...companies.map(c=>new Option(c.name,c.name)));
function message(text,error=false){$('communityMessage').textContent=text;$('communityMessage').classList.toggle('error',error);}
async function act(action,body={}){return cloud.request(action,body);}
function people(users){return users.length?users.map(p=>'<article class="person-card"><a class="person-avatar-link" href="'+publicProfileHref(p)+'" aria-label="View '+h(p.display_name)+' profile">'+profileAvatar(p)+'</a><div><a href="#user/'+encodeURIComponent(p.username)+'">'+h(p.display_name)+'</a><small>@'+h(p.username)+'</small></div></article>').join(''):'<p class="muted">No users found.</p>';}
async function boot(){
 const ticket=++bootEpoch; ++epoch; // Cancel any previous profile route on account changes.
 const owner=cloud.user?.id||null;
 if(lastOwner&&lastOwner!==owner)viewCache.clearOwner(lastOwner);
 lastOwner=owner;self=null;creatorAccess.reset();pendingPhoto=null;
 $('profilePhotoFile').value='';shell.setAccount(cloud.user);
 $('signedOut').hidden=!!owner;$('signedIn').hidden=!owner;
 $('communityAccount').textContent=owner?'Sign out':'Sign in with Google';
 if(!owner){message('Your next good idea starts with one small step.');return;}
 const cachedSelf=viewCache.self(owner);
 // The verified Firebase account can safely reuse its own cached header/profile
 // without waiting for another Supabase 'self' round trip.
 if(cachedSelf){
   self=cachedSelf;shell.setAccount(cloud.user,self.profile);
   void route();
   void refreshInbox(false).catch(()=>{}); // Notifications are always fetched live.
   message('Profile ready.');
   return; // Fresh (2-minute) account cache: no redundant self query.
 }
 try{
   const own=await act('self');
   if(ticket!==bootEpoch||cloud.user?.id!==owner)return;
   self=own;viewCache.saveSelf(owner,own);shell.setAccount(cloud.user,own.profile);
   const renamed=!!cachedSelf&&cachedSelf.profile?.username!==own.profile?.username;
   if(renamed){
     viewCache.invalidateProfile(owner,cachedSelf.profile?.username);
     viewCache.invalidateProfile(owner,own.profile?.username);
   }
   if(!cachedSelf||renamed)await route();
   if(!cachedSelf)await refreshInbox(false);
   if(ticket===bootEpoch)message('Your account is connected.');
 }catch(e){
   if(ticket===bootEpoch)message(cachedSelf?'Showing saved profile while account data reconnects.':e.message,true);
 }
}
async function route(){if(!self||!cloud.user)return;const ticket=++epoch,hash=location.hash.slice(1)||'me';for(const id of ['discover','profile','edit','inbox','roles'])$(id+'Panel').hidden=true;$('connections').replaceChildren();$('connectionsDialog').close();creatorAccess.reset();
 try{
  if(hash==='discover'){shell.focusSearch();location.hash='me';return;}
  if(hash==='edit'||hash==='me'&&!self.profile){$('editPanel').hidden=false;fillProfile();return;}
  if(hash==='inbox'){shell.openInbox();location.hash='me';return;}
  if(hash==='roles'){if(!self.admin)throw new Error('Only library administrators can manage creator access.');$('rolesPanel').hidden=false;await loadRoles();return;}
  const target=hash.startsWith('user/')?decodeURIComponent(hash.slice(5)):self.profile?.username;
  if(!target){location.hash='edit';return;}
  const owner=cloud.user.id,cached=viewCache.profile(owner,target,{allowStale:true});
  if(cached){
    // Show a previously fetched profile immediately, even if its short fresh TTL
    // expired. Replace it quietly after a fresh request; presence is NEVER cached.
    if(ticket!==epoch||cloud.user?.id!==owner)return;
    renderProfile(cached,{presencePending:true});$('profilePanel').hidden=false;
    void refreshPresence(true);
    if(!viewCache.profile(owner,target)){
      void act('profile',{target}).then(result=>{
        if(cloud.user?.id!==owner)return;
        viewCache.saveProfile(owner,target,result);
        if(ticket!==epoch||viewedTarget!==result.profile.public_id)return;
        renderProfile(result,{presencePending:true});
        void refreshPresence(true);
      }).catch(()=>{}); // Keep the cached profile if the database is unavailable.
    }
  }else{
    const result=await act('profile',{target});if(ticket!==epoch||cloud.user?.id!==owner)return;
    viewCache.saveProfile(owner,target,result);
    renderProfile(result);$('profilePanel').hidden=false;
  }
 }catch(e){if(ticket===epoch)message(e.message,true);}}
function fillProfile(){const p=self.profile||{};for(const key of ['organization_type','organization_name','organization_url','linkedin_url'])document.getElementById('detail_'+key).value=p[key]||'';$('profileUsername').value=p.username||'';$('profileName').value=p.display_name||cloud.user?.user_metadata?.full_name||'';$('profileBio').value=p.bio||'';$('profileAvatar').value=p.uploadedAvatar?'':p.avatar_url||'';$('photoPreview').hidden=!p.avatar_url;$('photoPreview').src=p.avatar_url||'';const preferences=profilePreferences(self.profile);$('profileDiscoverable').checked=preferences.discoverable;$('profilePresence').checked=preferences.show_presence;}
function renderProfile(r,{presencePending=false}={}){viewedTarget=r.profile.public_id;if(analytics){analytics.epoch++;analytics.accountGeneration++;}const p=r.profile;$('profileContent').innerHTML=profileMarkup(r,{catalogCount:catalog.length,catalog,admin:self.admin,canFollow:Boolean(self.profile?.discoverable)});
 viewedPresence=presencePending?null:receivedPresence(r.presence);
 const presenceNode=$('profilePresenceStatus');
 if(presencePending){presenceNode.dataset.status='checking';presenceNode.className='presence';presenceNode.textContent='Checking status…';}
 else paintPresence(presenceNode,viewedPresence);
 $('profileContent').insertAdjacentHTML('beforeend',analyticsMarkup);analytics=new Dashboard({cloud,getState:()=>({solved:{},days:r.stats.days||[]}),getCatalog:()=>catalog,getEvents:()=>r.stats.solves||[],summary:{solved:r.stats.solved,active:(r.stats.days||[]).length},topicInsights:r.insights?.skills||[],allowCompare:r.isOwn,name:r.isOwn?'You':'@'+p.username,profile:p,viewerProfile:self?.profile||null});analytics.open();
 const recentToggle=$('profileContent').querySelector('[data-recent-toggle]');if(recentToggle)recentToggle.onclick=()=>{const expanded=recentToggle.getAttribute('aria-expanded')!=='true',rows=$('profileContent').querySelectorAll('[data-recent-row]');rows.forEach((row,i)=>row.hidden=!expanded&&i>=3);recentToggle.setAttribute('aria-expanded',String(expanded));recentToggle.textContent=expanded?'Show less':'Show all '+rows.length+' ↗';};
 $('messageFriend')?.addEventListener('click',()=>shell.openChat(p.public_id));
 $('followBtn')?.addEventListener('click',async e=>{e.target.disabled=true;try{const fresh=await act('follow',{target:p.public_id,following:!r.isFollowing});viewCache.clearOwner(cloud.user?.id);viewCache.saveSelf(cloud.user?.id,self);renderProfile(fresh);}catch(err){message(err.message,true);e.target.disabled=false;}});
 $('profileContent').querySelectorAll('[data-connections]').forEach(b=>b.onclick=async()=>{const ticket=epoch,dialog=$('connectionsDialog'),kind=b.dataset.connections;$('connectionsTitle').textContent=(kind==='followers'?'Followers':'Following')+' ('+Number(kind==='followers'?r.followers:r.following)+')';$('connectionsList').textContent='Loading…';dialog.showModal();try{const list=await act(kind,{target:p.public_id});if(ticket===epoch&&dialog.open)$('connectionsList').innerHTML=list.users.length?people(list.users):'<p class="muted">'+(kind==='followers'?'No followers yet.':'Not following anyone yet.')+'</p>';}catch(e){if(ticket===epoch)$('connectionsList').textContent=e.message;}});
}
$('closeConnections').onclick=()=>$('connectionsDialog').close();$('connectionsList').addEventListener('click',e=>{if(e.target.closest('a'))$('connectionsDialog').close();});
async function refreshInbox(render){const r=await act('notifications');latest=r.items[0]?.id||0;const unread=r.items.filter(n=>n.id>r.lastRead).length;$('unreadBadge').textContent=unread||'';if(render)$('notifications').innerHTML=r.items.length?r.items.map(n=>'<article class="notification '+(n.id>r.lastRead?'unread':'')+'"><small>'+h(n.kind==='new'?'NEW QUEST 🐞':'CORRECTION ↻')+' · '+h(new Date(n.created_at).toLocaleDateString())+'</small><h3>'+h(n.title)+'</h3><p>'+h(n.message)+'</p><a href="./index.html?problem='+encodeURIComponent(n.problem_id)+'#practice">Let’s squash this bug ↗</a></article>').join(''):'<p class="muted">All quiet in the garden. New problems and corrections will arrive here.</p>';}
async function loadRoles(){const r=await act('roles');$('creatorList').innerHTML=r.creators.length?r.creators.map(p=>'<article class="person-card"><div><b>'+h(p.display_name)+'</b><small>@'+h(p.username)+'</small></div><button class="button secondary" data-revoke="'+h(p.public_id)+'">Revoke</button></article>').join(''):'<p class="muted">No delegated creators yet.</p>';$('creatorList').querySelectorAll('[data-revoke]').forEach(b=>b.onclick=async()=>{if(!confirm('Revoke this account’s creator access?'))return;try{await act('role-set',{target:b.dataset.revoke,creator:false});await loadRoles();message('Creator access revoked.');}catch(e){message(e.message,true);}});}
$('profilePhotoFile').onchange=async e=>{try{pendingPhoto=await prepareAvatar(e.target.files[0]);$('photoPreview').src='data:image/jpeg;base64,'+pendingPhoto;$('photoPreview').hidden=false;message('Photo ready. Save your profile to upload it.');}catch(err){pendingPhoto=null;e.target.value='';message(err.message,true);}};
$('findForm').onsubmit=async e=>{e.preventDefault();const ticket=epoch;try{const r=await act('search',{query:$('peopleQuery').value.trim()});if(ticket===epoch)$('peopleResults').innerHTML=people(r.users);}catch(err){message(err.message,true);}};
$('profileForm').onsubmit=async e=>{e.preventDefault();try{self=await act('profile-save',{username:$('profileUsername').value.trim().toLowerCase(),display_name:$('profileName').value.trim(),bio:$('profileBio').value,avatar_url:$('profileAvatar').value.trim(),discoverable:$('profileDiscoverable').checked,show_presence:$('profilePresence').checked,...profileDetails(Object.fromEntries(['organization_type','organization_name','organization_url','linkedin_url'].map(k=>[k,document.getElementById('detail_'+k).value])))});if(pendingPhoto){message('Uploading your photo…');self=await act('avatar-upload',{image:pendingPhoto});pendingPhoto=null;$('profilePhotoFile').value='';}viewCache.clearOwner(cloud.user?.id);viewCache.saveSelf(cloud.user?.id,self);shell.setAccount(cloud.user,self.profile);message('Your profile is saved.');if(location.hash==='#me')await route();else location.hash='me';}catch(err){message(err.message,true);}};

$('readAll').onclick=async()=>{try{await act('notifications-read',{id:latest});await refreshInbox(true);}catch(e){message(e.message,true);}};
async function login(){try{message('Opening Google sign-in…');await cloud.signIn();}catch(e){message(e.message,true);}}
$('communitySignIn').onclick=login;$('communityAccount').onclick=async()=>{try{if(cloud.user)await cloud.signOut();else await login();}catch(e){message(e.message,true);}};
addEventListener('hashchange',route);addEventListener('focus',()=>{if(cloud.user&&self)refreshInbox(location.hash==='#inbox').catch(()=>{});});
// Public problem metadata can load in parallel with Firebase; never delay
// profile rendering on a catalog request (even during an offline fallback).
catalog=cloud.readCatalogCache()?.problems||[];
void cloud.publicCatalog().then(rows=>{
  if(rows){catalog=rows;hydrateRecentProblemNumbers($('profileContent'),catalog);analytics?.render();}
}).catch(()=>{});
cloud.init().then(boot).catch(e=>{message(e.message,true);$('signedOut').hidden=false;});

// Status polls do not recreate the profile, charts or header avatar.
async function refreshPresence(force=false){if((presenceReading&&!force)||!cloud.user||!viewedTarget||(!force&&(document.visibilityState!=='visible'||!document.hasFocus()))||$('profilePanel').hidden)return;presenceReading=true;const target=viewedTarget,ticket=epoch;try{const r=await act('profile-presence',{target});if(ticket===epoch&&target===viewedTarget){viewedPresence=receivedPresence(r.presence);paintPresence($('profilePresenceStatus'),viewedPresence);}}catch{}finally{presenceReading=false;}}
setInterval(refreshPresence,5000);addEventListener('focus',refreshPresence);
setInterval(()=>{if(document.visibilityState==='visible'&&!$('profilePanel').hidden)paintPresence($('profilePresenceStatus'),viewedPresence);},1000);
function paintPresence(el,p){if(!el)return;const online=presenceOnline(p);const ago=relativeTime(p?.lastSeenMs??p?.lastSeen);const text=p?.visible?(ago?'Last seen '+ago:'Not active yet'):'Online status is private';const key=online?'online':text;if(el.dataset.status===key)return;el.dataset.status=key;el.className='presence'+(online?' online':'');el.replaceChildren();if(online){const dot=document.createElement('span');dot.className='presence-radar';dot.setAttribute('role','img');dot.setAttribute('aria-label','Online');dot.title='Online';el.append(dot);}else el.textContent=text;}
