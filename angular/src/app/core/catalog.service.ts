import {Injectable,signal} from '@angular/core';
import {validateStagingBackend,type StagingBackendConfig} from './staging-backend-contract';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export interface Parameter {readonly name:string;readonly type:string;}
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
  readonly companies?: readonly string[];
  readonly description: string;
  readonly constraints: string;
  readonly starter: string;
  readonly revision: number|null;
  readonly hiddenCount: number;
  readonly method: string;
  readonly params: readonly Parameter[];
  readonly returns: string;
  readonly normalize?: string;
  readonly examples: readonly Example[];
  readonly tests: readonly Example[];
}

function isProblem(value: unknown): value is Problem {
  if(!value||typeof value!=='object')return false;
  const p=value as Partial<Problem>;
  return typeof p.id==='string'&&/^[a-z][a-z0-9-]{1,63}$/.test(p.id)
    &&typeof p.title==='string'&&typeof p.description==='string'
    &&typeof p.starter==='string'&&typeof p.topic==='string'
    &&['Easy','Medium','Hard'].includes(p.difficulty||'')
    &&(p.revision===null||(Number.isSafeInteger(p.revision)&&Number(p.revision)>0))
    &&typeof p.hiddenCount==='number' && p.hiddenCount>=0
    &&Array.isArray(p.examples) &&Array.isArray(p.tests) &&Array.isArray(p.params)
    &&typeof p.method==='string' &&typeof p.returns==='string';
}
@Injectable({providedIn:'root'})
export class CatalogService {
  private pending: Promise<readonly Problem[]> | null=null;
  // A bundled starter catalog is available until an isolated staging backend
  // is provisioned. Never leak unpublished or hidden cases from production.
  readonly snapshot=signal(false);
  private readonly staging=fetch(new URL('staging-backend.json',document.baseURI),{cache:'no-store'})
    .then(async response=>{
      if(!response.ok)throw new Error('Staging config unavailable.');
      return await response.json() as StagingBackendConfig;
    });

  async all():Promise<readonly Problem[]>{
    if(!this.pending){
      this.pending=this.load().catch(error=>{this.pending=null;throw error;});
    }
    return this.pending;
  }
  private async load():Promise<readonly Problem[]>{
    // Query only the separate staging Supabase project. When no staging DB
    // exists, the bundled public starter catalog is explicitly a snapshot.
    try{
      const config=await this.staging;
      const endpoint=validateStagingBackend(config);
      const url=endpoint.origin+'/rest/v1/bytequest_problems'
        +'?select=id,content,revision,position&published=eq.true&order=position.asc,id.asc&limit=1000';
      const response=await fetch(url,{headers:{apikey:config.publishableKey},signal:AbortSignal.timeout(9000)});
      if(!response.ok)throw new Error('Catalog unavailable');
      const data:unknown=await response.json();
      if(!Array.isArray(data))throw new Error('Invalid catalog');
      const problems:Problem[]=data.map(row=>{
        if(!row||typeof row!=='object')throw new Error('Invalid public row');
        const source=row as {content?:Record<string,unknown>;revision?:number};
        const c=source.content;
        if(!c||!Array.isArray(c['params']))throw new Error('Invalid published problem');
        const params=(c['params'] as Parameter[]);
        const returns=String(c['returns']||'void');
        const method=String(c['method']||'');
        const starter=typeof c['starter']==='string'?c['starter']:
          'import java.util.*;\\n\\nclass Solution {\\n    public '+returns+' '+method+'('+params.map(p=>p.type+' '+p.name).join(', ')+') {\\n        throw new UnsupportedOperationException("Implement your solution");\\n    }\\n}\\n';
        const result={
          id:c['id'],title:c['title'],difficulty:c['difficulty'],topic:c['topic'],
          companies:Array.isArray(c['companies'])?(c['companies'] as unknown[]).filter((x):x is string=>typeof x==='string').slice(0,8):[],
          description:c['description'],constraints:c['constraints']||'',
          method,params,returns,normalize:c['normalize']||'',
          revision:Number.isSafeInteger(source.revision)?Number(source.revision):null,
          hiddenCount:Number.isSafeInteger(c['hiddenCount'])?Number(c['hiddenCount']):0,
          starter,examples:Array.isArray(c['tests'])?(c['tests'] as Example[]).slice(0,2):[],
          tests:Array.isArray(c['tests'])?(c['tests'] as Example[]):[]
        };
        if(!isProblem(result))throw new Error('Invalid published problem contract');
        return result;
      });
      this.snapshot.set(false);
      return problems;
    }catch{
      this.snapshot.set(true);
      const fallback=await fetch(new URL('catalog.json',document.baseURI),{cache:'no-cache'});
      if(!fallback.ok)throw new Error('Public problem catalog is unavailable ('+fallback.status+').');
      const payload:unknown=await fallback.json();
      if(!Array.isArray(payload)||!payload.every(isProblem))throw new Error('Invalid fallback catalog.');
      return payload as readonly Problem[];
    }
  }
}
