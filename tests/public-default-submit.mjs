import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaultSubmissionScope,requestSubmission} from '../dist/submissions.js';

// Exactly the same user-facing path as the reported problem: 70 hidden cases,
// published public cases available, no reliable private Java judge.
const problem={id:'battery-full-arrivals',title:'Battery Full Arrivals',revision:1,hiddenCount:70};
assert.equal(defaultSubmissionScope({problem,language:'Java 17',allowPublicPractice:true}),'public');
assert.equal(defaultSubmissionScope({problem:{...problem,hiddenCount:0},language:'Java 17',allowPublicPractice:true}),'complete',
 'Without hidden cases there is no reason to force unranked public-only mode.');
assert.equal(defaultSubmissionScope({problem,language:'Python 3.11',allowPublicPractice:true}),'complete','Only Java can select public Java verification');
assert.equal(defaultSubmissionScope({problem,language:'C++',allowPublicPractice:false}),'complete',
 'Non-Java submissions retain their existing behavior.');

const originalDocument=globalThis.document,originalFormData=globalThis.FormData;
let dialog=null;
function createFakeDialog(){
 const listeners={};
 const form={onsubmit:null};
 const full={onclick:null};
 const cancel={onclick:null};
 const closeButton={onclick:null};
 return{
  html:'',open:false,removed:false,
  get innerHTML(){return this.html;},
  set innerHTML(value){this.html=value;},
  setAttribute(){},
  querySelector(selector){
   if(selector==='form')return form;
   if(selector==='[data-full-verify]')return this.html.includes('data-full-verify')?full:null;
   if(selector==='[data-cancel]')return cancel;
   if(selector==='.dialog-close')return closeButton;
   return null;
  },
  addEventListener(name,cb){listeners[name]=cb;},
  showModal(){this.open=true;},
  close(){this.open=false;listeners.close?.();},
  remove(){this.removed=true;},
  controls:{form,full,cancel,closeButton}
 };
}
async function useDialog(args,choice){
 const pending=requestSubmission(args);
 assert.ok(dialog?.open,'A real submission confirmation dialog must be displayed');
 if(choice==='public'){
  assert.match(dialog.innerHTML,/Submit public tests →/,'Primary action is public on hidden-suite Java problems');
  assert.match(dialog.innerHTML,/Try private suite/,'Full hidden-suite submission requires explicit separate click');
  dialog.controls.form.onsubmit({preventDefault(){}});
 }else if(choice==='full'){
  assert.match(dialog.innerHTML,/Try private suite/);
  dialog.controls.full.onclick();
 }else if(choice==='regular'){
  assert.doesNotMatch(dialog.innerHTML,/Try private suite/);
  dialog.controls.form.onsubmit({preventDefault(){}});
 }else dialog.controls.cancel.onclick();
 const resolved=await pending;
 assert.equal(dialog.removed,true,'A completed dialog must clean up itself');
 return resolved;
}
try{
 globalThis.document={createElement:()=>dialog=createFakeDialog(),body:{append(){}}};
 globalThis.FormData=class{constructor(form){assert.ok(form);}get(name){return {
  approach:'Use a set and return early',time:'O(n)',space:'O(n)',shared:'on'
 }[name]??null;}};
 const pub=await useDialog({problem,language:'Java 17',allowPublicPractice:true},'public');
 assert.equal(pub.scope,'public');
 assert.equal(pub.shared,false,'Public verification cannot publish unverified hidden-suite code');
 assert.equal(pub.approach,'Use a set and return early',"Public mode must retain the user's approach");
 assert.equal(pub.timeComplexity,'O(n)');
 assert.equal(pub.spaceComplexity,'O(n)');
 assert.match(pub.nonce,/^[0-9a-f-]{36}$/i);

 const full=await useDialog({problem,language:'Java 17',allowPublicPractice:true},'full');
 assert.equal(full.scope,'complete','Hidden case verification must be an explicit decision');
 assert.equal(full.shared,true,'Full-suite sharing preference remains unchanged');
 assert.notEqual(full.nonce,pub.nonce,'Public and full suites must have separate idempotency keys');

 const noHidden=await useDialog({problem:{...problem,hiddenCount:0},language:'Java 17',allowPublicPractice:true},'regular');
 assert.equal(noHidden.scope,'complete');
 const nonJava=await useDialog({problem,language:'Python 3.11',allowPublicPractice:false},'regular');
 assert.equal(nonJava.scope,'complete');
 assert.equal(await useDialog({problem,language:'Java 17',allowPublicPractice:true},'cancel'),null);
}finally{
 globalThis.document=originalDocument;
 globalThis.FormData=originalFormData;
}
const app=readFileSync('dist/app.js','utf8');
assert.match(app,/options:\{\.\.\.options,scope:"public",shared:false,nonce:crypto\.randomUUID\(\)\}/,
 'A failed private request must provide a direct, safe public-mode recovery action');
assert.match(app,/const publicOnly=options\.mode==='public-practice'\|\|options\.scope==='public'/,
 'The actual submission request must honor the default public scope');
console.log('PASS: 70-hidden-case Java submit defaults to public, explicit full verify, notes retained, no false hidden acceptance.');
