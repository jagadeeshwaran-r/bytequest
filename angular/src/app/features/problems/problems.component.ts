import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {CatalogService, type Problem} from '../../core/catalog.service';

@Component({
  selector:'bq-problems',
  imports:[RouterLink],
  template:`
    <section class="page-title">
      <div><p class="eyebrow">PRACTICE LIBRARY</p><h1>Problems</h1>
        <p class="subtle">Start with patterns. Build deliberate, repeatable problem-solving skills.</p></div>
      <div class="page-count">{{filtered().length}} <span>/ {{problems().length}} published starters</span></div>
    </section>
    <div class="table-tools">
      <label class="search-control"><span class="sr-only">Search problems</span>
        <input type="search" placeholder="Search title or topic" [value]="query()" (input)="updateQuery($event)" />
      </label>
      <span class="helper">Preview catalog · live database migration comes next</span>
    </div>
    @if(loading()){
      <p class="load-status" role="status">Loading public problems…</p>
    } @else if(error()){
      <div class="load-status error" role="alert">{{error()}}</div>
    } @else {
      <div class="table-wrap">
        <table class="problem-table">
          <thead><tr><th>№</th><th>Problem</th><th>Difficulty</th><th>Topic</th><th></th></tr></thead>
          <tbody>
            @for(problem of filtered(); track problem.id; let i=$index){
              <tr>
                <td class="muted-cell">{{i+1}}</td>
                <td><a class="problem-name" [routerLink]="['/angular/problem',problem.id]">{{problem.title}}</a></td>
                <td><span class="difficulty" [class]="problem.difficulty.toLowerCase()">{{problem.difficulty}}</span></td>
                <td class="muted-cell">{{problem.topic}}</td>
                <td class="open-cell"><a [routerLink]="['/angular/problem',problem.id]" [attr.aria-label]="'Open '+problem.title">↗</a></td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="empty-row">No problems match your search.</td></tr>
            }
          </tbody>
        </table>
      </div>
    }
  `
})
export class ProblemsComponent implements OnInit {
  private readonly catalog=inject(CatalogService);
  readonly query=signal('');
  readonly loading=signal(true);
  readonly error=signal('');
  readonly problems=signal<readonly Problem[]>([]);
  readonly filtered=computed(()=>{
    const term=this.query().trim().toLowerCase();
    return this.problems().filter(p=>!term||p.title.toLowerCase().includes(term)||p.topic.toLowerCase().includes(term));
  });
  ngOnInit():void {
    void this.catalog.all().then(data=>this.problems.set(data))
      .catch(()=>this.error.set('Could not load the preview catalog. Refresh to retry.'))
      .finally(()=>this.loading.set(false));
  }
  updateQuery(event:Event):void {this.query.set((event.target as HTMLInputElement).value);}
}
