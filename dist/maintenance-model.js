// All ProSolver maintenance timestamps are stored in UTC, displayed/edited
// as Asia/Kolkata (IST, +05:30). Never rely on the visitor's device zone.
const IST_MINUTES=330;
const dateTimeLocal=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export function isoToISTInput(iso){
  const time=Date.parse(iso);
  return Number.isFinite(time)?new Date(time+IST_MINUTES*60000).toISOString().slice(0,16):'';
}
export function istInputToISO(input){
  if(!dateTimeLocal.test(input))throw new Error('Enter a valid maintenance date and time in IST.');
  const result=new Date(input+':00+05:30');
  if(!Number.isFinite(result.getTime())||isoToISTInput(result.toISOString())!==input)
    throw new Error('This IST date or time is invalid.');
  return result.toISOString();
}
export function istDisplay(iso){
  const time=Date.parse(iso);
  return Number.isFinite(time)?new Intl.DateTimeFormat('en-IN',{
    timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',
    hour:'numeric',minute:'2-digit',hour12:true
  }).format(new Date(time))+' IST':'Not specified';
}
export function maintenanceUiState(status,now=Date.now()){
  const active=status?.active===true,upcoming=status?.upcoming===true;
  if(active)return 'active';
  if(upcoming)return 'upcoming';
  return 'inactive';
}
