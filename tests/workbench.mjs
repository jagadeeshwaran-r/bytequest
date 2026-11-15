import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {bracketEdit} from '../dist/bracket-edit.js';
import {submissionFeedback} from '../dist/submission-feedback.js';
import {createChatState} from '../dist/chat-state.js';
import {profileMetrics,recentSolvesMarkup} from '../dist/profile-extras.js';
import {buildNativeProgram,nativeResults} from '../dist/languages.js';
import {validateCommunity} from '../supabase/functions/bytequest-firebase/community.js';
for(const language of ['java','cpp','c','python'])for(const [open,close] of [['(',')'],['[',']'],['{','}']]){
 assert.deepEqual(bracketEdit('',0,0,open,language),{value:open+close,start:1,end:1});
 assert.deepEqual(bracketEdit(open+close,1,1,close,language),{value:open+close,start:2,end:2});
 assert.deepEqual(bracketEdit(open+close,1,1,'Backspace',language),{value:'',start:0,end:0});
 assert.equal(bracketEdit('"literal ',9,9,open,language),null);assert.equal(bracketEdit(language==='python'?'# comment ':'// comment ',11,11,open,language),null);
}
assert.equal(bracketEdit('name',0,4,'(').value,'(name)');assert.equal(bracketEdit('a ',2,2,'<','cpp'),null);assert.equal(bracketEdit('a',1,1,'<','java'),null);assert.equal(bracketEdit('if (a ',6,6,'<','cpp'),null);
assert.equal(bracketEdit('vector',6,6,'<','cpp').value,'vector<>');assert.equal(bracketEdit('Map',3,3,'<','java').value,'Map<>');assert.equal(bracketEdit('vector<>',7,7,'Backspace','cpp').value,'vector');
const feedback=submissionFeedback({status:'wrong_answer',passed:2,total:5,message:'2 / 5 public cases passed.',cases:[{name:'Case 3',passed:false,actual:'<script>bad</script>',expected:'[1,2]'}]});assert.equal(feedback.title,'Wrong answer');assert.match(feedback.html,/role="alert"/);assert.ok(feedback.html.includes('Your output'));assert.ok(!feedback.html.includes('<script>'));assert.match(feedback.announcement,/2 \/ 5/);
assert.equal(submissionFeedback({status:'compile_error',message:'ByteQuest return contract: expected int'}).title,'Return type mismatch');assert.equal(submissionFeedback({status:'unavailable',code:'compiler_timeout'}).tone,'warning');assert.equal(submissionFeedback({accepted:true,status:'accepted'}).title,'Accepted');
let clock=1000;const state=createChatState(()=>clock),peer='11111111-1111-4111-8111-111111111111';state.apply({presence:[{public_id:peer,presence:{visible:true,online:true,serverNow:new Date(1000).toISOString(),expiresAt:new Date(31000).toISOString()}}],receipts:[{public_id:peer,through:12}]});assert.equal(state.online(peer),true);assert.equal(state.seen({isOwn:true,id:12},peer),true);assert.equal(state.seen({isOwn:true,id:13},peer),false);state.apply({receipts:[{public_id:peer,through:3}]});assert.equal(state.seen({isOwn:true,id:12},peer),true);clock=31001;assert.equal(state.online(peer),false);state.apply({presence:[]});assert.equal(state.online(peer),false);state.reset();assert.equal(state.seen({isOwn:true,id:12},peer),false,'Account switch clears another account’s receipts');
const recent=Array.from({length:30},(_,i)=>({problemId:'fixture-'+i,title:'<Fixture '+i+'>',difficulty:'Easy',solvedAt:new Date(Date.now()-i*10000).toISOString()}));const recentHtml=recentSolvesMarkup(recent);assert.equal((recentHtml.match(/data-recent-row/g)||[]).length,25);assert.equal((recentHtml.match(/hidden data-recent-row/g)||[]).length,22);assert.ok(!recentHtml.includes('<Fixture'));assert.match(recentHtml,/Show all 25/);assert.match(profileMetrics({solved:2,total:16,streak:3},20,16),/metric-streak/);
assert.deepEqual(validateCommunity('creator-search',{query:'MixedCaseFirebaseUID',owner:'forged'}),{query:'MixedCaseFirebaseUID'});assert.equal(validateCommunity('role-set',{target:'MixedCaseFirebaseUID',creator:true}).target,'MixedCaseFirebaseUID');assert.throws(()=>validateCommunity('creator-search',{query:'somebody@example.com'}));
const directory=mkdtempSync(join(tmpdir(),'bytequest-contract-'));
const p={id:'fixture-contract',method:'valueFor',params:[{name:'n',type:'int'}],returns:'int'},cases=[{args:[5],expected:5,label:'Return contract'}];
function compile(source,problem=p,testCases=cases){const code=buildNativeProgram(source,problem,testCases,'cpp'),file=join(directory,'main.cpp'),binary=join(directory,'run');writeFileSync(file,code);const built=spawnSync('g++',['-std=c++17',file,'-o',binary],{encoding:'utf8',timeout:20000});assert.ifError(built.error);if(built.status!==0)return{ok:false,message:built.stderr};const ran=spawnSync(binary,[],{encoding:'utf8',timeout:5000});assert.ifError(ran.error);assert.equal(ran.status,0,ran.stderr);return{ok:true,cases:nativeResults(ran.stdout,problem,testCases)};}
try{
 for(const source of ['int valueFor(int n){return true;}','int valueFor(int n){return n>0;}','int valueFor(int n){if(n)return true;return 0;}','bool valueFor(int n){return true;}','int valueFor(int n){return {true};}']){const r=compile(source);assert.equal(r.ok,false,source);assert.match(r.message,/ByteQuest return contract/);}
 assert.equal(compile('bool valueFor(int n){return 1;}',{...p,returns:'boolean'},[{args:[1],expected:true}]).ok,false);
 for(const source of ['int valueFor(int n){return n;}','constexpr int valueFor(int n){return n;}','int valueFor(int n){auto ok=[](int x){return x>0;}; if(ok(n))return n;return 0;}','int valueFor(int n){struct P{bool ok(int x){return x>0;}};P p;return p.ok(n)?n:0;}','int valueFor(int n){return n==0?0:1+valueFor(n-1);}','int valueFor(int n){return {n};}']){const r=compile(source);assert.equal(r.ok,true,r.message);assert.equal(r.cases[0].passed,true,source);}
 const list={...p,returns:'int[]'};assert.equal(compile('#include <vector>\nstd::vector<int> valueFor(int n){return {n};}',list,[{args:[5],expected:[5]}]).cases[0].passed,true);
}finally{rmSync(directory,{recursive:true,force:true});}
for(const name of ['languages.js','cpp-contract.js','code-context.js'])assert.equal(readFileSync('dist/'+name,'utf8'),readFileSync('supabase/functions/bytequest-firebase/domain/'+name,'utf8'));
console.log('PASS: balanced editor pairs, comparison-safe generics, visible submission feedback, private chat signal state, recent 3/25 lists, exact creator IDs and real C++ return-contract diagnostics.');
