import {cloudConfig} from "./config.js";
import {firebaseConfig} from "./firebase-config.js";
import {FirebaseSession} from "./firebase-session.js?v=upgrade-2";
import {createRequestCoordinator} from "./request-coordinator.js?v=profile-speed-1";
import {validateProblem} from "./catalog.js?v=private-reference-1";
import {blankProgress,validateProgress} from "./progress.js?v=next-1";
export function validPublicConfig(config){
  try{
    const url=new URL(config.url);
    if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/")return false;
    return /^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey);
  }catch{return false;}
}
// Only published, public problem definitions are cached. Auth, progress, chat,
// notifications, unread counts, rankings and presence always use live requests.
export const PUBLIC_CATALOG_TTL_MS=5*60*1000;
const PUBLIC_CATALOG_OFFLINE_MAX_MS=24*60*60*1000;
const PUBLIC_CATALOG_MAX_BYTES=4000000;
const CATALOG_CACHE_VERSION=2;
function catalogKey(config){return "bytequest.public-catalog.v2:"+new URL(config.url).hostname;}
function catalogStorage(fallback){
  if(fallback!==undefined)return fallback;
  try{return globalThis.localStorage||null;}catch{return null;}
}
export class Cloud {
  constructor(onChange=()=>{},{config=cloudConfig,firebase=firebaseConfig,fetchImpl=(...args)=>globalThis.fetch(...args),sessionFactory=(c,cb)=>new FirebaseSession(c,cb),storage=undefined,now=()=>Date.now(),authTimeoutMs=12000}={}){
    this.config=config;this.fetch=fetchImpl;this.catalogStore=catalogStorage(storage);this.clock=now;this.authTimeoutMs=Number.isFinite(authTimeoutMs)&&authTimeoutMs>=10?authTimeoutMs:12000;this.catalogInFlight=null;this.user=null;this.admin=false;this.canCreate=false;this.onChange=onChange;this.enabled=validPublicConfig(config);this.lastToken=null;this.loginReady=false;this.bootstrap=null;
    this.requests=createRequestCoordinator();
    this.session=sessionFactory(firebase,user=>{this.requests.clear();this.user=user;this.lastToken=null;this.admin=false;this.canCreate=false;this.bootstrap=null;this.onChange(user);});
  }
  async init(){await this.session.init();this.user=this.session.user;this.loginReady=this.session.ready;}
  async signIn(){await this.session.signIn();}
  async signOut(){this.onBeforeSignOut?.();await this.session.signOut();}
  async deleteAccount(){
    const owner=this.user?.id;if(!owner)throw new Error('Sign in to manage your account.');
    if(!this.deletionPending)await this.session.reauthenticate(owner);
    if(this.user?.id!==owner)throw new Error('Your account changed. Account removal was cancelled.');
    this.onBeforeSignOut?.();this.deletionPending=true;
    const result=await this.request('account-delete',{confirmation:'DELETE'},owner);
    if(!result.deleted)throw new Error('Account removal did not finish. Please retry.');
    try{for(const key of ['bytequest.user.'+owner,'bytequest.studio.'+owner])localStorage.removeItem(key);const card=JSON.parse(sessionStorage.getItem('bytequest.account-card')||'null');if(card?.owner===owner)sessionStorage.removeItem('bytequest.account-card');}catch{}
    try{sessionStorage.removeItem('bytequest.live.'+owner);sessionStorage.removeItem('bytequest.announcements.'+owner);}catch{}await this.session.signOut();this.deletionPending=false;return result;
  }
  // Store only the public catalog, never an authenticated response or hidden cases.
  // All cache reads revalidate problem contracts, so malformed/stale browser storage
  // cannot inject arbitrary catalog records into the app.
  readCatalogCache(){
    if(!this.enabled||!this.catalogStore)return null;
    try{
      const raw=this.catalogStore.getItem(catalogKey(this.config));
      if(!raw||raw.length>PUBLIC_CATALOG_MAX_BYTES)return null;
      const entry=JSON.parse(raw),age=this.clock()-entry.savedAt;
      if(entry.version!==CATALOG_CACHE_VERSION||!Array.isArray(entry.rows)||
        !Number.isFinite(age)||age<0||age>=PUBLIC_CATALOG_OFFLINE_MAX_MS)return null;
      const problems=entry.rows.map(row=>({...validateProblem(row.content,{publicOnly:true}),revision:row.revision}));
      return {age,problems};
    }catch{return null;}
  }
  invalidatePublicCatalog(){
    try{this.catalogStore?.removeItem(catalogKey(this.config));}catch{}
  }
  async publicCatalog({force=false}={}){
    if(!this.enabled)return null;
    const cached=this.readCatalogCache();
    if(!force&&cached&&cached.age<PUBLIC_CATALOG_TTL_MS)return cached.problems;
    if(this.catalogInFlight)return this.catalogInFlight;
    const query="?select=id,content,position,revision&published=eq.true&order=position.asc,id.asc&limit=1000";
    const request=(async()=>{
      try{
        const response=await this.fetch(this.config.url+"/rest/v1/bytequest_problems"+query,{
          headers:{apikey:this.config.publishableKey},signal:AbortSignal.timeout(12000)
        });
        if(!response.ok)throw new Error("Could not load the problem library.");
        const rows=await response.json();if(!Array.isArray(rows))throw new Error("Invalid problem library response.");
        const publicRows=rows.map(row=>({...row,content:{...row.content,reference:undefined}}));
        const problems=publicRows.map(row=>({...validateProblem(row.content,{publicOnly:true}),revision:row.revision}));
        try{
          const serialized=JSON.stringify({version:CATALOG_CACHE_VERSION,savedAt:this.clock(),rows:publicRows});
          if(serialized.length<=PUBLIC_CATALOG_MAX_BYTES)this.catalogStore?.setItem(catalogKey(this.config),serialized);
        }catch{} // Storage disabled or quota full: continue with the live result.
        return problems;
      }catch(error){
        if(!force&&cached)return cached.problems; // Offline: use last valid public library for up to one day.
        throw error;
      }
    })();
    this.catalogInFlight=request;
    try{return await request;}finally{if(this.catalogInFlight===request)this.catalogInFlight=null;}
  }
  requestMetrics(){return this.requests.metrics();}
  async request(action,body={},ownerId=this.user?.id){
    if(this.deletionPending&&action!=="account-delete")throw new Error("Account removal is in progress.");
    if(!this.enabled||!ownerId||this.user?.id!==ownerId)throw new Error("Sign in to sync your progress.");
    try{
      const result=await this.requests.run(action,body,ownerId,()=>this.networkRequest(action,body,ownerId));
      if(this.user?.id===ownerId)this.onHealth?.({kind:'request-ok',action});
      return result;
    }catch(error){
      if(this.user?.id===ownerId)this.onHealth?.({
        kind:'request-error',action,status:error?.httpStatus||0,
        authTimeout:/token timed out|sign-in expired|could not be verified/i.test(String(error?.message||''))
      });
      throw error;
    }
  }
  async networkRequest(action,body={},ownerId=this.user?.id){
    if(this.deletionPending&&action!=="account-delete")throw new Error("Account removal is in progress.");
    if(!this.enabled||!ownerId||this.user?.id!==ownerId)throw new Error("Sign in to sync your progress.");
    for(let attempt=0;attempt<2;attempt++){
      // Firebase getIdToken() has no caller-side deadline. A stuck token
      // refresh must not leave account progress permanently "loading".
      let tokenTimer;
      const token=await Promise.race([
        this.session.tokenFor(ownerId,attempt>0),
        new Promise((_,reject)=>{
          tokenTimer=setTimeout(()=>reject(new Error("Google sign-in token timed out. Your work is saved locally; retry Sync now.")),this.authTimeoutMs);
        })
      ]).finally(()=>clearTimeout(tokenTimer));
      this.lastToken={owner:ownerId,token};
      if(this.user?.id!==ownerId)throw new Error("Your account changed. Please retry saving.");
      const response=await this.fetch(this.config.url+"/functions/v1/bytequest-firebase",{
        method:"POST",headers:{"Content-Type":"application/json",apikey:this.config.publishableKey,Authorization:"Bearer "+token},
        body:JSON.stringify({action,...body}),signal:AbortSignal.timeout(action==="submission-create"?(body.language==="cpp"?100000:65000):action==="native-run"?(body.language==="cpp"?80000:45000):20000)
      });
      if(this.user?.id!==ownerId)throw new Error("Your account changed. Please retry saving.");
      if(response.status===401&&attempt===0)continue;
      let result;try{result=await response.json();}catch{throw new Error("Cloud progress is unavailable. Your work is saved on this device.");}
      if(!response.ok){
        const failure=new Error(result.error||"Cloud progress is unavailable. Your work is saved on this device.");
        failure.httpStatus=response.status;
        throw failure;
      }
      return result;
    }
  }
  async openLive({after,announcementsAfter=null,signal,onBatch},ownerId=this.user?.id){
    if(this.deletionPending||!ownerId||this.user?.id!==ownerId)throw new Error('Sign in to receive messages.');
    let response;
    for(let attempt=0;attempt<2;attempt++){
      const token=await this.session.tokenFor(ownerId,attempt>0);
      if(this.user?.id!==ownerId||signal.aborted)throw new Error('Account changed.');
      response=await this.fetch(this.config.url+'/functions/v1/bytequest-firebase',{method:'POST',headers:{'Content-Type':'application/json',apikey:this.config.publishableKey,Authorization:'Bearer '+token},body:JSON.stringify({action:'live-events',after,announcementsAfter}),signal});
      if(response.status!==401||attempt)break;
    }
    if(!response.ok||!response.body)throw new Error('Live updates are reconnecting.');
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
    try{while(true){const {done,value}=await reader.read();if(done)break;if(this.user?.id!==ownerId||signal.aborted||this.deletionPending)break;buffer+=decoder.decode(value,{stream:true});if(buffer.length>1000000)throw new Error('Invalid live update.');let end;while((end=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);for(const line of frame.split('\n'))if(line.startsWith('data:')){const batch=JSON.parse(line.slice(5));if(batch.error)throw new Error('Live updates are reconnecting.');onBatch(batch);}}}}
    finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  }
  leavePresence(body,ownerId=this.user?.id){
    const cached=this.lastToken;if(!cached||cached.owner!==ownerId)return;
    // Fire synchronously with a cached token; navigation must not wait for SDK refresh.
    this.fetch(this.config.url+"/functions/v1/bytequest-firebase",{method:"POST",keepalive:true,headers:{"Content-Type":"application/json",apikey:this.config.publishableKey,Authorization:"Bearer "+cached.token},body:JSON.stringify({action:"presence",...body})}).catch(()=>{});
  }
  async account(userId){
    if(this.bootstrap?.owner!==userId){
      const promise=this.request("account",{},userId).catch(error=>{if(this.bootstrap?.promise===promise)this.bootstrap=null;throw error;});
      this.bootstrap={owner:userId,promise};
    }
    return this.bootstrap.promise;
  }
  async checkAdmin(userId){
    const result=await this.account(userId);
    // Legacy account.admin means "editor OR library admin", not a library
    // administrator. Only the authenticated community "self" response can
    // determine whether Manage creators is shown.
    if(this.user?.id===userId)this.canCreate=result.canCreate===true;
    return result.canCreate===true;
  }
  async loadProgress(userId){const result=await this.account(userId);return {state:validateProgress(result.progress?.payload||blankProgress()),revision:result.progress?.revision||0};}
  async syncProgress(userId,local,merge){
    const remote=await this.request("progress",{},userId);
    let merged=merge(local,validateProgress(remote.payload||blankProgress())),revision=remote.revision||0;
    for(let attempt=0;attempt<4;attempt++){
      const row=await this.request("sync",{payload:merged,revision},userId);
      if(row.applied)return validateProgress(row.payload);
      merged=merge(merged,validateProgress(row.payload));revision=row.revision;
    }
    throw new Error("Another device is saving. Your changes are kept here; try Sync again.");
  }
  async adminCatalog(){const result=await this.request("studio-list");return result.problems;}
  async saveProblem(problem,{published=false,revision=0,position=0,hiddenTests=[],correction=""}={}){
    const result=await this.request("studio-save",{problem:validateProblem(problem),published,revision,position,hiddenTests,correction});
    this.invalidatePublicCatalog(); // Newly published, revised or unpublished content must be refetched.
    return result.problem;
  }
}
