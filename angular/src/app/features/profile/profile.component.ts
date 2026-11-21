import {ChangeDetectionStrategy, Component, effect, inject, signal} from '@angular/core';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {AuthService} from '../../core/auth.service';
import {ReadonlyApiService} from '../../core/readonly-api.service';
import {toSignal} from '@angular/core/rxjs-interop';
import {map} from 'rxjs';

interface Profile {
  readonly username:string;readonly display_name:string;readonly bio?:string;
  readonly avatar_url?:string; readonly github_url?:string;readonly linkedin_url?:string;
}
interface Stats{readonly streak:number;readonly solved?:number;readonly days:readonly string[];readonly serverDay:string;}
interface ProfileReply {
  readonly profile:Profile;readonly stats:Stats;
  readonly ranking?:{readonly rank:number;readonly points:number};
  readonly followers?:number;readonly following?:number;
  readonly insights?:{readonly recentSolves?:readonly {id:string;title?:string;solvedAt?:string}[]};
}
@Component({
 selector:'bq-profile',
 imports:[RouterLink],
 changeDetection:ChangeDetectionStrategy.OnPush,
 template:`
 <div class="community-page native-community">
   <main class="native-profile-main">
     @if(!auth.user()){
       <section class="white-card">
         <h2>Your public ByteQuest identity</h2>
         <p class="muted">Sign in to view your solving calendar and streaks. Staging will not change your original profile.</p>
         <button type="button" class="button primary" [disabled]="!auth.ready()||auth.loading()"
           (click)="auth.signIn()">Continue with Google</button>
       </section>
     } @else if(loading()){
       <p class="muted" role="status">Loading profile…</p>
     } @else if(error()){
       <p class="muted" role="alert">{{error()}}</p>
     } @else if(profile()){
       <section id="profileContent">
         <section class="profile-main-card profile-unboxed">
           <div class="profile-overview">
             <div class="profile-person">
               <div class="profile-hero">
                 <span class="profile-avatar-frame">
                   @if(profile()!.profile.avatar_url){
                     <img class="avatar large" [src]="profile()!.profile.avatar_url" alt="Profile avatar" referrerpolicy="no-referrer"/>
                   }@else{
                     <span class="avatar large native-avatar-initial">{{profile()!.profile.display_name.slice(0,1)||'B'}}</span>
                   }
                 </span>
                 <div class="profile-identity">
                   <span class="eyebrow">PROFILE</span>
                   <h2 class="profile-title">
                     <span class="rank-name-text">{{profile()!.profile.display_name}}</span>
                     <span class="profile-inline-rank">{{profile()!.ranking?.rank?'#'+profile()!.ranking!.rank+' global':'Unranked'}}</span>
                   </h2>
                   <div class="profile-username-line">
                     <span>&#64;{{profile()!.profile.username}}</span>
                     @if(profile()!.profile.github_url){
                       <a [href]="profile()!.profile.github_url" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
                     }
                   </div>
                   <div class="profile-connections">
                     <span><strong>{{profile()!.followers||0}}</strong> followers</span>
                     <span>·</span>
                     <span><strong>{{profile()!.following||0}}</strong> following</span>
                   </div>
                 </div>
               </div>
               @if(profile()!.profile.bio){<p class="profile-bio">{{profile()!.profile.bio}}</p>}
             </div>
             <div class="social-stats profile-metrics">
               <div class="social-stat metric-solved">
                 <span class="metric-label">Problems solved</span>
                 <b>{{profile()!.stats.solved??'—'}}</b>
                 <span class="metric-caption">Published challenges</span>
               </div>
               <div class="social-stat">
                 <span class="metric-label">Total points</span>
                 <b>{{profile()!.ranking?.points??0}}</b>
                 <span class="metric-caption">Your problem-solving score</span>
               </div>
               <div class="social-stat">
                 <span class="metric-label">Daily streak</span>
                 <b class="streak-count" [class.is-burning]="(profile()!.stats.streak||0)>0">
                   <span class="streak-digits">{{profile()!.stats.streak||0}}</span>
                 </b>
                 <span class="metric-caption">Consecutive new solve days</span>
               </div>
             </div>
           </div>
         </section>
         <section class="profile-calendar-section">
           <div class="calendar-heading">
             <div><h3>Solving calendar</h3><span>Accepted solve days · UTC</span></div>
             <label class="calendar-year-picker">Year
               <select aria-label="Choose solving calendar year" [value]="year()" (change)="changeYear($event)">
                 @for(y of availableYears();track y){<option [value]="y">{{y}}</option>}
               </select>
             </label>
           </div>
           <div class="activity-scroll month-calendar-scroll" tabindex="0" aria-label="Solving calendar year view">
             <div class="native-calendar" role="group" aria-label="Solve days">
               @for(month of calendarMonths();track month.index){
                 <div class="native-month">
                   <strong>{{month.name}}</strong>
                   <div class="native-month-grid">
                     @for(day of month.days;track day.date){
                       <span class="native-calendar-day" [class.active]="day.active"
                         [title]="day.date+(day.active?' · solved':' · no new solve')"></span>
                     }
                   </div>
                 </div>
               }
             </div>
           </div>
           <div class="activity-legend">
             <span>{{calendar().filter(day=>day.active).length}} solve days in {{year()}}</span>
           </div>
         </section>
         <section class="recent-solves">
           <header><h3>Recently solved</h3><p>Server-recorded solutions</p></header>
           @for(row of profile()!.insights?.recentSolves||[];track row.id){
             <div class="native-recent-solve">
               <a [routerLink]="['/angular/problem',row.id]">{{row.title||row.id}}</a>
               <small>{{row.solvedAt||''}}</small>
             </div>
           }@empty{<p class="muted">No recent server-recorded solves to show.</p>}
         </section>
       </section>
     }
   </main>
 </div>
 `,
 styles:[`
   :host{display:block}
   .native-profile-main{max-width:1240px;margin:auto;padding:14px 16px 36px;min-height:60vh}
   .native-avatar-initial{display:grid;place-items:center}
   .native-recent-solve{display:flex;justify-content:space-between;gap:16px;padding:12px 6px;border-bottom:1px solid var(--border)}
   .native-recent-solve small{color:var(--muted)}
   .native-calendar{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:22px;padding:12px}
   .native-month{min-width:150px}
   .native-month strong{display:block;font-size:12px;margin-bottom:9px}
   .native-month-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}
   .native-calendar-day{display:block;aspect-ratio:1;border:1px solid var(--border);border-radius:3px;background:var(--surface-2)}
   .native-calendar-day.active{background:var(--accent);border-color:var(--accent)}
   @media(max-width:900px){.native-calendar{grid-template-columns:repeat(3,minmax(0,1fr))}}
   @media(max-width:650px){.native-calendar{grid-template-columns:repeat(2,minmax(0,1fr))}}
 `]
})

export class ProfileComponent {
  readonly auth=inject(AuthService);
  private readonly api=inject(ReadonlyApiService);
  private readonly route=inject(ActivatedRoute);
  private readonly target=toSignal(this.route.paramMap.pipe(map(p=>p.get('target')||'me')),{initialValue:'me'});
  readonly profile=signal<ProfileReply|null>(null);
  readonly error=signal('');
  readonly loading=signal(false);
  readonly year=signal(new Date().getUTCFullYear());
  readonly calendar=signal<readonly {date:string;active:boolean}[]>([]);
  readonly availableYears=signal<readonly number[]>([new Date().getUTCFullYear()]);
  readonly calendarMonths=signal<readonly {index:number;name:string;days:readonly {date:string;active:boolean}[]}[]>([]);
  private generation=0;
  constructor(){
    effect(()=>{
      const target=this.target(),user=this.auth.user();
      if(!user){this.profile.set(null);this.error.set('');return;}
      void this.load(target);
    });
  }
  private async load(target:string):Promise<void>{
    const ticket=++this.generation;
    this.loading.set(true);this.error.set('');this.profile.set(null);
    try{
      let resolved=target;
      if(target==='me'){
        const result=await this.api.request<{profile:Profile}>('self');
        resolved=result.profile.username;
      }
      const result=await this.api.request<ProfileReply>('profile',{target:resolved});
      if(ticket!==this.generation)return;
      this.profile.set(result);
      const years=new Set<number>([new Date().getUTCFullYear()]);
      for(const day of result.stats?.days||[]){
        if(/^\\d{4}-\\d{2}-\\d{2}$/.test(day))years.add(Number(day.slice(0,4)));
      }
      this.availableYears.set([...years].sort((a,b)=>b-a));
      this.rebuildCalendar();
    }catch(e){if(ticket===this.generation)this.error.set(e instanceof Error?e.message:'Profile unavailable.');}
    finally{if(ticket===this.generation)this.loading.set(false);}
  }
  changeYear(event:Event):void{
    const value=Number((event.target as HTMLSelectElement).value);
    if(this.availableYears().includes(value)){this.year.set(value);this.rebuildCalendar();}
  }
  private rebuildCalendar():void{
    const year=this.year(),days=new Set(this.profile()?.stats.days||[]);
    const total=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
    this.calendar.set(Array.from({length:total},(_,i)=>{
      const date=new Date(Date.UTC(year,0,i+1)).toISOString().slice(0,10);
      return {date,active:days.has(date)};
    }));
    const names=['January','February','March','April','May','June','July','August','September','October','November','December'];
    this.calendarMonths.set(names.map((name,index)=>({
      index,name,days:this.calendar().filter(day=>Number(day.date.slice(5,7))===index+1)
    })));
  }
  liveProfile():string{
    return 'https://jagadeeshwaran-r.github.io/bytequest/community.html#user/'
      +encodeURIComponent(this.profile()?.profile.username||'');
  }
}
