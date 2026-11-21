import {ChangeDetectionStrategy,Component,inject,signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {AuthService} from '../../core/auth.service';
import {StagingActionService} from '../../core/staging-action.service';
interface Person{
 readonly public_id:string;readonly username:string;readonly display_name:string;
 readonly avatar_url?:string;
}
@Component({selector:'bq-search',imports:[RouterLink],changeDetection:ChangeDetectionStrategy.OnPush,
 template:`
<section class="native-find">
 <div class="section-heading"><div><span class="eyebrow">BYTEQUEST COMMUNITY</span>
   <h2>Find friends</h2><p>Connect with people building their problem-solving skills.</p></div>
 </div>
 @if(!auth.user()){
  <div class="white-card"><p>Sign in to discover learners.</p>
   <button type="button" class="button primary" (click)="auth.signIn()">Continue with Google</button></div>
 }@else{
 <form class="native-search-form" (submit)="find($event)">
  <label><span class="sr-only">Search username or profile ID</span>
   <input type="search" [value]="query()" (input)="change($event)"
    placeholder="Find by username or profile ID…" autocomplete="off" minlength="2" maxlength="50"/></label>
  <button class="button primary" type="submit" [disabled]="loading()||query().trim().length<2">Search</button>
 </form>
 @if(error()){<p class="native-search-error" role="alert">{{error()}}</p>}
 @if(loading()){<p role="status" class="muted">Searching learners…</p>}
 <div class="people-results">
  @for(person of people();track person.public_id){
   <article class="person-card">
    <a [routerLink]="['/angular/profile',person.username]" class="person-avatar-link">
      @if(person.avatar_url){<img [src]="person.avatar_url" alt="" referrerpolicy="no-referrer"/>}
      @else{<span class="native-initial">{{person.display_name.slice(0,1)}}</span>}
    </a>
    <div><a [routerLink]="['/angular/profile',person.username]">{{person.display_name}}</a>
    <small>&#64;{{person.username}}</small></div>
   </article>
  }@empty{
   @if(searched()&&!loading()){<p class="muted">No matching discoverable profiles.</p>}
  }
 </div>
 }
</section>
`,styles:[`
:host{display:block}
.native-find{width:min(780px,100%);margin:auto;padding:24px 12px 80px}
.native-search-form{display:flex;align-items:center;gap:12px;margin:18px 0 23px}
.native-search-form label{flex:1}
.native-search-form input{background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:10px;width:100%;padding:12px}
.native-search-error{font-size:12px;color:#e88}
.native-initial{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:var(--surface-2)}
.native-find .person-card{display:flex;align-items:center;gap:12px;padding:11px}
.native-find .person-card img{height:36px;width:36px;border-radius:50%;object-fit:cover}
.native-find .person-card small{display:block;color:var(--muted);font-size:11px}
`]})

export class SearchComponent{
 readonly auth=inject(AuthService);
 private readonly api=inject(StagingActionService);
 readonly query=signal('');
 readonly people=signal<readonly Person[]>([]);
 readonly loading=signal(false);
 readonly error=signal('');
 readonly searched=signal(false);
 private generation=0;
 change(event:Event):void{
  this.query.set((event.target as HTMLInputElement).value);
  this.error.set('');
 }
 async find(event:Event):Promise<void>{
  event.preventDefault();
  if(!this.auth.user()||this.loading())return;
  const query=this.query().trim();
  if(!/^[a-zA-Z0-9_-]{2,50}$/.test(query)){
   this.error.set('Use two or more username characters, numbers, underscores or hyphens.');return;
  }
  const ticket=++this.generation,owner=this.auth.user()?.id;
  this.loading.set(true);this.searched.set(true);this.error.set('');
  try{
   const result=await this.api.read<{users:Person[]}>('search',{query});
   if(ticket===this.generation&&this.auth.user()?.id===owner)
    this.people.set(Array.isArray(result.users)?result.users:[]);
  }catch(e){if(ticket===this.generation)this.error.set(e instanceof Error?e.message:'Unable to search people.');}
  finally{if(ticket===this.generation)this.loading.set(false);}
 }
}
