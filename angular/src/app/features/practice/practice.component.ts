import {Component, inject, OnDestroy, signal} from '@angular/core';
import {RouterLink, ActivatedRoute} from '@angular/router';
import {Subscription} from 'rxjs';
import {CatalogService, type Problem} from '../../core/catalog.service';
import {EditorComponent} from '../editor/editor.component';

const STORAGE_PREFIX='bytequest.angular-preview.draft.java.';
@Component({
  selector:'bq-practice',
  imports:[RouterLink,EditorComponent],
  template:`
    <div class="workspace-top">
      <a routerLink="/" class="back-link">← All problems</a>
      @if(problem()){<span class="workspace-pill">Java · editor preview</span>}
    </div>
    @if(loading()) {
      <p class="load-status" role="status">Opening problem…</p>
    } @else if(!problem()){
      <div class="load-status error" role="alert">This problem was not found in the starter catalog. <a routerLink="/">Return to problems</a></div>
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
            <span class="helper">Compile, Run, Submit and progress remain on the live site.</span>
            <a class="primary-link" [href]="liveLink()" target="_blank" rel="noopener noreferrer">
              Open in live ByteQuest ↗</a>
          </div>
        </section>
      </div>
    }
  `
})
export class PracticeComponent implements OnDestroy {
  private readonly route=inject(ActivatedRoute);
  private readonly catalog=inject(CatalogService);
  private readonly subscription:Subscription;
  readonly problem=signal<Problem|null>(null);
  readonly code=signal('');
  readonly loading=signal(true);

  constructor(){
    this.subscription=this.route.paramMap.subscribe(params=>{void this.select(params.get('id'));});
  }
  private async select(id:string|null):Promise<void>{
    this.loading.set(true);this.problem.set(null);
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
