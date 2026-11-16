import {mountShell} from './shell.js?v=workbench-1';
import {Cloud} from './cloud.js?v=catalog-1';
import {leaderboardRow,latestLeaderboard} from './leaderboard-model.js?v=avatar-1';
import {createViewCache} from './view-cache.js?v=avatar-1';
import {hydrateLeaderboardAvatars,releaseAvatarObjectUrls} from './avatar-cache.js?v=avatar-1';
const $=id=>document.getElementById(id),shell=mountShell();let page=0,scope=location.hash==='#friends'?'friends':'global',accountGeneration=0,lastOwner=null;
const cloud=new Cloud(()=>accountChanged());shell.connect(cloud);
const cache=createViewCache();
const loader=latestLeaderboard(async(action,query,owner)=>{
 const {force=false,...filters}=query;
 if(!force){const saved=cache.board(owner,filters,{allowStale:true});if(saved)return {...saved,_cached:true};}
 const fresh=await cloud.request(action,filters,owner);
 if(cloud.user?.id===owner)cache.saveBoard(owner,filters,fresh);
 return {...fresh,_cached:false};
});
function setMessage(text,error=false){$('leaderMessage').textContent=text;$('leaderMessage').classList.toggle('error',error);$('leaderAuthMessage').textContent=text;$('leaderAuthMessage').classList.toggle('error',error);}
function selectScope(){for(const button of document.querySelectorAll('[data-board]')){const active=button.dataset.board===scope;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}const selected=document.querySelector('[data-board="'+scope+'"]');$('leaderPanel').setAttribute('aria-labelledby',selected.id);$('boardHeading').textContent=scope==='friends'?'Friends leaderboard':'Global leaderboard';$('boardDescription').textContent=scope==='friends'?'You and the people you follow, in one place.':'A shared place for every discoverable learner.';}
function clearResults(){releaseAvatarObjectUrls();for(const id of ['yourRank','yourPoints','yourSolved','rankedLearners'])$(id).textContent='—';$('leaderRows').replaceChildren();$('leaderFindMe').hidden=true;$('leaderEmpty').hidden=true;$('leaderError').hidden=true;$('leaderPager').hidden=true;$('yourPosition').hidden=true;$('profileNudge').hidden=true;}
async function load({force=false}={}){
 const owner=cloud.user?.id;if(!owner)return;selectScope();clearResults();$('leaderPanel').setAttribute('aria-busy','true');$('leaderLoading').hidden=false;$('leaderRefresh').disabled=true;setMessage('Loading rankings…');
 try{const response=await loader.load({scope,period:$('leaderPeriod').value,page,force},owner);if(!response)return;
  const r=response.result;if(page>0&&!r.users.length){page=Math.max(0,Math.ceil(r.total/r.pageSize)-1);load();return;}
  $('leaderRows').innerHTML=r.users.map(leaderboardRow).join('');$('leaderRows').querySelectorAll('img').forEach(img=>img.onerror=()=>img.remove());$('leaderFindMe').hidden=!$('leaderRows').querySelector('.your-ranking');
  void hydrateLeaderboardAvatars($('leaderRows'),owner); // Rehydrate saved image bytes, even after signed URLs expire.
  $('yourRank').textContent=r.me?'#'+r.me.rank:'—';$('yourPoints').textContent=r.me?.points??'—';$('yourSolved').textContent=r.me?.solved??'—';$('rankedLearners').textContent=r.total;
  $('leaderEmpty').hidden=!!r.users.length;$('emptyTitle').textContent=scope==='friends'?'Build your practice circle.':'Be the first on the board.';$('emptyDescription').textContent=scope==='friends'?'Create a discoverable profile, then find and follow friends using the search above.':'Create a discoverable profile to join the leaderboard.';
  $('profileNudge').hidden=!!r.discoverable;$('profileNudgeText').textContent=r.hasProfile?'Make your profile discoverable to appear in the rankings.':'Create a profile to join the rankings and compare with friends.';
  $('friendHint').hidden=scope!=='friends'||r.total>1;
  const start=page*r.pageSize+1,end=Math.min((page+1)*r.pageSize,r.total);$('pageRange').textContent=r.total?start+'–'+end+' of '+r.total+' learners':'0 learners';$('leaderPager').hidden=r.total<=r.pageSize;$('leaderPrevious').disabled=page===0;$('leaderNext').disabled=end>=r.total;
  $('yourPosition').hidden=!r.me||r.users.some(p=>p.isYou);$('yourPosition').textContent=r.me?'Your position: #'+r.me.rank+' · '+r.me.points+' points · '+r.me.solved+' solved in this period.':'';
  setMessage(r._cached?'Saved rankings · Press Refresh ranks for the latest positions.':'Rankings updated from the server.');$('leaderLoading').hidden=true;$('leaderPanel').setAttribute('aria-busy','false');$('leaderRefresh').disabled=false;
 }catch(e){if(cloud.user?.id!==owner)return;$('leaderLoading').hidden=true;$('leaderError').hidden=false;$('leaderErrorText').textContent=e.message;$('leaderPanel').setAttribute('aria-busy','false');$('leaderRefresh').disabled=false;setMessage('Rankings could not be loaded.',true);}
}
async function accountChanged(){
 const ticket=++accountGeneration;loader.cancel();const nextOwner=cloud.user?.id||null;if(lastOwner&&lastOwner!==nextOwner)cache.clearOwner(lastOwner);lastOwner=nextOwner;shell.setAccount(cloud.user);clearResults();const signedIn=!!cloud.user;
 $('leaderAuthMessage').hidden=signedIn;$('leaderSignedOut').hidden=signedIn;$('leaderSignedIn').hidden=!signedIn;$('communityAccount').textContent=signedIn?'Sign out':'Sign in with Google';
 if(!signedIn){setMessage('Sign in to see the community and your friends.');return;}
 // Show cached rankings immediately; load verified profile details independently.
 // Neither the account response nor notifications are cached.
 const rankings=load();
 const savedAccount=cache.self(nextOwner);
 if(savedAccount){
   // Account is already verified by Firebase; no duplicate self RPC within TTL.
   shell.setAccount(cloud.user,savedAccount.profile);
 }else{
   try{
     const own=await cloud.request('self');
     if(ticket===accountGeneration&&cloud.user?.id===nextOwner){
       cache.saveSelf(nextOwner,own);shell.setAccount(cloud.user,own.profile);
     }
   }catch(e){
     if(ticket===accountGeneration)console.warn('ByteQuest profile details are temporarily unavailable:',e.message);
   }
 }
 await rankings;
}
async function login(){try{await cloud.signIn();}catch(e){setMessage(e.message,true);}}
$('leaderSignIn').onclick=login;$('communityAccount').onclick=async()=>{try{if(cloud.user)await cloud.signOut();else await login();}catch(e){setMessage(e.message,true);}};
document.querySelectorAll('[data-board]').forEach(button=>{button.onclick=()=>{const next=button.dataset.board;if(next===scope)return;location.hash=next;};button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?'global':e.key==='End'?'friends':scope==='global'?'friends':'global';document.querySelector('[data-board="'+next+'"]').focus();if(next!==scope)location.hash=next;};});
addEventListener('hashchange',()=>{scope=location.hash==='#friends'?'friends':'global';page=0;selectScope();load();});$('leaderPeriod').onchange=()=>{page=0;load();};$('leaderRefresh').onclick=()=>load({force:true});$('leaderFindMe').onclick=()=>{const row=$('leaderRows').querySelector('.your-ranking');if(!row)return;row.tabIndex=-1;row.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});row.focus({preventScroll:true});};$('leaderRetry').onclick=()=>accountChanged();$('leaderPrevious').onclick=()=>{if(page>0){page--;load();}};$('leaderNext').onclick=()=>{page++;load();};
addEventListener('pagehide',releaseAvatarObjectUrls);
selectScope();cloud.init().then(accountChanged).catch(e=>{setMessage(e.message,true);$('leaderSignedOut').hidden=false;});
