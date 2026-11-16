// Presentation gate only: FirebaseSession is the single source of truth for sign-in.
// GitHub Pages is public static hosting. This module does not authorize API requests.
export function accessPhase({authResolved=false, user=null, accountReady=false}={}){
  if(!authResolved)return "checking";
  if(!user)return "locked";
  return accountReady?"unlocked":"checking";
}
export function mountSignInGate({doc=document,signIn,reload=()=>location.reload()}={}){
  const root=doc.getElementById("authGate");
  const button=doc.getElementById("authGateButton");
  const status=doc.getElementById("authGateStatus");
  if(!root||!button||!status)throw new Error("ByteQuest sign-in screen is missing.");
  let phase="checking";
  function show(next,message){
    phase=next;
    doc.documentElement.dataset.bytequestAuth=next;
    root.hidden=next==="unlocked";
    button.disabled=next==="checking"||next==="signing-in"||next==="unlocked";
    button.textContent=next==="error"?"Reload and retry":"Continue with Google";
    status.textContent=message||(
      next==="checking"?"Checking your Google sign-in…":
      next==="signing-in"?"Opening Google sign-in…":
      next==="error"?"Sign-in is unavailable. Reload to try again.":
      next==="locked"?"Sign in to access the problem library.":""
    );
  }
  button.onclick=async()=>{
    if(phase==="error"){reload();return;}
    if(phase!=="locked")return;
    show("signing-in");
    try{
      await signIn();
      if(phase==="signing-in")show("checking","Finishing Google sign-in…");
    }catch(error){
      if(phase!=="unlocked")show("locked",error?.message||"Sign-in could not finish. Please try again.");
    }
  };
  show("checking");
  return {show, get phase(){return phase;}};
}
