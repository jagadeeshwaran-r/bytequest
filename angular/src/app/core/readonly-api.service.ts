import {Injectable, inject} from '@angular/core';
import {AuthService} from './auth.service';

const URL='https://zwubrziriuppkldrdoos.supabase.co/functions/v1/bytequest-firebase';
const KEY='sb_publishable_NpldkX3xQMLqThqaLlXJjg_v1q2quIn';
const allowed=new Set(['self','profile','leaderboard','search','notifications','submission-history']);
@Injectable({providedIn:'root'})
export class ReadonlyApiService{
  private readonly auth=inject(AuthService);
  async request<T>(action:string,options:Record<string,unknown>={}):Promise<T>{
    if(!allowed.has(action))throw new Error('Staging is read-only. This action is unavailable.');
    const owner=this.auth.user()?.id;
    if(!owner)throw new Error('Sign in to access your ByteQuest account.');
    const token=await this.auth.token();
    const response=await fetch(URL,{
      method:'POST',
      headers:{'Content-Type':'application/json',apikey:KEY,Authorization:'Bearer '+token},
      body:JSON.stringify({action,...options}),
      signal:AbortSignal.timeout(18000)
    });
    if(this.auth.user()?.id!==owner)throw new Error('Account changed. Request cancelled.');
    const payload:unknown=await response.json().catch(()=>{throw new Error('Server response unavailable.');});
    if(!response.ok){
      const obj=payload&&typeof payload==='object' ?payload as {error?:unknown}:null;
      throw new Error(typeof obj?.error==='string'?obj.error:'Unable to read ByteQuest information.');
    }
    return payload as T;
  }
}
