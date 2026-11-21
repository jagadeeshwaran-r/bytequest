import {ChangeDetectionStrategy, Component, effect, inject, signal} from '@angular/core';
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
 changeDetection:ChangeDetectionStrategy.OnPush,
 template:`
 <div class="leaderboard-page native-leaderboard">
 <main class="leaderboard-main">
   <div class="leader-heading">
     <div><span class="eyebrow">COMMUNITY &amp; CONSISTENCY</span>
       <h1>The <em>leaderboard.</em></h1>
       <p>A little consistency goes a long way. See where you stand.</p>
     </div>
     <a routerLink="/angular" class="leader-practice">Find your next problem ↗</a>
   </div>
   @if(!auth.user()){
     <section class="leader-signed-out">
       <h2>Better, together.</h2>
       <p>Sign in to view global rankings and compare with the people you follow.
         Your code, notes and email stay private.</p>
       <button type="button" class="button primary" [disabled]="!auth.ready()||auth.loading()"
         (click)="auth.signIn()">Continue with Google</button>
     </section>
   } @else {
     <div class="leader-summary" aria-label="Your ranking summary">
       <div><span>Your rank</span><strong>{{ranking()?.me?.rank??'—'}}</strong></div>
       <div><span>Points</span><strong>{{ranking()?.me?.points??'—'}}</strong></div>
       <div><span>Solved</span><strong>{{ranking()?.me?.solved??'—'}}</strong></div>
       <div><span>Learners</span><strong>{{ranking()?.total??'—'}}</strong></div>
     </div>
     <div class="leader-controls">
       <div class="leader-tabs" role="tablist" aria-label="Leaderboard scope">
         <button type="button" role="tab" [attr.aria-selected]="scope()==='global'"
           (click)="setScope('global')">Global</button>
         <button type="button" role="tab" [attr.aria-selected]="scope()==='friends'"
           (click)="setScope('friends')">Friends</button>
       </div>
       <select aria-label="Ranking period" [value]="period()" (change)="setPeriod($event)">
         <option value="all">All time</option><option value="week">This week</option>
         <option value="month">This month</option>
       </select>
       <button type="button" class="leader-refresh" [disabled]="loading()" (click)="load()">↻ Refresh ranks</button>
     </div>
     <section class="leader-panel" role="tabpanel" tabindex="0">
       <div class="leader-intro">
         <div><h2>{{scope()==='global'?'Global leaderboard':'Friends leaderboard'}}</h2>
           <p>{{scope()==='global'?'A shared place for every discoverable learner.':'Compare your problem-solving with friends.'}}</p>
         </div>
         @if(loading()){<p role="status" class="leader-message">Loading rankings…</p>}
       </div>
       @if(error()){<p class="leader-message" role="alert">{{error()}}</p>}
       <div class="leader-table-wrap">
         <table class="leader-table">
           <caption class="sr-only">Learner ranks from first solves of published problems</caption>
           <thead><tr><th>Rank</th><th>Learner</th><th>Points</th><th>Solved</th></tr></thead>
           <tbody>
             @for(learner of ranking()?.users||[];track learner.username){
               <tr [class.your-ranking]="learner.isYou">
                 <td>#{{learner.rank}}</td>
                 <td>
                   <a class="leader-person" [routerLink]="['/angular/profile',learner.username]">
                     <strong>{{learner.display_name}}</strong><small>&#64;{{learner.username}}</small>
                   </a>
                 </td>
                 <td class="leader-points">{{learner.points}}</td>
                 <td class="leader-solved">{{learner.solved}}</td>
               </tr>
             }@empty{
               @if(!loading()&&!error()){
                 <tr><td colspan="4"><p class="leader-state">No learners to display.</p></td></tr>
               }
             }
           </tbody>
         </table>
       </div>
       <div class="leader-pager">
         <span>Page {{page()+1}}</span>
         <button type="button" [disabled]="page()===0||loading()" (click)="go(-1)">Previous</button>
         <button type="button" [disabled]="loading()||(page()+1)*(ranking()?.pageSize||20)>=(ranking()?.total||0)"
           (click)="go(1)">Next</button>
       </div>
     </section>
     <p class="leader-note">Easy earns 10 points, Medium 25, and Hard 50. Each published
       problem counts once. Equal point totals share a rank. Period boundaries use UTC.</p>
   }
   <footer class="leader-footer"><span>Keep learning. Keep building.</span></footer>
 </main>
 </div>
 `,
 styles:[`
   :host{display:block}
   .native-leaderboard main.leaderboard-main{min-height:66vh}
   .native-leaderboard .leader-tabs button[aria-selected=true]{font-weight:700}
   .native-leaderboard .leader-person{display:flex;flex-direction:column;gap:3px;text-decoration:none;color:inherit}
 `]
})

export class LeaderboardComponent{
  readonly auth=inject(AuthService);
  private readonly api=inject(ReadonlyApiService);
  readonly scope=signal<Scope>('global');
  readonly page=signal(0);
  readonly period=signal<'all'|'week'|'month'>('all');
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
  setPeriod(event:Event):void{
    this.period.set((event.target as HTMLSelectElement).value as 'all'|'week'|'month');
    this.page.set(0);void this.load();
  }
  go(change:number):void{this.page.update(v=>Math.max(0,v+change));void this.load();}
  async load():Promise<void>{
    if(!this.auth.user())return;
    const ticket=++this.generation;this.loading.set(true);this.error.set('');
    try{
      const response=await this.api.request<Ranking>('leaderboard',{scope:this.scope(),period:this.period(),page:this.page()});
      if(ticket===this.generation)this.ranking.set(response);
    }catch(e){if(ticket===this.generation)this.error.set(e instanceof Error?e.message:'Rankings are unavailable.');}
    finally{if(ticket===this.generation)this.loading.set(false);}
  }
}
