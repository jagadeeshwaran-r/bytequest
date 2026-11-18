import {outagePageContent,safeReturnPage} from './system-state.js?v=1';

const params=new URLSearchParams(location.search);
const state=outagePageContent(params.get('issue'));
const from=safeReturnPage(params.get('from'));
document.body.dataset.issue=state.kind;
document.title=state.title.replace(/\.$/,'')+' · ByteQuest';
const $=id=>document.getElementById(id);
$('statusEyebrow').textContent=state.eyebrow;
const headline=state.title;
const lastPeriod=headline.lastIndexOf(' ');
if(lastPeriod>0){
 const first=headline.slice(0,lastPeriod),last=headline.slice(lastPeriod);
 $('statusTitle').replaceChildren(document.createTextNode(first+' '));
 const emphasis=document.createElement('em');emphasis.textContent=last.trim();$('statusTitle').append(emphasis);
}else $('statusTitle').textContent=headline;
$('statusIntro').textContent=state.intro;
$('statusDetail').textContent=state.detail;
$('visualStatus').textContent=state.diagnostic.toUpperCase();
$('statusCode').textContent=state.code;
$('statusRetryLabel').textContent=state.retry;
const returnHref='./'+from;
$('statusContinue').href=returnHref;
// Prefer back/forward cache when leaving the currently edited workspace;
// a fresh navigation can lose unpersisted cursor/selection state.
$('statusContinue').addEventListener('click',event=>{
 try{
  const previous=new URL(document.referrer);
  const prevPage=previous.pathname.slice(previous.pathname.lastIndexOf('/')+1);
  if(history.length>1&&previous.origin===location.origin&&safeReturnPage(prevPage)===prevPage){
   event.preventDefault();
   history.back();
  }
 }catch{} // Direct URL: follow the safe same-origin fallback link.
});
const feedback=$('statusFeedback'),retry=$('statusRetry');
const online=()=>navigator.onLine!==false;
function updateConnectivity(){
 if(state.kind==='offline'&&online())feedback.textContent='Your device reports a connection again. Retry to reload account services.';
 else if(!online())feedback.textContent='Still offline. You can return to cached practice without erasing local drafts.';
}
window.addEventListener('online',updateConnectivity);
window.addEventListener('offline',updateConnectivity);
retry.onclick=()=>{
 if(!online()){
  feedback.textContent='No internet connection detected. Check Wi-Fi or mobile data, then retry.';
  return;
 }
 retry.disabled=true;
 $('statusRetryLabel').textContent='Reopening ByteQuest…';
 // Original pages perform their own authenticated reads and state merges.
 // A successful navigation is NOT proof that cloud progress has synced.
 location.assign(returnHref);
};
updateConnectivity();

if(state.kind==='maintenance'){
  $('statusAdminLink').hidden=false;
  const timing=$('statusWindow'),feedbackArea=$('statusFeedback');
  async function readSchedule(){
    try{
      // Dynamic import keeps offline/busy pages functional without the backend.
      const [{fetchMaintenanceStatus},{istDisplay}]=await Promise.all([
        import('./maintenance-api.js?v=1'),
        import('./maintenance-model.js?v=1')
      ]);
      const status=await fetchMaintenanceStatus();
      if(status.active||status.upcoming){
        $('statusIntro').textContent=status.message||'ByteQuest is being upgraded.';
        $('statusDetail').textContent='Existing local drafts remain on your device. Cloud writes and verified submissions are paused only during the active maintenance window.';
        timing.hidden=false;
        $('statusWindowLabel').textContent=status.active?'EXPECTED RETURN · IST':'PLANNED WINDOW · IST';
        $('statusWindowTime').textContent=status.active?
          istDisplay(status.endsAt):istDisplay(status.startsAt);
        $('statusWindowEnds').textContent=status.active?
          'Maintenance is in progress. Backend submissions and sync are unavailable.':
          'Expected return: '+istDisplay(status.endsAt);
        if(!status.active)feedbackArea.textContent='Maintenance is scheduled but has not started.';
        else feedbackArea.textContent='The schedule is based on server time, not your device clock.';
      }else{
        timing.hidden=true;
        $('statusIntro').textContent='ByteQuest is not currently in maintenance mode.';
        $('statusDetail').textContent='This is the maintenance page preview. The service has not reported an active or upcoming enabled window.';
        $('statusRetryLabel').textContent='Return to ByteQuest';
        feedbackArea.textContent='No maintenance window is active. You can return to your workspace.';
      }
    }catch{
      timing.hidden=true;
      feedbackArea.textContent='Cannot confirm maintenance status. This screen may be a preview; retry when services are reachable.';
    }
  }
  void readSchedule();
  const scheduleTimer=setInterval(()=>{if(!document.hidden)void readSchedule();},45000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void readSchedule();});
  window.addEventListener('pagehide',()=>clearInterval(scheduleTimer),{once:true});
}
