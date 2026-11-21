import {ChangeDetectionStrategy,Component,computed,effect,inject,OnDestroy,OnInit,signal,untracked} from '@angular/core';
import {RouterLink} from '@angular/router';
import {AuthService} from '../../core/auth.service';
import {ReadonlyApiService} from '../../core/readonly-api.service';
import {CatalogService,type Problem} from '../../core/catalog.service';
import {CatalogViewState,type CatalogLevel} from '../../core/catalog-view-state.service';
import {companyLogo} from './company-logos';
const points:Record<string,number>={Easy:10,Medium:25,Hard:50};
interface StagingProgress{readonly payload?:{readonly solved?:Readonly<Record<string,unknown>>}}
interface StagingSelf{readonly profile?:{readonly username?:string}|null}
@Component({
 selector:'bq-problems',imports:[RouterLink],
 changeDetection:ChangeDetectionStrategy.OnPush,
 styleUrl:'./problems.component.css',
 template:`
<section id="mapView" class="view native-catalog" aria-label="Problem library">
  <div class="section-heading">
    <div><span class="eyebrow">PRACTICE &amp; PROGRESS</span>
      <h2>Problem library</h2><p>Choose a challenge. Build your problem-solving skills.</p>
    </div>
    <span class="soft-pill">{{problems().length}} problems · {{topicCount()}} topics</span>
  </div>
  <div class="filters" role="search" aria-label="Filter problems">
    <div class="catalog-search-wrap">
      <label class="search-box">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.8" cy="10.8" r="6.7" fill="none" stroke="currentColor" stroke-width="1.7"/>
          <path d="m16 16 5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
        </svg>
        <input aria-label="Search problems" autocomplete="off" placeholder="Search problems or numbers… ( / )"
          [value]="view.query()" (input)="search($event)"/>
      </label>
      @if(view.query()){
        <button type="button" class="catalog-refresh" aria-label="Clear search" (click)="view.query.set('')">Clear</button>
      }
    </div>
    <select aria-label="Filter by difficulty" [value]="view.difficulty()" (change)="level($event)">
      <option value="">All levels</option><option value="Easy">Easy</option>
      <option value="Medium">Medium</option><option value="Hard">Hard</option>
    </select>
    <select aria-label="Filter by completion" [value]="view.completion()" (change)="completion($event)">
      <option value="all">All problems</option><option value="solved">Solved</option><option value="new">To explore</option>
    </select>
  </div>
  <div class="catalog-meta">
    <span role="status" aria-live="polite">{{filtered().length===problems().length
      ?'Showing all '+problems().length+' problems'
      :'Showing '+filtered().length+' of '+problems().length+' problems'}}</span>
    <span class="catalog-sync-status" [attr.data-state]="error()?'error':loading()?'loading':'ready'">
      {{loading()?'Loading problem catalog…':catalog.snapshot()?'Bundled starter catalog':'Published catalog updated'}}
    </span>
    @if(auth.user()){
      <span class="catalog-user-progress">
        Account &#64;{{username()||'learner'}}
        @if(progressReady()){ · {{solvedCount()}} cloud-recorded solves}
        @else if(progressLoading()){ · checking progress…}
        @else { · progress unavailable}
      </span>
    } @else {<span class="catalog-user-progress">Sign in to see solved problems</span>}
    <button type="button" class="catalog-refresh" (click)="refresh()" [disabled]="loading()||progressLoading()">Refresh</button>
    <span class="catalog-meta-hint">Select a problem to open the editor</span>
  </div>
  @if(catalog.snapshot()&&!loading()){
    <p class="company-note" role="status">The staging catalog is unavailable. Showing bundled public starter problems.</p>
  }
  @if(progressError()&&auth.user()) {<p class="catalog-progress-error" role="status">{{progressError()}}</p>}
  @if(error()) {<p class="empty-state" role="alert">{{error()}}</p>}
  @else if(loading()) {<p class="empty-state" role="status">Loading public problems…</p>}
  @else {
    <div class="quest-grid">
      <table class="problem-table">
        <thead><tr>
          <th scope="col">No.</th><th scope="col">Title</th><th scope="col">Companies</th>
          <th scope="col">Difficulty</th><th scope="col">Status</th>
        </tr></thead>
        <tbody>
          @for(problem of filtered();track problem.id){
            <tr [class.is-solved-row]="progressReady()&&solved().has(problem.id)">
              <td class="catalog-number">{{numberOf(problem.id)}}</td>
              <td><a class="problem-title" [class.is-solved]="progressReady()&&solved().has(problem.id)"
                [routerLink]="['/angular/problem',problem.id]">{{problem.title}}</a></td>
              <td>
                <div class="native-company-list">
                  @for(company of (problem.companies||[]).slice(0,3);track company){
                    <span class="company-logo" [title]="company" [attr.aria-label]="company+' company tag'" role="img">
                      @if(logoFor(company);as logo){<img [src]="logo" alt="" loading="lazy"/>}
                      @else{<span class="company-unknown">{{company.slice(0,1).toUpperCase()}}</span>}
                    </span>
                  }
                  @if((problem.companies?.length||0)>3){
                    <span class="company-overflow" tabindex="0">
                      <button type="button" class="company-overflow-count"
                        [attr.aria-label]="(problem.companies!.length-3)+' additional company tags'">
                        +{{problem.companies!.length-3}}
                      </button>
                      <span class="company-overflow-panel" role="group" aria-label="Additional company tags">
                        @for(company of problem.companies!.slice(3);track company){
                          <span class="company-logo" [title]="company" [attr.aria-label]="company+' company tag'" role="img">
                            @if(logoFor(company);as logo){<img [src]="logo" alt="" loading="lazy"/>}
                            @else{<span class="company-unknown">{{company.slice(0,1).toUpperCase()}}</span>}
                          </span>
                        }
                      </span>
                    </span>
                  }
                  @if(!problem.companies?.length){<span class="muted catalog-no-company">—</span>}
                </div>
              </td>
              <td><span class="difficulty" [class]="problem.difficulty.toLowerCase()">{{problem.difficulty}}</span>
                <small class="problem-points">{{points[problem.difficulty]}} pts</small></td>
              <td>
                @if(progressReady()){
                  @if(solved().has(problem.id)){
                    <span class="problem-status catalog-solved"><span aria-hidden="true">✓</span> Solved</span>
                  }@else{<span class="problem-status catalog-unsolved">Unsolved</span>}
                }@else{<span class="problem-status catalog-unknown"
                  [title]="auth.user()?'Cloud progress unavailable':'Sign in to view solved status'">—</span>}
              </td>
            </tr>
          }@empty{
            <tr><td colspan="5"><p class="empty-state">
              {{view.completion()!=='all'&&!progressReady()
                ?'Sign in and load cloud progress to filter solved challenges.':'No matching problems.'}}
            </p></td></tr>
          }
        </tbody>
      </table>
    </div>
  }
</section>
`
})

export class ProblemsComponent implements OnInit,OnDestroy{
 readonly auth=inject(AuthService);
 readonly catalog=inject(CatalogService);
 readonly view=inject(CatalogViewState);
 private readonly api=inject(ReadonlyApiService);
 readonly loading=signal(true);
 readonly error=signal('');
 readonly problems=signal<readonly Problem[]>([]);
 readonly points=points;
 readonly solved=signal<ReadonlySet<string>>(new Set());
 readonly progressReady=signal(false);
 readonly progressLoading=signal(false);
 readonly progressError=signal('');
 readonly username=signal('');
 readonly topicCount=computed(()=>new Set(this.problems().map(p=>p.topic).filter(Boolean)).size);
 readonly solvedCount=computed(()=>this.problems().filter(p=>this.solved().has(p.id)).length);
 readonly filtered=computed(()=>{
   const query=this.view.query().trim().toLowerCase(),difficulty=this.view.difficulty();
   const completion=this.view.completion(),solved=this.solved(),ready=this.progressReady();
   return this.problems().filter((problem,index)=>
     (!query||problem.title.toLowerCase().includes(query)||String(index+1).includes(query))
     &&(!difficulty||problem.difficulty===difficulty)
     &&(completion==='all'||ready&&(completion==='solved'?solved.has(problem.id):!solved.has(problem.id))));
 });
 private generation=0;
 private destroyed=false;
 constructor(){
   effect(()=>{
     const owner=this.auth.user()?.id;
     untracked(()=>{
       if(!owner){
         ++this.generation;this.progressReady.set(false);this.progressLoading.set(false);
         this.solved.set(new Set());this.username.set('');this.progressError.set('');
       }else void this.refreshProgress(owner);
     });
   });
 }
 ngOnInit():void{void this.refreshCatalog();}
 async refresh():Promise<void>{
   const owner=this.auth.user()?.id;
   await Promise.all([this.refreshCatalog(),owner?this.refreshProgress(owner):Promise.resolve()]);
 }
 private async refreshCatalog():Promise<void>{
   this.loading.set(true);this.error.set('');
   try{this.problems.set(await this.catalog.all());}
   catch{this.error.set('Problem library unavailable. Try again.');}
   finally{this.loading.set(false);}
 }
 private async refreshProgress(owner:string):Promise<void>{
   const ticket=++this.generation;
   this.progressReady.set(false);this.progressLoading.set(true);this.progressError.set('');
   try{
     const [progress,self]=await Promise.allSettled([
       this.api.request<StagingProgress>('progress'),this.api.request<StagingSelf>('self')
     ]);
     if(this.destroyed||ticket!==this.generation||this.auth.user()?.id!==owner)return;
     if(self.status==='fulfilled')this.username.set(self.value.profile?.username||'learner');
     if(progress.status!=='fulfilled')throw progress.reason;
     const values=progress.value.payload?.solved;
     if(!values||typeof values!=='object'||Array.isArray(values))throw new Error('Cloud progress has an invalid format.');
     const now=Date.now();
     const validIds=Object.entries(values)
       .filter(([key,value])=>typeof key==='string'&&typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=now)
       .map(([key])=>key);
     this.solved.set(new Set(validIds));this.progressReady.set(true);
   }catch(error){
     if(ticket===this.generation&&this.auth.user()?.id===owner){
       this.solved.set(new Set());this.progressReady.set(false);
       this.progressError.set(error instanceof Error?error.message:'Unable to read staging progress.');
     }
   }finally{if(ticket===this.generation)this.progressLoading.set(false);}
 }
 logoFor(company:string):string|null{return companyLogo(company);}
 numberOf(id:string):string{
   const index=this.problems().findIndex(p=>p.id===id)+1;
   return index>0?String(index).padStart(2,'0'):'—';
 }
 search(event:Event):void{this.view.query.set((event.target as HTMLInputElement).value);}
 level(event:Event):void{this.view.difficulty.set((event.target as HTMLSelectElement).value as CatalogLevel);}
 completion(event:Event):void{this.view.completion.set((event.target as HTMLSelectElement).value as 'all'|'solved'|'new');}
 ngOnDestroy():void{this.destroyed=true;++this.generation;}
}
