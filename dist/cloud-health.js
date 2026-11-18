// A persistent, owner-scoped connection warning shared by Problems and Profile.
// Only server-confirmed syncs clear the unsynced warning. This is not a provider outage monitor.
const PREFIX='bytequest.sync-health.v1.';
const PENDING_WARNING_MS=15000;

export function describeCloudHealth(state,{online=true,now=Date.now()}={}){
  if(!online)return {kind:'offline',title:'You are offline',message:'ByteQuest cannot sync while offline. Keep your browser data and back up your work before leaving.'};
  if(!state||typeof state!=='object')return null;
  const local=state.localSaved===true?'Your latest changes were saved on this device, but not confirmed in the cloud.':'Your latest changes are not confirmed in the cloud. Back up your work before leaving.';
  switch(state.kind){
    case 'storage-failed':return {kind:'storage-failed',title:'Local backup unavailable',message:'The browser could not safely store your work. Copy your code and export a backup now.'};
    case 'sync-failed':return {kind:'sync-failed',title:'Cloud sync failed',message:local+' Your profile, streak and solved ticks may show older progress.'};
    case 'auth':return {kind:'auth',title:'Account connection interrupted',message:'ByteQuest could not verify your Firebase sign-in. New solves are not confirmed in your account. Avoid signing out or clearing site data.'};
    case 'throttled':return {kind:'throttled',title:'Too many requests',message:'ByteQuest is temporarily limiting requests. Keep your draft and retry after the limit clears.'};
    case 'verification':return {kind:'verification',title:'Submission verification unavailable',message:'The server could not verify this submission. Browser practice and server-verified accepted solutions are different; hidden cases remain unverified.'};
    case 'service':return {kind:'service',title:'ByteQuest server busy or unreachable',message:'A ByteQuest cloud request failed. This does not necessarily mean Supabase or Firebase is down. '+local};
    case 'pending':
      return Number.isFinite(state.at)&&now-state.at>=PENDING_WARNING_MS
        ?{kind:'pending',title:'Cloud sync is taking longer than expected',message:local+' You may see an older solved count on your profile.'}
        :null;
    default:return null;
  }
}

export function createCloudHealthStore({storage=null,clock=()=>Date.now()}={}){
  let owner=null,state=null;
  const key=()=>owner?PREFIX+owner:null;
  const save=()=>{
    const k=key();if(!k)return;
    try{
      if(state)storage?.setItem(k,JSON.stringify(state));
      else storage?.removeItem(k);
    }catch{/* Status persistence is best effort; never block saving code. */}
  };
  return {
    setOwner(next){
      if(owner===next)return;
      owner=next||null;state=null;
      try{
        const raw=owner&&storage?.getItem(key());
        if(raw){const parsed=JSON.parse(raw);if(['pending','sync-failed','storage-failed','auth','throttled','verification','service'].includes(parsed?.kind)&&
          Number.isFinite(parsed.at)&&parsed.at<=clock()&&clock()-parsed.at<7*86400000)state=parsed;}
      }catch{/* Continue with current-session status. */}
    },
    update(signal={}){
      const kind=signal.kind,at=clock();
      if(!owner&&kind!=='storage-failed')return;
      if(kind==='synced'){state=null;save();return;}
      if(kind==='pending'){
        if(state?.kind==='sync-failed'||state?.kind==='storage-failed'||state?.kind==='auth'||state?.kind==='service')return;
        state={kind:'pending',at:state?.kind==='pending'?state.at:at,localSaved:signal.localSaved===true};
      }else if(kind==='storage-failed'){
        state={kind,at,localSaved:false};
      }else if(kind==='sync-failed'){
        state={kind,at,localSaved:signal.localSaved===true};
      }else if(kind==='request-error'){
        const status=Number(signal.status)||0,action=String(signal.action||'');
        // Expected validation/permission failures are NOT system outages.
        const serious=status===0||status===401||status===429||status>=500;
        if(!serious||state?.kind==='storage-failed'||state?.kind==='sync-failed')return;
        const next=status===401||signal.authTimeout?'auth':status===429?'throttled':
          action==='submission-create'&&status===503?'verification':'service';
        state={kind:next,at,action,localSaved:signal.localSaved===true||state?.localSaved===true};
      }else if(kind==='request-ok'){
        // A successful profile/leaderboard fetch does not prove that pending
        // solves were synced. Clear only the matching transient service error.
        if(state?.action===signal.action&&['service','auth','throttled','verification'].includes(state.kind))state=null;
        else return;
      }else return;
      save();
    },
    view({online=true}={}){return describeCloudHealth(state,{online,now:clock()});},
    getState(){return state&&{...state};}
  };
}

export function mountCloudHealthNotice(doc=globalThis.document){
  if(!doc?.createElement)return {setOwner(){},update(){}};
  let storage=null;
  try{storage=doc.defaultView?.localStorage||null;}catch{}
  const model=createCloudHealthStore({storage});
  const notice=doc.createElement('aside');
  notice.className='bq-cloud-health';
  notice.id='bytequestCloudHealth';
  notice.setAttribute('role','status');
  notice.setAttribute('aria-live','polite');
  notice.hidden=true;
  const copy=doc.createElement('div');copy.className='bq-cloud-health-copy';
  const headline=doc.createElement('strong');
  const detail=doc.createElement('p');
  copy.append(headline,detail);
  const actions=doc.createElement('div');actions.className='bq-cloud-health-actions';
  const backup=doc.createElement('button');backup.type='button';backup.textContent='Back up progress';
  const account=doc.createElement('button');account.type='button';account.textContent='Open sync settings';
  const status=doc.createElement('a');status.href='https://status.supabase.com/';status.target='_blank';status.rel='noopener noreferrer';status.textContent='Provider status';
  backup.addEventListener('click',()=>doc.getElementById('exportBtn')?.click());
  account.addEventListener('click',()=>doc.getElementById('accountBtn')?.click());
  actions.append(backup,account,status);
  notice.append(copy,actions);
  (doc.querySelector('.minimal-header')||doc.body.firstElementChild)?.after(notice);
  const stylesheet=doc.createElement('link');stylesheet.rel='stylesheet';stylesheet.href='./cloud-health.css?v=1';doc.head?.append(stylesheet);
  const view=()=>{
    const result=model.view({online:doc.defaultView?.navigator?.onLine!==false});
    notice.hidden=!result;
    if(!result)return;
    notice.dataset.kind=result.kind;
    headline.textContent=result.title;
    detail.textContent=result.message;
    backup.hidden=!doc.getElementById('exportBtn');
    account.hidden=!doc.getElementById('accountBtn');
  };
  let pendingTimer;
  const update=signal=>{
    model.update(signal);view();
    if(signal?.kind==='pending'){
      clearTimeout(pendingTimer);
      pendingTimer=setTimeout(view,PENDING_WARNING_MS+100);
    }else if(signal?.kind==='synced')clearTimeout(pendingTimer);
  };
  doc.defaultView?.addEventListener('online',view);
  doc.defaultView?.addEventListener('offline',view);
  return {setOwner(owner){model.setOwner(owner);view();},update};
}
