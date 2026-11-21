import {Injectable,inject,signal} from '@angular/core';
import {AuthService} from './auth.service';
import {makeJavaSubmission,verifiedJavaVerdict,type JavaSubmissionProblem,
  type SuiteScope,type SubmissionNotes,type VerifiedVerdict} from './java-submission-contract';

interface StagingConfig{
  readonly enabled:boolean;
  readonly apiUrl:string;
  readonly publishableKey:string;
}
function validatedUrl(config:StagingConfig):string{
  if(config.enabled!==true)throw new Error('Verified Submit is disabled on this preview until an isolated staging backend is connected.');
  if(!config.apiUrl||!config.publishableKey)throw new Error('Staging backend configuration is incomplete.');
  const target=new URL(config.apiUrl);
  if(target.protocol!=='https:' || !/^[-a-z0-9]+\.supabase\.co$/.test(target.hostname)
    ||target.hostname==='zwubrziriuppkldrdoos.supabase.co'
    ||target.pathname!=='/functions/v1/bytequest-firebase')
    throw new Error('Submit requires a separate Supabase staging project. Production data must stay untouched.');
  return target.href;
}
/** Angular-side Java verified submission only; never run browser-case fallbacks here. */
@Injectable({providedIn:'root'})
export class VerifiedJavaService{
  private readonly auth=inject(AuthService);
  readonly status=signal('');
  readonly sending=signal(false);
  private pending:Promise<VerifiedVerdict>|null=null;
  private readonly settings=fetch(new URL('staging-backend.json',document.baseURI),{cache:'no-store'})
    .then(async result=>{
      if(!result.ok)throw new Error('Staging configuration is unavailable.');
      return await result.json() as StagingConfig;
    });
  async canSubmit():Promise<boolean>{
    try{validatedUrl(await this.settings);return true;}catch{return false;}
  }
  async submit(problem:JavaSubmissionProblem,source:string,scope:SuiteScope,notes:SubmissionNotes={}):Promise<VerifiedVerdict>{
    if(this.pending)throw new Error('Another submission is already running.');
    const owner=this.auth.user()?.id;
    if(!owner)throw new Error('Sign in to submit a verified Java solution.');
    const nonce=crypto.randomUUID();
    const payload=makeJavaSubmission(problem,source,scope,nonce,notes);
    const action=async()=>{
      const config=await this.settings;
      const url=validatedUrl(config);
      const token=await this.auth.token();
      if(this.auth.user()?.id!==owner)throw new Error('Your account changed. Submission cancelled.');
      this.status.set('Submitting Java to isolated staging judge…');
      const response=await fetch(url,{
        method:'POST',
        headers:{'Content-Type':'application/json',apikey:config.publishableKey,Authorization:'Bearer '+token},
        body:JSON.stringify(payload),
        signal:AbortSignal.timeout(70000)
      });
      if(this.auth.user()?.id!==owner)throw new Error('Your account changed. Ignore this result and check your account.');
      const body:unknown=await response.json().catch(()=>{throw new Error('The Java judge response could not be read.');});
      if(!response.ok){
        const detail=body&&typeof body==='object'?(body as {error?:unknown}).error:null;
        throw new Error(typeof detail==='string'?detail:'The staging judge rejected this Java submission.');
      }
      const verdict=verifiedJavaVerdict(body,scope);
      this.status.set(verdict.accepted?(scope==='public'?'Verified public-suite acceptance':'Verified full-suite acceptance'):'No verified acceptance recorded.');
      return verdict;
    };
    this.sending.set(true);
    const pending=action();
    this.pending=pending;
    try{return await pending;}
    finally{if(this.pending===pending)this.pending=null;this.sending.set(false);}
  }
}
