import {fetchMaintenanceStatus} from './maintenance-api.js?v=1';
import {istDisplay} from './maintenance-model.js?v=1';

// Application modules are NOT referenced as executable script tags in HTML.
// They are imported only after a server status check confirms that the site
// is available. This prevents an active maintenance window from booting the
// editor, social UI, background sync, or other user-facing applications.
const entrypoints=Object.freeze({
 'index.html':'./app.js',
 'community.html':'./community.js',
 'leaderboard.html':'./leaderboard.js',
 'studio.html':'./studio-page.js'
});
const page=location.pathname.split('/').pop()||'index.html';
const bootScript=document.querySelector('script[data-bq-app]');
const appSource=bootScript?.getAttribute('data-bq-app')||'';
const expected=entrypoints[page];
const approved=Boolean(expected&&appSource.startsWith(expected+'?'));
const maintenanceUrl='./status.html?issue=maintenance';
const connectionUrl='./status.html?issue=';
let launched=false,checking=false,timer=null,scheduledTimer=null,stopped=false,banner=null;
let lastStatus=null;
const pollInterval=15000;

function showAdvanceNotice(status){
  if(banner&&status.upcoming!==true){banner.remove();banner=null;return;}
  if(!status.upcoming||banner)return;
  banner=document.createElement('aside');
  banner.className='bq-maintenance-alert';
  banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');
  banner.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:#211f17;color:#f7e8c0;padding:10px 20px;text-align:center;font:12px/1.5 system-ui';
  const label=document.createElement('span');
  label.textContent='Scheduled maintenance: '+istDisplay(status.startsAt)+' to '+istDisplay(status.endsAt)+'. '+(status.message||'');
  const link=document.createElement('a');
  link.href=maintenanceUrl;link.textContent=' Details';link.style.color='inherit';
  banner.append(label,link);document.body.prepend(banner);
}
function blockAndRedirect(issue='maintenance'){
  stopped=true;
  clearInterval(timer);clearTimeout(scheduledTimer);
  // Immediately hide the current workspace before navigation can complete.
  // Draft persistence remains controlled by the existing editor; never clear
  // browser storage, force sign-out, or claim server sync happened.
  document.documentElement.dataset.bqMaintenanceCheck='pending';
  location.replace(issue==='maintenance'?maintenanceUrl:connectionUrl+issue);
}
function scheduleExactStart(status){
  clearTimeout(scheduledTimer);
  if(!status.upcoming||!status.startsAt||!status.serverTime)return;
  const delay=Date.parse(status.startsAt)-Date.parse(status.serverTime);
  if(!Number.isFinite(delay))return;
  // The periodic poll is a backup. A server-time-based scheduled timeout
  // catches the planned start even when a user remains on an open editor.
  scheduledTimer=setTimeout(()=>void check(true),Math.max(0,Math.min(delay+150,2147480000)));
}
async function launch(){
  if(launched||stopped)return;
  launched=true;
  document.documentElement.removeAttribute('data-bq-maintenance-check');
  try{
    await import(appSource);
  }catch(error){
    console.error('ByteQuest application failed to load',error);
    blockAndRedirect(navigator.onLine===false?'offline':'unreachable');
  }
}
async function check(force=false){
  if(checking||stopped)return;
  checking=true;
  try{
    const status=await fetchMaintenanceStatus({timeoutMs:5000});
    lastStatus=status;
    if(status.active===true){blockAndRedirect('maintenance');return;}
    // If a window is upcoming, re-check at its exact server-relative start.
    scheduleExactStart(status);
    if(!launched)await launch();
    if(stopped)return;
    showAdvanceNotice(status);
  }catch{
    if(!launched){
      // Fail closed on first visit: an unreachable status service must not
      // grant access when we cannot determine whether maintenance is active.
      blockAndRedirect(navigator.onLine===false?'offline':'unreachable');
    }else{
      // Do not mislabel a network failure as scheduled maintenance; block the
      // workspace until a fresh authoritative check confirms availability.
      blockAndRedirect(navigator.onLine===false?'offline':'unreachable');
    }
  }finally{checking=false;}
}

if(!approved){
  blockAndRedirect('unreachable');
}else{
  // No 'maintenanceAdmin=1' general-site bypass. The admin-only console at
  // maintenance.html is the sole privileged operational route.
  void check();
  timer=setInterval(()=>{if(!document.hidden)void check();},pollInterval);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check();});
  window.addEventListener('online',()=>void check());
  window.addEventListener('pagehide',()=>{clearInterval(timer);clearTimeout(scheduledTimer);});
}
