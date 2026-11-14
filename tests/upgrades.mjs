import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pointsFor,totalPoints,rankCup} from '../dist/rewards.js';
import {completions,newlineEdit,EditHistory} from '../dist/editor-tools.js';
import {smoothPath,solveEvents,bucketSolves} from '../dist/dashboard-model.js';
import {validateCommunity} from '../supabase/functions/bytequest-firebase/community.js';
import {createHandler} from '../supabase/functions/bytequest-firebase/handler.js';
import {makeAccountDeletion} from '../supabase/functions/bytequest-firebase/account-deletion.js';
import {Cloud} from '../dist/cloud.js';
const now=Date.now(),catalog=[{id:'easy',difficulty:'Easy'},{id:'medium',difficulty:'Medium'},{id:'hard',difficulty:'Hard'}];
assert.deepEqual(catalog.map(p=>pointsFor(p.difficulty)),[10,25,50]);
assert.equal(totalPoints({solved:{easy:1,medium:now,hard:now-1,unknown:1}},catalog,now),85);
assert.equal(totalPoints({solved:{easy:'1',medium:now+1,hard:-2}},catalog,now),0);
for(const [rank,label] of [[1,'Gold'],[2,'Silver'],[3,'Bronze']])assert.match(rankCup(rank),new RegExp(label+' cup, rank '+rank));
assert.equal(rankCup(4),'');assert.equal(rankCup(null),'');
for(const [language,prefix,expected] of [['java','Sys','System.out.println'],['python','enu','enumerate'],['c','mal','malloc'],['cpp','std::uno','std::unordered_map']])assert.ok(completions(prefix,prefix.length,language).some(c=>c.label===expected));
assert.deepEqual(completions('// Sys',6,'java'),[]);assert.deepEqual(completions('# enu',5,'python'),[]);
assert.ok(completions('findPa',6,'java',{method:'findPair',params:[]}).some(c=>c.label==='findPair'));
let edit=newlineEdit('    if (ok) {}',13,13,'java');assert.equal(edit.value,'    if (ok) {\n        \n    }');assert.equal(edit.start,22);
assert.equal(newlineEdit('    if ready:',13,13,'python').value,'    if ready:\n        ');
const history=new EditHistory({value:'',start:0,end:0});history.record({value:'a',start:1,end:1});history.record({value:'ab',start:2,end:2});assert.equal(history.undo().value,'a');assert.equal(history.redo().value,'ab');history.undo();history.record({value:'ac',start:2,end:2});assert.equal(history.redo().value,'ac');history.reset({value:'another owner',start:0,end:0});assert.equal(history.undo().value,'another owner');
assert.equal(smoothPath([]),'');assert.equal(smoothPath([[1,2]]),'M1,2');assert.match(smoothPath([[0,10],[10,0],[20,10]]),/ C/);assert.ok(!smoothPath([[0,0],[10,0],[20,5]]).includes('NaN'));
assert.equal(solveEvents({solved:{easy:now,medium:now+1,hard:'123'}},catalog,now).length,1);
assert.equal(bucketSolves([{day:'2026-02-31',topic:'Math'},{day:'2026-02-02',topic:'Math'}],{month:'2026-02'}).total,1);
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
assert.deepEqual(validateCommunity('friend-analytics',{targets:[...ids,ids[0]],owner_id:'forged'}),{targets:ids});
for(const targets of [['bad-id'],{},Array.from({length:101},()=>ids[0])])assert.throws(()=>validateCommunity('friend-analytics',{targets}));
const origin='https://bytequest.test',owner='verified-owner',steps=[];let fresh=true,pending=false;
const handler=createHandler({projectId:'fixture',allowedOrigins:[origin],verifyToken:async()=>({id:owner,authTime:Math.floor(Date.now()/1000)-(fresh?0:301)}),db:{
 async deletionStatus(id){assert.equal(id,owner);return pending?{completed_at:null}:null;},
 async beginDeletion(id){assert.equal(id,owner);steps.push('begin');return {avatar_path:'fixture/photo.jpg',completed:false};},
 async removeDeletedAvatar(path){assert.equal(path,'fixture/photo.jpg');steps.push('photo');},async finishDeletion(id){assert.equal(id,owner);steps.push('finish');},async touchAccount(){throw new Error('Deletion must not recreate a profile.');}
},deleteFirebaseAccount:async token=>{assert.equal(token,'verified-token');steps.push('firebase');}});
const request=body=>handler(new Request('https://api.invalid',{method:'POST',headers:{Origin:origin,Authorization:'Bearer verified-token','Content-Type':'application/json'},body:JSON.stringify({action:'account-delete',...body})}));
assert.equal((await request({confirmation:'NO'})).status,400);assert.deepEqual(steps,[]);
fresh=false;assert.equal((await request({confirmation:'DELETE'})).status,409);assert.deepEqual(steps,[]);
fresh=true;assert.equal((await request({confirmation:'DELETE',owner_id:'victim'})).status,200);assert.deepEqual(steps,['begin','photo','firebase','finish']);
fresh=false;pending=true;steps.length=0;assert.equal((await request({confirmation:'DELETE'})).status,200);assert.deepEqual(steps,['begin','photo','firebase','finish']);
let called=false;const remove=makeAccountDeletion({apiKey:'public-web-config',fetchImpl:async(url,options)=>{called=true;assert.equal(new URL(url).hostname,'identitytoolkit.googleapis.com');assert.ok(url.includes('/v1/accounts:delete?key='));assert.deepEqual(JSON.parse(options.body),{idToken:'verified-token'});return new Response('{}');}});await remove('verified-token');assert.ok(called);
await makeAccountDeletion({apiKey:'public',fetchImpl:async()=>new Response(JSON.stringify({error:{message:'USER_NOT_FOUND'}}),{status:400})})('gone-token');
await assert.rejects(()=>makeAccountDeletion({apiKey:'public',fetchImpl:async()=>new Response(JSON.stringify({error:{message:'PRIVATE PROVIDER TOKEN'}}),{status:400})})('sensitive-token'),e=>e.status===503&&!e.message.includes('PRIVATE')&&!e.message.includes('sensitive-token'));
const calls=[],session={async reauthenticate(id){calls.push('reauth:'+id);},async tokenFor(id){assert.equal(id,owner);return 'fixture';},async signOut(){calls.push('signout');}};
const cloud=new Cloud(()=>{},{sessionFactory:()=>session,fetchImpl:async(_url,options)=>{assert.deepEqual(JSON.parse(options.body),{action:'account-delete',confirmation:'DELETE'});return new Response('{"deleted":true}');}});cloud.user={id:owner};await cloud.deleteAccount();assert.deepEqual(calls,['reauth:'+owner,'signout']);assert.equal(cloud.deletionPending,false);
const switched=new Cloud(()=>{},{sessionFactory:()=>({async reauthenticate(){switched.user={id:'other'};}}),fetchImpl:()=>{throw new Error('must not delete');}});switched.user={id:owner};await assert.rejects(()=>switched.deleteAccount(),/account changed/);
assert.equal(readFileSync('dist/firebase-config.js','utf8'),readFileSync('supabase/functions/bytequest-firebase/domain/firebase-config.js','utf8'));
console.log('PASS: weighted points, cups, language suggestions, indentation, undo/context reset, smooth chart paths, private batch validation, recent-auth deletion, verified ownership, cleanup order, retry and Firebase provider isolation.');
