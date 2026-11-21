import {Injectable, OnDestroy, signal} from '@angular/core';
import {getApp, getApps, initializeApp} from 'firebase/app';
import {browserLocalPersistence, getAuth, GoogleAuthProvider, onAuthStateChanged, setPersistence, signInWithPopup, signOut, type Auth, type User, type Unsubscribe} from 'firebase/auth';

// Browser-safe public Firebase app configuration. Do not put Firebase Admin
// credentials, service accounts, or Supabase service-role keys in frontend code.
const config={
  apiKey:'AIzaSyDg6Zogv1JqCxHg26BT0HPwLJX4P45SobA',
  authDomain:'bytequest-7b841.firebaseapp.com',
  projectId:'bytequest-7b841',
  appId:'1:25442282451:web:7b188546eadc81adb75d26'
};
export interface Identity{readonly id:string;readonly name:string;readonly email:string;}
const mapIdentity=(user:User|null):Identity|null=>user?{
  id:'firebase:'+config.projectId+':'+user.uid,
  name:user.displayName||'Java explorer',email:user.email||''
}:null;

@Injectable({providedIn:'root'})
export class AuthService implements OnDestroy{
  private readonly app=getApps().some(a=>a.name==='bytequest-angular-staging')
    ?getApp('bytequest-angular-staging'):initializeApp(config,'bytequest-angular-staging');
  private readonly auth:Auth=getAuth(this.app);
  private current:User|null=null;
  private unsubscribe:Unsubscribe|null=null;
  readonly user=signal<Identity|null>(null);
  readonly ready=signal(false);
  readonly error=signal('');
  readonly loading=signal(false);
  readonly initialized:Promise<void>;
  constructor(){
    this.initialized=new Promise<void>((resolve,reject)=>{
      this.unsubscribe=onAuthStateChanged(this.auth,user=>{
        this.current=user;
        this.user.set(mapIdentity(user));
        if(!this.ready()){this.ready.set(true);resolve();}
      },error=>{this.error.set(error.message);this.ready.set(true);reject(error);});
    });
    void setPersistence(this.auth,browserLocalPersistence).catch(error=>this.error.set(error.message));
  }
  async signIn():Promise<void>{
    this.error.set('');this.loading.set(true);
    try{
      await this.initialized;
      const provider=new GoogleAuthProvider();
      provider.setCustomParameters({prompt:'select_account'});
      await signInWithPopup(this.auth,provider);
    }catch(error){
      this.error.set(error instanceof Error?error.message:'Could not sign in.');
    }finally {this.loading.set(false);}
  }
  async signOut():Promise<void>{
    this.error.set('');
    try{await signOut(this.auth);}catch(error){this.error.set(error instanceof Error?error.message:'Could not sign out.');}
  }
  async token():Promise<string>{
    await this.initialized;
    const user=this.current;
    if(!user)throw new Error('Sign in to view this account-only page.');
    const token=await user.getIdToken();
    if(this.current!==user)throw new Error('Account changed. Retry the request.');
    return token;
  }
  ngOnDestroy():void{this.unsubscribe?.();}
}
