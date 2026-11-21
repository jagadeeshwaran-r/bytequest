import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeJavaSubmission,verifiedJavaVerdict} from '../angular/src/app/core/java-submission-contract.ts';

const problem={id:'two-sum',revision:6,hiddenCount:12};
const source='class Solution { public int[] twoSum(int[] a,int target){return new int[]{0,1};}}';
const nonce='c2fbb3d0-32e2-43ab-8701-522d9bb16778';

test('Java-only public suite payload matches verified backend schema',()=>{
 const p=makeJavaSubmission(problem,source,'public',nonce,{approach:'  map  ',timeComplexity:'O(n)'});
 assert.equal(p.action,'submission-create');
 assert.equal(p.problemId,'two-sum');
 assert.equal(p.language,'java');
 assert.equal(p.revision,6);
 assert.equal(p.scope,'public');
 assert.equal(p.shared,true);
 assert.equal(p.showcase,true);
 assert.equal(p.approach,'map');
 assert.equal(p.timeComplexity,'O(n)');
 assert.equal(p.nonce,nonce);
 assert.equal('hidden' in p,false);
});
test('Private verification stays a separate explicit scope',()=>{
 const p=makeJavaSubmission(problem,source,'complete',nonce);
 assert.equal(p.scope,'complete');
 assert.equal(p.language,'java');
 assert.equal(p.shared,true);
});
test('Never submit stale fallback revision, blank code or invalid nonce',()=>{
 assert.throws(()=>makeJavaSubmission({...problem,revision:null},source,'public',nonce),/revision/);
 assert.throws(()=>makeJavaSubmission(problem,'   ','public',nonce),/solution/);
 assert.throws(()=>makeJavaSubmission(problem,source,'public','abc'),/nonce/);
 assert.throws(()=>makeJavaSubmission(problem,source.repeat(2000),'public',nonce),/60,000/);
 assert.throws(()=>makeJavaSubmission(problem,source,'public',nonce,{approach:'x'.repeat(5001)}),/Shorten/);
});
test('Only a server-recorded accepted result credits the requested verification scope',()=>{
 const proof={accepted:true,status:'accepted',verificationScope:'public',
  submission:{id:'server-submission-42'},message:'Public suite verified.'};
 const v=verifiedJavaVerdict(proof,'public');
 assert.equal(v.accepted,true);
 assert.equal(v.submissionId,'server-submission-42');
 assert.equal(verifiedJavaVerdict({...proof,submission:undefined},'public').accepted,false);
 assert.equal(verifiedJavaVerdict({...proof,status:'practice_accepted'},'public').accepted,false);
 assert.equal(verifiedJavaVerdict({...proof,verificationScope:'complete'},'public').accepted,false);
 assert.equal(verifiedJavaVerdict({...proof,accepted:false},'public').accepted,false);
 assert.equal(verifiedJavaVerdict({...proof,verificationScope:'public'},'complete').accepted,false);
 assert.equal(verifiedJavaVerdict({status:'ok',accepted:true},'public').accepted,false);
 assert.throws(()=>verifiedJavaVerdict(null,'public'),/invalid verdict/);
});
test('Staging submission endpoint starts disabled and rejects production Supabase',async()=>{
 const cfg=JSON.parse(await readFile('angular/public/staging-backend.json','utf8'));
 const service=await readFile('angular/src/app/core/verified-java.service.ts','utf8');
 assert.equal(cfg.enabled,false);
 assert.equal(cfg.apiUrl,'');
 assert.match(service,/zwubrziriuppkldrdoos\.supabase\.co/);
 assert.match(service,/Submit requires a separate Supabase staging project/);
 assert.doesNotMatch(service,/\/\/\s*skip.*verify|unsafeAllowProduction/);
});
