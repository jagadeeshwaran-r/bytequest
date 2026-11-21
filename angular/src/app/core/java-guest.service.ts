import {Injectable, OnDestroy, signal} from '@angular/core';
import type {Problem, Example} from './catalog.service';

interface JavaCase{readonly passed:boolean;readonly label?:string;readonly actual?:unknown;readonly expected?:unknown;readonly error?:string;}
interface JavaResult{
  readonly status:string; readonly cases?:readonly JavaCase[];
  readonly message?:string;readonly stdout?:string;readonly elapsedMs?:number;
}
interface Judge{
  run(source:string,problem:unknown,cases:readonly Example[]):Promise<JavaResult>;
  stop():void;
}
type JavaModule={JavaJudge:new (status:(message:string)=>void)=>Judge};

@Injectable({providedIn:'root'})
export class JavaGuestService implements OnDestroy{
 readonly status=signal('Java runtime not started');
 private judge:Judge|null=null;
 private pending:Promise<Judge>|null=null;
 async run(source:string,problem:Problem):Promise<JavaResult>{
  if(!problem.tests.length)throw new Error('This published problem has no public test cases.');
  if(source.length>60000)throw new Error('Solution exceeds the 60,000-character limit.');
  const judge=await this.getJudge();
  // Guest Run executes only the existing public tests. No hidden tests,
  // Firebase claims, database writes, leaderboard credit or submission unlocks.
  return judge.run(source,{
    id:problem.id,method:problem.method,params:problem.params,returns:problem.returns,
    normalize:problem.normalize||''
  },problem.tests);
 }
 private async getJudge():Promise<Judge>{
  if(this.judge)return this.judge;
  if(!this.pending){
    const script=new URL('java-runtime/judge.js',document.baseURI).href;
    this.pending=import(/* @vite-ignore */ script)
      .then((mod:unknown)=>{
        const runtime=mod as JavaModule;
        if(typeof runtime.JavaJudge!=='function')throw new Error('Java runtime module missing.');
        this.judge=new runtime.JavaJudge((message:string)=>this.status.set(message));
        return this.judge;
      }).catch(error=>{this.pending=null;throw error;});
  }
  return this.pending;
 }
 ngOnDestroy():void{this.judge?.stop();}
}
