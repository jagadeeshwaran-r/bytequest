import {Injectable, inject} from '@angular/core';
import {AuthService} from './auth.service';
import {validateStagingBackend,type StagingBackendConfig} from './staging-backend-contract';

// Account-scoped reads are authenticated POST requests in the existing Edge API.
// They are not truly read-only at the server: the request handler also touches
// account metadata. NEVER send them to ByteQuest production from staging.
const allowed=new Set([
  'self','profile','leaderboard','search','notifications',
  'submission-history','submission-list','submission-read','submission-public-list',
  'chat-list','chat-thread','followers','following','profile-presence',
  'friend-presence','friend-analytics','studio-list','problem-authors',
  'reference-read','roles','creator-search','maintenance-admin-get'
]);
@Injectable({providedIn:'root'})
export class ReadonlyApiService{
  private readonly auth=inject(AuthService);
  private readonly settings=fetch(new URL('staging-backend.json',document.baseURI),{cache:'no-store'})
    .then(async response=>{
      if(!response.ok)throw new Error('Unable to read the isolated test backend configuration.');
      return await response.json() as StagingBackendConfig;
    });
  async request<T>(action:string,options:Record<string,unknown>={}):Promise<T>{
    if(!allowed.has(action))throw new Error('Staging rejects unsupported account operations.');
    const owner=this.auth.user()?.id;
    if(!owner)throw new Error('Sign in to access your ByteQuest account.');
    const config=await this.settings;
    let endpoint:URL;
    try{endpoint=validateStagingBackend(config);}
    catch{throw new Error(
      'Staging account data is unavailable until the separate Supabase test database is connected. '+
      'Your production ByteQuest profile and rankings are unchanged.'
    );}
    const token=await this.auth.token();
    if(this.auth.user()?.id!==owner)throw new Error('Account changed. Request cancelled.');
    const response=await fetch(endpoint.href,{
      method:'POST',
      headers:{'Content-Type':'application/json',apikey:config.publishableKey,Authorization:'Bearer '+token},
      body:JSON.stringify({...options,action}),
      signal:AbortSignal.timeout(18000)
    });
    if(this.auth.user()?.id!==owner)throw new Error('Account changed. Request cancelled.');
    const payload:unknown=await response.json().catch(()=>{throw new Error('Test server response unavailable.');});
    if(!response.ok){
      const obj=payload&&typeof payload==='object'?payload as {error?:unknown}:null;
      throw new Error(typeof obj?.error==='string'?obj.error:'Unable to read ByteQuest staging information.');
    }
    return payload as T;
  }
}
