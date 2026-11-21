import {ChangeDetectionStrategy,Component,inject,OnInit,signal} from '@angular/core';
import {AuthService} from '../../core/auth.service';
import {StagingActionService} from '../../core/staging-action.service';
import {JavaGuestService} from '../../core/java-guest.service';
import {type Problem} from '../../core/catalog.service';
import {sampleCreatorDraft,draftFromRaw,creatorWritePayload,type JavaCreatorDraft} from '../../core/creator-contract';
interface StudioRow{
 readonly id:string;readonly content:Record<string,unknown>;readonly revision:number;
 readonly published:boolean;readonly position:number;readonly hiddenTests?:unknown[];
}
type Field='title'|'id'|'topic'|'method'|'returns'|'description'|'constraints'|'starter'|
 'reference'|'idea'|'invariant'|'correction';
@Component({
 selector:'bq-native-studio',changeDetection:ChangeDetectionStrategy.OnPush,
 template:`
<section class="native-studio">
 <div class="section-heading"><div><span class="eyebrow">CREATE &amp; SHARE</span><h2>Problem studio.</h2>
 <p>Create a challenge, check its Java solution, then publish it to the library.</p></div>
 <button type="button" class="button primary" (click)="fresh()">+ New problem</button></div>
 @if(!auth.user()){
  <div class="white-card studio-access-panel"><h3>Connect your ByteQuest account</h3>
  <p>Sign in to manage your own challenges.</p><button type="button" class="button primary" (click)="auth.signIn()">Continue with Google</button></div>
 }@else{
  @if(error()){<p role="alert" class="studio-message">{{error()}}</p>}
  @if(success()){<p role="status" class="studio-message">{{success()}}</p>}
  <div class="studio-toolbar"><label>Choose problem
   <select aria-label="Existing problems" [value]="selectedId()" (change)="choose($event)">
    <option value="">New challenge</option>
    @for(row of rows();track row.id){<option [value]="row.id">{{row.content['title']||row.id}}</option>}
   </select></label>
   <button type="button" class="button secondary" (click)="reload()" [disabled]="loading()">Refresh</button>
   <button type="button" class="button secondary" (click)="exportDraft()">Export JSON</button>
  </div>
  @if(loading()){<p role="status">Loading your challenges…</p>}
  <form class="studio-editor" (submit)="save($event)">
   <div class="studio-grid">
    <label>Title<input maxlength="100" required [value]="draft().title" (input)="field('title',$event)"/></label>
    <label>Problem ID<input maxlength="64" required [readOnly]="!!selectedId()" [value]="draft().id" (input)="field('id',$event)"/></label>
    <label>Topic<input maxlength="60" required [value]="draft().topic" (input)="field('topic',$event)"/></label>
    <label>Difficulty<select [value]="draft().difficulty" (change)="difficulty($event)">
     <option>Easy</option><option>Medium</option><option>Hard</option></select></label>
    <label>Java method<input required [value]="draft().method" (input)="field('method',$event)"/></label>
    <label>Return type<select [value]="draft().returns" (change)="field('returns',$event)">
      <option>int</option><option>int[]</option><option>int[][]</option><option>boolean</option><option>String</option><option>ListNode</option></select></label>
    <label>Library position<input type="number" min="0" max="1000000" [value]="draft().position" (input)="position($event)"/></label>
    <label class="native-publish-checkbox">Published<input type="checkbox" [checked]="draft().published" (change)="published($event)"/></label>
   </div>
   <label>Description<textarea rows="5" required [value]="draft().description" (input)="field('description',$event)"></textarea></label>
   <label>Constraints<textarea rows="2" [value]="draft().constraints" (input)="field('constraints',$event)"></textarea></label>
   <label>Java parameters (JSON array)<textarea rows="3" spellcheck="false" [value]="paramsJson()" (input)="jsonField('params',$event)"></textarea></label>
   <label>Starter Java<textarea rows="7" class="studio-java" spellcheck="false" [value]="draft().starter" (input)="field('starter',$event)"></textarea></label>
   <label>Reference Java<textarea rows="9" class="studio-java" spellcheck="false" [value]="draft().reference" (input)="field('reference',$event)"></textarea></label>
   <div class="studio-grid">
    <label>Published test cases (JSON)<textarea rows="8" spellcheck="false" [value]="testsJson()" (input)="jsonField('tests',$event)"></textarea></label>
    <label>Hidden test cases (JSON)<textarea rows="8" spellcheck="false" [value]="hiddenJson()" (input)="jsonField('hiddenTests',$event)"></textarea></label>
   </div>
   <label>Approach<textarea rows="3" [value]="draft().idea" (input)="field('idea',$event)"></textarea></label>
   <label>Invariant<textarea rows="3" [value]="draft().invariant" (input)="field('invariant',$event)"></textarea></label>
   <div class="studio-grid">
    <label>Time complexity<input [value]="draft().complexity.time" (input)="complexity('time',$event)"/></label>
    <label>Space complexity<input [value]="draft().complexity.space" (input)="complexity('space',$event)"/></label>
   </div>
   <label>Trade-off<textarea rows="2" [value]="draft().complexity.tradeoff" (input)="complexity('tradeoff',$event)"></textarea></label>
   <label>Hints (JSON array)<textarea rows="3" spellcheck="false" [value]="hintsJson()" (input)="jsonField('hints',$event)"></textarea></label>
   @if(draft().revision>0){<label>Correction note<input maxlength="1000" [value]="draft().correction" (input)="field('correction',$event)"/></label>}
   <div class="studio-controls">
    <button type="button" class="button secondary" [disabled]="running()" (click)="validate()">{{running()?'Checking Java…':'Run reference tests'}}</button>
    <button type="submit" class="button primary" [disabled]="running()||saving()||!canWrite()||(draft().published&&!validated())">
      {{saving()?'Saving…':draft().published?'Publish problem':'Save draft'}}</button>
   </div>
   @if(validationMessage()){<p role="status" class="studio-message">{{validationMessage()}}</p>}
   @if(!canWrite()){<p class="studio-message">The Java validator and JSON export work locally.
      Server saves require a separate staging backend. Production remains unchanged.</p>}
  </form>
 }
</section>
`,styles:[`
:host{display:block}
.native-studio{max-width:1130px;margin:0 auto;padding:15px 18px 70px}
.studio-editor{display:grid;gap:15px}
.studio-editor label,.studio-toolbar label{display:grid;gap:6px;font-size:12px}
.studio-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.studio-editor input:not([type=checkbox]),.studio-editor textarea,.studio-editor select,.studio-toolbar select{
 border:1px solid var(--border,#344);border-radius:8px;background:var(--surface,#152318);
 color:var(--text);padding:10px;width:100%;font:inherit}
.studio-editor textarea.studio-java{font:12px/1.7 'JetBrains Mono',monospace}
.studio-toolbar{display:flex;align-items:flex-end;gap:10px;margin:22px 0}
.studio-controls{display:flex;justify-content:flex-end;gap:12px}
.studio-message{font-size:12px;line-height:1.5;color:var(--muted)}
.native-studio button:disabled{opacity:.45}
.studio-editor label.native-publish-checkbox{display:flex;align-items:center;justify-content:space-between}
@media(max-width:730px){.studio-grid{grid-template-columns:1fr}}
`]
})

export class StudioComponent implements OnInit{
 readonly auth=inject(AuthService);
 private readonly api=inject(StagingActionService);
 private readonly java=inject(JavaGuestService);
 readonly draft=signal<JavaCreatorDraft>({...sampleCreatorDraft});
 readonly paramsJson=signal(JSON.stringify(sampleCreatorDraft.params,null,2));
 readonly testsJson=signal(JSON.stringify(sampleCreatorDraft.tests,null,2));
 readonly hiddenJson=signal(JSON.stringify(sampleCreatorDraft.hiddenTests,null,2));
 readonly hintsJson=signal(JSON.stringify(sampleCreatorDraft.hints,null,2));
 readonly rows=signal<readonly StudioRow[]>([]);
 readonly selectedId=signal('');
 readonly loading=signal(false);
 readonly saving=signal(false);
 readonly running=signal(false);
 readonly canWrite=signal(false);
 readonly validated=signal(false);
 readonly validationMessage=signal('');
 readonly error=signal('');
 readonly success=signal('');
 private validatedFingerprint='';
 ngOnInit():void{
  void this.api.canWrite().then(enabled=>this.canWrite.set(enabled));
  if(this.auth.user())void this.reload();
 }
 async reload():Promise<void>{
  if(!this.auth.user())return;
  this.loading.set(true);this.error.set('');
  try{
   const owner=this.auth.user()?.id;
   const response=await this.api.read<{problems?:StudioRow[]}>('studio-list');
   if(this.auth.user()?.id===owner)this.rows.set(response.problems||[]);
  }catch(error){this.error.set(error instanceof Error?error.message:'Unable to load Creator Studio.');}
  finally{this.loading.set(false);}
 }
 fresh():void{this.selectedId.set('');this.apply({...sampleCreatorDraft});this.error.set('');}
 choose(event:Event):void{
  const id=(event.target as HTMLSelectElement).value;
  const item=this.rows().find(row=>row.id===id);
  this.selectedId.set(item?.id||'');
  if(!item){this.fresh();return;}
  this.apply({...sampleCreatorDraft,...item.content,id:item.id,position:item.position,
   revision:item.revision,published:item.published,hiddenTests:item.hiddenTests||[],
   correction:''} as JavaCreatorDraft);
 }
 private apply(value:JavaCreatorDraft):void{
  this.draft.set(value);
  this.paramsJson.set(JSON.stringify(value.params,null,2));
  this.testsJson.set(JSON.stringify(value.tests,null,2));
  this.hiddenJson.set(JSON.stringify(value.hiddenTests,null,2));
  this.hintsJson.set(JSON.stringify(value.hints,null,2));
  this.invalidate();
 }
 private invalidate():void{
  this.validated.set(false);this.validatedFingerprint='';
  this.validationMessage.set('');this.success.set('');
 }
 field(key:Field,event:Event):void{
  this.draft.update(old=>({...old,[key]:(event.target as HTMLInputElement).value}));
  this.invalidate();
 }
 jsonField(key:'params'|'tests'|'hiddenTests'|'hints',event:Event):void{
  const value=(event.target as HTMLTextAreaElement).value;
  if(key==='params')this.paramsJson.set(value);
  if(key==='tests')this.testsJson.set(value);
  if(key==='hiddenTests')this.hiddenJson.set(value);
  if(key==='hints')this.hintsJson.set(value);
  this.invalidate();
 }
 difficulty(event:Event):void{
  this.draft.update(old=>({...old,difficulty:(event.target as HTMLSelectElement).value as JavaCreatorDraft['difficulty']}));
  this.invalidate();
 }
 position(event:Event):void{
  this.draft.update(old=>({...old,position:Number((event.target as HTMLInputElement).value)}));
  this.invalidate();
 }
 published(event:Event):void{
  this.draft.update(old=>({...old,published:(event.target as HTMLInputElement).checked}));
  this.invalidate();
 }
 complexity(key:'time'|'space'|'tradeoff',event:Event):void{
  const value=(event.target as HTMLInputElement).value;
  this.draft.update(old=>({...old,complexity:{...old.complexity,[key]:value}}));
  this.invalidate();
 }
 private parse():JavaCreatorDraft{
  const asJson=(value:string,name:string):unknown=>{
   try{return JSON.parse(value) as unknown;}catch{throw new Error('Invalid JSON in '+name+'.');}
  };
  return draftFromRaw({...this.draft(),
   params:asJson(this.paramsJson(),'Java parameters'),tests:asJson(this.testsJson(),'public tests'),
   hiddenTests:asJson(this.hiddenJson(),'hidden tests'),hints:asJson(this.hintsJson(),'hints')});
 }
 private async normalize(draft:JavaCreatorDraft):Promise<JavaCreatorDraft>{
  const modulePath=new URL('legacy/catalog.js',document.baseURI).href;
  const mod:unknown=await import(/* @vite-ignore */ modulePath);
  const validateProblem=(mod as {validateProblem?:(problem:unknown)=>unknown}).validateProblem;
  if(typeof validateProblem!=='function')throw new Error('ByteQuest creator validator is unavailable.');
  const {hiddenTests,published,position,revision,correction,...raw}=draft;
  const validated=validateProblem(raw) as Record<string,unknown>;
  return {...draft,...validated,hiddenTests,published,position,revision,correction} as JavaCreatorDraft;
 }
 async validate():Promise<void>{
  if(this.running())return;
  this.running.set(true);this.error.set('');this.validated.set(false);
  this.validationMessage.set('Checking public and hidden cases in Java 17…');
  try{
   const draft=await this.normalize(this.parse());
   const cases=[...draft.tests,...draft.hiddenTests];
   const result=await this.java.run(draft.reference,{
    ...draft,tests:cases,examples:cases.slice(0,2),normalize:''
   } as unknown as Problem);
   if(result.status!=='ok'||result.cases?.length!==cases.length
      ||result.cases.some(test=>!test.passed))
    throw new Error(result.message||'The reference Java solution failed some tests.');
   this.validatedFingerprint=JSON.stringify({draft,hidden:draft.hiddenTests});
   this.validated.set(true);
   this.validationMessage.set('✓ '+cases.length+' Java cases passed. Ready to publish.');
  }catch(error){this.error.set(error instanceof Error?error.message:'Java verification failed.');}
  finally{this.running.set(false);}
 }
 async save(event:Event):Promise<void>{
  event.preventDefault();
  if(this.saving()||!this.canWrite())return;
  this.saving.set(true);this.error.set('');this.success.set('');
  const owner=this.auth.user()?.id;
  try{
   const draft=await this.normalize(this.parse());
   if(draft.published&&(!this.validated()||
      this.validatedFingerprint!==JSON.stringify({draft,hidden:draft.hiddenTests})))
     throw new Error('Run Java verification for this version before publishing.');
   if(draft.published&&draft.revision>0&&!draft.correction.trim())
     throw new Error('Describe the correction before publishing a new revision.');
   const body=creatorWritePayload(draft);
   await this.api.write('studio-save',body);
   if(this.auth.user()?.id!==owner)return;
   this.success.set(draft.published?'Published to isolated staging.':'Saved to isolated staging.');
   await this.reload();
  }catch(error){this.error.set(error instanceof Error?error.message:'Could not save problem.');}
  finally{this.saving.set(false);}
 }
 exportDraft():void{
  try{
   const draft=this.parse();
   const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}));
   const link=document.createElement('a');link.href=url;link.download=draft.id+'.json';
   link.click();setTimeout(()=>URL.revokeObjectURL(url),0);
  }catch(error){this.error.set(error instanceof Error?error.message:'Could not export problem.');}
 }
}
