import {ChangeDetectionStrategy,Component,inject,signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {AuthService} from '../../core/auth.service';
import {StagingActionService} from '../../core/staging-action.service';

interface Person{
 readonly public_id:string;readonly username?:string;readonly display_name:string;
 readonly avatar_url?:string;readonly unread?:number;readonly online?:boolean;
}
interface Message{
 readonly id:number;readonly body:string;readonly created_at?:string;
 readonly isOwn?:boolean;readonly is_own?:boolean;readonly read?:boolean;
}
interface Update{
 readonly id:number;readonly kind:string;readonly problem_id?:string;
 readonly title?:string;readonly created_at?:string;readonly message?:string;
}
type Tab='messages'|'updates';
@Component({
 selector:'bq-chat',
 imports:[RouterLink],
 changeDetection:ChangeDetectionStrategy.OnPush,
 template:`
 <div class="native-chat-wrapper">
   <button class="message-button chat-toggle" type="button"
     aria-label="Messages and updates" aria-haspopup="dialog" [attr.aria-expanded]="isOpen()"
     (click)="toggle()">
     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
       <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-8.5A7.5 7.5 0 0 1 10.5 5H13a7 7 0 0 1 7 6.5Z"/>
     </svg>
     @if(unread()>0){<span class="native-unread">{{unread()>99?'99+':unread()}}</span>}
   </button>
   @if(isOpen()){
     <section class="chat-dialog native-chat-dialog" role="dialog"
       aria-modal="false" aria-label="ByteQuest messages and updates">
       <header class="chat-top"><h2>Messages &amp; updates</h2>
         <button type="button" class="chat-close" aria-label="Close messages" (click)="close()">×</button>
       </header>
       <div class="native-chat-tabs" role="tablist" aria-label="Inbox categories">
         <button type="button" role="tab" [attr.aria-selected]="tab()==='messages'"
           (click)="setTab('messages')">Messages</button>
         <button type="button" role="tab" [attr.aria-selected]="tab()==='updates'"
           (click)="setTab('updates')">Updates</button>
         <button type="button" aria-label="Refresh inbox" (click)="refresh()" [disabled]="loading()">↻</button>
       </div>
       @if(!auth.user()){
         <p class="native-chat-status">Sign in to read private messages and notifications.</p>
         <button type="button" class="button primary" [disabled]="!auth.ready()||auth.loading()"
           (click)="auth.signIn()">Continue with Google</button>
       } @else{
         @if(error()){<p class="native-chat-status" role="alert">{{error()}}</p>}
         @if(loading()){<p class="native-chat-status" role="status">Loading your inbox…</p>}
         @if(tab()==='updates'){
           <div class="native-updates">
             @for(update of updates();track update.id){
               <article class="inbox-item">
                 <small>{{update.kind}}</small>
                 @if(update.problem_id){
                   <a [routerLink]="['/angular/problem',update.problem_id]" (click)="close()">
                     {{update.title||update.message||'New problem update'}}
                   </a>
                 }@else{
                   <span>{{update.title||update.message||'Community update'}}</span>
                 }
               </article>
             }@empty{
               @if(!loading()){<p class="native-chat-status">No updates to display.</p>}
             }
             <button type="button" class="native-chat-small" (click)="markUpdatesRead()"
               [disabled]="!canWrite()||writing()||!updates().length">Mark all read</button>
           </div>
         }@else{
           <div class="native-chat-body">
             <div class="native-chat-people">
               @for(person of people();track person.public_id){
                 <button type="button" [class.selected]="peer()?.public_id===person.public_id"
                   (click)="selectPeer(person)">
                   @if(person.avatar_url){
                     <img [src]="person.avatar_url" alt="" referrerpolicy="no-referrer"/>
                   }@else{<span class="native-person-initial">{{person.display_name.slice(0,1)}}</span>}
                   <span class="native-person-label"><strong>{{person.display_name}}</strong>
                     <small>&#64;{{person.username||''}}</small></span>
                   @if(person.online){<span class="native-online" title="Online"></span>}
                   @if(person.unread){<small class="native-unread-inline">{{person.unread}}</small>}
                 </button>
               }@empty{
                 @if(!loading()){<p class="native-chat-status">No conversations yet.</p>}
               }
             </div>
             <div class="native-chat-thread">
               @if(peer()){
                 <div class="native-peer-title">
                   <a [routerLink]="['/angular/profile',peer()!.username||'me']" (click)="close()">
                     {{peer()!.display_name}}
                   </a>
                 </div>
                 <div class="native-messages" role="log" aria-label="Conversation messages">
                   @for(message of messages();track message.id){
                     <article class="native-message" [class.own]="message.isOwn||message.is_own">
                       <p>{{message.body}}</p>
                       <small>{{message.created_at||''}}
                         @if(message.isOwn||message.is_own){ <span>{{message.read?' · Seen':' · Sent'}}</span> }
                       </small>
                     </article>
                   }@empty{
                     <p class="native-chat-status">No messages in this conversation.</p>
                   }
                 </div>
                 <form class="native-compose" (submit)="send($event)">
                   <textarea aria-label="Message" rows="2" maxlength="2000"
                     placeholder="Write a message…" [value]="draft()" (input)="editDraft($event)"></textarea>
                   <button type="submit" class="button primary"
                     [disabled]="!canWrite()||writing()||!draft().trim()">
                     {{writing()?'Sending…':'Send'}}
                   </button>
                 </form>
                 @if(!canWrite()){<small class="native-chat-status">
                   Sending is disabled until the isolated staging backend is connected.
                 </small>}
               } @else{
                 <p class="native-chat-status">Choose a conversation.</p>
               }
             </div>
           </div>
         }
       }
     </section>
   }
 </div>
 `,
 styles:[`
 :host{display:block;position:relative}
 .native-chat-wrapper{position:relative}
 .native-chat-wrapper>.chat-toggle{display:flex;justify-content:center;align-items:center;width:37px;height:37px}
 .native-chat-wrapper>.chat-toggle svg{width:19px;height:19px}
 .native-chat-dialog{position:absolute;right:0;top:calc(100% + 12px);z-index:100;
   width:min(650px,calc(100vw - 24px));height:min(540px,75dvh);overflow:hidden;
   background:var(--surface,#121b14);border:1px solid var(--border,#303a30);
   border-radius:14px;display:flex;flex-direction:column;box-shadow:0 22px 55px #0007}
 .native-chat-dialog .chat-top{display:flex;align-items:center;justify-content:space-between;padding:14px 18px}
 .native-chat-dialog .chat-close{font-size:21px;color:inherit;border:0;background:transparent}
 .native-chat-tabs{display:flex;border-bottom:1px solid var(--border,#303a30);padding:0 16px}
 .native-chat-tabs button{border:0;background:none;color:inherit;cursor:pointer;padding:12px;font:inherit}
 .native-chat-tabs button[aria-selected=true]{border-bottom:2px solid var(--accent,#53bc84)}
 .native-chat-tabs button:last-child{margin-left:auto}
 .native-chat-body{min-height:0;display:grid;grid-template-columns:190px minmax(0,1fr);flex:1}
 .native-chat-people{border-right:1px solid var(--border,#303a30);overflow:auto}
 .native-chat-people button{display:flex;align-items:center;gap:8px;width:100%;
   border:0;background:none;text-align:left;color:inherit;cursor:pointer;padding:12px 9px}
 .native-chat-people button:hover,.native-chat-people button.selected{background:#6cbf8420}
 .native-person-initial,.native-chat-people img{display:grid;place-items:center;object-fit:cover;
   width:28px;height:28px;border-radius:50%;background:var(--surface-2,#283b2e)}
 .native-person-label{min-width:0;flex:1;display:grid;gap:3px}
 .native-person-label strong,.native-person-label small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .native-person-label small{font-size:10px;color:var(--muted)}
 .native-online{width:7px;height:7px;border-radius:50%;background:#42c884}
 .native-unread,.native-unread-inline{background:var(--accent,#6cdd9b);color:#0f1b13;
   border-radius:99px;padding:2px 5px;font-size:10px}
 .native-unread{position:absolute;right:-4px;top:-5px}
 .native-chat-thread{min-width:0;display:flex;flex-direction:column}
 .native-peer-title{padding:10px;border-bottom:1px solid var(--border,#303a30);font-weight:600}
 .native-messages{overflow:auto;flex:1;padding:10px}
 .native-message{max-width:90%;margin:7px 0;padding:9px 10px;border:1px solid var(--border,#303a30);border-radius:10px}
 .native-message.own{margin-left:auto;background:#6dbd8420}
 .native-message p{margin:0;font-size:12px;white-space:pre-wrap}
 .native-message small{font-size:10px;color:var(--muted)}
 .native-compose{display:flex;gap:8px;padding:8px;border-top:1px solid var(--border,#303a30)}
 .native-compose textarea{min-width:0;flex:1;resize:none;background:transparent;color:inherit;border:1px solid var(--border);border-radius:8px;padding:8px;font:inherit}
 .native-compose button{align-self:center}
 .native-chat-status{padding:13px;color:var(--muted);font-size:12px}
 .native-updates{overflow:auto;flex:1}
 .native-updates article{display:grid;gap:5px;padding:12px}
 .native-chat-small{margin:10px;padding:8px;border:1px solid var(--border);background:none;color:inherit}
 @media(max-width:570px){.native-chat-body{grid-template-columns:115px minmax(0,1fr)}
   .native-chat-people button{flex-wrap:wrap}.native-person-label{font-size:10px}}
 `]
})
export class ChatComponent{
 readonly auth=inject(AuthService);
 private readonly api=inject(StagingActionService);
 readonly isOpen=signal(false);
 readonly tab=signal<Tab>('messages');
 readonly people=signal<readonly Person[]>([]);
 readonly peer=signal<Person|null>(null);
 readonly messages=signal<readonly Message[]>([]);
 readonly updates=signal<readonly Update[]>([]);
 readonly unread=signal(0);
 readonly loading=signal(false);
 readonly writing=signal(false);
 readonly canWrite=signal(false);
 readonly error=signal('');
 readonly draft=signal('');
 private sequence=0;
 private retryNonce:string|null=null;
 toggle():void{if(this.isOpen()){this.close();return;}this.isOpen.set(true);void this.refresh();}
 close():void{this.isOpen.set(false);this.sequence++;}
 setTab(tab:Tab):void{this.tab.set(tab);void this.refresh();}
 editDraft(event:Event):void{
   this.draft.set((event.target as HTMLTextAreaElement).value);
   this.retryNonce=null;
 }
 async refresh():Promise<void>{
  if(!this.isOpen()||!this.auth.user())return;
  const ticket=++this.sequence,owner=this.auth.user()?.id;
  this.loading.set(true);this.error.set('');
  try{
   this.canWrite.set(await this.api.canWrite());
   if(this.tab()==='updates'){
    const response=await this.api.read<{items?:Update[];unread?:number}>('notifications');
    if(this.sequence!==ticket||this.auth.user()?.id!==owner)return;
    this.updates.set(response.items||[]);
    this.unread.set(Number(response.unread)||0);
   }else{
    const response=await this.api.read<{users?:Person[];totalUnread?:number}>('chat-list');
    if(this.sequence!==ticket||this.auth.user()?.id!==owner)return;
    this.people.set(response.users||[]);
    this.unread.set(Number(response.totalUnread)||0);
   }
  }catch(e){if(this.sequence===ticket)this.error.set(e instanceof Error?e.message:'Inbox unavailable.');}
  finally{if(this.sequence===ticket)this.loading.set(false);}
 }
 async selectPeer(person:Person):Promise<void>{
  const ticket=++this.sequence,owner=this.auth.user()?.id;
  this.peer.set(person);this.messages.set([]);this.error.set('');
  this.draft.set('');this.retryNonce=null;this.loading.set(true);
  try{
   const response=await this.api.read<{messages?:Message[]}>('chat-thread',{target:person.public_id});
   if(this.sequence!==ticket||this.auth.user()?.id!==owner)return;
   this.messages.set(response.messages||[]);
  }catch(e){if(this.sequence===ticket)this.error.set(e instanceof Error?e.message:'Conversation unavailable.');}
  finally{if(this.sequence===ticket)this.loading.set(false);}
 }
 async send(event:Event):Promise<void>{
  event.preventDefault();
  const peer=this.peer(),body=this.draft().trim();
  if(!peer||!body||this.writing()||!this.canWrite())return;
  const owner=this.auth.user()?.id;
  const nonce=this.retryNonce??crypto.randomUUID();
  this.retryNonce=nonce;this.writing.set(true);this.error.set('');
  try{
   const response=await this.api.write<{message:Message}>('chat-send',{target:peer.public_id,body,nonce});
   if(this.auth.user()?.id!==owner||this.peer()?.public_id!==peer.public_id)return;
   this.messages.update(items=>items.some(m=>m.id===response.message.id)?items:[...items,response.message]);
   this.draft.set('');this.retryNonce=null;
  }catch(e){this.error.set(e instanceof Error?e.message:'Message was not sent.');}
  finally{this.writing.set(false);}
 }
 async markUpdatesRead():Promise<void>{
  if(!this.canWrite()||this.writing()||!this.updates().length)return;
  this.writing.set(true);this.error.set('');
  try{await this.api.write('notifications-read',{id:Math.max(...this.updates().map(n=>n.id))});await this.refresh();}
  catch(e){this.error.set(e instanceof Error?e.message:'Could not mark updates read.');}
  finally{this.writing.set(false);}
 }
}
