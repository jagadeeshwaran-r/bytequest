import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {makeOnlineJudge} from '../supabase/functions/bytequest-firebase/online-judge.js';
import {createHandler} from '../supabase/functions/bytequest-firebase/handler.js';
import {problems} from '../dist/problems.js';
import {companies} from '../dist/companies-data.js';
const p=problems[0],cases=p.tests.slice(0,1);let sent;
const sandbox=makeOnlineJudge({fetchImpl:async(url,options)=>{sent={url,...JSON.parse(options.body)};return new Response(JSON.stringify({status:'0',program_output:'__BYTEQUEST_CASE_0__{"ok":true,"actual":[1,0]}\n'}));}});
assert.equal((await sandbox.run('def twoSum(nums,target): return [0,1]',p,cases,'python')).cases[0].passed,true);
assert.equal(sent.url,'https://wandbox.org/api/compile.json');assert.equal(sent.compiler,'cpython-3.11.10');assert.equal(sent.save,false);assert.ok(!JSON.stringify(sent).includes('Bearer'));
const broken=makeOnlineJudge({fetchImpl:async()=>new Response(JSON.stringify({status:'1',compiler_error:'syntax error'}))});assert.match((await broken.run('bad',p,cases,'cpp')).message,/syntax error/);
const offline=makeOnlineJudge({fetchImpl:async()=>{throw new Error('internal secret detail');}});assert.ok(!(await offline.run('bad',p,cases,'c')).message.includes('internal secret'));
let owner,called=0;const handler=createHandler({projectId:'fixture',allowedOrigins:[],verifyToken:async()=>({id:'verified-owner'}),db:{touchAccount:async()=>{},publicProblem:async()=>({content:p,revision:3}),claimOnlineRun:async id=>{owner=id;return true;}},onlineJudge:{run:async()=>{called++;return{status:'ok',cases:[]};}}});
const request=body=>handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify({action:'native-run',source:'code',problemId:p.id,language:'python',revision:3,cases,...body})}));
assert.equal((await request({user_id:'forged-owner',url:'https://evil.invalid'})).status,200);assert.equal(owner,'verified-owner');assert.equal(called,1);
assert.equal((await request({language:'shell'})).status,400);assert.equal((await request({revision:2})).status,409);assert.equal((await request({cases:[]})).status,400);assert.equal(called,1);
assert.equal(companies.length,100);assert.equal(new Set(companies.map(x=>x.slug)).size,100);for(const c of companies){const file='dist/'+c.file.slice(2);assert.ok(existsSync(file),c.name);assert.match(readFileSync(file,'utf8'),/<svg/);}
console.log('PASS: online provider contract, owner binding, validation, error handling and 100 local company logos.');
