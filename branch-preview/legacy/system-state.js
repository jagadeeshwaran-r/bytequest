// Deterministic outage classifications shared by network alerts and the
// standalone ByteQuest recovery page. No outage is inferred from HTTP 401/403
// or a single failed submission-verification request.
const issues=new Set(['offline','busy','unreachable','maintenance']);
const pages=new Set(['index.html','leaderboard.html','community.html','studio.html']);
const maintenanceCodes=new Set(['MAINTENANCE','MAINTENANCE_MODE','PLANNED_MAINTENANCE']);
export function safeReturnPage(input){
  if(typeof input!=='string')return 'index.html';
  const value=input.startsWith('./')?input.slice(2):input;
  return pages.has(value)?value:'index.html';
}
export function connectionPageUrl(issue,returnPage='index.html'){
  const kind=issues.has(issue)?issue:'unreachable';
  return './status.html?issue='+kind+'&from='+encodeURIComponent(safeReturnPage(returnPage));
}
export function classifyConnectionIssue(error,{online=true,status,code,action}={}){
  if(online===false)return 'offline';
  const operation=String(action||error?.action||'');
  // Private judging can fail while the rest of ByteQuest is healthy.
  if(operation==='submission-create'||operation==='native-run')return null;
  const http=Number(status??error?.httpStatus??error?.status??0);
  const reason=String(code??error?.errorCode??error?.code??'').toUpperCase();
  if(http===503&&maintenanceCodes.has(reason))return 'maintenance';
  if(http===429||http===503||http===504)return 'busy';
  const name=String(error?.name||error?.errorName||'');
  if(name==='TimeoutError'||name==='AbortError'||error?.timeout===true)return 'busy';
  if(http===502||http===0)return 'unreachable';
  return null;
}
export function outagePageContent(issue){
  const kind=issues.has(issue)?issue:'unreachable';
  const data={
    offline:{
      eyebrow:'LOCAL CONNECTION',title:'Signal lost.',
      intro:'Your device appears to be offline. ByteQuest cannot confirm cloud saves until your connection returns.',
      detail:'Cached problems and existing drafts may still be available on this device. Keep your browser data intact.',
      diagnostic:'Device is offline',retry:'Check connection',code:'BQ-001'
    },
    busy:{
      eyebrow:'TEMPORARY DELAY',title:'The network is taking a moment.',
      intro:'A ByteQuest request was delayed, rate-limited, or returned a temporary server error.',
      detail:'Your browser drafts have not been cleared. A successful cloud save must be confirmed separately.',
      diagnostic:'Service request delayed',retry:'Try again',code:'BQ-002'
    },
    unreachable:{
      eyebrow:'SERVICE CONNECTION',title:'The route went quiet.',
      intro:'Your device may be online, but ByteQuest could not reach one of the services it needs.',
      detail:'This does not prove a widespread Supabase or Firebase outage. Saved progress may remain available locally.',
      diagnostic:'Service unreachable',retry:'Retry connection',code:'BQ-003'
    },
    maintenance:{
      eyebrow:'PLANNED MAINTENANCE',title:'Fine-tuning the arena.',
      intro:'ByteQuest has reported that a service is in maintenance mode.',
      detail:'Your account changes are not confirmed until the service is available again. Existing browser drafts are not cleared.',
      diagnostic:'Maintenance reported',retry:'Check availability',code:'BQ-004'
    }
  };
  return {kind,...data[kind]};
}
export function issueFromCloudHealth(state,{online=true}={}){
  if(!online)return 'offline';
  if(!state)return null;
  if(state.kind==='maintenance')return 'maintenance';
  if(state.kind==='throttled')return 'busy';
  if(state.kind==='service')return classifyConnectionIssue(
    {httpStatus:state.status??0,errorCode:state.errorCode,action:state.action},
    {online}
  )||'unreachable';
  if(state.kind==='sync-failed'&&(state.status===0||state.status>=500))return classifyConnectionIssue(state,{online})||'unreachable';
  return null;
}
