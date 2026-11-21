import {connectionPageUrl,issueFromCloudHealth} from './system-state.js?v=1';

// Quiet, owner-scoped save health. Background API failures are NOT outages:
// an editor must stay usable while a profile, leaderboard, or judge recovers.
const PREFIX='bytequest.sync-health.v1.';
const PENDING_WARNING_MS=60000;
const SYNC_FAILURE_GRACE_MS=30000;

export function describeCloudHealth(state,{online=true,now=Date.now()}={}){
  if(!state||typeof state!=='object')return null;
  if(state.kind==='storage-failed')return {
    kind:'storage-failed',title:'Local save failed',
    message:'This browser could not save your draft. Back up your code before leaving.'
  };
  const hasLocalCopy=state.localSaved===true;
  if(state.kind==='sync-failed'){
    if(hasLocalCopy&&now-state.at<SYNC_FAILURE_GRACE_MS)return null;
    return{kind:'sync-failed',title:'Sync paused',
      message:hasLocalCopy?'Your changes remain on this device. Cloud sync will retry automatically.':'Cloud sync failed and there is no confirmed browser backup. Export your work.'};
  }
  if(state.kind==='pending'&&Number.isFinite(state.at)&&now-state.at>=PENDING_WARNING_MS){
    return{kind:online?'pending':'offline',title:online?'Sync delayed':'Working offline',
      message:hasLocalCopy?'Your latest changes are saved on this device. They will sync when the connection recovers.':'Cloud save is unconfirmed. Export your work before closing this page.'};
  }
  return null;
}

export function createCloudHealthStore({storage=null,clock=()=>Date.now()}={}){
  let owner=null,state=null;
  const key=()=>owner?PREFIX+owner:null;
  const save=()=>{
    const k=key();if(!k)return;
    try{
      // Do not resurrect stale transient service errors after a refresh.
      if(state&&['sync-failed','storage-failed'].includes(state.kind))
        storage?.setItem(k,JSON.stringify(state));
      else storage?.removeItem(k);
    }catch{/* Health metadata must never block code persistence. */}
  };
  return{
    setOwner(next){
      if(owner===next)return;
      owner=next||null;state=null;
      try{
        const raw=owner&&storage?.getItem(key());
        if(raw){const candidate=JSON.parse(raw);
          if(['sync-failed','storage-failed'].includes(candidate?.kind)&&
            Number.isFinite(candidate.at)&&candidate.at<=clock()&&clock()-candidate.at<86400000)
            state=candidate;
        }
      }catch{/* An account switch must not reuse an old owner's state. */}
    },
    update(signal={}){
      const kind=signal.kind,at=clock();
      if(!owner&&kind!=='storage-failed')return;
      if(kind==='synced'){state=null;save();return;}
      if(kind==='storage-failed'){
        state={kind,at,localSaved:false};
      }else if(kind==='sync-failed'){
        state={kind,at,localSaved:signal.localSaved===true};
      }else if(kind==='pending'){
        if(state?.kind==='sync-failed')return; // Only a confirmed sync can clear it.
        // If local storage started working again, withdraw the backup warning.
        if(state?.kind==='storage-failed'&&signal.localSaved!==true)return;
        state={kind,at:state?.kind==='pending'?state.at:at,localSaved:signal.localSaved===true};
      }else{
        // An individual request, including Java compilation and read-only
        // background refresh, must never open a global outage UI. Each feature
        // handles its own actionable error inline.
        return;
      }
      save();
    },
    view({online=true}={}){return describeCloudHealth(state,{online,now:clock()});},
    getState(){return state&&{...state};}
  };
}

export function mountCloudHealthNotice(doc=globalThis.document,target=doc?.querySelector('.header-tools')){
  if(!doc?.createElement)return {setOwner(){},update(){}};
  let storage=null;
  try{storage=doc.defaultView?.localStorage||null;}catch{}
  const model=createCloudHealthStore({storage});
  const notice=doc.createElement('details');
  notice.className='bq-cloud-health';
  notice.id='bytequestCloudHealth';
  notice.hidden=true;
  const toggle=doc.createElement('summary');
  toggle.setAttribute('aria-label','Cloud sync status and recovery options');
  const dot=doc.createElement('span');dot.className='bq-cloud-health-dot';dot.setAttribute('aria-hidden','true');
  const headline=doc.createElement('span');headline.className='bq-cloud-health-headline';
  toggle.append(dot,headline);
  const panel=doc.createElement('div');panel.className='bq-cloud-health-panel';
  const detail=doc.createElement('p');
  const actions=doc.createElement('div');actions.className='bq-cloud-health-actions';
  const backup=doc.createElement('button');backup.type='button';backup.textContent='Back up work';
  const account=doc.createElement('button');account.type='button';account.textContent='Sync settings';
  const connection=doc.createElement('a');connection.textContent='Connection details';connection.className='bq-connection-details';
  backup.addEventListener('click',()=>doc.getElementById('exportBtn')?.click());
  account.addEventListener('click',()=>doc.getElementById('accountBtn')?.click());
  actions.append(backup,account,connection);
  panel.append(detail,actions);
  notice.append(toggle,panel);
  (target||doc.querySelector('.minimal-header')||doc.body)?.append(notice);
  const stylesheet=doc.createElement('link');
  stylesheet.rel='stylesheet';stylesheet.href='./cloud-health.css?v=quiet-2';doc.head?.append(stylesheet);
  const view=()=>{
    const result=model.view({online:doc.defaultView?.navigator?.onLine!==false});
    notice.hidden=!result;
    if(!result){notice.open=false;return;}
    notice.dataset.kind=result.kind;
    headline.textContent=result.title;
    detail.textContent=result.message;
    backup.hidden=!doc.getElementById('exportBtn');
    account.hidden=!doc.getElementById('accountBtn');
    const issue=issueFromCloudHealth(model.getState(),{online:doc.defaultView?.navigator?.onLine!==false});
    connection.hidden=!issue;
    if(issue)connection.href=connectionPageUrl(issue,doc.defaultView?.location?.pathname?.split('/').pop()||'index.html');
  };
  let pendingTimer;
  const update=signal=>{
    model.update(signal);view();
    clearTimeout(pendingTimer);
    const kind=model.getState()?.kind;
    if(kind==='pending'||kind==='sync-failed'){
      pendingTimer=setTimeout(view,kind==='pending'?PENDING_WARNING_MS+100:SYNC_FAILURE_GRACE_MS+100);
    }
  };
  doc.defaultView?.addEventListener('online',view);
  doc.defaultView?.addEventListener('offline',view);
  return{setOwner(owner){model.setOwner(owner);notice.open=false;view();},update};
}
