import {ChangeDetectionStrategy, Component, effect, inject, input, OnDestroy, signal, untracked} from '@angular/core';
import {RouterLink} from '@angular/router';
import {AuthService} from '../../core/auth.service';
import {ReadonlyApiService} from '../../core/readonly-api.service';
import {StagingActionService} from '../../core/staging-action.service';

/** Public ranking data comes from the staging backend, never from a browser Run. */
interface Submission {
  readonly id:string;
  readonly language?:string;
  readonly created_at?:string|null;
  readonly suite_kind?:string|null;
  readonly shared?:boolean;
  readonly runtime_ms?:number|null;
  readonly memory_bytes?:number|null;
  readonly compiler?:string|null;
  readonly benchmark_version?:string|null;
  readonly problem_revision?:number|null;
  readonly rank?:number;
  readonly username?:string;
  readonly display_name?:string;
  readonly avatar_url?:string;
}
interface SubmissionReply {
  readonly users?:readonly Submission[];
  readonly items?:readonly Submission[];
  readonly submissions?:readonly Submission[];
  readonly unlocked?:boolean;
  readonly yourRank?:{readonly rank:number;readonly peers:number;readonly compiler?:string};
}
interface DetailReply{
  readonly submission?:Submission & {readonly source?:string;readonly approach?:string};
  readonly author?:{readonly username?:string;readonly display_name?:string};
}
type Board='public'|'full';
type RankingSort='runtime'|'memory';
type Panel='mine'|'community';

@Component({
  selector:'bq-submissions',
  imports:[RouterLink],
  changeDetection:ChangeDetectionStrategy.OnPush,
  template:`
    <section class="submission-screen" aria-label="Submission history and rankings">
      <div class="submission-heading">
        <div>
          <p class="submission-eyebrow">SUBMISSION HISTORY</p>
          <h3>{{view()==='mine'?'My submissions':'Community submissions'}}</h3>
          <p class="submission-view-note">
            {{view()==='mine'
              ? 'Your latest 25 submissions. New accepted solutions are publicly showcased; earlier private results can be published here.'
              : 'Accepted solutions join the public showcase by default. Public-test and full-suite rankings remain separate.'}}
          </p>
        </div>
        <button type="button" class="switch-view" (click)="switchView()">
          {{view()==='mine'?'Community rankings':'My submissions'}}
        </button>
      </div>

      @if(view()==='mine'){
        <p class="submission-view-note secondary-note">
          Browser practice is private and not verified; it does not unlock shared solutions.
          Server-recorded submissions are saved with your staging account.
        </p>
        <div class="submission-table-wrap">
          <table class="submission-table">
            <thead><tr>
              <th scope="col">Date</th><th scope="col">Result / privacy</th>
              <th scope="col">Language</th><th scope="col">Runtime</th>
              <th scope="col">Memory</th>
            </tr></thead>
            <tbody>
              @for(row of history();track row.id){
                <tr>
                  <td>{{dateLabel(row.created_at)}}</td>
                  <td class="result-cell">
                    <button type="button" class="submission-open" (click)="openDetail(row.id)"
                      [title]="resultLabel(row)">
                      <strong>{{resultLabel(row)}}</strong><small>Accepted</small>
                    </button>
                    @if(canPublish(row)){
                      <button type="button" class="publish-action" (click)="publishEarlier(row)"
                        [disabled]="sharingId()===row.id">
                        {{sharingId()===row.id?'Publishing…':'Publish earlier accepted solution'}}
                      </button>
                    }
                  </td>
                  <td class="muted-cell">{{languageLabel(row.language)}}</td>
                  <td class="numeric-cell">{{runtimeLabel(row.runtime_ms)}}</td>
                  <td class="numeric-cell">{{memoryLabel(row.memory_bytes)}}</td>
                </tr>
              } @empty {
                @if(!loading() && !error()){
                  <tr><td colspan="5" class="empty-submissions">
                    {{auth.user()?'No server-recorded submissions for this problem yet.':'Sign in to view your submissions.'}}
                  </td></tr>
                }
              }
            </tbody>
          </table>
        </div>
        @if(loading()){<p class="submission-message" role="status">Loading your submissions…</p>}
        @if(error()){<p class="submission-message is-error" role="alert">{{error()}}</p>}
        @if(message()){<p class="submission-message" role="status">{{message()}}</p>}
        @if(auth.user()){
          <button type="button" class="subtle-refresh" (click)="load()" [disabled]="loading()">↻ Refresh history</button>
        }
      } @else {
        <div class="board-tabs" role="group" aria-label="Community ranking scope">
          <button type="button" class="board-choice" [class.active]="board()==='public'"
            [attr.aria-pressed]="board()==='public'" (click)="chooseBoard('public')">Public tests</button>
          <button type="button" class="board-choice" [class.active]="board()==='full'"
            [attr.aria-pressed]="board()==='full'" (click)="chooseBoard('full')">Full-suite verified</button>
        </div>
        <div class="submission-filters">
          @if(board()==='full'){
            <label>Language
              <select aria-label="Ranking language" [value]="language()"
                (change)="chooseLanguage($event)">
                <option value="all">All languages</option>
                <option value="java">Java</option>
                <option value="python">Python 3.11</option>
                <option value="c">C 11</option>
                <option value="cpp">C++ 17</option>
              </select>
            </label>
          } @else {
            <p class="ranking-scope-note">Java public tests only · Hidden cases are not verified</p>
          }
          <label>Rank by
            <select aria-label="Rank by" [value]="sort()" (change)="chooseSort($event)">
              <option value="runtime">Runtime</option>
              <option value="memory">Peak memory</option>
            </select>
          </label>
        </div>
        @if(!auth.user()){
          <p class="submission-locked">Sign in to view community rankings.</p>
        } @else if(loading()){
          <p class="submission-message" role="status">Loading community submissions…</p>
        } @else if(error()){
          <p class="submission-message is-error" role="alert">{{error()}}</p>
        } @else if(!unlocked()){
          <p class="submission-locked">Submit an accepted server-verified solution for this problem revision
            to unlock these rankings. Browser Run alone does not qualify.</p>
        } @else {
          @if(board()==='public'){
            <p class="submission-view-note ranking-notice">
              Public tests only: the hidden suite has not been checked. Java providers and
              benchmark versions may differ; do not compare runtimes across providers.
            </p>
            @if(yourRank()){
              <p class="submission-view-note">Your public-test position:
                <strong>#{{yourRank()!.rank}} of {{yourRank()!.peers}}</strong>
                · {{providerLabel(yourRank()!.compiler)}}
              </p>
            }
          }
          <div class="submission-table-wrap">
            <table class="submission-table community-table">
              <thead><tr>
                <th scope="col">Rank</th><th scope="col">Learner</th>
                <th scope="col">Language</th><th scope="col">Runtime</th><th scope="col">Memory</th>
              </tr></thead>
              <tbody>
                @for(row of rankings();track row.id){
                  <tr>
                    <td class="rank-cell">{{rankLabel(row.rank)}}</td>
                    <td>
                      <div class="learner-cell">
                        <a [routerLink]="['/angular/profile',row.username||row.id]"
                          [attr.aria-label]="'View '+(row.display_name||row.username||'learner')+' profile'">
                          @if(row.avatar_url){
                            <img class="learner-avatar" [src]="row.avatar_url" alt="" referrerpolicy="no-referrer"/>
                          } @else {
                            <span class="learner-avatar avatar-fallback">
                              {{(row.display_name||row.username||'?').slice(0,1).toUpperCase()}}
                            </span>
                          }
                        </a>
                        <button type="button" class="submission-open" (click)="openDetail(row.id)">
                          <strong>{{row.display_name||row.username||'ByteQuest learner'}}</strong>
                          @if(row.username){<small>&#64;{{row.username}}</small>}
                        </button>
                      </div>
                    </td>
                    <td class="muted-cell">{{languageLabel(row.language)}}</td>
                    <td class="numeric-cell">{{runtimeLabel(row.runtime_ms)}}</td>
                    <td class="numeric-cell">{{memoryLabel(row.memory_bytes)}}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="empty-submissions">No shared accepted submissions on this board yet.</td></tr>
                }
              </tbody>
            </table>
          </div>
          <nav class="submission-pager" aria-label="Ranking pages">
            <button type="button" (click)="changePage(-1)" [disabled]="page()===0">← Previous</button>
            <span>Page {{page()+1}}</span>
            <button type="button" (click)="changePage(1)" [disabled]="rankings().length<25">Next →</button>
          </nav>
          <p class="benchmark-note">
            {{board()==='public'
              ? 'Public-test results are not full-suite verification. Compare only matching Java providers and benchmark versions.'
              : 'Full-suite results include hidden tests. Compare runtimes within the same language and benchmark version.'}}
            Each learner's best shared result for this problem revision appears.
          </p>
        }
      }

      @if(detailLoading()||detailError()||detail()){
        <div class="detail-backdrop" role="presentation" (click)="closeDetail()">
          <section class="detail-dialog" role="dialog" aria-modal="true" aria-label="Saved submission"
            (click)="$event.stopPropagation()">
            <button class="detail-close" type="button" (click)="closeDetail()" aria-label="Close submission details">×</button>
            <p class="submission-eyebrow">ACCEPTED SUBMISSION</p>
            <h3>{{detail()?.author?.display_name||detail()?.author?.username||'Saved Java solution'}}</h3>
            @if(detailLoading()){<p role="status">Loading saved solution…</p>}
            @if(detailError()){<p role="alert" class="is-error">{{detailError()}}</p>}
            @if(detail()?.submission;as record){
              <p class="submission-view-note">{{languageLabel(record.language)}} ·
                {{runtimeLabel(record.runtime_ms)}} · {{memoryLabel(record.memory_bytes)}}</p>
              @if(record.approach){<p>{{record.approach}}</p>}
              <h4>Submitted code</h4>
              <pre class="saved-code"><code>{{record.source||'Source unavailable.'}}</code></pre>
            }
          </section>
        </div>
      }
    </section>
  `,
  styles:[`
    :host{display:block;min-width:0;color:var(--text)}
    .submission-screen{padding:28px 30px 32px;font-size:12px}
    .submission-heading{display:flex;align-items:center;justify-content:space-between;gap:14px}
    .submission-eyebrow{font-size:10px;letter-spacing:.17em;font-weight:700;color:var(--muted);margin:0 0 13px}
    h3{font-family:Georgia,serif;font-size:26px;font-weight:400;letter-spacing:-.6px;margin:0 0 14px}
    .submission-view-note{font-size:12px;line-height:1.65;color:var(--subtle);max-width:470px;margin:0 0 16px}
    .secondary-note{max-width:none;margin:4px 0 18px}
    button{cursor:pointer}
    button:disabled{opacity:.45;cursor:not-allowed}
    .switch-view,.board-choice,.publish-action{border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--text);padding:10px 13px;font-weight:600;font-size:11px}
    .switch-view{flex-shrink:0;white-space:nowrap}
    .switch-view:hover,.board-choice:hover{border-color:var(--accent)}
    .submission-table-wrap{overflow:auto;max-width:100%}
    .submission-table{width:100%;border-collapse:collapse;text-align:left;table-layout:fixed}
    .submission-table th{font-weight:600;text-transform:uppercase;font-size:10px;color:var(--muted);padding:11px 7px;border-bottom:1px solid var(--line);white-space:nowrap}
    .submission-table td{padding:14px 7px;border-bottom:1px solid var(--line);font-size:11px;line-height:1.6;vertical-align:middle}
    .submission-table th:nth-child(1){width:17%}.submission-table th:nth-child(2){width:29%}
    .submission-table th:nth-child(3){width:17%}.submission-table th:nth-child(4){width:19%}.submission-table th:nth-child(5){width:18%}
    .result-cell{min-width:0}
    .submission-open{display:flex;flex-direction:column;align-items:flex-start;gap:3px;background:transparent;border:0;color:var(--text);padding:0;text-align:left;max-width:100%;min-width:0}
    .submission-open strong{font-size:11px;font-weight:600;display:block;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .submission-open small{font-size:10px;color:var(--muted);font-weight:400}
    .submission-open:hover strong{color:var(--accent)}
    .muted-cell{color:var(--subtle)}.numeric-cell{font:10px/1.5 'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;white-space:nowrap}
    .empty-submissions{text-align:center;color:var(--muted);padding:22px!important}
    .publish-action{display:block;margin-top:5px;color:var(--accent);padding:5px 7px;font-size:10px;white-space:normal;text-align:left}
    .subtle-refresh{border:0;color:var(--accent);background:transparent;padding:12px 0;font-size:11px}
    .submission-message{padding:12px 0;color:var(--subtle);line-height:1.7}
    .is-error{color:#da6767}
    .board-tabs{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0 25px}
    .board-choice.active{color:var(--accent);border-color:var(--accent);background:color-mix(in srgb,var(--accent) 8%,var(--panel))}
    .submission-filters{display:flex;align-items:flex-end;flex-wrap:wrap;gap:14px;margin-bottom:20px}
    .submission-filters label{display:flex;flex-direction:column;gap:8px;font-size:10px;color:var(--muted)}
    .submission-filters select{appearance:auto;border:1px solid var(--line);background:var(--panel-2);color:var(--text);border-radius:8px;padding:10px 9px;min-width:112px;font-size:11px}
    .ranking-scope-note{margin:0 auto 10px 0;font-size:11px;color:var(--muted);line-height:1.5}
    .ranking-notice{max-width:none;margin-bottom:12px}
    .learner-cell{display:flex;align-items:center;gap:10px;min-width:0}
    .learner-cell a{flex-shrink:0}
    .learner-avatar{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;object-fit:cover;background:var(--surface);border:1px solid var(--line)}
    .avatar-fallback{font-weight:700;color:var(--accent)}
    .community-table th:nth-child(1){width:12%}.community-table th:nth-child(2){width:40%}
    .community-table th:nth-child(3){width:15%}.community-table th:nth-child(4){width:18%}.community-table th:nth-child(5){width:15%}
    .rank-cell{font-weight:700;font-size:13px!important}
    .submission-pager{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:14px 0}
    .submission-pager button{border:1px solid var(--line);background:var(--panel-2);border-radius:7px;color:var(--text);padding:8px 11px;font-size:11px}
    .submission-pager span{color:var(--subtle);font-size:11px}
    .benchmark-note{font-size:11px;line-height:1.75;color:var(--muted);margin:16px 0 0}
    .submission-locked{border:1px solid var(--line);border-radius:9px;background:var(--panel-2);padding:21px;line-height:1.7;color:var(--subtle)}
    .detail-backdrop{position:fixed;inset:0;z-index:150;background:#0009;display:grid;place-items:center;padding:20px}
    .detail-dialog{position:relative;width:min(680px,100%);max-height:86dvh;overflow:auto;padding:28px;border:1px solid var(--line);border-radius:14px;background:var(--panel);box-shadow:0 22px 70px #0005}
    .detail-close{position:absolute;right:18px;top:14px;border:0;background:transparent;color:var(--text);font-size:25px}
    .saved-code{font:12px/1.7 'JetBrains Mono',monospace;background:var(--panel-2);border:1px solid var(--line);padding:16px;border-radius:9px;overflow:auto;white-space:pre}
    @media(max-width:1050px){.submission-screen{padding:22px 18px}.submission-table th,.submission-table td{padding-left:5px;padding-right:5px}.learner-avatar{width:27px;height:27px}}
    @media(max-width:550px){.submission-heading{align-items:flex-start;flex-direction:column}.submission-table{min-width:510px}.board-tabs{margin-top:18px}}
  `]
})
export class SubmissionsComponent implements OnDestroy {
  readonly problemId=input.required<string>();
  readonly revision=input<number|null>(null);
  readonly hiddenCount=input(0);
  readonly refreshKey=input(0);
  readonly initialView=input<Panel>('mine');
  readonly auth=inject(AuthService);
  private readonly api=inject(ReadonlyApiService);
  private readonly actions=inject(StagingActionService);
  readonly view=signal<Panel>('mine');
  readonly board=signal<Board>('full');
  readonly language=signal('all');
  readonly sort=signal<RankingSort>('runtime');
  readonly page=signal(0);
  readonly history=signal<readonly Submission[]>([]);
  readonly rankings=signal<readonly Submission[]>([]);
  readonly unlocked=signal(false);
  readonly yourRank=signal<SubmissionReply['yourRank']>(undefined);
  readonly loading=signal(false);
  readonly error=signal('');
  readonly message=signal('');
  readonly sharingId=signal<string|null>(null);
  readonly detail=signal<(DetailReply & {submission:NonNullable<DetailReply['submission']>})|null>(null);
  readonly detailLoading=signal(false);
  readonly detailError=signal('');
  private generation=0;
  private detailGeneration=0;
  private disposed=false;

  constructor(){
    effect(()=>{
      const id=this.problemId(),owner=this.auth.user()?.id,initialView=this.initialView();
      this.refreshKey();
      const defaultBoard=this.hiddenCount()>0?'public':'full';
      untracked(()=>{
        if(!id||this.disposed)return;
        this.view.set(initialView);
        this.board.set(defaultBoard);
        this.page.set(0);
        this.history.set([]);this.rankings.set([]);
        this.closeDetail();
        if(owner)void this.load();
        else {++this.generation;this.loading.set(false);this.error.set('');}
      });
    });
  }
  switchView():void {
    this.view.set(this.view()==='mine'?'community':'mine');
    this.page.set(0);this.error.set('');this.message.set('');
    void this.load();
  }
  chooseBoard(next:Board):void {
    if(this.board()===next)return;
    this.board.set(next);this.page.set(0);
    void this.load();
  }
  chooseLanguage(event:Event):void {
    const value=(event.target as HTMLSelectElement).value;
    if(!['all','java','python','c','cpp'].includes(value))return;
    this.language.set(value);this.page.set(0);
    void this.load();
  }
  chooseSort(event:Event):void {
    const value=(event.target as HTMLSelectElement).value;
    if(value!=='runtime'&&value!=='memory')return;
    this.sort.set(value);this.page.set(0);
    void this.load();
  }
  changePage(delta:number):void {
    this.page.set(Math.max(0,this.page()+delta));
    void this.load();
  }
  async load():Promise<void>{
    const id=this.problemId(),owner=this.auth.user()?.id,view=this.view(),board=this.board();
    const ticket=++this.generation;
    this.loading.set(Boolean(owner));this.error.set('');
    if(!owner){this.history.set([]);this.rankings.set([]);this.unlocked.set(false);return;}
    try{
      if(view==='mine'){
        const response=await this.api.request<SubmissionReply>('submission-history',{problemId:id});
        if(!this.isCurrent(ticket,id,owner,view,board))return;
        const rows=response.users||response.items||response.submissions||[];
        this.history.set(rows.filter(row=>row?.id&&row.language==='java')
          .sort((a,b)=>Date.parse(b.created_at||'')-Date.parse(a.created_at||'')).slice(0,25));
      }else{
        const action=board==='public'?'submission-public-list':'submission-list';
        const response=await this.api.request<SubmissionReply>(action,{
          problemId:id,sort:this.sort(),page:this.page(),
          ...(board==='full'?{language:this.language()}:{})
        });
        if(!this.isCurrent(ticket,id,owner,view,board))return;
        this.unlocked.set(response.unlocked===true);
        this.yourRank.set(response.yourRank);
        this.rankings.set((response.users||response.items||response.submissions||[]).filter(row=>!!row?.id));
      }
    }catch(e){
      if(this.isCurrent(ticket,id,owner,view,board)){
        this.error.set(e instanceof Error?e.message:'Unable to load staging submissions.');
      }
    }finally{
      if(this.isCurrent(ticket,id,owner,view,board))this.loading.set(false);
    }
  }
  private isCurrent(ticket:number,id:string,owner:string,view:Panel,board:Board):boolean{
    return !this.disposed&&ticket===this.generation&&this.problemId()===id&&
      this.auth.user()?.id===owner&&this.view()===view&&(view==='mine'||this.board()===board);
  }
  resultLabel(row:Submission):string{
    const publicOnly=this.hiddenCount()>0&&row.suite_kind==='public';
    return (publicOnly?'Public tests accepted':'Verified')+' · '+(row.shared?'showcased':'earlier private');
  }
  canPublish(row:Submission):boolean{
    return !row.shared&&row.suite_kind==='public'&&
      row.benchmark_version==='bq-public-only-v1'&&
      row.problem_revision===this.revision();
  }
  async publishEarlier(row:Submission):Promise<void>{
    const owner=this.auth.user()?.id,id=this.problemId();
    if(!owner||!this.canPublish(row)||this.sharingId())return;
    this.sharingId.set(row.id);this.error.set('');
    try{
      await this.actions.write('submission-public-share',{id:row.id,shared:true});
      if(this.problemId()===id&&this.auth.user()?.id===owner){
        this.message.set('Your earlier accepted solution is now shared on the public-test board.');
        await this.load();
      }
    }catch(e){this.error.set(e instanceof Error?e.message:'Could not publish this accepted solution.');}
    finally{this.sharingId.set(null);}
  }
  async openDetail(id:string):Promise<void>{
    const problem=this.problemId(),owner=this.auth.user()?.id,ticket=++this.detailGeneration;
    if(!owner)return;
    this.detail.set(null);this.detailError.set('');this.detailLoading.set(true);
    try{
      const reply=await this.api.request<DetailReply>('submission-read',{id});
      if(this.disposed||ticket!==this.detailGeneration||this.problemId()!==problem||this.auth.user()?.id!==owner)return;
      if(!reply.submission||typeof reply.submission.source!=='string')throw new Error('Saved code is unavailable for this submission.');
      this.detail.set({submission:reply.submission,author:reply.author});
    }catch(e){if(ticket===this.detailGeneration)this.detailError.set(e instanceof Error?e.message:'Could not read this submission.');}
    finally{if(ticket===this.detailGeneration)this.detailLoading.set(false);}
  }
  closeDetail():void{++this.detailGeneration;this.detail.set(null);this.detailLoading.set(false);this.detailError.set('');}
  dateLabel(value?:string|null):string{
    if(!value)return '—';
    const date=new Date(value);
    return Number.isFinite(date.getTime())?date.toLocaleDateString():'—';
  }
  runtimeLabel(value?:number|null):string{
    return value===null||value===undefined||!Number.isFinite(value)?'Not measured':
      value<0.001?'< 0.001 ms':value.toFixed(3)+' ms';
  }
  memoryLabel(value?:number|null):string{
    return value===null||value===undefined||!Number.isFinite(value)?'Not measured':
      (value/1048576).toFixed(2)+' MB';
  }
  languageLabel(value?:string):string{
    return ({java:'Java',python:'Python 3.11',c:'C 11',cpp:'C++ 17'} as Record<string,string>)[value||'']||value||'—';
  }
  providerLabel(value?:string):string{
    return value==='judge0-java-17'?'Judge0 Java 17':value==='wandbox-java-21'?'Wandbox Java 21':'Java provider';
  }
  rankLabel(rank?:number):string{
    return rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':Number.isFinite(rank)?'#'+rank:'—';
  }
  ngOnDestroy():void{this.disposed=true;++this.generation;this.closeDetail();}
}
