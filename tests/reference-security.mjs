import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHandler,HttpError} from '../supabase/functions/bytequest-firebase/handler.js';
import {Cloud} from '../dist/cloud.js';
import {problems} from '../dist/problems.js';
import {validateProblem} from '../dist/catalog.js';

const publicModule=readFileSync('dist/problems.js','utf8');
assert.ok(!publicModule.includes('reference:'),'No answer source may be embedded in dist/problems.js');
assert.ok(!publicModule.includes('body.split('),'Golden solution bodies must not remain in the published bundle');
const example={...problems[0],reference:'SECRET_REFERENCE'};
assert.equal(validateProblem(example,{publicOnly:true}).reference,undefined);
assert.equal(validateProblem(example).reference,'SECRET_REFERENCE');
assert.equal(validateProblem({...example,reference:undefined},{publicOnly:true}).reference,undefined);
assert.throws(()=>validateProblem({...example,reference:undefined}),/Reference solution/);

let lastOwner=null,lastId=null,lastRevision=null,grant=false;
const handler=createHandler({
 projectId:'test',allowedOrigins:['https://jagadeeshwaran-r.github.io'],
 verifyToken:async token=>{
   if(token!=='signed-alice')throw Error('Bad token');
   return {id:'firebase:test:alice'};
 },
 db:{
   touchAccount:async()=>{},
   reference:async(owner,id,revision)=>{
     lastOwner=owner;lastId=id;lastRevision=revision;
     if(!grant)throw new HttpError(403,'No verified accepted solution for this problem.');
     return{reference:'PRIVATE_SERVER_ONLY',revision};
   }
 }
});
const request=async(body,auth='Bearer signed-alice')=>handler(new Request('https://example.supabase.co/functions/v1/bytequest-firebase',{
 method:'POST',headers:{Origin:'https://jagadeeshwaran-r.github.io','content-type':'application/json',authorization:auth},
 body:JSON.stringify(body)
}));
const payload={action:'reference-read',problemId:'two-sum',revision:2,
 owner_id:'firebase:test:victim',verified:true,accepted:true};
assert.equal((await request(payload,'')).status,401,'Anonymous requests must never receive source');
assert.equal((await request(payload,'Bearer forgery')).status,401,'Forged authentication cannot read references');
assert.equal((await request({...payload,problemId:'../other'})).status,400);
assert.equal((await request({...payload,revision:-1})).status,400);
assert.equal((await request(payload)).status,403,'No verified acceptance means denied');
assert.equal(lastOwner,'firebase:test:alice','Firebase token controls owner; forged body fields do not');
grant=true;
const allowed=await request(payload);
assert.equal(allowed.status,200);
assert.deepEqual(await allowed.json(),{reference:'PRIVATE_SERVER_ONLY',revision:2});
assert.equal(lastId,'two-sum');
assert.equal(lastRevision,2);

const sql=readFileSync('database/private-reference-solutions.sql','utf8');
assert.ok(sql.includes('create table if not exists public.bytequest_problem_references'));
assert.ok(sql.includes('revoke all on public.bytequest_problem_references from public, anon, authenticated'));
assert.ok(sql.includes("set content=content-'reference'"),'Public database source must be scrubbed');
assert.ok(sql.includes("problem-'reference'"),'Future catalog authoring must keep source private');
assert.ok(sql.includes('public.bytequest_problem_history'),'Historical revisions must be scrubbed too');
const db=readFileSync('supabase/functions/bytequest-firebase/database.js','utf8');
assert.ok(db.includes('.eq("owner_id",owner).eq("problem_id",id).eq("problem_revision",revision)'),
 'Only a verified submission for the SAME owner, problem, and revision unlocks source');
assert.ok(db.includes('bytequest_problem_references'));
assert.ok(db.includes('bytequest_problem_authors'),'Own authors retain secure Studio access');
assert.ok(db.includes('bytequest_library_admins'),'Library admins retain secure Studio access');
assert.ok(db.includes('content:{...r.content,reference:'),'Studio editor should get private reference separately');
const app=readFileSync('dist/app.js','utf8');
assert.ok(app.includes('cloud.request("reference-read",{problemId:selected.id,revision:selected.revision},owner)'));
assert.ok(!app.includes('html(current.reference)'),'Editorial cannot reveal a preloaded public source');
const cloudCode=readFileSync('dist/cloud.js','utf8');
assert.ok(cloudCode.includes('rows:publicRows'),'Public cache stores sanitized data only');
assert.ok(cloudCode.includes('publicOnly:true'),'Public catalog validation must redact source');
const config={url:'https://example.supabase.co',publishableKey:'sb_publishable_test'};
const storage=new Map();
const cloud=new Cloud(()=>{},{
 config,
 storage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
 sessionFactory:()=>({}),
 fetchImpl:async()=>new Response(JSON.stringify([{id:example.id,content:example,revision:2}]),{status:200})
});
const catalog=await cloud.publicCatalog();
assert.equal(catalog[0].reference,undefined,'Public API cache adapter must never emit reference code');
assert.ok(!JSON.stringify([...storage.values()]).includes('SECRET_REFERENCE'),'Reference code must not enter public local cache');
console.log('PASS: anonymous, forged, unverified and wrong revision reference access denied; public browser assets and cache redacted.');
