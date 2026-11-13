import {cloudConfig} from "./config.js";
import {firebaseConfig} from "./firebase-config.js";
import {FirebaseSession} from "./firebase-session.js";
import {validateProblem} from "./catalog.js?v=green-final";
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
    this.config=config;this.fetch=fetchImpl;this.user=null;this.admin=false;this.canCreate=false;this.onChange=onChange;this.enabled=validPublicConfig(config);this.loginReady=false;this.bootstrap=null;
    this.session=sessionFactory(firebase,user=>{this.user=user;this.admin=false;this.canCreate=false;this.bootstrap=null;this.onChange(user);});
  }
  async init(){await this.session.init();this.user=this.session.user;this.loginReady=this.session.ready;}
  async signIn(){await this.session.signIn();}
  async signOut(){await this.session.signOut();}
  async publicCatalog(){
    if(!this.enabled)return null;
    const query="?select=id,content,position,revision&published=eq.true&order=position.asc,id.asc&limit=1000";
    const response=await this.fetch(this.config.url+"/rest/v1/bytequest_problems"+query,{headers:{apikey:this.config.publishableKey},signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error("Could not load the problem library.");
    const rows=await response.json();if(!Array.isArray(rows))throw new Error("Invalid problem library response.");
    return rows.map(row=>({...validateProblem(row.content),revision:row.revision}));
  }
  async request(action,body={},ownerId=this.user?.id){
    if(!this.enabled||!ownerId||this.user?.id!==ownerId)throw new Error("Sign in to sync your progress.");
    for(let attempt=0;attempt<2;attempt++){
      const token=await this.session.tokenFor(ownerId,attempt>0);
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
