// Maintenance schedule is evaluated against server time on EVERY request.
// No cron, frontend clock, user-supplied admin flag, or cached role is trusted.
const modes=new Set(['scheduled','on']);
const publicReadActions=new Set([
  'account','progress','self','reference-read','studio-list','account-delete'
]);
function instant(value){
  const date=new Date(value);
  return typeof value==='string'&&Number.isFinite(date.getTime())?date.getTime():NaN;
}
export function maintenanceState(row,now=Date.now()){
  if(!row||typeof row!=='object')throw new Error('Maintenance configuration is unavailable.');
  const enabled=row.enabled===true;
  const mode=row.mode;
  const start=instant(row.starts_at??row.startsAt);
  const end=instant(row.ends_at??row.endsAt);
  const valid=modes.has(mode)&&Number.isFinite(start)&&Number.isFinite(end)&&end>start;
  if(!valid)throw new Error('Invalid maintenance configuration.');
  const active=enabled&&now<end&&(mode==='on'||now>=start);
  const upcoming=enabled&&mode==='scheduled'&&now<start;
  return {
    enabled,mode,active,upcoming,
    startsAt:new Date(start).toISOString(),
    endsAt:new Date(end).toISOString(),
    message:String(row.message||'').slice(0,280),
    serverTime:new Date(now).toISOString()
  };
}
export function publicMaintenanceStatus(row,now=Date.now()){
  const state=maintenanceState(row,now);
  return {
    active:state.active,upcoming:state.upcoming,
    mode:state.active||state.upcoming?state.mode:null,
    startsAt:state.active||state.upcoming?state.startsAt:null,
    endsAt:state.active||state.upcoming?state.endsAt:null,
    message:state.active||state.upcoming?state.message:null,
    serverTime:state.serverTime
  };
}
export function validateMaintenanceSettings(input,now=Date.now()){
  if(!input||typeof input!=='object'||Array.isArray(input))
    throw new Error('Provide valid maintenance settings.');
  const {enabled,mode,startsAt,endsAt,revision}=input;
  if(typeof enabled!=='boolean'||!modes.has(mode))
    throw new Error('Select scheduled or immediate maintenance, and enable it explicitly.');
  if(!Number.isSafeInteger(revision)||revision<0||revision>=Number.MAX_SAFE_INTEGER)
    throw new Error('Reload maintenance settings before saving.');
  const start=instant(startsAt),end=instant(endsAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)
    throw new Error('Choose an end time later than the start time.');
  // Never arm a past window or create an unbounded on-now lockout.
  if(enabled&&mode==='scheduled'&&start<=now)
    throw new Error('A scheduled maintenance start must be in the future (IST).');
  if(enabled&&end<=now)
    throw new Error('The expected end time must be in the future.');
  if(end-start>7*86400000)
    throw new Error('Keep each maintenance window within seven days.');
  if(typeof input.message!=='string'||input.message.trim().length<1||input.message.trim().length>280)
    throw new Error('Enter a maintenance message of 1–280 characters.');
  return {
    enabled,mode,
    startsAt:new Date(start).toISOString(),
    endsAt:new Date(end).toISOString(),
    message:input.message.trim(),
    revision
  };
}
export function maintenanceBlocksAction(action){
  return !publicReadActions.has(action);
}
export function maintenanceAdminResponse(row,now=Date.now()){
  const status=maintenanceState(row,now);
  return {...status,revision:Number(row.revision)||0,updatedAt:row.updated_at||null};
}
