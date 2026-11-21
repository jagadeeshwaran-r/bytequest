// Studio relies on the same Firebase session as the rest of ByteQuest.
// A cached profile photo/name is never evidence of authentication.
export function studioAccessState(cloud){
  const user=cloud?.user,loggedIn=Boolean(user),allowed=loggedIn&&Boolean(cloud.canCreate);
  if(allowed)return {kind:'ready',allowed:true,buttonVisible:false};
  if(!loggedIn){
    const error=cloud?.loginError;
    if(error)return {kind:'auth-error',allowed:false,title:cloud.loginReady?"Google sign-in couldn't finish":"Couldn't restore your session",message:String(error),buttonVisible:true,buttonText:cloud.loginReady?'Try Google sign-in again':'Retry connection',note:'Your drafts and published problems stay with your ByteQuest account.'};
    if(!cloud?.loginReady)return {kind:'connecting',allowed:false,title:'Restoring your session…',message:'Checking the Google account already connected to ByteQuest.',buttonVisible:false,note:'Your drafts and published problems stay with your ByteQuest account.'};
    return {kind:'signed-out',allowed:false,title:'Connect your ByteQuest account',message:'Use the same Google account as your ByteQuest profile to create and publish problems.',buttonVisible:true,buttonText:'Continue with Google',note:'Your drafts and published problems stay with your ByteQuest account.'};
  }
  const error=cloud.accessError;
  if(cloud.accessChecking)return {kind:'checking',allowed:false,title:'Checking publishing access…',message:'Your existing Google session is connected. Checking your creator permissions…',buttonVisible:false,note:'You are already signed in. No second Google sign-in is needed.'};
  if(error)return {kind:'permission-error',allowed:false,title:"Couldn't verify publishing access",message:String(error),buttonVisible:true,buttonText:'Retry access check',note:'You are already signed in. No second Google sign-in is needed.'};
  return {kind:'needs-creator',allowed:false,title:'Publishing access required',message:"You're signed in, but publishing requires creator access. An administrator can enable it for your account.",buttonVisible:false,note:'You are already signed in. No second Google sign-in is needed.'};
}
