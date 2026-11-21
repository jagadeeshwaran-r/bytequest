import {Injectable,OnDestroy,signal} from '@angular/core';
import {validateStagingBackend,type StagingBackendConfig} from './staging-backend-contract';

export interface PublicMaintenance{
 readonly active:boolean;readonly upcoming:boolean;readonly message?:string;
 readonly startsAt?:string|null;readonly endsAt?:string|null;readonly serverTime?:string;
}
@Injectable({providedIn:'root'})
export class MaintenanceStatusService implements OnDestroy{
 readonly strict=location.hostname==='jagadeeshwaran-r.github.io';
 readonly loading=signal(this.strict);
 readonly blocked=signal(false);
 readonly upcoming=signal<PublicMaintenance|null>(null);
 readonly error=signal('');
 private refreshTimer:number|undefined;
 private readonly onFocus=()=>{void this.refresh();};
 private request:Promise<void>|null=null;
 private readonly staging=fetch(new URL('staging-backend.json',document.baseURI),{cache:'no-store'})
   .then(async response=>{
     if(!response.ok)throw new Error('Staging backend config unavailable.');
     return await response.json() as StagingBackendConfig;
   });
 constructor(){
   void this.refresh();
   this.refreshTimer=window.setInterval(()=>{
     if(document.visibilityState==='visible')void this.refresh();
   },15000);
   window.addEventListener('focus',this.onFocus);
 }
 async refresh():Promise<void>{
  if(this.request)return this.request;
  const work=async()=>{
    try{
      const config=await this.staging;
      let endpoint:URL;
      try{endpoint=validateStagingBackend(config);}
      catch{
        // In a public-only preview the maintenance service is not configured.
        // Never poll production's Edge Function from a different origin, and
        // never claim a real maintenance status was verified.
        if(this.strict)throw new Error('Maintenance verification requires a configured ByteQuest backend.');
        this.error.set('');this.upcoming.set(null);this.blocked.set(false);
        return;
      }
      const response=await fetch(endpoint.href+'/maintenance',{
        method:'GET',headers:{apikey:config.publishableKey},
        cache:'no-store',signal:AbortSignal.timeout(6000)
      });
      if(!response.ok)throw new Error('Status check failed ('+response.status+').');
      const result:PublicMaintenance=await response.json();
      if(typeof result.active!=='boolean'||typeof result.upcoming!=='boolean')
        throw new Error('Maintenance response was invalid.');
      this.blocked.set(result.active);
      this.upcoming.set(result.upcoming?result:null);
      this.error.set('');
    }catch(error){
      // Live GitHub Pages is strict: an unreadable maintenance status cannot
      // silently bypass a previously reported active maintenance window.
      this.error.set(error instanceof Error?error.message:'Status check unavailable.');
    }finally{
      this.loading.set(false);
    }
  };
  const request=work();
  this.request=request;
  try{await request;}finally{this.request=null;}
 }
 ngOnDestroy():void{
   if(this.refreshTimer!==undefined)window.clearInterval(this.refreshTimer);
   window.removeEventListener('focus',this.onFocus);
 }
}
