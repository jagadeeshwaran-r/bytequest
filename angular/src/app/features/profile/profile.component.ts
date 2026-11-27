import {ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, signal, untracked} from '@angular/core';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {toSignal} from '@angular/core/rxjs-interop';
import {map} from 'rxjs';
import {AuthService} from '../../core/auth.service';
import {ReadonlyApiService} from '../../core/readonly-api.service';
import {CatalogService, type Problem} from '../../core/catalog.service';
import {
 earnedStreakAwards, profileCalendar, countdownToUTC, solveRelativeTime, solvingGraph, utcISO, validUTC,
 type SolveEvent,type GraphMode,type GraphMeasure
} from './profile-view-model';

interface Profile{
 readonly username:string;readonly display_name:string;readonly bio?:string;
 readonly avatar_url?:string|null;readonly github_url?:string;readonly linkedin_url?:string;
 readonly is_admin?:boolean;readonly discoverable?:boolean;
}
interface Stats{
 readonly streak:number;readonly solved?:number;readonly total?:number;readonly serverDay:string;
 readonly days:readonly string[];readonly solves?:readonly SolveEvent[];readonly streakAdjusted?:boolean;
}
interface Recent{readonly problemId:string;readonly title?:string;readonly difficulty?:string;readonly solvedAt?:string}
interface Insight{
 readonly recentSolves?:readonly Recent[];
 readonly skills?:readonly {readonly name:string;readonly solved:number}[];
 readonly languages?:readonly {readonly language:string;readonly solved:number}[];
 readonly details?:{readonly linkedin_url?:string;readonly github_url?:string};
}
interface ProfileReply{
 readonly profile:Profile;readonly stats:Stats;readonly isOwn?:boolean;
 readonly ranking?:{readonly rank:number;readonly points:number};
 readonly followers?:number;readonly following?:number;readonly insights?:Insight;
}
interface Friend{readonly public_id:string;readonly username:string;readonly display_name:string}
interface FriendSeries extends Friend{readonly solves:readonly SolveEvent[]}
interface Topic{readonly name:string;readonly total:number;readonly solved:number}
type TopicFilter='all'|'completed'|'in-progress'|'not-started';

@Component({
 selector:'bq-profile',
 imports:[RouterLink],
 changeDetection:ChangeDetectionStrategy.OnPush,
 styleUrl:'./profile.component.css',
 template:`
 <div class="bqp">
  <main class="bqp-main">
   @if(!auth.user()){
     <section class="bqp-access">
       <h2>Your public ByteQuest identity</h2>
       <p>Sign in to see your streaks, activity, badges and recent solves. Staging is isolated from production.</p>
       <button type="button" class="bqp-button primary" [disabled]="!auth.ready()||auth.loading()" (click)="auth.signIn()">Continue with Google</button>
     </section>
   } @else if(loading()){
     <p class="bqp-message" role="status">Loading profile…</p>
   } @else if(error()){
     <p class="bqp-message" role="alert">{{error()}}</p>
   } @else if(needsProfile()){
     <section class="bqp-access">
       <h2>Set up your staging profile</h2>
       <p>This isolated test database starts separately from your production ByteQuest profile.</p>
       <a routerLink="/angular/profile/edit" class="bqp-button primary">Create staging profile</a>
     </section>
   } @else if(profile();as record){
    <section class="bqp-overview" aria-label="Profile summary">
      <div class="bqp-person">
        <div class="bqp-hero">
          <span class="bqp-photo-wrap">
            @if(record.profile.avatar_url){
              <img class="bqp-photo" [src]="record.profile.avatar_url" alt="Profile avatar" referrerpolicy="no-referrer"/>
            } @else {
              <span class="bqp-photo">{{record.profile.display_name.slice(0,1).toUpperCase()}}</span>
            }
            @if(record.ranking?.rank===1 || record.ranking?.rank===2 || record.ranking?.rank===3){
              <span class="bqp-ribbon" role="img" [attr.aria-label]="'Global rank '+record.ranking?.rank+' ribbon'">
                <svg viewBox="0 0 68 78" aria-hidden="true">
                  <path d="M15 45 6 73 21 67 29 77 37 45Z" fill="#b22a42"/>
                  <path d="M34 44 41 76 48 66 64 71 52 43Z" fill="#ef3755"/>
                  <path d="M34 2 60 13 65 33 51 56 34 62 13 52 3 30 10 13Z" fill="#8a9aaf" stroke="#e6edf2" stroke-width="2"/>
                  <circle cx="34" cy="29" r="22" fill="#b5c4d1" stroke="#647b91" stroke-width="3"/>
                  <circle cx="34" cy="29" r="17" fill="#dfe8ef"/>
                  <path d="m34 15 4.5 9 10 1.5-7.2 7 1.7 10-9-4.7-9 4.7 1.7-10-7.2-7 10-1.5Z" fill="#708da3"/>
                </svg>
              </span>
            }
          </span>
          <div class="bqp-identity">
            <p class="bqp-eyebrow">PROFILE</p>
            <div class="bqp-name-line">
              <h1>{{record.profile.display_name}}</h1>
              <span class="bqp-pill">{{record.ranking?.rank?'#'+record.ranking?.rank+' global':'Unranked'}}</span>
              @if(record.profile.is_admin){<span class="bqp-pill">Admin</span>}
            </div>
            <div class="bqp-handle">
              <span>&#64;{{record.profile.username}}</span>
              @if(record.isOwn){<span class="bqp-presence" aria-label="Your profile"></span>}
              @if(linkedinUrl()){<a class="bqp-linkedin" [href]="linkedinUrl()" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">in</a>}
              @if(githubUrl()){<a class="bqp-github" [href]="githubUrl()" target="_blank" rel="noopener noreferrer" aria-label="GitHub">GH</a>}
            </div>
            <div class="bqp-followers">
              <span>{{record.followers||0}} followers</span><span>·</span>
              <span>{{record.following||0}} following</span>
            </div>
          </div>
        </div>
        @if(record.profile.bio){<p class="bqp-bio">{{record.profile.bio}}</p>}
        @if(record.isOwn){<a class="bqp-button" routerLink="/angular/profile/edit">Edit profile</a>}
      </div>
      <div class="bqp-metrics">
        <section>
          <span>Problems solved</span>
          <strong class="bqp-solved">{{record.stats.solved??0}}<small> / {{record.stats.total??catalog().length}}</small></strong>
          <p>Published challenges</p>
        </section>
        <section>
          <span>Total points</span>
          <strong>{{record.ranking?.points??0}}</strong>
          <p>Your problem-solving score</p>
        </section>
        <section>
          <span>Daily streak</span>
          <strong class="bqp-streak" [class.has-streak]="record.stats.streak>0">
            {{record.stats.streak||0}}<small> {{record.stats.streak===1?'day':'days'}}</small>
          </strong>
          <p>{{record.stats.streakAdjusted?'Administratively adjusted streak':'Consecutive solve days'}}</p>
          <div class="bqp-reset"><span>New day in</span><time role="timer" aria-live="off">{{utcCountdown()}}</time><span>UTC</span></div>
        </section>
      </div>
    </section>

    @if(awards().length){
      <section class="bqp-achievements" aria-labelledby="bqpStreakTitle">
        <div>
          <p class="bqp-eyebrow">ACHIEVEMENTS</p>
          <h2 id="bqpStreakTitle">Streak badges</h2>
          <p>Lifetime milestones · earned from consecutive UTC solve days</p>
        </div>
        <div class="bqp-awards" role="list">
          @for(award of awards();track award.days){
            <div class="bqp-award" [class]="'tier-'+award.color" role="listitem"
              [attr.aria-label]="award.days+'-day '+award.name+' streak badge earned '+award.count+' times'"
              [title]="award.days+' days · '+award.name+' · earned '+award.count+' times, last '+award.lastEarned">
              <svg viewBox="0 0 136 174" aria-hidden="true">
                <defs><linearGradient [attr.id]="'bqp-medal-'+award.days" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="var(--badge-light)"/><stop offset=".58" stop-color="var(--badge-edge)"/>
                  <stop offset="1" stop-color="var(--badge-shadow)"/>
                </linearGradient></defs>
                <path d="M20 112 5 166 28 154 44 168 53 112Z" fill="var(--badge-shadow)"/>
                <path d="M83 112 92 168 108 154 131 166 116 112Z" fill="var(--badge-shadow)"/>
                <path d="M68 5 119 32 119 109 68 139 17 109 17 32Z" fill="#121a23"
                  [attr.stroke]="'url(#bqp-medal-'+award.days+')'" stroke-width="6" stroke-linejoin="round"/>
                <path d="M68 15 109 37 109 104 68 128 27 104 27 37Z" fill="none" stroke="var(--badge-light)" opacity=".5"/>
                <g fill="none" stroke="var(--badge-light)" stroke-width="2">
                  <rect x="60" y="28" width="16" height="15" rx="1.5"/><path d="M60 33h16M64 26v5M72 26v5"/>
                </g>
                <path d="M39 104Q26 87 35 60M97 104Q110 87 101 60" fill="none" stroke="var(--badge-edge)" stroke-width="2"/>
                <text x="68" y="81" text-anchor="middle" class="number">{{award.days}}</text>
                <text x="68" y="96" text-anchor="middle" class="days">DAYS</text>
                <path d="M11 114H125L132 129 121 143H15L4 129Z" fill="var(--badge-edge)" stroke="var(--badge-light)"/>
                <text x="68" y="133" text-anchor="middle" class="name">{{award.name}}</text>
              </svg>
              @if(award.count>1){<span class="multiplier">×{{award.count}}</span>}
            </div>
          }
        </div>
      </section>
    }

    <section class="bqp-panel bqp-calendar" aria-labelledby="bqpCalendarTitle">
      <header class="bqp-section-heading">
        <div><h2 id="bqpCalendarTitle">Solving calendar</h2><p>Accepted solve days · UTC</p></div>
        <label class="bqp-year-select">Year
          <select aria-label="Choose solving calendar year" [value]="year()" (change)="changeYear($event)">
            @for(value of availableYears();track value){<option [value]="value">{{value}}</option>}
          </select>
        </label>
      </header>
      <div class="bqp-calendar-scroll" tabindex="0" aria-label="Solving calendar year">
        <div class="bqp-calendar-inner">
          <div class="bqp-weekdays" aria-hidden="true">
            <span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span></span>
          </div>
          <div class="bqp-months">
            @for(month of calendarMonths();track month.index){
              <section class="bqp-month" [attr.aria-label]="month.name">
                <span>{{month.name}}</span>
                <div class="bqp-month-grid">
                  @for(cell of month.cells;track $index){
                    @if(cell){
                      <span class="bqp-calendar-cell" [class.accepted]="cell.active" [class.future]="cell.future"
                        [title]="cell.date+(cell.active?' · accepted':cell.future?' · future':' · no solve')"></span>
                    } @else {
                      <span class="bqp-calendar-cell pad" aria-hidden="true"></span>
                    }
                  }
                </div>
              </section>
            }
          </div>
        </div>
      </div>
      <div class="bqp-calendar-legend">
        <span>{{year()}}-01-01 → {{calendarEnd()}}</span>
        <div><span>{{solveDays()}} solve days</span>
          <span class="bqp-squares">No solve <i></i><i class="accepted"></i> Accepted</span></div>
      </div>
      <p class="bqp-note">Streaks count consecutive UTC days with accepted solves.</p>
    </section>

    <section class="bqp-panel bqp-recent" aria-labelledby="bqpRecentTitle">
      <header class="bqp-section-heading">
        <div><h2 id="bqpRecentTitle">Recently solved</h2><p>Latest accepted solves · up to 25 problems</p></div>
        @if(recent().length>3){
          <button type="button" class="bqp-button" [attr.aria-expanded]="showAllRecent()"
            (click)="showAllRecent.set(!showAllRecent())">
            {{showAllRecent()?'Show less':'Show all '+recent().length+' ↗'}}
          </button>
        }
      </header>
      <div class="bqp-recent-list">
        @for(row of visibleRecent();track row.problemId){
          <a [routerLink]="['/angular/problem',row.problemId]">
            <span class="num">{{problemNumber(row.problemId)}}</span>
            <strong>{{row.title||problemName(row.problemId)}}</strong>
            <span class="difficulty" [class]="(row.difficulty||'').toLowerCase()">{{row.difficulty||'—'}}</span>
            <time [attr.datetime]="row.solvedAt||null" [title]="row.solvedAt||''">{{relative(row.solvedAt)}}</time>
          </a>
        } @empty{<p class="bqp-empty">Accepted problems will appear here.</p>}
      </div>
    </section>

    <section class="bqp-expertise">
      <div>
        <h3>Skills practiced</h3>
        <div class="bqp-chips">
          @for(skill of record.insights?.skills||[];track skill.name){
            <span class="bqp-chip">{{skill.name}} <small>{{skill.solved}} solved</small></span>
          } @empty {<p>Skills appear after solving published problems.</p>}
        </div>
      </div>
      <div>
        <h3>Languages used</h3>
        <div class="bqp-chips">
          @for(language of record.insights?.languages||[];track language.language){
            <span class="bqp-chip language">{{languageName(language.language)}} <small>{{language.solved}} solved</small></span>
          } @empty{<p>Languages appear after accepted submissions.</p>}
        </div>
      </div>
    </section>

    <section class="bqp-panel bqp-rhythm" aria-labelledby="bqpRhythmTitle">
      <header class="bqp-section-heading">
        <div><h2 id="bqpRhythmTitle">Solving rhythm</h2><p>First accepted solves, grouped by date.</p></div>
        <div class="bqp-chart-controls">
          <select aria-label="Chart frequency" [value]="graphMode()" (change)="changeMode($event)">
            <option value="daily">Daily</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option>
          </select>
          <select aria-label="Chart measurement" [value]="graphMeasure()" (change)="changeMeasure($event)">
            <option value="period">Period solves</option><option value="cumulative">Cumulative solves</option>
          </select>
          <label class="bqp-check"><input type="checkbox" [checked]="forecast()" (change)="forecast.set($any($event.target).checked)"/> Show forecast</label>
          <select aria-label="Forecast horizon" [value]="forecastHorizon()" (change)="changeHorizon($event)">
            <option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option>
          </select>
          @if(graphMode()==='daily'){
            <input type="month" aria-label="Chart month" [value]="chartMonth()" (change)="setChartMonth($event)"/>
          } @else if(graphMode()==='monthly'){
            <select aria-label="Chart year" [value]="year()" (change)="changeYear($event)">
              @for(value of availableYears();track value){<option [value]="value">{{value}}</option>}
            </select>
          }
          <select aria-label="Chart topic" [value]="graphTopic()" (change)="graphTopic.set($any($event.target).value)">
            <option value="">All topics</option>
            @for(topic of topics();track topic.name){<option [value]="topic.name">{{topic.name}}</option>}
          </select>
        </div>
      </header>
      <div class="bqp-chart-legend">
        @for(series of graph().series;track series.id){
          <span><i [style.background]="series.color"></i>{{series.label}}</span>
        }
      </div>
      <div class="bqp-chart-scroll">
        <svg class="bqp-chart-svg" viewBox="0 0 930 245" role="img" aria-label="First accepted solves chart">
          @for(tick of graph().yTicks;track tick.value){
            <line x1="45" [attr.y1]="tick.y" x2="910" [attr.y2]="tick.y"
              stroke="var(--border)" stroke-width="1" stroke-dasharray="3 6"/>
            <text x="33" [attr.y]="tick.y+4" text-anchor="end" fill="var(--muted)" font-size="11">{{tick.value}}</text>
          }
          @for(tick of graph().xTicks;track tick.x){
            <text [attr.x]="tick.x" y="238" text-anchor="middle" fill="var(--muted)" font-size="11">{{tick.label}}</text>
          }
          @for(series of graph().series;track series.id){
            <path [attr.d]="series.d" fill="none" [attr.stroke]="series.color"
              stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
            @for(point of series.points;track point.label){
              @if(point.value>0){
                <circle [attr.cx]="point.x" [attr.cy]="point.y" r="4.1"
                  [attr.fill]="series.color" stroke="var(--surface)" stroke-width="1.5">
                  <title>{{series.label}} · {{point.label}} · {{point.value}} solved</title>
                </circle>
              }
            }
          }
        </svg>
      </div>
      <p class="bqp-forecast-note">{{graph().note}}</p>
      @if(record.isOwn){
        <div class="bqp-compare">
          <button class="bqp-button" type="button" (click)="toggleCompare()">
            {{compareOpen()?'▾':'▸'}} Compare with friends
            @if(selectedFriends().length){({{selectedFriends().length}})}
          </button>
          @if(compareOpen()){
            <div class="bqp-friend-chooser">
              <p>Choose any number of followed friends, or compare all.</p>
              <button class="bqp-button" type="button" (click)="compareAll()">All friends</button>
              <button class="bqp-button" type="button" (click)="clearCompare()">Clear</button>
              @if(friendLoading()){<p role="status">Loading comparisons…</p>}
              @if(friendError()){<p role="alert">{{friendError()}}</p>}
              <div>
                @for(friend of friends();track friend.public_id){
                  <label><input type="checkbox" [checked]="selectedFriends().includes(friend.public_id)"
                    (change)="toggleFriend(friend.public_id,$event)"/>
                    {{friend.display_name}} <small>&#64;{{friend.username}}</small></label>
                } @empty {
                  @if(!friendLoading()){<p>Follow discoverable friends to compare solving rhythms.</p>}
                }
              </div>
            </div>
          } @else {<p>Choose any number of followed friends, or compare all.</p>}
        </div>
      }
      <p class="bqp-footnote">First accepted solves only · UTC dates · Solid = actual, dotted = statistical estimate.
        Non-ML forecasts use historical backtesting; future solving is never guaranteed.</p>
    </section>

    <section class="bqp-panel bqp-topics" aria-labelledby="bqpTopicTitle">
      <header class="bqp-section-heading">
        <h2 id="bqpTopicTitle">Topic coverage</h2>
        <p>A compact view of your progress across the published library.</p>
      </header>
      <div class="bqp-topic-stats">
        <div><strong>{{topicsPracticed()}} <small>/ {{topics().length}}</small></strong><span>Topics practiced</span></div>
        <div><strong>{{topicsCompleted()}}</strong><span>Topics completed</span></div>
        <div><strong>{{record.stats.solved??0}} <small>/ {{record.stats.total??catalog().length}}</small></strong><span>Problems solved</span></div>
      </div>
      <div class="bqp-topics-bottom">
        <p>Browse published topics, see completion and find what to learn next.</p>
        <button class="bqp-button" type="button" (click)="topicsOpen.set(!topicsOpen())"
          [attr.aria-expanded]="topicsOpen()">
          {{topicsOpen()?'Hide topics':'Browse '+topics().length+' topics'}}
        </button>
      </div>
      @if(topicsOpen()){
        <div class="bqp-topic-directory">
          <div class="bqp-directory-controls">
            <input type="search" aria-label="Search topics" [value]="topicQuery()" (input)="topicQuery.set($any($event.target).value)" placeholder="Search topics…"/>
            <select aria-label="Topic progress filter" [value]="topicFilter()" (change)="changeTopicFilter($event)">
              <option value="all">All topics</option><option value="completed">Completed</option>
              <option value="in-progress">In progress</option><option value="not-started">Not started</option>
            </select>
          </div>
          @for(topic of filteredTopics();track topic.name){
            <div class="bqp-topic-row">
              <div><strong>{{topic.name}}</strong><small>{{topic.solved}} / {{topic.total}} solved</small></div>
              <span class="bqp-topic-track"><i [style.width.%]="topic.total?topic.solved/topic.total*100:0"></i></span>
            </div>
          } @empty {<p>No matching published topics.</p>}
        </div>
      }
    </section>
    <footer class="bqp-footer"><span>ByteQuest</span><a href="legacy/privacy.html">Privacy</a></footer>
   }
  </main>
 </div>
`
})

export class ProfileComponent implements OnDestroy{
 readonly auth=inject(AuthService);
 private readonly api=inject(ReadonlyApiService);
 private readonly catalogApi=inject(CatalogService);
 private readonly route=inject(ActivatedRoute);
 private readonly target=toSignal(this.route.paramMap.pipe(map(p=>p.get('target')||'me')),{initialValue:'me'});
 readonly profile=signal<ProfileReply|null>(null);
 readonly needsProfile=signal(false);
 readonly error=signal('');
 readonly loading=signal(false);
 readonly catalog=signal<readonly Problem[]>([]);
 readonly now=signal(Date.now());
 readonly year=signal(new Date().getUTCFullYear());
 readonly availableYears=signal<readonly number[]>([new Date().getUTCFullYear()]);
 readonly showAllRecent=signal(false);
 readonly graphMode=signal<GraphMode>('daily');
 readonly graphMeasure=signal<GraphMeasure>('period');
 readonly graphTopic=signal('');
 readonly chartMonth=signal(utcISO(new Date()).slice(0,7));
 readonly forecast=signal(true);
 readonly forecastHorizon=signal(7);
 readonly compareOpen=signal(false);
 readonly friends=signal<readonly Friend[]>([]);
 readonly selectedFriends=signal<readonly string[]>([]);
 readonly friendSeries=signal<readonly FriendSeries[]>([]);
 readonly friendLoading=signal(false);
 readonly friendError=signal('');
 readonly topicsOpen=signal(false);
 readonly topicQuery=signal('');
 readonly topicFilter=signal<TopicFilter>('all');
 private generation=0;
 private compareGeneration=0;
 private destroyed=false;
 private readonly clock:ReturnType<typeof setInterval>;

 readonly awards=computed(()=>earnedStreakAwards(this.profile()?.stats.days||[],this.profile()?.stats.serverDay||utcISO(new Date())));
 readonly calendarMonths=computed(()=>profileCalendar(this.year(),this.profile()?.stats.days||[],this.profile()?.stats.serverDay||utcISO(new Date())));
 readonly calendarEnd=computed(()=>{
   const server=this.profile()?.stats.serverDay||utcISO(new Date());
   return this.year()===Number(server.slice(0,4))?server:this.year()+'-12-31';
 });
 readonly solveDays=computed(()=>this.calendarMonths().reduce((sum,m)=>sum+m.cells.filter(cell=>cell?.active).length,0));
 readonly recent=computed(()=>(this.profile()?.insights?.recentSolves||[]).filter(row=>!!row.problemId).slice(0,25));
 readonly visibleRecent=computed(()=>this.showAllRecent()?this.recent():this.recent().slice(0,3));
 readonly linkedinUrl=computed(()=>this.profile()?.insights?.details?.linkedin_url||this.profile()?.profile.linkedin_url||'');
 readonly githubUrl=computed(()=>this.profile()?.insights?.details?.github_url||this.profile()?.profile.github_url||'');
 readonly topics=computed<readonly Topic[]>(()=>{
   const counts=new Map<string,number>();
   for(const problem of this.catalog())if(problem.topic)counts.set(problem.topic,(counts.get(problem.topic)||0)+1);
   const solved=new Map((this.profile()?.insights?.skills||[]).map(s=>[s.name,s.solved]));
   return [...counts].map(([name,total])=>({name,total,solved:Math.min(total,solved.get(name)||0)}))
     .sort((a,b)=>a.name.localeCompare(b.name));
 });
 readonly topicsPracticed=computed(()=>this.topics().filter(x=>x.solved>0).length);
 readonly topicsCompleted=computed(()=>this.topics().filter(x=>x.total>0&&x.solved===x.total).length);
 readonly filteredTopics=computed(()=>{
   const text=this.topicQuery().toLowerCase().trim(),state=this.topicFilter();
   return this.topics().filter(x=>(!text||x.name.toLowerCase().includes(text))&&(
     state==='all'||state==='completed'&&x.solved===x.total||
     state==='in-progress'&&x.solved>0&&x.solved<x.total||state==='not-started'&&x.solved===0));
 });
 readonly graph=computed(()=>{
   const record=this.profile();
   return solvingGraph([
     {id:'you',label:record?.isOwn?'You':record?.profile.display_name||'Learner',
       color:'#12a579',solves:record?.stats.solves||[]},
     ...this.friendSeries().filter(x=>this.selectedFriends().includes(x.public_id))
       .map((x,i)=>({id:x.public_id,label:x.display_name,color:['#bc84cc','#5694d7','#d6a04a','#dc7775'][i%4],solves:x.solves||[]}))
   ],{
     mode:this.graphMode(),measure:this.graphMeasure(),month:this.chartMonth(),
     year:this.year(),topic:this.graphTopic(),showForecast:this.forecast(),
     today:record?.stats.serverDay||utcISO(new Date())
   });
 });

 constructor(){
   this.clock=setInterval(()=>this.now.set(Date.now()),1000);
   effect(()=>{
     const target=this.target(),user=this.auth.user();
     untracked(()=>{
       if(!user){++this.generation;this.profile.set(null);this.error.set('');this.loading.set(false);return;}
       void this.load(target,user.id);
     });
   });
 }
 private async load(target:string,owner:string):Promise<void>{
   const ticket=++this.generation;
   this.loading.set(true);this.error.set('');this.profile.set(null);this.needsProfile.set(false);
   this.showAllRecent.set(false);this.compareOpen.set(false);this.friendSeries.set([]);this.selectedFriends.set([]);
   try{
     let username=target;
     if(target==='me'){
       const self=await this.api.request<{profile:Profile|null}>('self');
       if(!self.profile?.username){if(ticket===this.generation)this.needsProfile.set(true);return;}
       username=self.profile.username;
     }
     const [result,catalog]=await Promise.all([
       this.api.request<ProfileReply>('profile',{target:username}),
       this.catalogApi.all().catch(()=>[] as readonly Problem[])
     ]);
     if(this.destroyed||ticket!==this.generation||this.auth.user()?.id!==owner)return;
     this.profile.set(result);this.catalog.set(catalog);
     const current=Number((result.stats.serverDay||utcISO(new Date())).slice(0,4));
     const years=new Set<number>();
     for(let y=current;y>=current-5;y--)if(y>=2000)years.add(y);
     for(const d of result.stats.days||[])if(validUTC(d)&&Number(d.slice(0,4))<=current)years.add(Number(d.slice(0,4)));
     this.availableYears.set([...years].sort((a,b)=>b-a));
     this.year.set(current);
     this.chartMonth.set((result.stats.serverDay||utcISO(new Date())).slice(0,7));
   }catch(err){if(ticket===this.generation)this.error.set(err instanceof Error?err.message:'Profile unavailable.');}
   finally{if(ticket===this.generation)this.loading.set(false);}
 }
 utcCountdown():string{return countdownToUTC(this.now());}
 relative(value?:string):string{return solveRelativeTime(value,this.now());}
 problemNumber(id:string):string{
   const at=this.catalog().findIndex(p=>p.id===id);
   return at>=0?String(at+1).padStart(2,'0'):'—';
 }
 problemName(id:string):string{return this.catalog().find(p=>p.id===id)?.title||id;}
 languageName(code:string):string{
   return ({java:'Java',c:'C',cpp:'C++',python:'Python'} as Record<string,string>)[code]||code;
 }
 changeYear(event:Event):void{
   const y=Number((event.target as HTMLSelectElement).value);
   if(this.availableYears().includes(y))this.year.set(y);
 }
 changeMode(event:Event):void{
   const v=(event.target as HTMLSelectElement).value;
   if(['daily','monthly','yearly'].includes(v))this.graphMode.set(v as GraphMode);
 }
 changeMeasure(event:Event):void{
   const v=(event.target as HTMLSelectElement).value;
   if(v==='period'||v==='cumulative')this.graphMeasure.set(v);
 }
 changeHorizon(event:Event):void{
   const n=Number((event.target as HTMLSelectElement).value);
   if([7,14,30].includes(n))this.forecastHorizon.set(n);
 }
 setChartMonth(event:Event):void{
   const v=(event.target as HTMLInputElement).value;
   if(/^\d{4}-(0[1-9]|1[0-2])$/.test(v))this.chartMonth.set(v);
 }
 changeTopicFilter(event:Event):void{
   const v=(event.target as HTMLSelectElement).value;
   if(['all','completed','in-progress','not-started'].includes(v))this.topicFilter.set(v as TopicFilter);
 }
 async toggleCompare():Promise<void>{
   this.compareOpen.set(!this.compareOpen());
   if(!this.compareOpen()||this.friends().length||!this.profile()?.isOwn)return;
   const ticket=++this.compareGeneration,owner=this.auth.user()?.id;
   this.friendLoading.set(true);this.friendError.set('');
   try{
     const response=await this.api.request<{users:readonly Friend[]}>('following',{target:this.profile()!.profile.username});
     if(!this.destroyed&&ticket===this.compareGeneration&&this.auth.user()?.id===owner)
       this.friends.set((response.users||[]).filter(x=>!!x.public_id));
   }catch(e){if(ticket===this.compareGeneration)this.friendError.set(e instanceof Error?e.message:'Friends unavailable.');}
   finally{if(ticket===this.compareGeneration)this.friendLoading.set(false);}
 }
 toggleFriend(id:string,event:Event):void{
   const set=new Set(this.selectedFriends());
   if((event.target as HTMLInputElement).checked)set.add(id);else set.delete(id);
   this.selectedFriends.set([...set]);void this.fetchFriends();
 }
 compareAll():void{this.selectedFriends.set(this.friends().map(x=>x.public_id));void this.fetchFriends();}
 clearCompare():void{
   ++this.compareGeneration;this.selectedFriends.set([]);this.friendSeries.set([]);
   this.friendLoading.set(false);this.friendError.set('');
 }
 private async fetchFriends():Promise<void>{
   const ids=this.selectedFriends(),ticket=++this.compareGeneration,owner=this.auth.user()?.id;
   if(!ids.length){this.friendSeries.set([]);this.friendLoading.set(false);return;}
   this.friendLoading.set(true);this.friendError.set('');
   try{
     const result=await this.api.request<{users:readonly FriendSeries[]}>('friend-analytics',{targets:ids});
     if(!this.destroyed&&ticket===this.compareGeneration&&this.auth.user()?.id===owner)
       this.friendSeries.set((result.users||[]).filter(x=>ids.includes(x.public_id)));
   }catch(e){if(ticket===this.compareGeneration)this.friendError.set(e instanceof Error?e.message:'Comparison unavailable.');}
   finally{if(ticket===this.compareGeneration)this.friendLoading.set(false);}
 }
 ngOnDestroy():void{
   this.destroyed=true;++this.generation;++this.compareGeneration;clearInterval(this.clock);
 }
}
