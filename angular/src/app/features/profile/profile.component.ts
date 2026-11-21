import {Component, effect, inject, signal} from '@angular/core';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {AuthService} from '../../core/auth.service';
import {ReadonlyApiService} from '../../core/readonly-api.service';
import {toSignal} from '@angular/core/rxjs-interop';
import {map} from 'rxjs';

interface Profile {
  readonly username:string;readonly display_name:string;readonly bio?:string;
  readonly avatar_url?:string; readonly github_url?:string;readonly linkedin_url?:string;
}
interface Stats{readonly streak:number;readonly days:readonly string[];readonly serverDay:string;}
interface ProfileReply {
  readonly profile:Profile;readonly stats:Stats;
  readonly ranking?:{readonly rank:number;readonly points:number};
  readonly followers?:number;readonly following?:number;
  readonly insights?:{readonly recentSolves?:readonly {id:string;title?:string;solvedAt?:string}[]};
}
@Component({
  selector:'bq-profile',
  imports:[RouterLink],
  template:`
  <section class="page-title"><div><p class="eyebrow">COMMUNITY</p><h1>Profile</h1>
    <p class="subtle">Live account data · staging is strictly read-only.</p></div></section>
  @if(!auth.user()){<p class="load-status">Sign in using Google to view ByteQuest profiles on staging.
    Your original progress remains unchanged.</p>}
  @else if(loading()){<p class="load-status">Loading profile…</p>}
  @else if(error()){<p class="load-status error" role="alert">{{error()}}</p>}
  @else if(profile()){
    <div class="preview-profile">
      <div class="profile-top">
        <span class="profile-initial">{{profile()!.profile.display_name?.slice(0,1)||'B'}}</span>
        <div><p class="eyebrow">BYTEQUEST LEARNER</p><h2>{{profile()!.profile.display_name}}</h2>
          <p class="subtle">&#64;{{profile()!.profile.username}}</p></div>
        <div class="profile-stats">
          <div><strong>{{profile()!.ranking?.rank||'—'}}</strong><small>Global rank</small></div>
          <div><strong>{{profile()!.ranking?.points||0}}</strong><small>Points</small></div>
          <div><strong>{{profile()!.stats.streak||0}}</strong><small>UTC streak</small></div>
        </div>
      </div>
      @if(profile()!.profile.bio){<p class="description">{{profile()!.profile.bio}}</p>}
      <p class="subtle">{{profile()!.followers||0}} followers · {{profile()!.following||0}} following</p>
      <div class="calendar-preview">
        <h3>Solving calendar · {{year()}}</h3>
        <div class="calendar-grid" aria-label="First-solve days for the current UTC year">
          @for(day of calendar();track day.date){
            <span class="calendar-day" [class.earned]="day.active" [attr.title]="day.date" [attr.aria-label]="day.date+(day.active?' · solved':' · no new solve')"></span>
          }
        </div>
      </div>
      <p class="helper">Streaks and day credits come from the existing verified ByteQuest profile API.</p>
      <a class="secondary-link" [href]="liveProfile()" target="_blank" rel="noopener noreferrer">Full live profile ↗</a>
    </div>
  }
  `
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
      const year=this.year(),days=new Set(result.stats?.days||[]);
      const total=((Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000);
      this.calendar.set(Array.from({length:total},(_,i)=>{
        const date=new Date(Date.UTC(year,0,i+1)).toISOString().slice(0,10);
        return {date,active:days.has(date)};
      }));
    }catch(e){if(ticket===this.generation)this.error.set(e instanceof Error?e.message:'Profile unavailable.');}
    finally{if(ticket===this.generation)this.loading.set(false);}
  }
  liveProfile():string{
    return 'https://jagadeeshwaran-r.github.io/bytequest/community.html#user/'
      +encodeURIComponent(this.profile()?.profile.username||'');
  }
}
