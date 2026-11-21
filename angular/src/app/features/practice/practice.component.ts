import {ChangeDetectionStrategy, Component, inject, OnDestroy, signal} from '@angular/core';
import {RouterLink, ActivatedRoute, Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {CatalogService, type Problem} from '../../core/catalog.service';
import {EditorComponent} from '../editor/editor.component';
import {SubmissionsComponent} from './submissions.component';
import {JavaGuestService} from '../../core/java-guest.service';
import {AuthService} from '../../core/auth.service';
import {VerifiedJavaService} from '../../core/verified-java.service';
import {ReadonlyApiService} from '../../core/readonly-api.service';
import type {SuiteScope,VerifiedVerdict} from '../../core/java-submission-contract';

const STORAGE_PREFIX='bytequest.angular-preview.draft.java.';
@Component({
  selector:'bq-practice',
  imports:[RouterLink,EditorComponent,SubmissionsComponent],
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
          <div class="learning-content native-learning-content" [class.submissions-content]="pane()==='submissions'">
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
              <bq-submissions [problemId]="problem()!.id" [revision]="problem()!.revision"
                [hiddenCount]="problem()!.hiddenCount" [refreshKey]="submissionRefresh()"
                [initialView]="submissionInitialView()"/>
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
              @if(!canVerify()){
                <p class="native-validation-note">Verified Submit is unavailable until an isolated test backend is configured. Guest Run does not increase points or streak.</p>
              }
            </div>
          </div>
          <!-- Keep submission feedback OUTSIDE the scrollable playground. The
               prior verdict was below five Run cases, so successful Submit
               looked like it never responded on a small laptop screen. -->
          @if(verifying() || verifiedVerdict() || verificationError()){
            <div class="native-submit-feedback"
              [class.is-accepted]="verifiedVerdict()?.accepted"
              [class.is-error]="!!verificationError() || (!!verifiedVerdict() && !verifiedVerdict()!.accepted)"
              role="status" aria-live="polite" aria-atomic="true">
              @if(verifying()){
                <strong>Checking your submission on the staging server…</strong>
                <span>This verifies published public cases, not private hidden tests.</span>
              } @else if(verificationError()){
                <strong>Submission was not confirmed</strong>
                <span role="alert">{{verificationError()}}</span>
              } @else if(verifiedVerdict()){
                <strong>{{verifiedVerdict()!.accepted
                  ? '✓ Accepted — '+(verifiedVerdict()!.scope==='public'?'public tests verified':'full suite verified')
                  : 'Submission not accepted'}}</strong>
                <span>{{verifiedVerdict()!.message}}</span>
                @if(verifiedVerdict()!.accepted){
                  <div class="native-result-links">
                    <button type="button" class="native-submission-history-link" (click)="openCommunity()">
                      View community rankings
                    </button>
                    <button type="button" class="native-submission-history-link" (click)="openPane('learn');readReference()">
                      View unlocked Java answer
                    </button>
                    <button type="button" class="native-submission-history-link" (click)="openPane('submissions')">
                      View saved submission
                    </button>
                  </div>
                }
              }
            </div>
          }
          <div class="runbar">
            <span class="native-run-status" role="status" aria-live="polite">
              <span class="runtime-dot"></span>
              @if(verifying()){
                Submitting to ByteQuest staging…
              } @else if(verificationError()){
                Submission failed — see message above
              } @else if(verifiedVerdict()){
                {{verifiedVerdict()!.accepted?'✓ Accepted on staging':'Not accepted — see message above'}}
              } @else {
                {{running()?'Running public tests…':result()?'Java public Run finished':(guest.status()||'Real Java. Right here.')}}
              }
            </span>
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
    .native-learning-content.submissions-content{padding:0!important}
    .native-practice .problem-pane{min-width:0}
    .native-editor-area{height:440px;min-height:300px;overflow:hidden}
    .native-editor-area bq-editor{display:block;height:100%;min-height:0}
    .native-result-line{display:flex;align-items:center;gap:14px;margin-top:8px}
    .native-validation-note{font-size:11px;opacity:.75}
    .native-practice .runbar .button{min-width:86px}
    .native-submit-feedback{display:flex;flex-direction:column;gap:5px;padding:12px 18px;
      border-top:1px solid var(--line);background:var(--panel-2);color:var(--text);
      font-size:12px;line-height:1.5;max-height:168px;overflow:auto;flex-shrink:0}
    .native-submit-feedback strong{font-size:12px;font-weight:700;color:var(--text)}
    .native-submit-feedback.is-accepted{border-left:3px solid var(--accent)}
    .native-submit-feedback.is-accepted strong{color:var(--accent)}
    .native-submit-feedback.is-error{border-left:3px solid #e57979}
    .native-submit-feedback.is-error strong{color:#e57979}
    .native-submit-feedback span{overflow-wrap:anywhere}
    .native-result-links{display:flex;flex-wrap:wrap;gap:9px;align-items:center}
    .native-submission-history-link{align-self:flex-start;border:0;background:transparent;
      color:var(--accent);font-weight:600;font-size:11px;text-decoration:underline;padding:3px 0}
    .native-practice .runbar .native-run-status{min-width:0;overflow-wrap:anywhere}
    /* When a verdict appears, let the test playground shrink rather than
       clipping the new result banner or the Submit buttons below it. */
    :host .native-practice .editor-pane .test-panel{
      flex:1 1 105px!important;min-height:105px!important;max-height:none!important;overflow:auto
    }
    .native-practice .editor-pane .native-editor-area{flex-shrink:1}
    .native-practice .editor-pane .runbar{flex-shrink:0}

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
  readonly submissionRefresh=signal(0);
  readonly submissionInitialView=signal<'mine'|'community'>('mine');
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
    this.referenceCode.set('');this.referenceError.set('');
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
        if(verdict.accepted)this.submissionRefresh.update(value=>value+1);
      }else{
        this.verificationError.set('The active problem, account or solution changed. Refresh your submission history.');
      }
    }catch(error){
      if(this.problem()?.id===id)this.verificationError.set(error instanceof Error?error.message:'Server verification failed.');
    }finally{this.verifying.set(false);}
  }
  openPane(pane:'problem'|'learn'|'visual'|'submissions'):void{
    if(pane==='submissions')this.submissionInitialView.set('mine');
    this.pane.set(pane);
  }
  openCommunity():void{
    this.submissionInitialView.set('community');
    this.pane.set('submissions');
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
    if(value!==this.code()){
      // Never display acceptance for an edited, unverified draft.
      this.verifiedVerdict.set(null);
      if(!this.verifying())this.verificationError.set('');
    }
    this.code.set(value);
    try{localStorage.setItem(STORAGE_PREFIX+id,value);}catch{ /* Editing must still work with blocked or full storage. */ }
  }
  format(value:unknown):string {return JSON.stringify(value);}
  liveLink():string {return 'https://jagadeeshwaran-r.github.io/bytequest/?problem='+encodeURIComponent(this.problem()?.id||'two-sum');}
  ngOnDestroy():void {this.subscription.unsubscribe();}
}
