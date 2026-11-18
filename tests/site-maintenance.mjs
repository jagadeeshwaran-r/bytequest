import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {maintenanceState,publicMaintenanceStatus,validateMaintenanceSettings,maintenanceBlocksAction}
  from '../supabase/functions/bytequest-firebase/domain/maintenance.js';
import {isoToISTInput,istInputToISO,istDisplay} from '../dist/maintenance-model.js';
import {createHandler,HttpError} from '../supabase/functions/bytequest-firebase/handler.js';

const start='2026-11-19T19:30:00.000Z',end='2026-11-19T20:30:00.000Z';
const draft={enabled:false,mode:'scheduled',starts_at:start,ends_at:end,
 message:"We're upgrading ByteQuest to make your coding experience better.",revision:0};
const before=Date.parse('2026-11-19T19:29:59.999Z');
const atStart=Date.parse('2026-11-19T19:30:00.000Z');
const atEnd=Date.parse('2026-11-19T20:30:00.000Z');
assert.equal(maintenanceState(draft,atStart).active,false,'Inactive default is ALWAYS disabled');
assert.equal(publicMaintenanceStatus(draft,atStart).startsAt,null,'Do not leak unarmed drafts publicly');
assert.equal(publicMaintenanceStatus(draft,atStart).message,null,'Do not leak unarmed messages');
assert.equal(maintenanceState({...draft,enabled:true},before).upcoming,true,'Advance notice before window');
assert.equal(maintenanceState({...draft,enabled:true},before).active,false);
assert.equal(maintenanceState({...draft,enabled:true},atStart).active,true,'Start is inclusive');
assert.equal(maintenanceState({...draft,enabled:true},atStart).upcoming,false);
assert.equal(maintenanceState({...draft,enabled:true},atEnd-1).active,true);
assert.equal(maintenanceState({...draft,enabled:true},atEnd).active,false,'Maintenance ends automatically without cron');
assert.equal(maintenanceState({...draft,enabled:true},atEnd).upcoming,false);
assert.equal(maintenanceState({...draft,enabled:true,mode:'on'},before).active,true,'Explicit immediate mode');
assert.equal(maintenanceState({...draft,enabled:true,mode:'on'},atEnd).active,false,'Immediate maintenance also expires at end');
assert.equal(isoToISTInput(start),'2026-11-20T01:00');
assert.equal(isoToISTInput(end),'2026-11-20T02:00');
assert.equal(istInputToISO('2026-11-20T01:00'),start);
assert.equal(istInputToISO('2026-11-20T02:00'),end);
assert.match(istDisplay(end),/20 Nov 2026/);
assert.throws(()=>istInputToISO('2026-02-30T00:00'));
const enabledDraft={enabled:true,mode:'scheduled',startsAt:start,endsAt:end,
 message:draft.message,revision:0};
assert.deepEqual(validateMaintenanceSettings(enabledDraft,before).startsAt,start);
assert.throws(()=>validateMaintenanceSettings(enabledDraft,atStart),/must be in the future/);
assert.deepEqual(validateMaintenanceSettings({...enabledDraft,enabled:false},atEnd+100000),{
 ...enabledDraft,enabled:false
},'Old schedules remain editable only while disabled');
for(const invalid of [
 {...enabledDraft,revision:-1},{...enabledDraft,revision:'0'},
 {...enabledDraft,mode:'made-up'},{...enabledDraft,message:'<'.repeat(281)},
 {...enabledDraft,endsAt:start}
])assert.throws(()=>validateMaintenanceSettings(invalid,before),'Invalid admin settings fail closed');
assert.throws(()=>validateMaintenanceSettings({...enabledDraft,endsAt:'2026-11-28T19:30:00Z'},before),/seven days/);
for(const action of ['sync','studio-save','submission-create','hidden-submit','native-run','profile-save','follow','chat-send','avatar-upload','presence'])
 assert.equal(maintenanceBlocksAction(action),true,action+' must be blocked during maintenance');
for(const action of ['account','progress','self','reference-read','studio-list','account-delete'])
 assert.equal(maintenanceBlocksAction(action),false,action+' remains accessible for recovery');

let now=Date.now(),row={...draft,starts_at:new Date(now-60000).toISOString(),
 ends_at:new Date(now+3600000).toISOString()},writes=0,touches=0;
const identities=new Map([['admin',{id:'firebase:test:admin'}],['learner',{id:'firebase:test:learner'}]]);
const adminIds=new Set(['firebase:test:admin']);
const db={
 maintenance:async()=>({...row}),
 isLibraryAdmin:async owner=>adminIds.has(owner),
 saveMaintenance:async(owner,settings)=>{
   assert.ok(adminIds.has(owner));
   if(settings.revision!==row.revision)throw new HttpError(409,'Revision conflict');
   writes++;row={...row,enabled:settings.enabled,mode:settings.mode,
     starts_at:settings.startsAt,ends_at:settings.endsAt,message:settings.message,
     revision:row.revision+1,updated_at:new Date().toISOString()};
   return {...row};
 },
 touchAccount:async()=>{touches++;},
 progress:async()=>({payload:{},revision:0}),
 problems:async()=>[],
 community:async()=>({admin:false,profile:null}),
 isEditor:async()=>false
};
const handler=createHandler({
 projectId:'fixture',allowedOrigins:['https://jagadeeshwaran-r.github.io'],
 verifyToken:async token=>{const identity=identities.get(token);if(!identity)throw new Error('Bad signature');return identity;},db
});
const endpoint='https://example.supabase.co/functions/v1/bytequest-firebase';
const get=()=>handler(new Request(endpoint+'/maintenance',{
 method:'GET',headers:{Origin:'https://jagadeeshwaran-r.github.io'}
}));
const post=(action,token='learner',rest={})=>handler(new Request(endpoint,{
 method:'POST',headers:{Origin:'https://jagadeeshwaran-r.github.io',
 Authorization:'Bearer '+token,'Content-Type':'application/json'},
 body:JSON.stringify({action,...rest})
}));
let status=await get();
assert.equal(status.status,200,'Anonymous users may read status without logging in');
assert.equal(status.headers.get('Cache-Control'),'no-store');
assert.equal((await status.json()).active,false,'Saved draft must not activate maintenance');
assert.equal((await post('maintenance-admin-get')).status,403);
assert.equal((await post('maintenance-admin-get','bogus')).status,401);
assert.equal((await post('maintenance-admin-get','learner',{admin:true,owner_id:'firebase:test:admin'})).status,403,
 'Client-supplied admin privileges/owner IDs must not be trusted');
assert.equal((await post('maintenance-admin-get','admin')).status,200);
let config={enabled:true,mode:'on',startsAt:new Date(now-60000).toISOString(),
 endsAt:new Date(now+3600000).toISOString(),message:'Maintenance test',revision:row.revision};
assert.equal((await post('maintenance-admin-save','learner',{settings:config})).status,403);
assert.equal(writes,0);
assert.equal((await post('maintenance-admin-save','admin',{settings:{...config,mode:'bad'}})).status,400);
assert.equal((await post('maintenance-admin-save','admin',{settings:config})).status,200);
assert.equal(writes,1);
assert.equal((await post('maintenance-admin-save','admin',{settings:config})).status,409,'Stale revisions must not overwrite admin settings');
status=await get();const active=await status.json();
assert.equal(active.active,true,'Armed maintenance becomes active server-side');
assert.equal(active.message,'Maintenance test');
for(const action of ['sync','studio-save','submission-create','hidden-submit','native-run','profile-save']){
 const response=await post(action,'learner',{admin:true,owner_id:'firebase:test:admin'});
 assert.equal(response.status,503,action+' must stop for non-admin');
 const body=await response.json();assert.equal(body.code,'MAINTENANCE');
 assert.equal(body.endsAt,row.ends_at);
}
assert.equal(touches,0,'Rejected maintenance writes must not touch user accounts');
assert.equal((await post('progress','learner')).status,200,'Progress can still be fetched for safe recovery');
assert.equal((await post('studio-list','admin')).status,200,'Verified admin bypasses active maintenance');
const disable={...config,revision:row.revision,enabled:false};
assert.equal((await post('maintenance-admin-save','admin',{settings:disable})).status,200);
assert.equal((await (await get()).json()).active,false);
assert.equal((await post('studio-list','learner')).status,200,'Normal app resumes immediately after disabling');

const migration=readFileSync('database/site-maintenance.sql','utf8');
assert.ok(migration.includes('false,\'scheduled\''),'Migration must persist an inactive default schedule');
assert.ok(migration.includes('2026-11-19 19:30:00+00')&&migration.includes('2026-11-19 20:30:00+00'),
 'Schedule must translate 01:00–02:00 IST to exact UTC timestamps');
assert.ok(migration.includes('enable row level security'));
assert.ok(migration.includes('revoke all on public.bytequest_site_maintenance from public,anon,authenticated'));
assert.ok(migration.includes('on conflict(key) do nothing'),'Migrations must not overwrite existing admin settings');
const adapter=readFileSync('supabase/functions/bytequest-firebase/database.js','utf8');
assert.ok(adapter.includes(".eq('user_id',owner)"),'Only verified server role checks can access admin config');
assert.ok(adapter.includes(".eq('revision',settings.revision)"),'Admin writes require optimistic concurrency');
const gate=readFileSync('dist/maintenance-gate.js','utf8');
assert.ok(gate.includes("access.request('maintenance-admin-get'"),'Admin bypass must be checked with authenticated backend');
assert.ok(gate.includes('location.replace'),'Cold visitor navigation reaches the maintenance screen');
assert.ok(gate.includes('showBanner(status)'),'Open coding workspaces are not forcibly redirected');
const adminPage=readFileSync('dist/maintenance-admin.js','utf8');
assert.ok(adminPage.includes('confirm('),'Enabling must require explicit administrator confirmation');
assert.ok(adminPage.includes("mode==='on'"),'Immediate mode supported');
assert.ok(adminPage.includes("cloud.request('maintenance-admin-save'"),'Settings persist through authenticated Edge endpoint');
for(const page of ['index','leaderboard','community','studio']){
 assert.ok(readFileSync('dist/'+page+'.html','utf8').includes('maintenance-gate.js?v=1'),
  page+' must load preflight status before application startup');
}
// Maintenance visitor experience must not advertise a way around an active
// scheduled window, including briefly before the ES module finishes loading.
const maintenanceMarkup=readFileSync('dist/status.html','utf8');
const maintenanceScript=readFileSync('dist/status-page.js','utf8');
const maintenanceStyles=readFileSync('dist/system-state.css','utf8');
const outageWorker=readFileSync('dist/runtime-sw.js','utf8');
assert.ok(maintenanceMarkup.includes("document.documentElement.dataset.maintenancePage='true'"),
 'Maintenance page must hide actions before asynchronous scripts load');
assert.ok(maintenanceScript.includes("if(state.kind==='maintenance'){")&&
 maintenanceScript.includes("  $('statusRetry').hidden=true;")&&
 maintenanceScript.includes("  $('statusContinue').hidden=true;"),
 'Maintenance-specific controller must hide retry and continue actions');
assert.ok(maintenanceStyles.includes('html[data-maintenance-page="true"] .status-actions')&&
 maintenanceStyles.includes('body[data-issue="maintenance"] .status-actions'),
 'Maintenance recovery controls must be hidden even when CSS renders before JS');
assert.ok(!maintenanceStyles.includes('body[data-issue="offline"] .status-actions{display:none'),
 'Offline practice recovery buttons must remain available');
assert.ok(maintenanceMarkup.includes('id="statusAdminLink"'),
 'Admin maintenance recovery must remain accessible');
assert.ok(outageWorker.includes("bytequest-connection-page-v3")&&
 outageWorker.includes("./status-page.js?v=maintenance-controls-1"),
 'Offline cache must refresh the maintenance recovery page JavaScript');
assert.ok(maintenanceMarkup.includes("./status-page.js?v=maintenance-controls-1"),
 'Status HTML must load the updated controller');
console.log('PASS: disabled initial IST draft, server-clock start/end, admin-only bypass and saves, writes blocked with 503, auth and safe recovery.');
