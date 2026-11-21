import {Component, inject, OnDestroy, signal} from '@angular/core';
import {RouterLink, ActivatedRoute} from '@angular/router';
import {Subscription} from 'rxjs';
import {CatalogService, type Problem} from '../../core/catalog.service';
import {EditorComponent} from '../editor/editor.component';
import {JavaGuestService} from '../../core/java-guest.service';

const STORAGE_PREFIX='bytequest.angular-preview.draft.java.';
@Component({
  selector:'bq-practice',
  imports:[RouterLink,EditorComponent],
  template:`
    <div class="workspace-top">
      <a routerLink="/angular" class="back-link">← All problems</a>
      @if(problem()){<span class="workspace-pill">Java · editor preview</span>}
    </div>
    @if(loading()) {
      <p class="load-status" role="status">Opening problem…</p>
    } @else if(!problem()){
      <div class="load-status error" role="alert">This problem was not found in the starter catalog. <a routerLink="/angular">Return to problems</a></div>
    } @else {
      <div class="workspace">
        <section class="statement" aria-label="Problem statement">
          <div class="statement-head"><p class="eyebrow">PROBLEM</p><h1>{{problem()!.title}}</h1>
            <span class="difficulty" [class]="problem()!.difficulty.toLowerCase()">{{problem()!.difficulty}}</span>
            <span class="topic-tag">{{problem()!.topic}}</span></div>
          <p class="description">{{problem()!.description}}</p>
          @if(problem()!.constraints){
            <h2>Constraints</h2><p class="subtle">{{problem()!.constraints}}</p>
          }
          <h2>Examples</h2>
          @for(example of problem()!.examples;track $index;let index=$index) {
            <div class="example">
              <strong>Example {{index+1}}</strong>
              <pre>Input: {{format(example.args)}}
Output: {{format(example.expected)}}</pre>
              @if(example.label){<p class="subtle">{{example.label}}</p>}
            </div>
          }
        </section>
        <section class="editor-pane" aria-label="Java editor">
          <div class="pane-header"><span class="file-name">Solution.java</span>
            <span class="helper">Draft saved only on this device</span></div>
          <bq-editor [value]="code()" (valueChange)="saveCode($event)" />
          <div class="editor-actions">
            <button class="primary-link action-button" type="button" [disabled]="running()" (click)="runGuest()">
              {{running() ? 'Running Java…' : 'Run public tests'}}
            </button>
            <span class="helper">{{guest.status()}}</span>
            <a class="secondary-link" [href]="liveLink()" target="_blank" rel="noopener noreferrer">
              Open live Submit ↗</a>
          </div>
          <div class="run-feedback" aria-live="polite">
            @if(resultError()){<p class="run-error">{{resultError()}}</p>}
            @if(result()){
              <div class="run-heading">{{result()!.status==='ok' ? 'Public test results' : 'Java '+result()!.status}}</div>
              @if(result()!.message){<p class="run-error">{{result()!.message}}</p>}
              @for(test of result()!.cases||[];track $index;let i=$index){
                <div class="run-case"><span [class.is-pass]="test.passed" [class.is-fail]="!test.passed">
                  {{test.passed ? '✓ Passed' : '× Failed'}}
                </span><span>{{test.label||('Test '+(i+1))}}</span></div>
              }
              @if(result()!.stdout){<pre class="run-stdout">{{result()!.stdout}}</pre>}
            }
            <p class="helper">Guest Run checks public cases only. It does not submit, unlock rankings, or increase your streak.</p>
          </div>
        </section>
      </div>
    }
  `
})
export class PracticeComponent implements OnDestroy {
  private readonly route=inject(ActivatedRoute);
  private readonly catalog=inject(CatalogService);
  readonly guest=inject(JavaGuestService);
  readonly running=signal(false);
  readonly result=signal<{status:string;cases?:readonly {passed:boolean;label?:string}[];stdout?:string;message?:string}|null>(null);
  readonly resultError=signal('');
  private readonly subscription:Subscription;
  readonly problem=signal<Problem|null>(null);
  readonly code=signal('');
  readonly loading=signal(true);

  constructor(){
    this.subscription=this.route.paramMap.subscribe(params=>{void this.select(params.get('id'));});
  }
  private async select(id:string|null):Promise<void>{
    this.loading.set(true);this.problem.set(null);this.result.set(null);this.resultError.set('');
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
