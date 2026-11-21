// Live, no-credentials, READ-ONLY backend E2E against the isolated project.
// Does not mutate any account, submit code, or touch the production service.
import assert from 'node:assert/strict';
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
console.log('PASS live staging HTTP: Edge health, disabled maintenance, expected Firebase project, allowed/rejected CORS, authentication rejection and no account writes');
