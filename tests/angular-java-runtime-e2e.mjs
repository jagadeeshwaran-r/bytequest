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
 try{const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});
  res.end(data);}catch{res.writeHead(404);res.end('Missing');}
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
 const errors=[];const writes=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{
  if(/supabase\.co/.test(r.url())&&r.method()!=='GET')
   writes.push(r.url());
 });
 const origin='http://127.0.0.1:'+server.address().port;
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
 assert.match(result,/Java public Run finished/i,'Java runtime did not finish: '+result);
 assert.doesNotMatch(result,/Failed|compile error|runtime error/i,'Java public tests did not pass: '+result);
 const cases=await page.locator('.native-practice .native-result-line').allInnerTexts();
 assert.ok(cases.length>=2,'Java runner did not return all public test cases');
 assert.ok(cases.every(c=>c.includes('Passed')),'Java returned a failing test: '+cases.join(' | '));
 assert.equal(await page.getByRole('button',{name:'Submit solution'}).isDisabled(),true);
 await page.getByRole('tab',{name:'Editorial'}).click();
 assert.equal(await page.locator('.reference-code').count(),0,'Guest Run leaked the private reference');
 assert.deepEqual(writes,[],'Guest Run wrote to production Supabase');
 assert.deepEqual(errors,[],'Angular browser errors: '+errors.join(' | '));
 console.log('PASS: real Java 17 compilation, '+cases.length+' public cases, guest Run cannot submit or unlock editorial');
 await page.close();
}finally{
 if(browser)await browser.close();
 await new Promise(done=>server.close(done));
}
