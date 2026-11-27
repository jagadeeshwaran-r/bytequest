// Live, no-credentials, READ-ONLY backend E2E against the isolated project.
// Does not mutate any account, submit code, or touch the production service.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const api='https://ainsxwxvfybhwdennsvh.supabase.co/functions/v1/bytequest-firebase';
const origin='https://bytequest-angular-staging.vercel.app';
const badOrigin='https://malicious-site.invalid';
const req=async(path,opts={})=>{
 const response=await fetch(api+path,{...opts,signal:AbortSignal.timeout(20000)});
 let payload;const text=await response.text();try{payload=JSON.parse(text)}catch{payload={text:text.slice(0,300)}}
 return{response,payload};
};
const preflight=await req('',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,apikey,content-type'}});
assert.equal(preflight.response.status,204,'Authorized staging CORS preflight must work: '+JSON.stringify(preflight.payload));
assert.equal(preflight.response.headers.get('access-control-allow-origin'),origin);
assert.match(preflight.response.headers.get('access-control-allow-methods')||'',/POST/);
const rejectedOrigin=await req('',{method:'OPTIONS',headers:{Origin:badOrigin,'Access-Control-Request-Method':'POST'}});
assert.equal(rejectedOrigin.response.status,403,'Untrusted web origin must be rejected');
assert.notEqual(rejectedOrigin.response.headers.get('access-control-allow-origin'),badOrigin);
const health=await req('/health',{headers:{Origin:origin}});
assert.equal(health.response.status,200,'The isolated Edge Function is not serving health: '+JSON.stringify(health.payload));
assert.equal(health.payload.projectId,'bytequest-7b841');
assert.equal(health.payload.provider,'firebase');
const status=await req('/maintenance',{headers:{Origin:origin}});
assert.equal(status.response.status,200,'Public staging maintenance state not reachable: '+JSON.stringify(status.payload));
assert.equal(status.payload.active,false,'Maintenance must be disabled by default');
const noAuth=await req('',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action:'leaderboard',scope:'global'})});
assert.equal(noAuth.response.status,401,'Anonymous users must not access authenticated rankings');
const forged=await req('',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer not.a.firebase.token'},body:JSON.stringify({action:'leaderboard',scope:'global'})});
assert.equal(forged.response.status,401,'Forged Firebase tokens must be rejected');
const privateNoAuth=await req('',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action:'account-delete',confirmation:'DELETE'})});
assert.equal(privateNoAuth.response.status,401,'Account deletion must never accept anonymous calls');

const cfg=JSON.parse(await readFile('angular/public/staging-backend.json','utf8'));
assert.equal(cfg.enabled,true);
assert.equal(cfg.apiUrl,api);
assert.match(cfg.publishableKey,/^sb_publishable_/);
const restBase='https://ainsxwxvfybhwdennsvh.supabase.co/rest/v1/';
const readRest=async(table,query='?select=*&limit=1000')=>{
 const response=await fetch(restBase+table+query,{headers:{apikey:cfg.publishableKey},
   signal:AbortSignal.timeout(20000)});
 const body=await response.json();return{response,body};
};
const catalog=await readRest('bytequest_problems','?select=id,content,revision&published=eq.true&limit=1000');
assert.equal(catalog.response.status,200,'Public catalog not readable from real staging REST API: '+JSON.stringify(catalog.body).slice(0,250));
assert.equal(catalog.body.length,16,'Unexpected seeded public catalog size');
assert.ok(catalog.body.every(row=>!Object.hasOwn(row.content,'reference')
  &&!Object.hasOwn(row.content,'hiddenTests')&&!Object.hasOwn(row.content,'hidden')),
  'Public REST catalog leaked server-only Java information');
for(const table of ['bytequest_problem_references','bytequest_problem_private',
  'bytequest_submissions','bytequest_firebase_progress']){
 const reply=await readRest(table);
 assert.ok([401,403].includes(reply.response.status),
   'Anonymous clients can read private table '+table+': '+reply.response.status);
}
console.log('PASS live staging PostgREST: 16 public published Java problems; references, hidden tests, submissions and private progress denied to anonymous clients');
console.log('PASS live staging HTTP: Edge health, disabled maintenance, expected Firebase project, allowed/rejected CORS, authentication rejection and no account writes');

