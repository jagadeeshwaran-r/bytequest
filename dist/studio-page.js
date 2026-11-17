// Standalone Studio entrypoint. Do NOT initialize the Problems workbench here:
// that workbench expects editor/catalog DOM nodes absent from studio.html and
// previously crashed before Firebase could restore an existing session.
import {Cloud} from './cloud.js?v=creator-admin-1';
import {Studio} from './studio.js?v=studio-auth-1&feature=rich-statements-1';
import {mountShell} from './shell.js?v=creator-admin-1';

window.__bytequestStudioStarted=true;
const $=id=>document.getElementById(id);
const shell=mountShell();
let accountEpoch=0,lastOwner=undefined,toastTimer=null;
const cloud=new Cloud(()=>{void accountChanged();});
const notify=message=>{
  const toast=$('toast');if(!toast)return;
  toast.textContent=message;toast.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),3500);
};
const studio=new Studio({cloud,notify,onCatalogChanged:async()=>{}});
shell.connect(cloud);

function paintAccount(){
  const user=cloud.user;
  shell.setAccount(user);
  shell.setAdmin(cloud.admin);
  const name=String(user?.user_metadata?.full_name||'Java explorer');
  $('accountLabel').textContent=user?name.split(' ')[0]:'Sign in with Google';
  $('syncLabel').textContent=user?'Account connected':cloud.loginReady?'On this device':'Connecting account';
  $('accountTitle').textContent=user?'Your learning, connected.':'A little more connected.';
  $('accountDescription').textContent=user?'Your Studio drafts and problems belong to this Google account.':'Sign in with Google to publish problems and save your work.';
  $('accountIdentity').hidden=!user;
  $('accountIdentity').textContent=user?name+(user.email?' · '+user.email:''):'';
  $('googleSignInBtn').hidden=!!user;
  $('guestContinue').hidden=!!user;
  $('signOutBtn').hidden=!user;
  // Synced practice backups are managed from Problems; Studio does not
  // duplicate that backend/merge workflow.
  $('syncNowBtn').hidden=true;
  $('importGuestBtn').hidden=true;
}
async function verifyAccess(){
  const owner=cloud.user?.id;
  if(!owner)return;
  const epoch=++accountEpoch;
  cloud.accessChecking=true;cloud.accessError=null;
  cloud.admin=false; // Never reuse the legacy editor flag as admin authority.
  paintAccount();void studio.open();
  // Check actual admin rights without delaying creator workspace loading.
  void cloud.request('self',{},owner).then(response=>{
    if(epoch!==accountEpoch||cloud.user?.id!==owner)return;
    cloud.admin=response.admin===true;
    paintAccount();
  }).catch(()=>{
    if(epoch!==accountEpoch||cloud.user?.id!==owner)return;
    cloud.admin=false;paintAccount();
  });
  try{
    await cloud.checkAdmin(owner);
    if(epoch!==accountEpoch||cloud.user?.id!==owner)return;
    cloud.accessError=null;
  }catch(error){
    if(epoch!==accountEpoch||cloud.user?.id!==owner)return;
    cloud.admin=false;cloud.canCreate=false;
    cloud.accessError=error?.message||'Unable to check publishing access. Retry.';
  }finally{
    if(epoch===accountEpoch&&cloud.user?.id===owner){
      cloud.accessChecking=false;
      paintAccount();void studio.open();
    }
  }
}
function accountChanged(){
  const owner=cloud.user?.id||null;
  if(lastOwner!==owner){
    lastOwner=owner;accountEpoch++;
    studio.accountChanged();
  }
  paintAccount();
  if(owner)return verifyAccess();
  cloud.admin=false;cloud.canCreate=false;
  cloud.accessChecking=false;cloud.accessError=null;
  return studio.open();
}

let signingIn=false;
async function googleSignIn(){
  if(signingIn)return;
  if(!cloud.loginReady){
    $('authMessage').textContent='The sign-in session has not initialized. Reload Studio to retry.';
    cloud.loginError='The sign-in connection has not initialized. Reload Studio to retry.';
    void studio.open();
    return;
  }
  signingIn=true;
  const dialogButton=$('googleSignInBtn'),gateButton=$('studioSignIn');
  dialogButton.disabled=true;gateButton.disabled=true;
  try{
    $('authMessage').textContent='Opening Google sign-in…';
    await cloud.signIn();cloud.loginError=null;
    $('authMessage').textContent='';
    if($('accountDialog').open)$('accountDialog').close();
    // Firebase onAuthStateChanged owns the authenticated user. If its
    // callback already fired, the permission check is running independently.
  }catch(error){
    $('authMessage').textContent=error.message;
    cloud.loginError=error.message;void studio.open();
  }finally{
    dialogButton.disabled=false;gateButton.disabled=false;signingIn=false;
  }
}
$('studioSignIn').onclick=()=>{
  if(!cloud.loginReady){location.reload();return;}
  if(cloud.user){void verifyAccess();return;}
  void googleSignIn();
};
$('googleSignInBtn').onclick=()=>void googleSignIn();
function openAccount(){
  paintAccount();
  if(!$('accountDialog').open)$('accountDialog').showModal();
}
$('accountBtn').onclick=openAccount;
$('syncBadge').onclick=openAccount;
$('profileBtn').onclick=()=>{location.href='./community.html#me';};
$('signOutBtn').onclick=async()=>{
  const button=$('signOutBtn');button.disabled=true;
  try{await cloud.signOut();if($('accountDialog').open)$('accountDialog').close();}
  catch(error){$('authMessage').textContent=error.message;}
  finally{button.disabled=false;}
};
$('exportBtn').onclick=()=>{location.href='./index.html#progress';};
$('aboutBtn').onclick=()=>$('aboutDialog').showModal();
$('guestContinue').onclick=()=>$('accountDialog').close();
document.querySelectorAll('.dialog-close,.dialog-close-button').forEach(button=>{
  button.onclick=()=>button.closest('dialog')?.close();
});

async function boot(){
  paintAccount();void studio.open();
  // A broken CDN or blocked Firebase initialization cannot leave the UI in
  // "Restoring your session" forever. Keep the pending promise alive so
  // successful late restoration still replaces this provisional error.
  const slowTimer=setTimeout(()=>{
    if(!cloud.loginReady){
      cloud.loginError='Google session restoration is taking longer than expected. Check your connection and choose Retry connection.';
      void studio.open();
    }
  },10000);
  try{
    await cloud.init();
    cloud.loginError=null;
  }catch(error){
    cloud.loginError=error?.message||'Unable to restore Google sign-in.';
    $('authMessage').textContent=cloud.loginError;
  }finally{
    clearTimeout(slowTimer);
    void accountChanged();
  }
}
void boot();
