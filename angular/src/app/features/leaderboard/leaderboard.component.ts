import {Component, effect, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {AuthService} from '../../core/auth.service';
import {ReadonlyApiService} from '../../core/readonly-api.service';

type Scope='global'|'friends';
interface Learner{readonly rank:number;readonly username:string;readonly display_name:string;
  readonly points:number;readonly solved:number;readonly isYou?:boolean;}
interface Ranking{readonly users:readonly Learner[];readonly total:number;
  readonly me?:Learner;readonly pageSize:number;}
@Component({
  selector:'bq-leaderboard',
  imports:[RouterLink],
  template:`
  <section class="page-title"><div><p class="eyebrow">GLOBAL COMMUNITY</p><h1>Leaderboard</h1>
    <p class="subtle">Read-only rankings from your current ByteQuest account.</p></div></section>
  <div class="table-tools">
    <div class="scope-switch"><button type="button" [class.active]="scope()==='global'" (click)="setScope('global')">Global</button>
      <button type="button" [class.active]="scope()==='friends'" (click)="setScope('friends')">Friends</button></div>
    @if(auth.user()){<button class="theme-toggle" type="button" (click)="load()">Refresh ranks</button>}
  </div>
  @if(!auth.user()){<p class="load-status">Sign in to view rankings and friends.</p>}
  @else if(loading()){<p class="load-status">Fetching rankings…</p>}
  @else if(error()){<p class="load-status error" role="alert">{{error()}}</p>}
  @else {
    @if(ranking()?.me){<p class="helper">Your position: #{{ranking()!.me!.rank}} · {{ranking()!.me!.points}} points</p>}
    <div class="table-wrap"><table class="problem-table">
      <thead><tr><th>Rank</th><th>Learner</th><th>Points</th><th>Solved</th></tr></thead>
      <tbody>
        @for(learner of ranking()?.users||[];track learner.username){
          <tr [class.is-your-ranking]="learner.isYou">
            <td class="muted-cell">#{{learner.rank}}</td>
            <td><a class="problem-name" [routerLink]="['/profile',learner.username]">{{learner.display_name}}</a>
              <span class="leader-handle">&#64;{{learner.username}}</span></td>
            <td>{{learner.points}}</td><td>{{learner.solved}}</td>
          </tr>
        }@empty{<tr><td colspan="4" class="empty-row">No learners to display.</td></tr>}
      </tbody>
    </table></div>
    <div class="leader-pager">
      <button class="theme-toggle" type="button" [disabled]="page()===0" (click)="go(-1)">Previous</button>
      <span class="helper">Page {{page()+1}}</span>
      <button class="theme-toggle" type="button" [disabled]="(page()+1)*(ranking()?.pageSize||20)>=(ranking()?.total||0)" (click)="go(1)">Next</button>
    </div>
  }
  `
})
export class LeaderboardComponent{
  readonly auth=inject(AuthService);
  private readonly api=inject(ReadonlyApiService);
  readonly scope=signal<Scope>('global');
  readonly page=signal(0);
  readonly loading=signal(false);
  readonly error=signal('');
  readonly ranking=signal<Ranking|null>(null);
  private generation=0;
  constructor(){effect(()=>{
    const user=this.auth.user();
    if(user)void this.load();
    else {this.ranking.set(null);this.error.set('');}
  });}
  setScope(scope:Scope):void{this.scope.set(scope);this.page.set(0);void this.load();}
  go(change:number):void{this.page.update(v=>Math.max(0,v+change));void this.load();}
  async load():Promise<void>{
    if(!this.auth.user())return;
    const ticket=++this.generation;this.loading.set(true);this.error.set('');
    try{
      const response=await this.api.request<Ranking>('leaderboard',{scope:this.scope(),period:'all',page:this.page()});
      if(ticket===this.generation)this.ranking.set(response);
    }catch(e){if(ticket===this.generation)this.error.set(e instanceof Error?e.message:'Rankings are unavailable.');}
    finally{if(ticket===this.generation)this.loading.set(false);}
  }
}
