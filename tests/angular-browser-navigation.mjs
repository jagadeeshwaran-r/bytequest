// Real Chromium regression: ByteQuest's native shell must remain mounted
// across client-side navigation, never tearing down all UI to a black screen.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,access} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {chromium}=require('../angular/node_modules/playwright-core');
const root=resolve('angular/dist/angular-preview');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml','.jar':'application/java-archive'};
const server=createServer(async(req,res)=>{
  let path;
  try{path=decodeURIComponent(new URL(req.url||'/', 'http://localhost').pathname);}
  catch{res.writeHead(400);res.end();return;}
  const file=resolve(root,'.'+(path==='/'?'/index.html':path));
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  try{
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream',
      'Cache-Control':'public, max-age=3600'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
});
const browserPathCandidates=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];
let executablePath;
for(const path of browserPathCandidates){try{await access(path);executablePath=path;break}catch{}}
await new Promise(resolveServer=>server.listen(0,'127.0.0.1',resolveServer));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
  browser=await chromium.launch({headless:true,
    ...(executablePath?{executablePath}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:900},colorScheme:'dark'});
  await page.goto(origin+'/#/angular',{waitUntil:'domcontentloaded',timeout:40000});
  const nav=page.getByRole('navigation',{name:'Main navigation'});
  await nav.getByRole('link',{name:'Leaderboard'}).waitFor({timeout:20000});
  // Capture the actual DOM instance, not an element selector. If Angular
  // replaces the header, the observer records it even if it reappears quickly.
  await page.evaluate(()=>{
    window.__bytequestNavigation={header:document.querySelector('header.minimal-header'),
      removals:0,styleCount:document.querySelectorAll('link[data-bq-static-style]').length};
    const record=window.__bytequestNavigation;
    new MutationObserver(()=>{
      if(!record.header?.isConnected)record.removals++;
    }).observe(document.body,{subtree:true,childList:true});
  });
  const go=async(name,fragment,selector)=>{
    await nav.getByRole('link',{name}).click();
    await page.waitForURL(url=>url.hash.includes(fragment),{timeout:15000});
    await page.locator(selector).waitFor({timeout:20000});
    const state=await page.evaluate(()=>({
      connected:window.__bytequestNavigation.header?.isConnected,
      removals:window.__bytequestNavigation.removals,
      frameCount:document.querySelectorAll('iframe').length,
      links:document.querySelectorAll('link[data-bq-static-style]').length,
      navigationCount:performance.getEntriesByType('navigation').length
    }));
    assert.equal(state.connected,true,'Persistent ByteQuest header was unmounted navigating to '+name);
    assert.equal(state.removals,0,'Header was removed even briefly navigating to '+name);
    assert.equal(state.frameCount,0,'Native navigation opened an iframe on '+name);
    assert.equal(state.links,30,'Canonical CSS was duplicated, lost or not fully installed');
    assert.equal(state.navigationCount,1,'Full document reload occurred on '+name);
  };
  await go('Leaderboard','/angular/leaderboard','.native-leaderboard');
  await go('Problems','/angular','.native-catalog');
  const problemLink=page.locator('.native-catalog a.problem-title').first();
  await problemLink.waitFor({timeout:25000});
  await problemLink.click();
  await page.waitForURL(url=>url.hash.includes('/angular/problem/'),{timeout:15000});
  await page.locator('.native-practice .editor-pane').waitFor({timeout:20000});
  const after=await page.evaluate(()=>({
    connected:window.__bytequestNavigation.header?.isConnected,
    removals:window.__bytequestNavigation.removals,
    links:document.querySelectorAll('link[data-bq-static-style]').length,
    hasEditor:!!document.querySelector('.native-practice bq-editor'),
    hasIframe:!!document.querySelector('iframe')
  }));
  assert.equal(after.connected,true);
  assert.equal(after.removals,0);
  assert.equal(after.links,30);
  assert.equal(after.hasEditor,true);
  assert.equal(after.hasIframe,false);
  console.log('PASS: 3 Angular navigations, persistent header, zero iframe, zero CSS re-injection, visible Java editor');
}finally{
  if(browser)await browser.close();
  await new Promise(resolveServer=>server.close(resolveServer));
}
