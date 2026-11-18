import {Cloud} from './cloud.js?v=outage-1';
import {isoToISTInput,istInputToISO,istDisplay} from './maintenance-model.js?v=1';

const $=id=>document.getElementById(id);
const cloud=new Cloud(()=>{void checkAccess();});
let current=null,epoch=0,busy=false;
function message(text,isError=false){$('maFeedback').textContent=text;$('maFeedback').dataset.error=String(isError);}
function showAuth(text,{login=false,retry=false}={}){
 $('maAuth').hidden=false;$('maControl').hidden=true;
 $('maAuthText').textContent=text;
 $('maSignIn').hidden=!login;
 $('maRetry').hidden=!retry;
 $('adminSiteLink').hidden=true;
}
function setBusy(value){
 busy=value;for(const id of ['maSave','maArm','maDisable'])$(id).disabled=value;
}
function paint(record){
 current=record;
 $('maAuth').hidden=true;$('maControl').hidden=false;$('adminSiteLink').hidden=false;
 $('maOwner').textContent=cloud.user?.email||'Verified library administrator';
 $('maMode').value=record.mode;
 $('maStart').value=isoToISTInput(record.startsAt);
 $('maEnd').value=isoToISTInput(record.endsAt);
 $('maMessage').value=record.message;
 $('maChars').textContent=record.message.length;
 const state=record.active?'ACTIVE':record.upcoming?'SCHEDULED':record.enabled?'WINDOW ENDED':'DISABLED';
 $('maState').textContent=state;
 $('maStateTitle').textContent=record.active?'Maintenance is live':
   record.upcoming?'Maintenance is armed':'Maintenance is not active';
 $('maStateDetail').textContent=record.active?
   'Learner writes are blocked. The window ends automatically at '+istDisplay(record.endsAt)+'.':
   record.upcoming?'Maintenance starts automatically at '+istDisplay(record.startsAt)+'.':
   record.enabled?'The scheduled window has expired. Disable it before scheduling another.':
   'These settings are an inactive draft. Nothing starts unless you explicitly enable maintenance.';
 $('maArm').textContent=$('maMode').value==='on'?'Start maintenance now':'Enable schedule';
 $('maDisable').disabled=!record.enabled;
}
async function checkAccess(){
 const token=++epoch,owner=cloud.user?.id;
 current=null;
 if(!owner){
  showAuth(cloud.loginReady?'Sign in with Google to access library-admin maintenance settings.':'Restoring the Google sign-in session…',{login:cloud.loginReady});
  return;
 }
 showAuth('Verifying your library administrator role with the server…');
 try{
  const result=await cloud.request('maintenance-admin-get',{},owner);
  if(token!==epoch||cloud.user?.id!==owner)return;
  paint(result);message('');
 }catch(error){
  if(token!==epoch||cloud.user?.id!==owner)return;
  showAuth(error?.httpStatus===403?
   'Your Google account is not a ByteQuest library administrator. No changes were made.':
   'Could not verify administrator access. Check the backend connection and retry.',{retry:true});
  message(error?.message||'Authorization unavailable',true);
 }
}
function settings(enabled){
 if(!current)throw new Error('Verify administrator access before saving.');
 const mode=$('maMode').value;
 let startsAt=istInputToISO($('maStart').value),endsAt=istInputToISO($('maEnd').value);
 if(enabled&&mode==='on')startsAt=new Date().toISOString();
 return {
  enabled,mode,startsAt,endsAt,
  message:$('maMessage').value.trim(),
  revision:current.revision
 };
}
async function save(enabled,{confirmActivation=false}={}){
 if(busy||!current)return;
 let candidate;try{candidate=settings(enabled);}catch(error){message(error.message,true);return;}
 if(confirmActivation){
  const windowText=candidate.mode==='scheduled'?
   'from '+istDisplay(candidate.startsAt)+' until '+istDisplay(candidate.endsAt):
   'immediately until '+istDisplay(candidate.endsAt);
  if(!confirm('Enable ByteQuest maintenance '+windowText+'? Learners will see the maintenance notice and backend writes will be blocked.'))return;
 }
 setBusy(true);message('Saving maintenance configuration…');
 const owner=cloud.user?.id,ticket=epoch;
 try{
  const result=await cloud.request('maintenance-admin-save',{settings:candidate},owner);
  if(owner!==cloud.user?.id||ticket!==epoch)return;
  paint(result);
  message(enabled?'Maintenance schedule is armed. The server controls start/end times.':
   'Maintenance is disabled. Saved settings remain available for a future window.');
 }catch(error){
  if(ticket!==epoch||owner!==cloud.user?.id)return;
  message(error?.message||'Could not save settings. Current maintenance state was not changed.',true);
 }finally{if(ticket===epoch){setBusy(false);if(current)$('maDisable').disabled=!current.enabled;}}
}
$('maForm').addEventListener('submit',event=>{
 event.preventDefault();
 // A disabled draft stays disabled; an already enabled schedule is edited
 // deliberately, without quietly switching its armed state.
 void save(current?.enabled===true);
});
$('maArm').onclick=()=>void save(true,{confirmActivation:true});
$('maDisable').onclick=()=>{
 if(current?.enabled!==true)return;
 if(confirm('Disable ByteQuest maintenance immediately? Learners will be able to submit and sync again.'))void save(false);
};
$('maMode').onchange=()=>{
 $('maArm').textContent=$('maMode').value==='on'?'Start maintenance now':'Enable schedule';
};
$('maMessage').oninput=()=>$('maChars').textContent=$('maMessage').value.length;
$('maSignIn').onclick=async()=>{
 if(!cloud.loginReady){message('Google sign-in is still initializing. Retry connection.',true);return;}
 $('maSignIn').disabled=true;
 try{await cloud.signIn();}catch(error){message(error?.message||'Sign-in failed.',true);}
 finally{$('maSignIn').disabled=false;}
};
$('maRetry').onclick=()=>void checkAccess();
$('maSignOut').onclick=async()=>{
 try{await cloud.signOut();}catch(error){message(error.message,true);}
};
showAuth('Restoring the Google sign-in session…');
void cloud.init().then(()=>checkAccess()).catch(error=>{
 showAuth('Could not initialize Firebase authentication. Check your connection.',{retry:true});
 message(error?.message||'Authentication unavailable',true);
});
