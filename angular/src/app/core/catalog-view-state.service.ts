import {Injectable, signal} from '@angular/core';
export type CatalogLevel=''|'Easy'|'Medium'|'Hard';
/** Survives route transitions without caching DOM or reloading the page. */
@Injectable({providedIn:'root'})
export class CatalogViewState{
 readonly query=signal('');
 readonly difficulty=signal<CatalogLevel>('');
 readonly completion=signal<'all'|'solved'|'new'>('all');
 readonly scrollY=signal(0);
}
