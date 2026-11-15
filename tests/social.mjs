import assert from 'node:assert/strict';
import {relativeTime,receivedPresence,profilePreferences} from '../dist/presence-model.js';
import {friendTransitions,mountFriendAlerts} from '../dist/friend-alerts.js';
import {validateCommunity} from '../supabase/functions/bytequest-firebase/community.js';
import {createDatabase} from '../supabase/functions/bytequest-firebase/database.js';
import {createHandler} from '../supabase/functions/bytequest-firebase/handler.js';

const now=Date.UTC(2026,10,14,12);
for(const [age,want] of [[0,'just now'],[1,'1 sec ago'],[30,'30 sec ago'],[59,'59 sec ago'],[60,'1 minute ago'],[300,'5 minutes ago'],[3600,'1 hr ago'],[7200,'2 hrs ago'],[86400,'1 day ago'],[2592000,'1 month ago'],[31536000,'1 yr ago'],[63072000,'2 yrs ago']])assert.equal(relativeTime(now-age*1000,now),want);
assert.equal(relativeTime('bad date',now),null);assert.equal(relativeTime(undefined,now),null);assert.equal(relativeTime(now+60000,now),'just now');
const skewed=receivedPresence({serverNow:'2026-11-14T00:00:00Z',lastSeen:'2026-11-13T23:59:30Z'},now);assert.equal(relativeTime(skewed.lastSeenMs,now),'30 sec ago','Last-seen age uses the server clock, even on devices with wrong clocks.');
assert.deepEqual(profilePreferences(null),{discoverable:true,show_presence:true});assert.deepEqual(profilePreferences({discoverable:false,show_presence:false}),{discoverable:false,show_presence:false});

function friend(online=true,id='friend-a',visible=true){return{public_id:id,username:id.replace('-','_'),display_name:'Fixture learner',presence:{visible,online,serverNow:new Date(now).toISOString(),expiresAt:online?new Date(now+30000).toISOString():null}};}
let update=friendTransitions(new Map(),[friend()],now);assert.equal(update.arrivals.length,0,'Opening a page does not announce everyone already online.');
update=friendTransitions(update.state,[friend(false)],now+1000);update=friendTransitions(update.state,[friend()],now+2000);assert.equal(update.arrivals.length,1);
update=friendTransitions(update.state,[friend()],now+3000);assert.equal(update.arrivals.length,0,'Heartbeats do not repeat arrival alerts.');
update=friendTransitions(update.state,[friend(false)],now+4000);update=friendTransitions(update.state,[friend()],now+5000);assert.equal(update.arrivals.length,0,'Quick reconnects have a one-minute cooldown.');
update=friendTransitions(update.state,[friend(false)],now+65000);update=friendTransitions(update.state,[friend()],now+66000);assert.equal(update.arrivals.length,1);
update=friendTransitions(update.state,[friend(true,'friend-a',false)],now+67000);assert.equal(update.arrivals.length,0);assert.equal(update.state.size,0,'Opted-out or unfollowed friends leave the tracked snapshot.');
assert.equal(friendTransitions(new Map(),[friend(true,'new-follow')],now).arrivals.length,0);
const expired=friend();expired.presence.expiresAt=new Date(now-1).toISOString();assert.equal(friendTransitions(new Map(),[expired],now).state.get('friend-a').online,false);

// Exercise account switching and hidden-page races without changing any real follows.
const win=new EventTarget(),doc=new EventTarget();let tick,focused=true,clock=now,resolve,body;const notices=[];
win.setInterval=fn=>{tick=fn;return 1;};win.clearInterval=()=>{};doc.visibilityState='visible';doc.hasFocus=()=>focused;
const cloud={request:(action,data,owner)=>{body={action,data,owner};return new Promise(r=>{resolve=r;});}};
const monitor=mountFriendAlerts(cloud,{notify:p=>notices.push(p),win,doc,now:()=>clock});const settle=async()=>{await Promise.resolve();await Promise.resolve();};
monitor.setOwner({id:'viewer-a'});assert.deepEqual(body,{action:'friend-presence',data:{},owner:'viewer-a'});resolve({users:[friend(false)]});await settle();
tick();resolve({users:[friend()]});await settle();assert.equal(notices.length,1);
tick();const oldResolve=resolve;monitor.setOwner({id:'viewer-b'});const newResolve=resolve;oldResolve({users:[friend(false)]});await settle();newResolve({users:[friend()]});await settle();assert.equal(notices.length,1,'A new account gets a silent baseline.');
tick();focused=false;win.dispatchEvent(new Event('blur'));resolve({users:[friend(false)]});await settle();focused=true;win.dispatchEvent(new Event('focus'));resolve({users:[friend()]});await settle();assert.equal(notices.length,1,'A late hidden response cannot create arrivals.');
monitor.setOwner(null);const previous=body;tick();assert.equal(body,previous);monitor.dispose();

const calls=[];let current=null;
const db=createDatabase('https://example.supabase.co','fixture-key',{fetchImpl:async(url,options)=>{
 const path=new URL(url).pathname;const data=options.body?JSON.parse(options.body):null;calls.push({path,data,url:String(url)});
 const result=path.endsWith('/bytequest_friend_presence')?{users:[]}:(path.endsWith('/bytequest_community')||path.endsWith('/bytequest_save_profile'))?{profile:null}:current;
 return new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}});
}});
await db.community('verified-owner','friend-presence',{viewer_id:'forged'});assert.deepEqual(calls.at(-1).data,{viewer_id:'verified-owner'});
const save={username:'learner',display_name:'Name',bio:'',avatar_url:''};
const clean=validateCommunity('profile-save',save);await db.community('verified-owner','profile-save',clean);assert.ok(calls.at(-1).path.endsWith('/bytequest_save_profile'));assert.equal(calls.at(-1).data.owner_id,'verified-owner');assert.equal(calls.at(-1).data.data.discoverable,true);assert.equal(calls.at(-1).data.data.show_presence,true);
current={discoverable:false,show_presence:false};await db.community('verified-owner','profile-save',clean);assert.equal(calls.at(-1).data.data.discoverable,false);assert.equal(calls.at(-1).data.data.show_presence,false,'Omitted settings preserve existing opt-outs.');
for(const settings of [{discoverable:'true'},{show_presence:null}])assert.throws(()=>validateCommunity('profile-save',{...save,...settings}));
const verified=[];const handler=createHandler({projectId:'fixture',allowedOrigins:[],verifyToken:async()=>({id:'verified-owner'}),db:{touchAccount:async()=>{},community:async(...args)=>{verified.push(args);return{users:[]};}}});
const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify({action:'friend-presence',viewer_id:'other-owner',target:'other-friend',users:['forged']})}));
assert.equal(response.status,200);assert.deepEqual(verified[0],['verified-owner','friend-presence',{}]);
console.log('PASS: relative last seen, clock skew, privacy defaults, friend arrival transitions, cooldown, visibility/account races and verified viewer binding.');
