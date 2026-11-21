import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateStagingBackend} from '../angular/src/app/core/staging-backend-contract.ts';

const stage='abcdefghijklmnopqrst';
const endpoint='https://'+stage+'.supabase.co/functions/v1/bytequest-firebase';
const enabled={enabled:true,apiUrl:endpoint,publishableKey:'sb_publishable_test_only'};

test('An isolated staging project and exact Supabase function URL are required',()=>{
  assert.equal(validateStagingBackend(enabled).href,endpoint);
  assert.throws(()=>validateStagingBackend({...enabled,enabled:false}),/disabled/);
  assert.throws(()=>validateStagingBackend({...enabled,publishableKey:''}),/incomplete/);
  assert.throws(()=>validateStagingBackend({...enabled,apiUrl:''}),/incomplete/);
  assert.throws(()=>validateStagingBackend({...enabled,apiUrl:'not a URL'}),/Invalid staging API URL/);
});
const rejected=[
 ['live production','https://zwubrziriuppkldrdoos.supabase.co/functions/v1/bytequest-firebase'],
 ['insecure HTTP',endpoint.replace('https:','http:')],
 ['wrong Supabase host','https://'+stage+'.supabase.co.evil.example/functions/v1/bytequest-firebase'],
 ['lookalike suffix','https://'+stage+'.supabase.com/functions/v1/bytequest-firebase'],
 ['non-Supabase host','https://example.com/functions/v1/bytequest-firebase'],
 ['unexpected port','https://'+stage+'.supabase.co:8443/functions/v1/bytequest-firebase'],
 ['URL credentials','https://user:pass@'+stage+'.supabase.co/functions/v1/bytequest-firebase'],
 ['wrong function',endpoint.replace('/bytequest-firebase','/another-function')],
 ['wrong path',endpoint+'/submissions'],
 ['URL query',endpoint+'?action=submission-create'],
 ['URL fragment',endpoint+'#bypass'],
 ['invalid short project','https://abc.supabase.co/functions/v1/bytequest-firebase'],
 ['invalid project characters','https://test_project.supabase.co/functions/v1/bytequest-firebase']
];
for(const [label,url] of rejected){
 test('Reject '+label,()=>assert.throws(()=>validateStagingBackend({...enabled,apiUrl:url})));
}
test('Both verified Java Submit and mutable account APIs use identical validated destination',async()=>{
 const submit=await readFile('angular/src/app/core/verified-java.service.ts','utf8');
 const account=await readFile('angular/src/app/core/staging-action.service.ts','utf8');
 const settings=JSON.parse(await readFile('angular/public/staging-backend.json','utf8'));
 assert.match(submit,/import \{validateStagingBackend/);
 assert.match(submit,/return validateStagingBackend\(config\)\.href/);
 assert.match(account,/import \{validateStagingBackend/);
 assert.match(account,/validateStagingBackend\(await this\.config\)/);
 const readonly=await readFile('angular/src/app/core/readonly-api.service.ts','utf8');
 assert.match(readonly,/validateStagingBackend\(config\)/,'All authenticated reads need an isolated Supabase endpoint');
 assert.match(readonly,/fetch\(endpoint\.href/);
 assert.doesNotMatch(readonly,/zwubrziriuppkldrdoos|https:\/\/.*supabase\.co\/functions\/v1/,
  'Authenticated staging reads may never POST to production Supabase');
 assert.equal(settings.enabled,false,'Branch preview must remain non-writable before staging backend setup');
 assert.equal(settings.apiUrl,'');
 assert.equal(settings.publishableKey,'');
});
