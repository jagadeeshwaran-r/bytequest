import {cloudConfig} from "./config.js";
import {firebaseConfig} from "./firebase-config.js";
import {FirebaseSession} from "./firebase-session.js?v=upgrade-2";
import {validateProblem} from "./catalog.js?v=presence-1";
import {blankProgress,validateProgress} from "./progress.js";
export function validPublicConfig(config){
  try{
    const url=new URL(config.url);
    if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/")return false;
    return /^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey);
  }catch{return false;}
}
export class Cloud {
  constructor(onChange=()=>{},{config=cloudConfig,firebase=firebaseConfig,fetchImpl=(...args)=>globalThis.fetch(...args),sessionFactory=(c,cb)=>new FirebaseSession(c,cb)}={}){
    this.config=config;this.fetch=fetchImpl;this.user=null;this.admin=false;this.canCreate=false;this.onChange=onChange;this.enabled=validPublicConfig(config);this.lastToken=null;this.loginReady=false;this.bootstrap=null;
    this.session=sessionFactory(firebase,user=>{this.user=user;this.lastToken=null;this.admin=false;this.canCreate=false;this.bootstrap=null;this.onChange(user);});
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
    await this.session.signOut();this.deletionPending=false;return result;
  }
  async publicCatalog(){
    if(!this.enabled)return null;
    const query="?select=id,content,position,revision&published=eq.true&order=position.asc,id.asc&limit=1000";
    const response=await this.fetch(this.config.url+"/rest/v1/bytequest_problems"+query,{headers:{apikey:this.config.publishableKey},signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error("Could not load the problem library.");
    const rows=await response.json();if(!Array.isArray(rows))throw new Error("Invalid problem library response.");
    return rows.map(row=>({...validateProblem(row.content),revision:row.revision}));
  }
  async request(action,body={},ownerId=this.user?.id){
    if(this.deletionPending&&action!=="account-delete")throw new Error("Account removal is in progress.");
    if(!this.enabled||!ownerId||this.user?.id!==ownerId)throw new Error("Sign in to sync your progress.");
    for(let attempt=0;attempt<2;attempt++){
      const token=await this.session.tokenFor(ownerId,attempt>0);
      this.lastToken={owner:ownerId,token};
      if(this.user?.id!==ownerId)throw new Error("Your account changed. Please retry saving.");
      const response=await this.fetch(this.config.url+"/functions/v1/bytequest-firebase",{
        method:"POST",headers:{"Content-Type":"application/json",apikey:this.config.publishableKey,Authorization:"Bearer "+token},
        body:JSON.stringify({action,...body}),signal:AbortSignal.timeout(action==="native-run"?45000:20000)
      });
      if(this.user?.id!==ownerId)throw new Error("Your account changed. Please retry saving.");
      if(response.status===401&&attempt===0)continue;
      let result;try{result=await response.json();}catch{throw new Error("Cloud progress is unavailable. Your work is saved on this device.");}
      if(!response.ok)throw new Error(result.error||"Cloud progress is unavailable. Your work is saved on this device.");
      return result;
    }
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
    const result=await this.account(userId);if(this.user?.id===userId){this.admin=result.admin===true;this.canCreate=result.canCreate===true;}return result.admin===true;
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
    const result=await this.request("studio-save",{problem:validateProblem(problem),published,revision,position,hiddenTests,correction});return result.problem;
  }
}
