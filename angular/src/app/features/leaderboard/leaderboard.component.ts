import {ChangeDetectionStrategy, Component, effect, inject, signal, untracked} from '@angular/core';
import {RouterLink} from '@angular/router';
import {AuthService} from '../../core/auth.service';
import {ReadonlyApiService} from '../../core/readonly-api.service';

type Scope='global'|'friends';
type Period='all'|'week'|'month';
interface Learner{
  readonly rank:number;readonly username:string;readonly public_id?:string;
  readonly display_name:string;readonly avatar_url?:string|null;
  readonly points:number;readonly solved:number;
  readonly easy?:number;readonly medium?:number;readonly hard?:number;
  readonly isYou?:boolean;
}
interface Ranking{
  readonly users:readonly Learner[];readonly total:number;readonly me?:Learner|null;
  readonly pageSize:number;readonly discoverable?:boolean;readonly hasProfile?:boolean;
}
@Component({
  selector:'bq-leaderboard',
  imports:[RouterLink],
  changeDetection:ChangeDetectionStrategy.OnPush,
  template:`
  <div class="leaderboard-page native-leaderboard">
    <main class="leaderboard-main">
      <header class="leader-heading">
        <div>
          <span class="eyebrow">COMMUNITY &amp; CONSISTENCY</span>
          <h1>The leaderboard.</h1>
          <p>A little consistency goes a long way. See where you stand.</p>
        </div>
        <a routerLink="/angular" class="leader-practice">Find your next problem ↗</a>
      </header>

      @if(!auth.user()){
        <section class="leader-signed-out">
          <h2>Better, together.</h2>
          <p>Sign in to view global rankings and compare with the people you follow.
            Your code, notes and email stay private.</p>
          <button type="button" class="button primary" [disabled]="!auth.ready()||auth.loading()"
            (click)="auth.signIn()">Continue with Google</button>
        </section>
      } @else {
        <section class="leader-summary" aria-label="Your ranking summary">
          <div><span>Your rank</span><strong>{{displayRank(ranking()?.me?.rank)}}</strong></div>
          <div><span>Points</span><strong>{{ranking()?.me?.points??'—'}}</strong></div>
          <div><span>Solved</span><strong>{{ranking()?.me?.solved??'—'}}</strong></div>
          <div><span>Learners</span><strong>{{ranking()?.total??'—'}}</strong></div>
        </section>

        @if(ranking() && ranking()!.hasProfile===false){
          <p class="leader-notice">Create a public profile to join the rankings.
            <a routerLink="/angular/profile/edit">Edit profile ↗</a></p>
        } @else if(ranking() && ranking()!.discoverable===false){
          <p class="leader-notice">Enable discoverability on your profile to appear on the leaderboard.
            <a routerLink="/angular/profile/edit">Edit profile ↗</a></p>
        }

        <div class="leader-controls">
          <div class="leader-tabs" role="tablist" aria-label="Leaderboard scope">
            <button type="button" role="tab" [class.active]="scope()==='global'"
              [attr.aria-selected]="scope()==='global'" (click)="setScope('global')">Global</button>
            <button type="button" role="tab" [class.active]="scope()==='friends'"
              [attr.aria-selected]="scope()==='friends'" (click)="setScope('friends')">Friends</button>
          </div>
          <div class="leader-tools">
            <select aria-label="Ranking period" [value]="period()" (change)="setPeriod($event)">
              <option value="all">All time</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
            </select>
            <button type="button" class="leader-find" [disabled]="!ranking()?.me||loading()"
              (click)="findMe()">Find me</button>
            <button type="button" class="leader-refresh" [disabled]="loading()"
              (click)="load()">↻ Refresh ranks</button>
          </div>
        </div>

        <section class="leader-panel" role="tabpanel" tabindex="0" [attr.aria-busy]="loading()">
          <div class="leader-intro">
            <div>
              <h2>{{scope()==='global'?'Global leaderboard':'Friends leaderboard'}}</h2>
              <p>{{scope()==='global'?'A shared place for every discoverable learner.':'Compare your problem-solving with friends.'}}</p>
            </div>
            <p class="leader-message" role="status" aria-live="polite">
              {{loading()?'Loading rankings…':error()?'Could not load rankings':ranking()?'Rankings updated from the server.':''}}
            </p>
          </div>
          @if(error()){
            <p class="leader-message error" role="alert">{{error()}}
              <button type="button" class="leader-retry" (click)="load()">Retry</button>
            </p>
          }
          <div class="leader-table-wrap">
            <table class="leader-table">
              <caption class="sr-only">Learners ranked by difficulty-weighted points for first solves</caption>
              <thead>
                <tr>
                  <th scope="col">Rank</th><th scope="col">Learner</th>
                  <th scope="col">Points</th><th scope="col">Solved</th>
                  <th scope="col">Easy</th><th scope="col">Medium</th><th scope="col">Hard</th>
                </tr>
              </thead>
              <tbody>
                @for(learner of ranking()?.users||[];track learner.username){
                  <tr [class.your-ranking]="learner.isYou" [attr.id]="learner.isYou?'nativeLeaderMe':null">
                    <td class="leader-rank-cell">
                      <span class="leader-rank" [class.gold]="learner.rank===1"
                        [class.silver]="learner.rank===2" [class.bronze]="learner.rank===3">
                        @if(learner.rank<=3){<span class="leader-trophy" aria-hidden="true">🏆</span>}
                        <span>{{learner.rank}}</span>
                      </span>
                    </td>
                    <td>
                      <a class="leader-person" [routerLink]="['/angular/profile',learner.username]">
                        <span class="leader-avatar">
                          @if(learner.avatar_url){
                            <img [src]="learner.avatar_url" alt="" loading="lazy" referrerpolicy="no-referrer"/>
                          } @else {
                            {{(learner.display_name||learner.username||'?').slice(0,1).toUpperCase()}}
                          }
                        </span>
                        <span class="leader-identity">
                          <strong>{{learner.display_name||learner.username}}</strong>
                          <small>&#64;{{learner.username}}</small>
                        </span>
                        @if(learner.isYou){<span class="leader-you">You</span>}
                      </a>
                    </td>
                    <td class="leader-points">{{learner.points}}</td>
                    <td class="leader-solved">{{learner.solved}}</td>
                    <td class="leader-difficulty easy">{{learner.easy??0}}</td>
                    <td class="leader-difficulty medium">{{learner.medium??0}}</td>
                    <td class="leader-difficulty hard">{{learner.hard??0}}</td>
                  </tr>
                } @empty {
                  @if(!loading()&&!error()){
                    <tr><td colspan="7" class="leader-empty">
                      {{scope()==='friends'?'No followed learners are ranked yet. Find friends to grow your board.':'No learners to display.'}}
                    </td></tr>
                  }
                }
              </tbody>
            </table>
          </div>
          @if(findMessage()){
            <p class="leader-position" role="status">{{findMessage()}}</p>
          }
          @if((ranking()?.total??0)>(ranking()?.pageSize??25)){
            <nav class="leader-pager" aria-label="Leaderboard pages">
              <span>Page {{page()+1}}</span>
              <button type="button" [disabled]="page()===0||loading()" (click)="go(-1)">Previous</button>
              <button type="button" [disabled]="loading()||(page()+1)*(ranking()?.pageSize??25)>=(ranking()?.total??0)"
                (click)="go(1)">Next</button>
            </nav>
          }
        </section>
        <p class="leader-note">Easy earns 10 points, Medium 25 and Hard 50. Each published problem counts once.
          Equal point totals share a rank. Weeks start on Monday; period boundaries use UTC.
          Rankings use synced, self-reported practice progress. Only discoverable profiles appear.</p>
      }
      <footer class="leader-footer">
        <span>Keep learning. Keep building.</span>
        <a href="legacy/privacy.html">Privacy</a>
      </footer>
    </main>
  </div>
  `,
  styles:[`
    :host{display:block;min-height:100%}
    :host .native-leaderboard{min-height:100%;padding-bottom:24px;
      background-image:linear-gradient(to right,color-mix(in srgb,var(--line) 26%,transparent) 1px,transparent 1px),
      linear-gradient(to bottom,color-mix(in srgb,var(--line) 26%,transparent) 1px,transparent 1px);
      background-size:72px 72px;background-position:center top}
    :host .native-leaderboard main.leaderboard-main{
      max-width:1360px!important;margin:0 auto!important;padding:20px 26px 28px!important;min-height:66dvh
    }
    :host .native-leaderboard .leader-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin:0 0 23px}
    :host .native-leaderboard .leader-heading .eyebrow{display:inline-flex;align-items:center;gap:10px;
      font:550 10px/1.4 'JetBrains Mono',monospace;letter-spacing:.12em;color:var(--muted)}
    :host .native-leaderboard .leader-heading .eyebrow:before{content:'';width:6px;height:6px;background:var(--accent);border-radius:50%}
    :host .native-leaderboard .leader-heading h1{font:650 clamp(30px,3.4vw,40px)/1.18 Inter,system-ui,sans-serif!important;
      letter-spacing:-.05em;margin:14px 0!important;color:var(--text)}
    :host .native-leaderboard .leader-heading p{margin:0;color:var(--muted);font-size:13px}
    :host .native-leaderboard .leader-practice{font:500 12px Inter,system-ui,sans-serif;color:var(--text);
      white-space:nowrap;border-bottom:1px solid var(--line);padding:9px 0}
    :host .native-leaderboard .leader-summary{
      display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid var(--line);
      border-radius:14px;background:var(--panel);margin:20px 0 22px;padding:21px 0;box-shadow:0 6px 20px #00000005
    }
    :host .native-leaderboard .leader-summary>div{display:flex;flex-direction:column;align-items:flex-start;
      padding:0 28px;gap:5px;min-width:0;border-right:1px solid var(--line)}
    :host .native-leaderboard .leader-summary>div:last-child{border:0}
    :host .native-leaderboard .leader-summary span{text-transform:uppercase;letter-spacing:.065em;
      font:550 10px/1.5 Inter,system-ui,sans-serif;color:var(--muted);min-height:0}
    :host .native-leaderboard .leader-summary strong{font:650 30px/1.15 Inter,system-ui,sans-serif!important;
      color:var(--text);letter-spacing:-.04em;font-variant-numeric:tabular-nums}
    :host .native-leaderboard .leader-summary>div:first-child strong{color:var(--accent)!important}
    :host .native-leaderboard .leader-controls{display:flex;gap:12px;align-items:center;margin-bottom:21px;flex-wrap:wrap}
    :host .native-leaderboard .leader-tabs{display:flex;align-items:center;gap:3px;padding:4px;
      border:1px solid var(--line);background:var(--panel);border-radius:11px;margin-right:auto}
    :host .native-leaderboard .leader-tabs button{font:550 12px Inter,system-ui,sans-serif;
      border:0;background:transparent;border-radius:9px;padding:8px 18px;min-height:34px;color:var(--muted)}
    :host .native-leaderboard .leader-tabs button[aria-selected=true]{background:var(--panel-2);
      box-shadow:inset 0 0 0 1px var(--line);color:var(--text);font-weight:650}
    :host .native-leaderboard .leader-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    :host .native-leaderboard .leader-tools select,
    :host .native-leaderboard .leader-tools button{display:inline-flex;align-items:center;min-height:39px;
      padding:8px 13px;border:1px solid var(--line);border-radius:9px;background:var(--panel);
      font:550 12px Inter,system-ui,sans-serif;color:var(--text)}
    :host .native-leaderboard .leader-tools .leader-find{color:var(--accent)}
    :host .native-leaderboard .leader-intro{display:flex;align-items:center;justify-content:space-between;gap:15px;margin:0 0 14px}
    :host .native-leaderboard .leader-intro h2{font:650 16px Inter,system-ui,sans-serif!important;
      letter-spacing:-.02em;color:var(--text);margin:0 0 7px}
    :host .native-leaderboard .leader-intro p{font-size:12px;color:var(--muted);margin:0}
    :host .native-leaderboard .leader-message{font-size:11px;color:var(--muted);text-align:right;margin:0;line-height:1.5}
    :host .native-leaderboard .leader-message.error{padding:8px 0;color:#d16f6f}
    :host .native-leaderboard .leader-retry{border:1px solid var(--line);padding:5px 10px;border-radius:7px;background:var(--panel);margin-left:10px;color:var(--text)}
    :host .native-leaderboard .leader-table-wrap{overflow-x:auto;overflow-y:hidden;border:1px solid var(--line);
      border-radius:14px;background:var(--panel)}
    :host .native-leaderboard .leader-table{border-collapse:collapse;width:100%;min-width:660px;font-size:12px;color:var(--text)}
    :host .native-leaderboard .leader-table th{background:var(--panel);text-transform:uppercase;letter-spacing:.075em;
      color:var(--muted);font:550 10px Inter,system-ui,sans-serif;padding:14px 18px;border-bottom:1px solid var(--line)}
    :host .native-leaderboard .leader-table th:nth-child(1){width:11%}
    :host .native-leaderboard .leader-table th:nth-child(2){width:35%}
    :host .native-leaderboard .leader-table td{padding:15px 18px;border-top:1px solid var(--line);font-variant-numeric:tabular-nums}
    :host .native-leaderboard .leader-table tbody tr:first-child td{border-top:0}
    :host .native-leaderboard .leader-table tbody tr.your-ranking td{
      background:color-mix(in srgb,var(--accent) 7%,var(--panel))}
    :host .native-leaderboard .leader-table tbody tr.your-ranking td:first-child{box-shadow:inset 3px 0 0 var(--accent)}
    :host .native-leaderboard .leader-rank{display:inline-flex;align-items:center;gap:10px;color:var(--accent);font-weight:700}
    :host .native-leaderboard .leader-trophy{font-size:19px;line-height:1}
    :host .native-leaderboard .leader-rank.silver .leader-trophy{filter:grayscale(1)}
    :host .native-leaderboard .leader-rank.bronze .leader-trophy{filter:sepia(1) hue-rotate(335deg) saturate(2)}
    :host .native-leaderboard .leader-person{display:flex;align-items:center;gap:12px;min-width:0;
      text-decoration:none;color:var(--text)}
    :host .native-leaderboard .leader-avatar{display:grid;place-items:center;flex-shrink:0;width:39px;height:39px;
      border:1px solid var(--line);border-radius:12px;background:var(--panel-2);color:var(--accent);font-weight:650;overflow:hidden}
    :host .native-leaderboard .leader-avatar img{width:100%;height:100%;object-fit:cover}
    :host .native-leaderboard .leader-identity{display:flex;flex-direction:column;min-width:0;gap:3px}
    :host .native-leaderboard .leader-person strong{font-size:12px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    :host .native-leaderboard .leader-person small{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    :host .native-leaderboard .leader-you{border:1px solid var(--line);padding:3px 7px;border-radius:5px;
      color:var(--accent);font-size:10px;white-space:nowrap}
    :host .native-leaderboard .leader-points{font-weight:750;color:var(--accent);font-size:13px}
    :host .native-leaderboard .leader-solved{font-weight:700}
    :host .native-leaderboard .leader-difficulty.easy{color:#159456}
    :host .native-leaderboard .leader-difficulty.medium{color:#a97513}
    :host .native-leaderboard .leader-difficulty.hard{color:#c94355}
    :host .native-leaderboard .leader-empty{text-align:center!important;padding:30px 15px!important;color:var(--muted)}
    :host .native-leaderboard .leader-pager{display:flex;align-items:center;gap:12px;justify-content:flex-end;margin-top:15px}
    :host .native-leaderboard .leader-pager span{margin-right:auto;color:var(--muted)}
    :host .native-leaderboard .leader-pager button{border:1px solid var(--line);border-radius:8px;background:var(--panel);
      padding:8px 11px;color:var(--text)}
    :host .native-leaderboard .leader-note{margin-top:14px;font:400 11px/1.8 Inter,system-ui,sans-serif;color:var(--muted)}
    :host .native-leaderboard .leader-footer{display:flex;justify-content:space-between;margin-top:26px;
      padding-top:22px;border-top:1px solid var(--line);color:var(--muted);font:11px 'JetBrains Mono',monospace}
    :host .native-leaderboard .leader-signed-out{border:1px solid var(--line);background:var(--panel);border-radius:12px;padding:25px;max-width:550px}
    :host .native-leaderboard .leader-notice{border:1px solid var(--line);background:var(--panel-2);
      padding:12px 15px;border-radius:10px;margin:0 0 18px}
    :host .native-leaderboard .leader-notice a{color:var(--accent)}
    @media(max-width:780px){
      :host .native-leaderboard main.leaderboard-main{padding:16px 12px 28px!important}
      :host .native-leaderboard .leader-summary{grid-template-columns:repeat(2,minmax(0,1fr));row-gap:18px}
      :host .native-leaderboard .leader-summary>div{padding:0 18px;border-right:0}
      :host .native-leaderboard .leader-summary>div:nth-child(odd){border-right:1px solid var(--line)}
      :host .native-leaderboard .leader-heading{align-items:flex-start}
      :host .native-leaderboard .leader-practice{display:none}
      :host .native-leaderboard .leader-tools{width:100%;justify-content:flex-start}
      :host .native-leaderboard .leader-intro{align-items:flex-start}
      :host .native-leaderboard .leader-table{min-width:0;table-layout:fixed}
      :host .native-leaderboard .leader-table th:first-child{width:52px}
      :host .native-leaderboard .leader-table th:nth-child(2){width:auto}
      :host .native-leaderboard .leader-table th:nth-child(3){width:80px}
      :host .native-leaderboard .leader-table th:nth-child(n+4),:host .native-leaderboard .leader-table td:nth-child(n+4){display:none}
      :host .native-leaderboard .leader-table td,:host .native-leaderboard .leader-table th{padding:12px 9px}
      :host .native-leaderboard .leader-avatar{width:32px;height:32px}
      :host .native-leaderboard .leader-person{gap:7px}
      :host .native-leaderboard .leader-you{padding:2px 4px}
    }
  `]
})
export class LeaderboardComponent{
  readonly auth=inject(AuthService);
  private readonly api=inject(ReadonlyApiService);
  readonly scope=signal<Scope>('global');
  readonly page=signal(0);
  readonly period=signal<Period>('all');
  readonly loading=signal(false);
  readonly error=signal('');
  readonly ranking=signal<Ranking|null>(null);
  readonly findMessage=signal('');
  private generation=0;

  constructor(){
    effect(()=>{
      const owner=this.auth.user()?.id;
      untracked(()=>{
        if(owner)void this.load();
        else{++this.generation;this.ranking.set(null);this.error.set('');this.findMessage.set('');this.loading.set(false);}
      });
    });
  }
  displayRank(rank?:number):string{return typeof rank==='number'&&rank>0?'#'+rank:'—';}
  setScope(next:Scope):void{
    if(this.scope()===next)return;
    this.scope.set(next);this.page.set(0);this.ranking.set(null);this.findMessage.set('');void this.load();
  }
  setPeriod(event:Event):void{
    const value=(event.target as HTMLSelectElement).value as Period;
    if(!['all','week','month'].includes(value))return;
    this.period.set(value);this.page.set(0);this.ranking.set(null);this.findMessage.set('');void this.load();
  }
  go(delta:number):void{this.page.update(p=>Math.max(0,p+delta));this.findMessage.set('');void this.load();}
  async load():Promise<void>{
    const owner=this.auth.user()?.id;
    if(!owner)return;
    const ticket=++this.generation,scope=this.scope(),period=this.period(),page=this.page();
    this.loading.set(true);this.error.set('');
    try{
      const response=await this.api.request<Ranking>('leaderboard',{scope,period,page});
      if(ticket!==this.generation||this.auth.user()?.id!==owner)return;
      this.ranking.set(response);
    }catch(error){
      if(ticket===this.generation&&this.auth.user()?.id===owner)
        this.error.set(error instanceof Error?error.message:'Rankings are unavailable.');
    }finally{if(ticket===this.generation)this.loading.set(false);}
  }
  async findMe():Promise<void>{
    const current=this.ranking()?.me;
    if(!current)return;
    this.findMessage.set('');
    if(!this.ranking()?.users.some(user=>user.isYou)){
      // Rank can be shared. This lands on the approximate page; if a tie shifts
      // position, show the authoritative rank rather than invent a row.
      const perPage=this.ranking()?.pageSize||25;
      this.page.set(Math.max(0,Math.floor((current.rank-1)/perPage)));
      await this.load();
    }
    requestAnimationFrame(()=>{
      const row=document.getElementById('nativeLeaderMe');
      if(row)row.scrollIntoView({behavior:'smooth',block:'center'});
      else this.findMessage.set('Your position: #'+current.rank+' · '+current.points+' points · '+current.solved+' solved.');
    });
  }
}
