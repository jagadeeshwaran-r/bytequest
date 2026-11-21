import {inject,Injectable,signal} from '@angular/core';
import {AuthService} from './auth.service';
import {ReadonlyApiService} from './readonly-api.service';

// This client never sends writes to the live Supabase project from staging.
// A separate project must be provisioned, configured, and authorized first.
const writeActions=new Set([
  'profile-save','avatar-upload','follow','chat-send','chat-read',
  'notifications-read','role-set','studio-save','sync','submission-public-share',
  'maintenance-admin-save'
]);
export interface StagingBackendConfig {
  readonly enabled:boolean;readonly apiUrl:string;readonly publishableKey:string;
}
const liveProject='zwubrziriuppkldrdoos';
export function validateStagingBackend(config:StagingBackendConfig):URL{
  if(!config||config.enabled!==true)throw new Error('Account changes are disabled until the separate test database is ready.');
  if(!config.apiUrl||!config.publishableKey)throw new Error('Staging backend credentials are incomplete.');
  let url:URL;
  try{url=new URL(config.apiUrl);}catch{throw new Error('Invalid staging API URL.');}
  const project=url.hostname.split('.')[0];
  if(url.protocol!=='https:'||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/$/.test(url.origin+'/')
    ||url.hostname===liveProject+'.supabase.co'||!/^([a-z0-9]{12,30})$/.test(project)
    ||url.pathname!=='/functions/v1/bytequest-firebase'
    ||url.username||url.password||url.search||url.hash){
    throw new Error('Only a separate secure ByteQuest Supabase staging function may accept account changes.');
  }
  return url;
}
/** Common strongly guarded interface for native UI features.
 * Read actions still follow existing production-origin CORS rules.
 * Mutations are allowed exclusively against an isolated staging backend.
 */
@Injectable({providedIn:'root'})
export class StagingActionService{
  private readonly auth=inject(AuthService);
  private readonly readonlyApi=inject(ReadonlyApiService);
  readonly mutationBusy=signal(false);
  private readonly config=fetch(new URL('staging-backend.json',document.baseURI),{cache:'no-store'})
    .then(async response=>{
      if(!response.ok)throw new Error('Could not read test database configuration.');
      return await response.json() as StagingBackendConfig;
    });
  read<T>(action:string,body:Record<string,unknown>={}):Promise<T>{
    return this.readonlyApi.request<T>(action,body);
  }
  async canWrite():Promise<boolean>{
    try{validateStagingBackend(await this.config);return true;}catch{return false;}
  }
  async write<T>(action:string,body:Record<string,unknown>={}):Promise<T>{
    if(!writeActions.has(action))throw new Error('Unsupported account update.');
    if(this.mutationBusy())throw new Error('Another account update is still in progress.');
    const endpoint=validateStagingBackend(await this.config);
    const owner=this.auth.user()?.id;
    if(!owner)throw new Error('Sign in to manage your ByteQuest account.');
    this.mutationBusy.set(true);
    try{
      const token=await this.auth.token();
      if(this.auth.user()?.id!==owner)throw new Error('Your account changed; the update was cancelled.');
      const configuration=await this.config;
      const response=await fetch(endpoint.href,{
        method:'POST',
        headers:{'Content-Type':'application/json',apikey:configuration.publishableKey,Authorization:'Bearer '+token},
        body:JSON.stringify({...body,action}),
        signal:AbortSignal.timeout(65000)
      });
      if(this.auth.user()?.id!==owner)throw new Error('Account changed while processing your request.');
      const result:unknown=await response.json().catch(()=>{throw new Error('Server reply could not be read.');});
      if(!response.ok){
        const error=result&&typeof result==='object'?(result as {error?:unknown}).error:undefined;
        throw new Error(typeof error==='string'?error:'The test server rejected this action.');
      }
      return result as T;
    }finally{this.mutationBusy.set(false);}
  }
}
