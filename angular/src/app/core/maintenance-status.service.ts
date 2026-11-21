import {Injectable,OnDestroy,signal} from '@angular/core';

const api='https://zwubrziriuppkldrdoos.supabase.co/functions/v1/bytequest-firebase/maintenance';
const publishableKey='sb_publishable_NpldkX3xQMLqThqaLlXJjg_v1q2quIn';
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
      const response=await fetch(api,{
        method:'GET',headers:{apikey:publishableKey},
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
      // No staging write capabilities are available when Origin is rejected.
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
