import {ChangeDetectionStrategy,Component,effect,inject,signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {AuthService} from '../../core/auth.service';
import {StagingActionService} from '../../core/staging-action.service';
import {type ProfileEdit,validateProfileEdit} from '../../core/profile-edit-contract';
const empty:ProfileEdit={
 username:'',display_name:'',bio:'',avatar_url:'',
 discoverable:true,show_presence:true,organization_type:'',
 organization_name:'',organization_url:'',linkedin_url:'',github_url:''
};
type TextField=Exclude<keyof ProfileEdit,'discoverable'|'show_presence'>;
@Component({
 selector:'bq-profile-edit',imports:[RouterLink],
 changeDetection:ChangeDetectionStrategy.OnPush,
 template:`
 <div class="community-page native-profile-edit">
  <main>
   <header class="profile-edit-header"><div><span class="eyebrow">YOUR PUBLIC IDENTITY</span>
     <h2>Edit profile</h2><p>Update how other learners see you on ByteQuest.</p></div>
     <a routerLink="/angular/profile/me" aria-label="Return to profile">×</a>
   </header>
   @if(!auth.user()){
    <div class="white-card"><p>Sign in to edit your profile.</p>
      <button class="button primary" type="button" (click)="auth.signIn()">Continue with Google</button></div>
   } @else if(loading()){
    <p class="muted" role="status">Loading saved profile…</p>
   } @else{
    @if(error()){<p role="alert" class="native-error">{{error()}}</p>}
    @if(success()){<p role="status" class="native-success">{{success()}}</p>}
    <form class="profile-form" (submit)="save($event)">
     <div class="profile-edit-group"><h3>About you</h3>
      <label>Username<input autocomplete="username" minlength="3" maxlength="24"
       pattern="[a-z][a-z0-9_]{2,23}" required [value]="form().username"
       (input)="set('username',$event)"/></label>
      <label>Display name<input maxlength="60" required [value]="form().display_name"
       (input)="set('display_name',$event)"/></label>
      <label>A little about you<textarea maxlength="280" rows="3"
       [value]="form().bio" (input)="set('bio',$event)"></textarea></label>
      <small>{{form().bio.length}} / 280</small>
      <label>Avatar image (HTTPS URL)<input inputmode="url" [value]="form().avatar_url"
       (input)="set('avatar_url',$event)"/></label>
     </div>
     <div class="profile-edit-group"><h3>Work and education</h3>
      <label>Organization type<select [value]="form().organization_type"
       (change)="set('organization_type',$event)">
        <option value="">Not specified</option><option value="company">Company</option>
        <option value="organization">Organization</option><option value="university">University</option>
       </select></label>
      <label>Organization name<input maxlength="100" [value]="form().organization_name"
       (input)="set('organization_name',$event)"/></label>
      <label>Organization website<input inputmode="url" [value]="form().organization_url"
       (input)="set('organization_url',$event)"/></label>
     </div>
     <div class="profile-edit-group"><h3>Links</h3>
      <label>GitHub profile<input inputmode="url" [value]="form().github_url"
       (input)="set('github_url',$event)"/></label>
      <label>LinkedIn profile<input inputmode="url" [value]="form().linkedin_url"
       (input)="set('linkedin_url',$event)"/></label>
     </div>
     <div class="profile-edit-group"><h3>Privacy</h3>
      <label class="native-checkbox"><input type="checkbox" [checked]="form().discoverable"
       (change)="setBoolean('discoverable',$event)"/> Allow others to discover my profile</label>
      <label class="native-checkbox"><input type="checkbox" [checked]="form().show_presence"
       (change)="setBoolean('show_presence',$event)"/> Show online and last-seen status</label>
     </div>
     <div class="profile-edit-actions">
      <a class="button secondary" routerLink="/angular/profile/me">Cancel</a>
      <button type="submit" class="button primary" [disabled]="saving()||!canWrite()">
       {{saving()?'Saving…':'Save changes'}}</button>
     </div>
     @if(!canWrite()){<p class="muted">Saving profile changes is disabled in staging until
        a separate test backend is connected. Your live profile remains unchanged.</p>}
    </form>
   }
  </main>
 </div>
 `,
 styles:[`
  :host{display:block}
  .native-profile-edit main{width:min(760px,100%);margin:auto;padding:20px 12px 65px}
  .native-profile-edit .profile-form{display:grid;gap:20px}
  .native-profile-edit .profile-edit-group{display:grid;gap:12px}
  .native-profile-edit .profile-edit-group label{display:grid;gap:6px;font-size:12px}
  .native-profile-edit .profile-edit-group label.native-checkbox{display:flex;align-items:center}
  .native-profile-edit .profile-edit-actions{display:flex;align-items:center;justify-content:flex-end;gap:12px}
  .native-profile-edit .profile-form input:not([type=checkbox]),
  .native-profile-edit .profile-form select,.native-profile-edit .profile-form textarea{
   width:100%;border:1px solid var(--border);background:var(--surface);
   border-radius:8px;color:var(--text);padding:10px}
  .native-error{color:#e78b8b}.native-success{color:var(--accent)}
 `]
})
export class EditProfileComponent{
 readonly auth=inject(AuthService);
 private readonly api=inject(StagingActionService);
 readonly form=signal<ProfileEdit>({...empty});
 readonly loading=signal(true);
 readonly canWrite=signal(false);
 readonly saving=signal(false);
 readonly error=signal('');
 readonly success=signal('');
 constructor(){effect(()=>{
   if(this.auth.user())void this.load();
   else{this.form.set({...empty});this.loading.set(false);}
 });}
 private async load():Promise<void>{
   this.loading.set(true);
   const user=this.auth.user()?.id;
   try{
     this.canWrite.set(await this.api.canWrite());
     if(!user)return;
     const self=await this.api.read<{profile:Partial<ProfileEdit>}>('self');
     if(this.auth.user()?.id!==user)return;
     this.form.set({...empty,...self.profile});
   }catch(e){this.error.set(e instanceof Error?e.message:'Could not load profile.');}
   finally{this.loading.set(false);}
 }
 set(key:TextField,event:Event):void{
  const target=event.target as HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement;
  this.form.update(current=>({...current,[key]:target.value}));
  this.success.set('');this.error.set('');
 }
 setBoolean(key:'discoverable'|'show_presence',event:Event):void{
  const value=(event.target as HTMLInputElement).checked;
  this.form.update(current=>({...current,[key]:value}));
  this.success.set('');this.error.set('');
 }
 async save(event:Event):Promise<void>{
   event.preventDefault();
   if(this.saving()||!this.canWrite())return;
   let body:ProfileEdit;
   try{body=validateProfileEdit(this.form());}
   catch(e){this.error.set(e instanceof Error?e.message:'Invalid profile.');return;}
   this.saving.set(true);this.error.set('');this.success.set('');
   const user=this.auth.user()?.id;
   try{
     await this.api.write('profile-save',body as unknown as Record<string,unknown>);
     if(this.auth.user()?.id===user){this.form.set(body);this.success.set('Saved to your staging profile.');}
   }catch(e){this.error.set(e instanceof Error?e.message:'Profile could not be saved.');}
   finally{this.saving.set(false);}
 }
}
