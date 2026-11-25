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
 'studio.html':'./studio-page.js',
 'privacy.html':'./reference-motion.js',
 'runner.html':'./runner-core.js',
 'native-runner.html':'./native-runner-core.js'
});
const page=location.pathname.split('/').pop()||'index.html';
const bootScript=document.querySelector('script[data-bq-app]');
const appSource=bootScript?.getAttribute('data-bq-app')||'';
const expected=entrypoints[page];
const approved=Boolean(expected&&appSource.startsWith(expected+'?'));
const maintenanceUrl='./status.html?issue=maintenance';
const connectionUrl='./status.html?issue=';
let launched=false,checking=false,timer=null,scheduledTimer=null,stopped=false,banner=null;
let lastStatus=null,knownScheduledStart=0,knownScheduledEnd=0;
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
    console.error('ProSolver application failed to load',error);
    blockAndRedirect(navigator.onLine===false?'offline':'unreachable');
  }
}
async function check(force=false){
  if(checking||stopped)return;
  checking=true;
  try{
    const status=await fetchMaintenanceStatus({timeoutMs:5000});
    lastStatus=status;
    // An armed schedule is the one exception to non-blocking recovery:
    // retain server-relative bounds so a network failure at its start cannot
    // silently bypass a previously confirmed maintenance window.
    const start=Date.parse(status.startsAt),end=Date.parse(status.endsAt),server=Date.parse(status.serverTime);
    if(status.upcoming&&[start,end,server].every(Number.isFinite)){
      knownScheduledStart=Date.now()+start-server;
      knownScheduledEnd=Date.now()+end-server;
    }else{knownScheduledStart=0;knownScheduledEnd=0;}
    if(status.active===true){blockAndRedirect('maintenance');return;}
    // If a window is upcoming, re-check at its exact server-relative start.
    scheduleExactStart(status);
    if(!launched)await launch();
    if(stopped)return;
    showAdvanceNotice(status);
  }catch{
    if(!launched){
      // First entry still requires an authoritative status check.
      blockAndRedirect(navigator.onLine===false?'offline':'unreachable');
    }else if(knownScheduledStart&&Date.now()>=knownScheduledStart&&Date.now()<knownScheduledEnd){
      // We already received a verified future maintenance window. Keep the
      // strict lock if the status endpoint happens to fail at its start.
      blockAndRedirect('maintenance');
    }else{
      // An already-open editor is not a network diagnostic. Transient errors,
      // tab switches and laptop wakeups must never replace the workspace with
      // the full-page connection screen. Server-side maintenance still blocks
      // protected requests; keep the local draft usable and retry next poll.
      console.info('ProSolver maintenance heartbeat unavailable; editor remains usable.');
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
  // BFCache restore rechecks maintenance without hiding a working editor.
  // Confirmed active maintenance still causes an immediate hard redirect.
  window.addEventListener('pageshow',event=>{
    if(!event.persisted)return;
    clearInterval(timer);
    timer=setInterval(()=>{if(!document.hidden)void check();},pollInterval);
    void check();
  });
  window.addEventListener('online',()=>void check());
  window.addEventListener('pagehide',()=>{clearInterval(timer);clearTimeout(scheduledTimer);});
}
