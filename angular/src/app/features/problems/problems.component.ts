import {ChangeDetectionStrategy, Component, computed, inject, OnInit, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {CatalogService, type Problem} from '../../core/catalog.service';
import {CatalogViewState,type CatalogLevel} from '../../core/catalog-view-state.service';

const points:Record<string,number>={Easy:10,Medium:25,Hard:50};
@Component({
 selector:'bq-problems',imports:[RouterLink],
 changeDetection:ChangeDetectionStrategy.OnPush,
 template:`
 <section id="mapView" class="view native-catalog">
   <div class="section-heading">
     <div><span class="eyebrow">PRACTICE &amp; PROGRESS</span>
       <h2>Problem library</h2>
       <p>Choose a challenge. Build your problem-solving skills.</p>
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
         <input aria-label="Search problems" autocomplete="off"
           placeholder="Search problems or numbers… ( / )"
           [value]="view.query()" (input)="search($event)" />
       </label>
       @if(view.query()){
         <button type="button" class="catalog-refresh" aria-label="Clear search"
           (click)="view.query.set('')">Clear</button>
       }
     </div>
     <select aria-label="Filter by difficulty" [value]="view.difficulty()" (change)="level($event)">
       <option value="">All levels</option>
       <option value="Easy">Easy</option>
       <option value="Medium">Medium</option>
       <option value="Hard">Hard</option>
     </select>
     <select aria-label="Filter by completion" [value]="view.completion()" (change)="completion($event)">
       <option value="all">All problems</option>
       <option value="solved">Solved</option>
       <option value="new">To explore</option>
     </select>
   </div>
   <div class="catalog-meta">
     <span role="status" aria-live="polite">{{filtered().length===problems().length
       ?'Showing all '+problems().length+' problems'
       :'Showing '+filtered().length+' of '+problems().length+' problems'}}</span>
     <span class="catalog-sync-status">{{loading()?'Loading problem catalog…':catalog.snapshot()?'Offline starter catalog':'Published test library'}}</span>
     <button type="button" class="catalog-refresh" (click)="refresh()" [disabled]="loading()">Refresh</button>
     <span class="catalog-meta-hint">Select a problem to open the editor</span>
   </div>
   @if(catalog.snapshot()&&!loading()){
     <p class="company-note" role="status">The isolated staging database is not connected. These are bundled starter problems, not the full ByteQuest library.</p>
   }
   @if(error()){
     <p class="empty-state" role="alert">{{error()}}</p>
   }@else if(loading()){
     <p class="empty-state" role="status">Loading public problems…</p>
   }@else{
     <div class="quest-grid">
       <table class="problem-table">
         <thead><tr>
           <th>No.</th><th>Title</th><th>Companies</th><th>Difficulty</th><th>Status</th>
         </tr></thead>
         <tbody>
           @for(problem of filtered();track problem.id){
             <tr>
               <td>{{numberOf(problem.id)}}</td>
               <td><a class="problem-title" [routerLink]="['/angular/problem',problem.id]">{{problem.title}}</a></td>
               <td><span class="muted">—</span></td>
               <td><span class="difficulty" [class]="problem.difficulty.toLowerCase()">{{problem.difficulty}}</span>
                 <small class="problem-points">{{points[problem.difficulty]}} pts</small></td>
               <td><span class="muted" title="Sign-in is required to verify solved status">—</span></td>
             </tr>
           }@empty{
             <tr><td colspan="5"><p class="empty-state">No matching problems.</p></td></tr>
           }
         </tbody>
       </table>
       <p class="company-note">Company associations and solved status will appear when the authenticated staging API is connected.</p>
     </div>
   }
 </section>
 `,
 styles:[`
   :host{display:block;min-height:60vh}
   .native-catalog{display:block!important}
   .native-catalog .problem-title{color:inherit;text-decoration:none;cursor:pointer}
   .native-catalog .problem-title:hover{color:var(--accent)}
   .native-catalog .catalog-refresh:disabled{opacity:.5;cursor:progress}
   .native-catalog .quest-grid{min-height:130px}
   .native-catalog .catalog-search-wrap{display:flex;align-items:center;gap:8px}
   @media(max-width:650px){.native-catalog .section-heading{flex-wrap:wrap}}
 `]
})
export class ProblemsComponent implements OnInit {
 readonly catalog=inject(CatalogService);
 readonly view=inject(CatalogViewState);
 readonly loading=signal(true);
 readonly error=signal('');
 readonly problems=signal<readonly Problem[]>([]);
 readonly points=points;
 readonly topicCount=computed(()=>new Set(this.problems().map(p=>p.topic)).size);
 readonly filtered=computed(()=>{
   const query=this.view.query().trim().toLowerCase();
   const difficulty=this.view.difficulty();
   const completion=this.view.completion();
   // Unknown solved status is not interpreted as "unsolved".
   return this.problems().filter((problem,index)=>
     (!query||problem.title.toLowerCase().includes(query)||String(index+1).includes(query))
     &&(!difficulty||problem.difficulty===difficulty)
     &&completion==='all');
 });
 ngOnInit():void{void this.refresh();}
 async refresh():Promise<void>{
   this.loading.set(true);this.error.set('');
   try{this.problems.set(await this.catalog.all());}
   catch{this.error.set('Problem library unavailable. Try again.');}
   finally{this.loading.set(false);}
 }
 numberOf(id:string):string{
   const index=this.problems().findIndex(x=>x.id===id)+1;
   return String(index).padStart(2,'0');
 }
 search(event:Event):void{this.view.query.set((event.target as HTMLInputElement).value)}
 level(event:Event):void{this.view.difficulty.set((event.target as HTMLSelectElement).value as CatalogLevel)}
 completion(event:Event):void{this.view.completion.set((event.target as HTMLSelectElement).value as 'all'|'solved'|'new')}
}
