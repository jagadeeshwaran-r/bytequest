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
