export function validFirebaseConfig(config){
  return !!config && /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(config.projectId)
    && config.authDomain===config.projectId+".firebaseapp.com"
    && /^AIza[A-Za-z0-9_-]{30,50}$/.test(config.apiKey)
    && /^1:\d+:web:[a-zA-Z0-9]+$/.test(config.appId);
}
export function firebaseIdentity(user,projectId){
  if(!user||typeof user.uid!=="string"||!user.uid.length||user.uid.length>128)return null;
  return {id:"firebase:"+projectId+":"+user.uid,email:user.email||"",user_metadata:{full_name:String(user.displayName||"Java explorer")}};
}
export function firebaseAuthMessage(error){
  const messages={
    "auth/popup-blocked":"Your browser blocked the Google window. Allow pop-ups for ProSolver and try again. On mobile, open ProSolver directly in Safari or Chrome.",
    "auth/popup-closed-by-user":"The Google window was closed. Your local practice is saved; try again when you are ready.",
    "auth/cancelled-popup-request":"Another sign-in window is already open.",
    "auth/unauthorized-domain":"Google sign-in is not enabled for this website address yet. Guest practice is available.",
    "auth/operation-not-allowed":"Google sign-in is not activated yet. Guest practice is available.",
    "auth/network-request-failed":"Could not reach Google sign-in. Check your connection and try again.",
    "auth/web-storage-unsupported":"This browser blocks the storage needed for sign-in. Open ProSolver in a regular Safari or Chrome tab.",
    "auth/user-disabled":"This account is disabled. Contact the site owner.",
    "auth/invalid-api-key":"The sign-in connection needs attention from the site owner. Guest practice is available."
  };
  return messages[error?.code]||"Google sign-in could not finish. Your local practice is saved; please try again.";
}
async function loadFirebase(){
  const [app,auth]=await Promise.all([
    import("https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js")
  ]);
  return {...app,...auth};
}
export class FirebaseSession{
  constructor(config,onChange=()=>{},{loadSdk=loadFirebase}={}){
    this.config=config;this.onChange=onChange;this.loadSdk=loadSdk;this.auth=null;this.firebaseUser=null;this.ready=false;this.user=null;
  }
  async init(){
    if(!validFirebaseConfig(this.config))throw new Error("Firebase sign-in is being connected. You can keep practising as a guest.");
    this.sdk=await this.loadSdk();
    const app=this.sdk.initializeApp(this.config,"bytequest");this.auth=this.sdk.getAuth(app);
    await this.sdk.setPersistence(this.auth,this.sdk.browserLocalPersistence);
    await new Promise((resolve,reject)=>{
      let initial=true;
      this.unsubscribe=this.sdk.onAuthStateChanged(this.auth,user=>{
        const previous=this.user?.id||null;
        this.firebaseUser=user;this.user=firebaseIdentity(user,this.config.projectId);
        if(initial){initial=false;this.ready=true;resolve();}
        else if(previous!==(this.user?.id||null))this.onChange(this.user);
      },reject);
    });
  }
  async signIn(){
    if(!this.ready||!this.auth)throw new Error("Sign-in is still loading. Please try again in a moment.");
    const provider=new this.sdk.GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});
    try{await this.sdk.signInWithPopup(this.auth,provider);}catch(error){throw new Error(firebaseAuthMessage(error));}
  }
  async reauthenticate(ownerId){
    const user=this.firebaseUser;if(!user||this.user?.id!==ownerId)throw new Error('Your account changed. Reopen account settings.');
    const provider=new this.sdk.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
    try{await this.sdk.reauthenticateWithPopup(user,provider);}catch(error){throw new Error(firebaseAuthMessage(error));}
    if(this.firebaseUser!==user||this.user?.id!==ownerId)throw new Error('Your account changed. Account removal was cancelled.');
  }
  async signOut(){if(this.auth)await this.sdk.signOut(this.auth);}
  async tokenFor(ownerId,force=false){
    const user=this.firebaseUser;
    if(!user||this.user?.id!==ownerId)throw new Error("Your account changed. Please retry saving.");
    const token=await user.getIdToken(force);
    if(this.firebaseUser!==user||this.user?.id!==ownerId)throw new Error("Your account changed. Please retry saving.");
    return token;
  }
}
