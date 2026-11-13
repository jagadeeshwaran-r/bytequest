import {cloudConfig} from "./config.js";
import {validateProblem} from "./catalog.js";
import {blankProgress,validateProgress} from "./progress.js";
export function validPublicConfig(config){
  try{
    const url=new URL(config.url);
    if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash)return false;
    return /^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey);
  }catch{return false;}
}
export class Cloud {
  constructor(onChange=()=>{}){this.client=null;this.user=null;this.admin=false;this.googleEnabled=false;this.onChange=onChange;this.enabled=validPublicConfig(cloudConfig);}
  async init(){
    if(!this.enabled)return;
    const {createClient}=await import("https://esm.sh/@supabase/supabase-js@2.119.0");
    this.client=createClient(cloudConfig.url,cloudConfig.publishableKey,{auth:{flowType:"pkce",detectSessionInUrl:false,persistSession:true,autoRefreshToken:true,storageKey:"bytequest.auth.v2"}});
    const settingsResponse=await fetch(cloudConfig.url+"/auth/v1/settings",{headers:{apikey:cloudConfig.publishableKey}});
    if(settingsResponse.ok){const settings=await settingsResponse.json();this.googleEnabled=settings.external?.google===true;}
    const url=new URL(location.href),code=url.searchParams.get("code");
    const authError=url.searchParams.get("error_description");
    if(code){const {error}=await this.client.auth.exchangeCodeForSession(code);this.cleanCallback(url);if(error)throw error;}
    else if(authError){this.cleanCallback(url);throw new Error(authError);}
    this.client.auth.onAuthStateChange((event,session)=>{
      const next=session?.user||null;
      if(this.user?.id===next?.id)return;
      this.user=next;this.admin=false;
      // Auth callbacks must finish before making another Supabase request.
      setTimeout(()=>this.onChange(next),0);
    });
    const {data,error}=await this.client.auth.getUser();
    if(error&&error.name!=="AuthSessionMissingError")throw error;
    this.user=data?.user||null;
  }
  cleanCallback(url){for(const key of ["code","error","error_code","error_description"])url.searchParams.delete(key);history.replaceState(null,"",url.pathname+url.search+(url.hash||"#practice"));}
  async signIn(){
    if(!this.enabled||!this.client)throw new Error("Cloud accounts are being connected. You can keep practising on this device.");
    if(!this.googleEnabled)throw new Error("Google sign-in is waiting for the site owner to finish activation. You can keep practising as a guest.");
    const redirectTo=new URL("./",location.href).href;
    const {error}=await this.client.auth.signInWithOAuth({provider:"google",options:{redirectTo,queryParams:{prompt:"select_account"}}});
    if(error)throw error;
  }
  async signOut(){if(this.client){const{error}=await this.client.auth.signOut({scope:"local"});if(error)throw error;}}
  async publicCatalog(){
    if(!this.client)return null;
    const {data,error}=await this.client.from("bytequest_problems").select("id,content,position,revision").eq("published",true).order("position").order("id").limit(1000);
    if(error)throw error;
    return data.map(row=>validateProblem(row.content));
  }
  async checkAdmin(userId){
    if(!this.client||!userId)return false;
    const {data,error}=await this.client.from("bytequest_admins").select("user_id").eq("user_id",userId).maybeSingle();
    if(error)throw error;
    if(this.user?.id===userId)this.admin=!!data;
    return !!data;
  }
  async loadProgress(userId){
    const {data,error}=await this.client.from("bytequest_progress").select("payload,revision").eq("user_id",userId).maybeSingle();
    if(error)throw error;
    return{state:data?validateProgress(data.payload):blankProgress(),revision:data?.revision||0};
  }
  async syncProgress(userId,local,merge){
    const {data:{session},error:sessionError}=await this.client.auth.getSession();
    if(sessionError)throw sessionError;
    if(!session||session.user.id!==userId||this.user?.id!==userId)throw new Error("Your account changed. Please retry saving.");
    const remote=await this.loadProgress(userId);
    let merged=merge(local,remote.state),revision=remote.revision;
    for(let attempt=0;attempt<4;attempt++){
      if(this.user?.id!==userId)throw new Error("Your account changed.");
      // Bind this write to the captured user's token. Account switching cannot
      // redirect an earlier user's progress into the new user's row.
      const response=await fetch(cloudConfig.url+"/rest/v1/rpc/sync_bytequest_progress",{
        method:"POST",headers:{"Content-Type":"application/json",apikey:cloudConfig.publishableKey,Authorization:"Bearer "+session.access_token},
        body:JSON.stringify({new_payload:merged,expected_revision:revision})
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.message||"Could not sync progress.");
      const row=result[0];
      if(!row)throw new Error("No progress result returned.");
      if(row.applied)return validateProgress(row.payload);
      merged=merge(merged,validateProgress(row.payload));revision=row.revision;
    }
    throw new Error("Another device is saving. Your changes are kept here; try Sync again.");
  }
  async adminCatalog(){
    const {data,error}=await this.client.from("bytequest_problems").select("*").order("position").order("id").limit(1000);if(error)throw error;return data;
  }
  async saveProblem(problem,{published=false,revision=0,position=0}={}){
    const row={id:problem.id,content:validateProblem(problem),published,position,revision:revision+1,updated_at:new Date().toISOString()};
    const query=revision?this.client.from("bytequest_problems").update(row).eq("id",problem.id).eq("revision",revision).select("id,revision"):this.client.from("bytequest_problems").insert(row).select("id,revision");
    const {data,error}=await query;if(error)throw error;
    if(!data?.length)throw new Error("This problem changed in another window. Reload it before saving.");
    return data[0];
  }
}
