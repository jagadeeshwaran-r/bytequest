// Live, read-only staging smoke: deployed Angular assets, Firebase public
// project configuration / authorized domain, and Google OAuth popup initiation.
// NEVER supplies credentials or writes to Supabase or Firebase accounts.
// Completion of an actual Google login still requires an interactive test user.
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('../angular/node_modules/playwright-core');

const origin='https://bytequest-angular-staging.vercel.app';
const cfgText=await readFile('angular/src/app/core/auth.service.ts','utf8');
const value=name=>{
 const match=cfgText.match(new RegExp('\\b'+name+":'([^']+)'"));
 assert.ok(match,'Missing browser Firebase config: '+name);
 return match[1];
};
const projectId=value('projectId'),key=value('apiKey');
assert.equal(projectId,'bytequest-7b841');
assert.equal(value('authDomain'),projectId+'.firebaseapp.com');

const get=async pathname=>{
 const response=await fetch(origin+pathname,{signal:AbortSignal.timeout(20000)});
 assert.equal(response.status,200,pathname+' could not be fetched from live staging');
 return response;
};
const home=await (await get('/')).text();
assert.match(home,/<title>ByteQuest/);
const stage=await (await get('/staging-backend.json')).json();
assert.equal(stage.enabled,true,'The separate staging database must be enabled for authenticated E2E');
assert.equal(stage.apiUrl,'https://ainsxwxvfybhwdennsvh.supabase.co/functions/v1/bytequest-firebase');
assert.match(stage.publishableKey,/^sb_publishable_/,'Staging must use only public API credentials');
const catalog=await (await get('/catalog.json')).json();
assert.ok(Array.isArray(catalog)&&catalog.length>=10,'Live Angular site has no usable catalog');
assert.ok(catalog.every(x=>!Object.hasOwn(x,'hiddenTests')&&!Object.hasOwn(x,'reference')),
 'Staging site exposes private Java problem material');

const remote=await fetch('https://identitytoolkit.googleapis.com/v1/projects?key='+encodeURIComponent(key),{
 headers:{Origin:origin},signal:AbortSignal.timeout(20000)
});
const raw=await remote.json();
assert.equal(remote.status,200,'Firebase public Auth config unavailable: '+JSON.stringify(raw).slice(0,240));
// The public Identity Toolkit getProjects endpoint returns the numeric Google
// project number, whereas Firebase SDK projectId is the human-readable slug.
const projectNumber=value('appId').split(':')[1];
assert.equal(String(raw.projectId),projectNumber,'Frontend Firebase project number mismatch');
assert.ok(Array.isArray(raw.authorizedDomains),'Firebase did not return authorized domains');
assert.ok(raw.authorizedDomains.includes(new URL(origin).hostname),
 'Staging domain is not in Firebase authorizedDomains; add it under Authentication > Settings');
const providers=Array.isArray(raw.idpConfig)?raw.idpConfig:[];
if(providers.length){
 const google=providers.find(p=>p.providerId==='google.com');
 assert.ok(google&&google.enabled!==false,'Google provider disabled in Firebase project configuration');
}
console.log('PASS live Firebase: API key identifies correct project and staging hostname is authorized');
console.log('PASS live website: index, public catalog, no hidden code, writes pointed exclusively at isolated staging');

let browser;
try{
 let executablePath;
 for(const path of ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser']){
  try{await access(path);executablePath=path;break;}catch{}
 }
 browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{}),
  args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const critical=[];
 page.on('pageerror',err=>critical.push(err.message));
 await page.goto(origin+'/#/angular',{waitUntil:'domcontentloaded',timeout:35000});
 await page.getByRole('button',{name:/Account/}).first().waitFor({timeout:25000});
 await page.getByRole('button',{name:/Account/}).first().click();
 const button=page.getByRole('button',{name:'Sign in with Google'});
 await button.waitFor({timeout:15000});
 await page.waitForFunction(()=>{
  const el=[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Sign in with Google'));
  return el&&!el.disabled;
 },undefined,{timeout:15000});
 const popupPromise=page.waitForEvent('popup',{timeout:20000});
 await button.click();
 const popup=await popupPromise;
 await popup.waitForURL(u=>['accounts.google.com',projectId+'.firebaseapp.com'].some(x=>u.hostname===x),{timeout:20000});
 const popUrl=new URL(popup.url());
 assert.ok(['accounts.google.com',projectId+'.firebaseapp.com'].includes(popUrl.hostname));
 assert.ok(!critical.some(x=>/unauthorized-domain|invalid-api-key|operation-not-allowed/i.test(x)),
  'OAuth popup reported a Firebase configuration error');
 console.log('PASS live browser: Google OAuth popup launched with authorized Firebase project');
 console.log('NOT TESTED: Google credential submission, callback completion, Firebase token, real Supabase write E2E');
 await page.close();await popup.close().catch(()=>{});
}finally{await browser?.close();}
