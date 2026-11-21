// Real browser Java 17 integration smoke. No authentication and no production writes.
// This test intentionally does not award points, streaks or verified acceptance.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,access} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('../angular/node_modules/playwright-core');
const root=resolve('angular/dist/angular-preview');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css',
 '.json':'application/json','.jar':'application/java-archive','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{
 let path;try{path=decodeURIComponent(new URL(req.url||'/','http://localhost').pathname);}
 catch{res.writeHead(400);res.end();return;}
 const file=resolve(root,'.'+(path==='/'?'/index.html':path));
 if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 try{
   const data=await readFile(file);
   const headers={'Content-Type':types[extname(file)]||'application/octet-stream','Accept-Ranges':'bytes'};
   // CheerpJ expects byte-range support when loading JARs. The CI HTTP
   // fixture must behave like the real Vercel static server, not return a
   // full 200 body for every Range request.
   const range=req.headers.range?.match(/^bytes=([0-9]+)-([0-9]*)$/);
   if(range){
     const start=Number(range[1]),end=range[2]?Number(range[2]):data.length-1;
     if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=data.length){
       res.writeHead(416,{...headers,'Content-Range':'bytes */'+data.length});res.end();return;
     }
     const last=Math.min(end,data.length-1);
     const slice=data.subarray(start,last+1);
     res.writeHead(206,{...headers,'Content-Range':'bytes '+start+'-'+last+'/'+data.length,
       'Content-Length':String(slice.length)});
     res.end(slice);return;
   }
   res.writeHead(200,{...headers,'Content-Length':String(data.length)});res.end(data);
  }catch{res.writeHead(404);res.end('Missing');}
});
let browser;
await new Promise(done=>server.listen(0,'127.0.0.1',done));
try{
 let binary;for(const p of ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser']){
  try{await access(p);binary=p;break;}catch{}
 }
 browser=await chromium.launch({headless:true,...binary?{executablePath:binary}:{},
  args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1360,height:900}});
 const errors=[];const writes=[];const blocked=[];const warnings=[];
 page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')warnings.push(m.text().slice(0,250));});
 page.on('requestfailed',request=>{
   blocked.push({url:request.url(),failure:request.failure()?.errorText||'unknown'});
 });
 page.on('response',response=>{
   if(response.status()>=400)blocked.push({url:response.url(),status:response.status()});
 });const javaNetwork=[];const consoleErrors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().slice(0,260));});
 page.on('requestfailed',r=>{if(/leaningtech|java-runtime|runner-core/.test(r.url()))javaNetwork.push({url:r.url().split('?')[0],failure:r.failure()?.errorText});});
 page.on('response',r=>{if(/leaningtech|java-runtime|runner-core/.test(r.url())&&r.status()>=400)javaNetwork.push({url:r.url().split('?')[0],status:r.status()});});
 page.on('request',r=>{
  if(/supabase\.co/.test(r.url())&&r.method()!=='GET')
   writes.push(r.url());
 });
 const origin='http://127.0.0.1:'+server.address().port;
 const mocked=process.env.BQ_MOCK_JAVA==='1';
 if(mocked){
  // Isolate Angular/iframe/postMessage contract from the third-party CheerpJ CDN.
  // This is NOT a Java execution test and must never replace the real test.
  await page.route('https://cjrtnc.leaningtech.com/5.0/loader.js',route=>route.fulfill({
   status:200,contentType:'application/javascript',
   body:`window.cheerpjInit=async()=>{};
window.cheerpjRunLibrary=async()=>({quest:{JavaRunner:{run:async(source,tests)=>{
 const count=(String(tests).match(/check\\(/g)||[]).length;
 return JSON.stringify({status:'ok',cases:Array.from({length:count},(_,i)=>({passed:true,label:'Case '+(i+1)}))});
}}}});`
  }));
 }
 await page.goto(origin+'/#/angular/problem/two-sum',{waitUntil:'domcontentloaded',timeout:45000});
 const editor=page.getByRole('textbox',{name:'Java solution code'});
 await editor.waitFor({timeout:30000});
 const correct=`class Solution {
 public int[] twoSum(int[] nums,int target) {
  java.util.Map<Integer,Integer> map=new java.util.HashMap<>();
  for(int i=0;i<nums.length;i++){
   int want=target-nums[i];
   if(map.containsKey(want))return new int[]{map.get(want),i};
   map.put(nums[i],i);
  }
  return new int[0];
 }
}`;
 await editor.fill(correct);
 await page.getByRole('button',{name:'Run',exact:true}).click();
 await page.waitForFunction(()=>{
  const summary=document.querySelector('.native-practice .result-summary');
  const error=document.querySelector('.native-practice .run-error');
  return summary||error;
 },{},{timeout:165000});
 const result=await page.locator('.native-practice .result-output').innerText();
 if(!/Java public Run finished/i.test(result)){
  const status=await page.locator('.native-run-status').innerText().catch(()=>'<status unavailable>');
  const frames=page.frames().map(frame=>frame.url().split('?')[0]).filter(url=>url.includes('java-runtime'));
  console.error('JAVA_BOOT_DIAGNOSTICS',JSON.stringify({status,frames,javaNetwork:javaNetwork.slice(-20),consoleErrors:consoleErrors.slice(-12),pageErrors:errors.slice(-8)}));
 }
 const runtimeStatus=await page.locator('.native-run-status').innerText().catch(()=>'(missing runtime status)');
 console.log('JAVA_DEBUG '+JSON.stringify({runtimeStatus,result,
   failedRequests:blocked.slice(0,18),browserWarnings:warnings.slice(0,12),
   pageErrors:errors.slice(0,12)}));
 assert.match(result,/Java public Run finished/i,'Java runtime did not finish: '+result);
 assert.doesNotMatch(result,/Failed|compile error|runtime error/i,'Java public tests did not pass: '+result);
 const cases=await page.locator('.native-practice .native-result-line').allInnerTexts();
 assert.ok(cases.length>=2,'Java runner did not return all public test cases');
 assert.ok(cases.every(c=>c.includes('Passed')),'Java returned a failing test: '+cases.join(' | '));
 assert.equal(await page.getByRole('button',{name:'Submit solution'}).isDisabled(),true);
 // Regression: the exact Java failure reported on Duplicate Detective.
 // In the browser, Set / HashSet must compile without explicit java.util imports,
 // just as the verified Submit service does. Only the real JVM proves this.
 if(!mocked){
   const collections=`class Solution {
 public boolean containsDuplicate(int[] nums) {
  Set<Integer> bucket = new HashSet<>();
  for (int n : nums) {
   if (!bucket.add(n)) return true;
  }
  return false;
 }
}`;
   await page.goto(origin+'/#/angular/problem/contains-duplicate',
     {waitUntil:'domcontentloaded',timeout:30000});
   await editor.waitFor({timeout:30000});
   await editor.fill(collections);
   const runCollections=page.getByRole('button',{name:'Run',exact:true});
   await runCollections.click();
   await page.getByRole('button',{name:'Running…'}).waitFor({timeout:10000});
   await runCollections.waitFor({timeout:90000});
   await page.waitForFunction(()=>{
     const output=document.querySelector('.native-practice .result-output');
     return output?.querySelector('.result-summary, .run-error');
   },undefined,{timeout:90000});
   const collectionOutput=await page.locator('.native-practice .result-output').innerText();
   const collectionCases=await page.locator('.native-practice .native-result-line').allInnerTexts();
   assert.match(collectionOutput,/Java public Run finished/,
     'Missing Set/HashSet imports caused Java compilation failure: '+collectionOutput);
   assert.equal(collectionCases.length,5,'Expected all five Contains Duplicate public cases');
   assert.ok(collectionCases.every(c=>c.includes('Passed')),
     'Duplicate Detective failed with auto-imported Java collections: '+collectionOutput);
   assert.doesNotMatch(collectionOutput,/compile_error|cannot find symbol/,
     'java.util imports were not available to the JVM');
   assert.equal(await editor.inputValue(),collections,'The editor source must retain user-written code without injected imports');
   console.log('PASS real Java: Set/HashSet compile without manual imports, 5/5 Contains Duplicate cases, untouched editor draft');
   await page.goto(origin+'/#/angular/problem/two-sum',
     {waitUntil:'domcontentloaded',timeout:30000});
   await editor.waitFor({timeout:30000});
 }
 // Real JVM negative-path regressions. The CDN-mocked contract intentionally
 // returns success for every case, so run these only against real Java 17.
 if(!mocked){
   const runButton=page.getByRole('button',{name:'Run',exact:true});
   const output=page.locator('.native-practice .result-output');
   // Wrong answers must display red failed cases, not a false green success.
   await editor.fill('class Solution { public int[] twoSum(int[] nums,int target) { return new int[]{0,0}; } }');
   await runButton.click();
   await page.getByRole('button',{name:'Running…'}).waitFor({timeout:10000});
   await runButton.waitFor({timeout:90000});
   await page.waitForFunction(()=>document.querySelectorAll('.native-practice .native-result-line').length>0
     || !!document.querySelector('.native-practice .run-error'),undefined,{timeout:90000});
   const wrongCases=await page.locator('.native-practice .native-result-line').allInnerTexts();
   assert.ok(wrongCases.some(c=>c.includes('Failed')),
     'Wrong answer did not report failed public cases: '+(await output.innerText()));
   assert.equal(await page.getByRole('button',{name:'Submit solution'}).isDisabled(),true);
   // Compiler diagnostics must be visible, and must never unlock the solution.
   await editor.fill('class Solution { public int[] twoSum(int[] nums,int target) { this is invalid java; } }');
   await runButton.click();
   await page.getByRole('button',{name:'Running…'}).waitFor({timeout:10000});
   await runButton.waitFor({timeout:90000});
   await page.waitForFunction(()=>!!document.querySelector('.native-practice .result-summary')
     || !!document.querySelector('.native-practice .run-error'),undefined,{timeout:90000});
   const compileText=await output.innerText();
   assert.match(compileText,/compile|error|invalid|failed|diagnostic/i,
     'Invalid Java lacked visible compilation feedback: '+compileText);
   assert.doesNotMatch(compileText,/✓ Passed/,'Compiler error reused stale passing cases');
   assert.equal(await page.getByRole('button',{name:'Submit solution'}).isDisabled(),true);
   // The editor must remain responsive after both failed runs.
   await editor.fill(correct);
   assert.equal(await editor.inputValue(),correct,'Editor became unusable after compilation failure');
   console.log('PASS: real Java wrong-answer feedback, compile-error feedback, editable recovery, no verified credit');
 }
 await page.getByRole('tab',{name:'Editorial'}).click();
 assert.equal(await page.locator('.reference-code').count(),0,'Guest Run leaked the private reference');
 assert.deepEqual(writes,[],'Guest Run wrote to production Supabase');
 assert.deepEqual(errors,[],'Angular browser errors: '+errors.join(' | '));
 console.log('PASS: '+(mocked?'mock Java iframe/message bridge':'real Java 17 compilation')+', '+cases.length+' public cases, guest Run cannot submit or unlock editorial');
 await page.close();
}finally{
 if(browser)await browser.close();
 await new Promise(done=>server.close(done));
}
