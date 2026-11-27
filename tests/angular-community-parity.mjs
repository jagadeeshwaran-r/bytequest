import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateProfileEdit} from '../angular/src/app/core/profile-edit-contract.ts';
import {sampleCreatorDraft,draftFromRaw,creatorWritePayload} from '../angular/src/app/core/creator-contract.ts';

const read=path=>readFile(path,'utf8');
test('ByteQuest profile payload preserves required identity and social privacy settings',()=>{
 const raw={username:' java_explorer ',display_name:' Backend learner ',bio:'Java',
  avatar_url:'',discoverable:true,show_presence:false,
  organization_type:'company',organization_name:'Acme',
  organization_url:'https://example.org',linkedin_url:'https://www.linkedin.com/in/example/',
  github_url:'https://github.com/example'};
 const result=validateProfileEdit(raw);
 assert.equal(result.username,'java_explorer');
 assert.equal(result.display_name,'Backend learner');
 assert.equal(result.github_url,'https://github.com/example');
 assert.equal(result.show_presence,false);
 assert.equal(result.organization_type,'company');
});
test('Profile validation rejects weak usernames, unsafe profile links and overlong biographies',()=>{
 const p={username:'abc',display_name:'Example',bio:'',avatar_url:'',
  discoverable:true,show_presence:true,organization_type:'',
  organization_name:'',organization_url:'',linkedin_url:'',github_url:''};
 assert.throws(()=>validateProfileEdit({...p,username:'!bad'}),/Username/);
 assert.throws(()=>validateProfileEdit({...p,bio:'x'.repeat(281)}),/Biography/);
 assert.throws(()=>validateProfileEdit({...p,avatar_url:'http://insecure.example'}),/HTTPS/);
 assert.throws(()=>validateProfileEdit({...p,github_url:'https://evil.example/steal'}),/GitHub/);
 assert.throws(()=>validateProfileEdit({...p,linkedin_url:'https://linkedin.com/jobs'}),/LinkedIn/);
});
test('Creator save keeps hidden cases in private API payload, not public problem definition',()=>{
 const draft=draftFromRaw(sampleCreatorDraft);
 const payload=creatorWritePayload(draft);
 assert.equal(payload['revision'],0);
 assert.equal(payload['position'],0);
 assert.equal(payload['published'],false);
 assert.ok(Array.isArray(payload['hiddenTests']));
 assert.ok(!Object.hasOwn(payload['problem'],'hiddenTests'));
 assert.equal(payload['problem'].id,'array-sum');
});
test('Creator validation requires proper test structures and enforces version bounds',()=>{
 assert.throws(()=>draftFromRaw({...sampleCreatorDraft,tests:[]}),/2–100/);
 assert.throws(()=>draftFromRaw({...sampleCreatorDraft,
  tests:[{args:[1]},...sampleCreatorDraft.tests]}),/args and expected/);
 assert.throws(()=>draftFromRaw({...sampleCreatorDraft,revision:-1}),/revision/);
 assert.throws(()=>creatorWritePayload({...sampleCreatorDraft,published:true,reference:''}),/reference/);
});
test('All social writes are isolated from live ByteQuest Supabase',async()=>{
 const api=await read('angular/src/app/core/staging-action.service.ts');
 const config=JSON.parse(await read('angular/public/staging-backend.json','utf8'));
 const shell=await read('angular/src/app/native-shell.component.ts');
 const studio=await read('angular/src/app/features/studio/studio.component.ts');
 const chat=await read('angular/src/app/features/chat/chat.component.ts');
 const routes=await read('angular/src/app/app.routes.ts');
 assert.equal(config.enabled,true);
 assert.equal(config.apiUrl,'https://ainsxwxvfybhwdennsvh.supabase.co/functions/v1/bytequest-firebase');
 assert.match(config.publishableKey,/^sb_publishable_/);
 assert.match(api,/const writeActions=new Set/);
 const isolation=await read('angular/src/app/core/staging-backend-contract.ts');
 assert.match(isolation,/project===productionRef/);
 assert.match(isolation,/url\.hostname!==project\+'\.supabase\.co'/);
 assert.match(api,/validateStagingBackend\(await this\.config\)/);
 assert.match(api,/body:JSON\.stringify\(\{\.\.\.body,action\}\)/);
 assert.match(shell,/<bq-chat\/>/);
 assert.match(chat,/track person\.public_id/);
 assert.match(chat,/track message\.id/);
 assert.match(chat,/\.canWrite\(\)/);
 assert.match(studio,/Run reference tests/);
 assert.match(studio,/validatedFingerprint/);
 assert.match(studio,/creatorWritePayload/);
 assert.match(routes,/path:'profile\/edit'/);
 assert.match(routes,/path:'studio'/);
 assert.match(routes,/path:'find'/);
});
