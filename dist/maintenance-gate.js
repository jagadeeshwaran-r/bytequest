import {fetchMaintenanceStatus} from './maintenance-api.js?v=1';
import {istDisplay} from './maintenance-model.js?v=1';

const page=location.pathname.split('/').pop()||'index.html';
const allowed=new Set(['index.html','community.html','leaderboard.html','studio.html']);
if(allowed.has(page)){
  let firstCheck=true,busy=false,adminVerified=false,adminChecking=false,last=null;
  let banner=null,dismissed=false;
  function ensureBanner(){
    if(banner)return banner;
    banner=document.createElement('aside');
    banner.className='bq-maintenance-alert';
    banner.setAttribute('role','status');
    banner.setAttribute('aria-live','polite');
    banner.hidden=true;
    const text=document.createElement('p');text.className='bq-maintenance-alert-text';
    const details=document.createElement('a');details.textContent='Maintenance details';
    details.href='./status.html?issue=maintenance&from='+encodeURIComponent(page);
    const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='Dismiss';
    dismiss.onclick=()=>{dismissed=true;banner.hidden=true;};
    banner.append(text,details,dismiss);
    document.body.prepend(banner);
    const css=document.createElement('link');css.rel='stylesheet';css.href='./maintenance-gate.css?v=1';document.head.append(css);
    return banner;
  }
  function showBanner(status){
    const active=status.active===true;
    if(!active&&!status.upcoming)return;
    if(!active&&dismissed)return;
    const element=ensureBanner();
    const message=status.message||'ByteQuest maintenance is scheduled.';
    const when=active?
      'Maintenance is active until '+istDisplay(status.endsAt)+'.':
      'Scheduled maintenance: '+istDisplay(status.startsAt)+' to '+istDisplay(status.endsAt)+'.';
    element.querySelector('p').textContent=when+' '+message+
      (active?' Cloud submissions and sync are paused. Keep local drafts and back up your work.':'');
    element.hidden=false;element.dataset.active=String(active);
  }
  async function verifyAdminBypass(){
    if(adminVerified)return true;
    if(adminChecking)return false;
    adminChecking=true;
    try{
      // Auth/session restoration does not grant the bypass. The Edge Function
      // checks ByteQuest library-admin membership using the Firebase token.
      const {Cloud}=await import('./cloud.js?v=outage-1');
      const access=new Cloud();
      await access.init();
      if(!access.user?.id)return false;
      await access.request('maintenance-admin-get',{},access.user.id);
      adminVerified=true;return true;
    }catch{return false;}
    finally{adminChecking=false;}
  }
  async function check(){
    if(busy)return;
    busy=true;
    try{
      const status=await fetchMaintenanceStatus();
      last=status;
      if(status.active){
        const requestedBypass=new URLSearchParams(location.search).get('maintenanceAdmin')==='1';
        if(firstCheck){
          const authorized=requestedBypass&&await verifyAdminBypass();
          if(!authorized){
            // Cold navigation enters the dedicated visitor page.
            location.replace('./status.html?issue=maintenance&from='+encodeURIComponent(page));
            return;
          }
        }
        // For already-open coding workspaces, never force a navigation that
        // might discard unconfirmed drafts. Backend enforcement stays active.
        showBanner(status);
      }else if(status.upcoming)showBanner(status);
      else if(banner)banner.hidden=true;
    }catch{
      // An unavailable status endpoint is NOT proof that maintenance is active.
      // Keep existing work and let the cloud-health bar report connection errors.
    }finally{busy=false;firstCheck=false;}
  }
  void check();
  const poll=setInterval(()=>{if(!document.hidden)void check();},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check();});
  window.addEventListener('online',()=>void check());
  window.addEventListener('pagehide',()=>clearInterval(poll),{once:true});
}
