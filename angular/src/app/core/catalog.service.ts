import {Injectable} from '@angular/core';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export interface Example {
  readonly args: readonly unknown[];
  readonly expected: unknown;
  readonly label: string;
}
export interface Problem {
  readonly id: string;
  readonly title: string;
  readonly difficulty: Difficulty;
  readonly topic: string;
  readonly description: string;
  readonly constraints: string;
  readonly starter: string;
  readonly method: string;
  readonly examples: readonly Example[];
}

function isProblem(value: unknown): value is Problem {
  if(!value||typeof value!=='object')return false;
  const p=value as Partial<Problem>;
  return typeof p.id==='string'&&/^[a-z][a-z0-9-]{1,63}$/.test(p.id)
    &&typeof p.title==='string'&&typeof p.description==='string'
    &&typeof p.starter==='string'&&typeof p.topic==='string'
    &&['Easy','Medium','Hard'].includes(p.difficulty||'')
    &&Array.isArray(p.examples);
}
@Injectable({providedIn:'root'})
export class CatalogService {
  private pending: Promise<readonly Problem[]> | null=null;
  async all(): Promise<readonly Problem[]> {
    if(!this.pending){
      this.pending=fetch(new URL('catalog.json',document.baseURI),{cache:'no-cache'})
        .then(async response=>{
          if(!response.ok)throw new Error('Catalog could not be loaded ('+response.status+').');
          const payload:unknown=await response.json();
          if(!Array.isArray(payload)||!payload.every(isProblem))throw new Error('Invalid published catalog response.');
          return payload as readonly Problem[];
        }).catch(error=>{this.pending=null;throw error;});
    }
    return this.pending;
  }
}
