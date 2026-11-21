import {ChangeDetectionStrategy, Component, inject, OnDestroy, signal} from '@angular/core';
import {RouterLink, ActivatedRoute, Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {CatalogService, type Problem} from '../../core/catalog.service';
import {EditorComponent} from '../editor/editor.component';
import {JavaGuestService} from '../../core/java-guest.service';
import {AuthService} from '../../core/auth.service';
import {VerifiedJavaService} from '../../core/verified-java.service';
import {ReadonlyApiService} from '../../core/readonly-api.service';
import type {SuiteScope,VerifiedVerdict} from '../../core/java-submission-contract';

const STORAGE_PREFIX='bytequest.angular-preview.draft.java.';
@Component({
  selector:'bq-practice',
  imports:[RouterLink,EditorComponent],
  changeDetection:ChangeDetectionStrategy.OnPush,
  template:`
    <section class="view native-practice">
      <div class="native-practice-navigation">
        <a routerLink="/angular" class="catalog-refresh">← Problems</a>
        <span class="muted">Java 17</span>
      </div>
      @if(loading()){
        <p class="empty-state" role="status">Opening problem…</p>
      } @else if(!problem()){
        <p class="empty-state" role="alert">Problem not found. <a routerLink="/angular">Back to library</a></p>
      } @else {
      <div class="lab">
        <section class="problem-pane" aria-label="Problem and learning materials">
          <div class="pane-tabs" role="tablist" aria-label="Learning materials">
            <button type="button" role="tab" [class.active]="pane()==='problem'"
              [attr.aria-selected]="pane()==='problem'" (click)="openPane('problem')">Description</button>
            <button type="button" role="tab" [class.active]="pane()==='learn'"
              [attr.aria-selected]="pane()==='learn'" (click)="openPane('learn')">Editorial</button>
            <button type="button" role="tab" [class.active]="pane()==='visual'"
              [attr.aria-selected]="pane()==='visual'" (click)="openPane('visual')">Visualize</button>
            <button type="button" role="tab" [class.active]="pane()==='submissions'"
              [attr.aria-selected]="pane()==='submissions'" (click)="openPane('submissions')">Submissions</button>
          </div>
          <div class="learning-content native-learning-content">
            @if(pane()==='problem'){
              <div class="problem-heading">
                <p class="problem-eyebrow">Coding challenge</p>
                <div class="problem-title-row">
                  <h3>{{problem()!.title}}</h3>
                  <div class="problem-badges">
                    <span class="problem-difficulty" [class]="problem()!.difficulty.toLowerCase()">{{problem()!.difficulty}}</span>
                  </div>
                </div>
              </div>
              <div class="problem-statement-copy">
                <p class="body-copy">{{problem()!.description}}</p>
              </div>
              <h4>Input</h4>
              <p class="body-copy">{{formatParameters()}}</p>
              <h4>Output</h4>
              <p class="body-copy">Return {{problem()!.returns}} from {{problem()!.method}}.</p>
              <h4>Examples</h4>
              @for(example of problem()!.examples;track $index;let index=$index){
                <div class="example-card">
                  <div class="example-label">Example {{index+1}}</div>
                  <code>Input: <b>{{format(example.args)}}</b>
Output: <b>{{format(example.expected)}}</b></code>
                  @if(example.label){<p>{{example.label}}</p>}
                </div>
              }
              <h4>Constraints</h4>
              <div class="constraints">{{problem()!.constraints}}</div>
              <details class="concept-hint"><summary>Reveal the key concept</summary>
                <p>{{problem()!.topic}}</p>
              </details>
            } @else if(pane()==='learn') {
              <span class="pattern-tag">EDITORIAL</span>
              <h3>Approach</h3>
              <p class="body-copy">The Java answer is released only after the server verifies your accepted submission. Browser Run never unlocks it.</p>
              @if(referenceError()){<p class="run-error" role="alert">{{referenceError()}}</p>}
              @if(referenceCode()){
                <p class="reference-reveal-note">Your accepted Java submission unlocked this solution.</p>
                <pre class="reference-code"><code>{{referenceCode()}}</code></pre>
              } @else{
                <button type="button" class="reference-button" (click)="readReference()"
                  [disabled]="!auth.user()||readingReference()||!problem()!.revision">
                  {{readingReference()?'Checking verified access…':'Check Java answer access'}}
                </button>
              }
            } @else if(pane()==='submissions'){
              <span class="pattern-tag">SUBMISSION HISTORY</span>
              <h3>Your Java submissions</h3>
              <p class="submission-view-note">Server-recorded submissions remain separate from browser practice.</p>
              <button type="button" class="button secondary" (click)="loadHistory()" [disabled]="historyLoading()">
                {{historyLoading()?'Loading…':'Refresh history'}}
              </button>
              @if(historyError()){<p class="run-error" role="alert">{{historyError()}}</p>}
              @for(row of history();track row.id){
                <article class="native-submission">
                  <strong>Accepted · {{row.suite_kind==='public'?'Public suite':'Full suite'}}</strong>
                  <span>{{row.language}} · {{row.created_at||'Date unavailable'}}</span>
                  <span>{{row.runtime_ms===null?'—':row.runtime_ms+' ms'}} · {{row.shared?'Shared':'Private (earlier result)'}}</span>
                </article>
              }@empty{
                @if(!historyLoading()&&!historyError()){<p class="body-copy">No server-recorded Java submissions found.</p>}
              }
            } @else {
              <span class="pattern-tag">VISUALIZE</span>
              <h3>Java technique</h3>
              <p class="body-copy">This panel is being migrated. Continue using the original compatibility screen for visual traces.</p>
            }
          </div>
          <details class="hint-bar">
            <summary>Need a hint? <span class="muted">Reveal guidance when you need it</span></summary>
            <div class="hint-content"><p>{{problem()!.topic}} is a useful starting point.</p></div>
          </details>
        </section>
        <div class="pane-resizer" role="separator" aria-label="Description and editor divider" aria-orientation="vertical"></div>
        <section class="editor-pane" aria-label="Java editor and test results">
          <div class="editor-top">
            <span class="file-tab"><span class="java-dot">J</span>
              <span>Solution.java</span><span class="file-dot"></span></span>
            <div class="editor-tools">
              <button type="button" class="mini-icon" title="Reset to starter" (click)="resetDraft()">Reset</button>
              <select aria-label="Programming language" disabled><option value="java">Java 17</option></select>
            </div>
          </div>
          <div class="native-editor-area">
            <bq-editor [value]="code()" (valueChange)="saveCode($event)"/>
          </div>
          <div class="editor-status">
            <span><span class="green-dot"></span>Draft saved on this device</span>
            <span>Spaces: 4 <span class="divider">|</span> UTF-8</span>
          </div>
          <div class="test-panel">
            <div class="test-header"><strong>Test playground</strong></div>
            <div class="test-tabs">
              @for(example of problem()!.examples;track $index;let index=$index){
                <button type="button" [class.active]="selectedCase()===index" (click)="selectedCase.set(index)">
                  Case {{index+1}}
                  @if(result()?.cases?.[index]){
                    <span [class.is-pass]="result()!.cases![index].passed" [class.is-fail]="!result()!.cases![index].passed">
                      {{result()!.cases![index].passed?'✓':'×'}}
                    </span>
                  }
                </button>
              }
            </div>
            @if(problem()!.examples[selectedCase()];as example){
              <div class="test-detail"><div><label>INPUT</label>
                <code>{{format(example.args)}}</code></div>
                <div><label>EXPECTED</label><code>{{format(example.expected)}}</code></div>
              </div>
            }
            <div class="result-output" aria-live="polite">
              @if(resultError()){<p class="run-error" role="alert">{{resultError()}}</p>}
              @if(verificationError()){<p class="run-error" role="alert">{{verificationError()}}</p>}
              @if(result()){
                <div class="result-summary" [class.failed]="result()!.status!=='ok'">
                  {{result()!.status==='ok'?'Java public Run finished':'Java '+result()!.status}}
                </div>
                @if(result()!.message){<p>{{result()!.message}}</p>}
                @for(t of result()!.cases||[];track $index;let index=$index){
                  <div class="native-result-line">
                    <span [class.is-pass]="t.passed" [class.is-fail]="!t.passed">{{t.passed?'✓ Passed':'× Failed'}}</span>
                    {{t.label||'Case '+(index+1)}}
                  </div>
                }
              }
              @if(verifiedVerdict()){
                <p class="result-summary" [class.failed]="!verifiedVerdict()!.accepted">
                  {{verifiedVerdict()!.accepted?'✓ Server-verified':'No verified acceptance'}} · {{verifiedVerdict()!.message}}
                </p>
              }
              @if(!canVerify()){
                <p class="native-validation-note">Verified Submit is unavailable until an isolated test backend is configured. Guest Run does not increase points or streak.</p>
              }
            </div>
          </div>
          <div class="runbar">
            <span class="native-run-status"><span class="runtime-dot"></span>{{guest.status()||'Real Java. Right here.'}}</span>
            <button type="button" class="button secondary" [disabled]="running()||verifying()" (click)="runGuest()">
              {{running()?'Running…':'Run'}}
            </button>
            <button type="button" class="button primary" [disabled]="running()||verifying()||!canVerify()||!auth.user()"
              (click)="submitVerified('public')">
              {{verifying()?'Submitting…':'Submit solution'}}
            </button>
          </div>
        </section>
      </div>
      <div class="below-lab"><span>✳ Progress over perfection. Every attempt counts.</span>
        <button type="button" (click)="nextProblem()">Next problem →</button>
      </div>
      }
    </section>
  `,
  styles:[`
    :host{display:block}
    .native-practice{display:block!important}
    .native-practice-navigation{display:flex;gap:18px;justify-content:space-between;padding:15px 0}
    .native-learning-content{min-height:580px;max-height:80dvh;overflow:auto}
    .native-editor-area{height:440px;min-height:300px;overflow:hidden}
    .native-editor-area bq-editor{display:block;height:100%;min-height:0}
    .native-result-line{display:flex;align-items:center;gap:14px;margin-top:8px}
    .native-validation-note{font-size:11px;opacity:.75}
    .native-practice .runbar .button{min-width:86px}
    @media(max-width:850px){.native-practice .lab{display:block}.native-learning-content{max-height:420px}}
  `]
})

export class PracticeComponent implements OnDestroy {
  private readonly route=inject(ActivatedRoute);
  private readonly router=inject(Router);
  private readonly catalog=inject(CatalogService);
  readonly guest=inject(JavaGuestService);
  private readonly api=inject(ReadonlyApiService);
  readonly readingReference=signal(false);
  readonly referenceCode=signal('');
  readonly referenceError=signal('');
  readonly historyLoading=signal(false);
  readonly historyError=signal('');
  readonly history=signal<readonly {id:string;language:string;created_at?:string;suite_kind?:string;shared?:boolean;runtime_ms?:number|null}[]>([]);
  readonly auth=inject(AuthService);
  readonly verified=inject(VerifiedJavaService);
  readonly canVerify=signal(false);
  readonly verifying=signal(false);
  readonly verifiedVerdict=signal<VerifiedVerdict|null>(null);
  readonly verificationError=signal('');
  readonly running=signal(false);
  readonly result=signal<{status:string;cases?:readonly {passed:boolean;label?:string}[];stdout?:string;message?:string}|null>(null);
  readonly resultError=signal('');
  private readonly subscription:Subscription;
  readonly problem=signal<Problem|null>(null);
  readonly code=signal('');
  readonly loading=signal(true);

  constructor(){
    this.subscription=this.route.paramMap.subscribe(params=>{void this.select(params.get('id'));});
    void this.verified.canSubmit().then(enabled=>this.canVerify.set(enabled));
  }
  private async select(id:string|null):Promise<void>{
    this.loading.set(true);this.problem.set(null);this.result.set(null);this.resultError.set('');
    this.pane.set('problem');this.selectedCase.set(0);
    this.referenceCode.set('');this.referenceError.set('');this.history.set([]);this.historyError.set('');
    this.verifiedVerdict.set(null);this.verificationError.set('');
    try {
      const found=(await this.catalog.all()).find(p=>p.id===id)||null;
      if(this.route.snapshot.paramMap.get('id')!==id)return;
      this.problem.set(found);
      if(found){
        let draft:string|null=null;
        try{draft=localStorage.getItem(STORAGE_PREFIX+found.id);}catch{ /* No storage access. */ }
        this.code.set(draft??found.starter);
      }
    } catch {this.problem.set(null);}
    finally {if(this.route.snapshot.paramMap.get('id')===id)this.loading.set(false);}
  }
  async runGuest():Promise<void>{
    const problem=this.problem();
    if(!problem||this.running())return;
    this.running.set(true);this.result.set(null);this.resultError.set('');
    const snapshot=this.code();
    const id=problem.id;
    try{
      const verdict=await this.guest.run(snapshot,problem);
      if(this.problem()?.id===id)this.result.set(verdict);
    }catch(error){
      if(this.problem()?.id===id)this.resultError.set(error instanceof Error?error.message:'Java execution failed. Retry.');
    }finally {this.running.set(false);}
  }
  async submitVerified(scope:SuiteScope):Promise<void>{
    const problem=this.problem();
    if(!problem||!this.canVerify()||this.verifying()||!this.auth.user())return;
    this.verifying.set(true);
    this.verifiedVerdict.set(null);
    this.verificationError.set('');
    const owner=this.auth.user()?.id,code=this.code(),id=problem.id;
    try{
      const verdict=await this.verified.submit(problem,code,scope);
      if(this.problem()?.id===id&&this.auth.user()?.id===owner&&this.code()===code){
        this.verifiedVerdict.set(verdict);
      }else{
        this.verificationError.set('The active problem, account or solution changed. Refresh your submission history.');
      }
    }catch(error){
      if(this.problem()?.id===id)this.verificationError.set(error instanceof Error?error.message:'Server verification failed.');
    }finally{this.verifying.set(false);}
  }
  openPane(pane:'problem'|'learn'|'visual'|'submissions'):void{
    this.pane.set(pane);
    if(pane==='submissions')void this.loadHistory();
  }
  async loadHistory():Promise<void>{
    const problem=this.problem(),owner=this.auth.user()?.id;
    if(!problem||!owner||this.historyLoading())return;
    this.historyLoading.set(true);this.historyError.set('');
    try{
      const reply=await this.api.request<{users?:unknown[];items?:unknown[]}>('submission-history',{problemId:problem.id});
      if(this.problem()?.id!==problem.id||this.auth.user()?.id!==owner)return;
      const rows=(reply.users||reply.items||[]).filter(row=>{
        if(!row||typeof row!=='object')return false;
        const item=row as {id?:unknown;language?:unknown};
        return typeof item.id==='string'&&item.language==='java';
      }) as {id:string;language:string;created_at?:string;suite_kind?:string;shared?:boolean;runtime_ms?:number|null}[];
      this.history.set(rows.slice(0,25));
    }catch(e){if(this.problem()?.id===problem.id)this.historyError.set(e instanceof Error?e.message:'Could not load submissions.');}
    finally{this.historyLoading.set(false);}
  }
  async readReference():Promise<void>{
    const problem=this.problem(),owner=this.auth.user()?.id;
    if(!problem||!owner||!problem.revision||this.readingReference())return;
    this.readingReference.set(true);this.referenceError.set('');
    try{
      const reply=await this.api.request<{reference?:unknown;revision?:unknown}>('reference-read',{
        problemId:problem.id,revision:problem.revision
      });
      if(this.problem()?.id!==problem.id||this.auth.user()?.id!==owner
        ||this.pane()!=='learn')return;
      if(typeof reply.reference!=='string'||!reply.reference
        ||reply.revision!==problem.revision)
        throw new Error('The private Java reference response was invalid.');
      this.referenceCode.set(reply.reference);
    }catch(e){
      if(this.problem()?.id===problem.id)this.referenceError.set(e instanceof Error?e.message:'The Java answer remains locked.');
    }finally{this.readingReference.set(false);}
  }
  readonly pane=signal<'problem'|'learn'|'visual'|'submissions'>('problem');
  readonly selectedCase=signal(0);
  formatParameters():string{
    const problem=this.problem();
    return problem?problem.params.map(param=>param.name+' ('+param.type+')').join(', '):'';
  }
  resetDraft():void{
    const problem=this.problem();
    if(!problem||this.running())return;
    this.saveCode(problem.starter);
    this.result.set(null);
    this.resultError.set('');
  }
  async nextProblem():Promise<void>{
    const current=this.problem();
    if(!current)return;
    const all=await this.catalog.all();
    const index=all.findIndex(item=>item.id===current.id);
    const next=all[(index+1)%all.length];
    if(next)void this.router.navigate(['/angular/problem',next.id]);
  }
  saveCode(value:string):void {
    const id=this.problem()?.id;
    if(!id)return;
    this.code.set(value);
    try{localStorage.setItem(STORAGE_PREFIX+id,value);}catch{ /* Editing must still work with blocked or full storage. */ }
  }
  format(value:unknown):string {return JSON.stringify(value);}
  liveLink():string {return 'https://jagadeeshwaran-r.github.io/bytequest/?problem='+encodeURIComponent(this.problem()?.id||'two-sum');}
  ngOnDestroy():void {this.subscription.unsubscribe();}
}
