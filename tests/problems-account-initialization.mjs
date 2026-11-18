import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Studio} from '../dist/studio.js';
import {problemStatusMarkup} from '../dist/problem-status.js';

// Reproduce the precise production crash. Problems retains a legacy creator
// form but does not have optional fields introduced on the standalone Studio.
const index=readFileSync('dist/index.html','utf8');
const studioHtml=readFileSync('dist/studio.html','utf8');
const missing=['pIllustration','pIllustrationAlt','pIllustrationCaption','pExampleExplanations'];
assert.ok(missing.every(id=>!index.includes('id="'+id+'"')),
 'The Problems page lacks optional Studio-only fields, which originally crashed accountChanged()');
assert.ok(missing.every(id=>studioHtml.includes('id="'+id+'"')),
 'The dedicated Studio still provides the full creator controls');

const nodes=new Map(),node=id=>{
 if(missing.includes(id))return null;
 if(!nodes.has(id))nodes.set(id,{
   value:'',hidden:false,checked:false,readOnly:false,textContent:'',
   replaceChildren(){},add(){},setAttribute(){}
 });
 return nodes.get(id);
};
const originalDocument=globalThis.document;
try{
 globalThis.document={getElementById:node};
 const fake={
   bulk:{accountChanged(){}},stop(){},rows:[],fill:Studio.prototype.fill,
   message(message){this.lastMessage=message;},
   companyPicker:null,loadedFor:'prior-account',validated:{}
 };
 Studio.prototype.accountChanged.call(fake);
 assert.equal(fake.loadedFor,null,'Studio account change remains functional on an incomplete form');
 assert.equal(fake.rows.length,0);
 assert.ok(fake.lastMessage.includes('Validate the reference solution'),
   'Absent optional controls no longer crash Studio.fill');
 assert.ok(nodes.get('pTitle').value,'Required fields still populate normally');
 assert.equal(node('pIllustration'),null,'Reproduction did not invent the missing DOM');
}finally{
 if(originalDocument===undefined)delete globalThis.document;
 else globalThis.document=originalDocument;
}

const app=readFileSync('dist/app.js','utf8');
assert.ok(!app.includes('new Studio('),
 'The Problems bundle must not initialize Studio; studio-page.js has its own entrypoint');
assert.ok(app.includes('const studio={accountChanged(){},stop(){},open(){}}'),
 'Legacy route callbacks must be harmless on Problems');
assert.ok(readFileSync('dist/studio-page.js','utf8').includes('new Studio('),
 'Dedicated Studio must retain full authoring functionality');

const change=app.slice(app.indexOf('async function changeAccount(user){'),app.indexOf('async function syncCloud(){'));
const local=change.indexOf('state=reconcilePracticeProgress(readLocal(storageKey))');
const ready=change.indexOf('accountReady=true');
const dashboard=change.indexOf('dashboard.accountChanged()');
const paint=change.indexOf('renderPractice();');
const remote=change.indexOf('void refreshCloudProgress(owner,epoch)');
assert.ok(local>0&&ready>local&&dashboard>ready&&paint>ready,
 'Owner-local progress MUST become ready before any optional Dashboard/editor work');
assert.ok(remote>ready&&remote<dashboard,
 'Start authenticated cloud recovery before optional UI work can fail');
assert.ok(change.includes('persist({scheduleSync:false})'),
 'Initial local progress must never write an empty snapshot before remote merge');
assert.ok(change.includes('catch(error){console.warn("ByteQuest: noncritical dashboard initialization failed"'),
 'An optional chart cannot strand account progress in Loading forever');

const sync=app.slice(app.indexOf('async function syncCloud(){'),app.indexOf('// Public catalog loading'));
assert.ok(sync.includes('await changeAccount(cloud.user);'),
 'Sync now must repair a partially initialized owner instead of returning an endless Loading message');
assert.ok(!sync.includes('Your account progress is still loading. Your drafts are saved locally'),
 'Old misleading permanent-loading diagnostic must be removed');
assert.ok(problemStatusMarkup(false,{complete:false}).includes('Checking…'));
assert.ok(!problemStatusMarkup(false,{complete:false}).includes('Unsolved'));
assert.ok(problemStatusMarkup(false,{complete:false,failed:true}).includes('Status unavailable'));
assert.ok(app.includes('accountHistoryStatus="ready"'),
 'Only server-confirmed account history may turn unknown statuses into Unsolved');
assert.ok(index.includes('reliable-auth-bootstrap=1'),'GitHub Pages must load the repaired code');
console.log('PASS: reproduced missing Studio fields; account startup cannot be blocked; uncertain solves never masquerade as unsolved.');
