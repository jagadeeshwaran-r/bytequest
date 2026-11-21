// Chromium screenshot-reference geometry: no Firebase credentials or database writes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,access} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('../angular/node_modules/playwright-core');
const root=resolve('angular/dist/angular-preview');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url||'/', 'http://localhost').pathname);}
 catch{res.writeHead(400);res.end();return;}
 const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 try{const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(bytes);}
 catch{res.writeHead(404);res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
 let binary;
 for(const candidate of ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser']){
  try{await access(candidate);binary=candidate;break}catch{}
 }
 browser=await chromium.launch({headless:true,...binary?{executablePath:binary}:{},
  args:['--no-sandbox','--disable-dev-shm-usage']});
 const origin='http://127.0.0.1:'+server.address().port;
 for(const size of [{width:1440,height:900},{width:390,height:844}]){
  const page=await browser.newPage({viewport:size,colorScheme:'dark'});
  await page.addInitScript(()=>{
   if(!localStorage.getItem('bytequest.theme'))localStorage.setItem('bytequest.theme','dark');
  });
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/#/angular/problem/two-sum',{waitUntil:'domcontentloaded',timeout:40000});
  await page.locator('.native-practice .lab .native-editor-area bq-editor').waitFor({timeout:25000});
  const state=await page.evaluate(()=>{
   const rect=element=>{const r=element.getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,height:r.height};};
   const elem=selector=>document.querySelector(selector);
   const lab=elem('.native-practice .lab'),left=elem('.native-practice .problem-pane'),
    right=elem('.native-practice .editor-pane'),editor=elem('.native-practice .native-editor-area'),
    test=elem('.native-practice .test-panel'),bar=elem('.native-practice .runbar');
   return {
    theme:document.documentElement.dataset.theme,
    title:elem('.native-practice .problem-title-row h3')?.textContent?.trim(),
    lab:rect(lab),left:rect(left),right:rect(right),editor:rect(editor),
    test:rect(test),bar:rect(bar),
    radius:parseFloat(getComputedStyle(lab).borderTopLeftRadius),
    panelBackground:getComputedStyle(lab).backgroundColor,
    navRadius:parseFloat(getComputedStyle(elem('header.minimal-header')).borderTopLeftRadius),
    tableCount:elem('.native-practice .pane-tabs')?.querySelectorAll('button').length,
    screenScroll:document.documentElement.scrollWidth,viewport:innerWidth
   };
  });
  assert.equal(state.theme,'dark');assert.match(state.title,/1\. Two Sum/);
  assert.equal(state.tableCount,4);
  assert.ok(state.navRadius>=30,'Glass header not rounded: '+JSON.stringify(state));
  assert.ok(state.radius>=10,'Workspace shell not rounded: '+JSON.stringify(state));
  assert.equal(state.panelBackground,'rgb(15, 15, 20)');
  assert.ok(state.editor.height>150,'Editor collapsed: '+JSON.stringify(state));
  assert.ok(state.test.height>=135,'Test panel collapsed: '+JSON.stringify(state));
  assert.ok(state.bar.height>=50,'Submit controls clipped: '+JSON.stringify(state));
  assert.ok(state.bar.bottom<=state.right.bottom+4,'Runbar outside editor: '+JSON.stringify(state));
  assert.ok(state.screenScroll<=state.viewport+2,'Workspace expands page horizontally: '+JSON.stringify(state));
  if(size.width>=900){
   assert.ok(state.left.right<=state.right.x,'Split panels overlap');
   assert.ok(state.left.width>=300,'Description pane too narrow');
   await page.getByRole('button',{name:'Expand editor'}).click();
   const focus=await page.locator('.native-practice .lab.editor-focus').isVisible();
   assert.equal(focus,true,'Editor expand control does not work');
   await page.getByRole('button',{name:'Exit expanded editor'}).click();
   assert.equal(await page.locator('.native-practice .lab.editor-focus').count(),0);
  }
  await page.goto(origin+'/#/angular/leaderboard',{waitUntil:'domcontentloaded'});
  await page.locator('.native-leaderboard .leader-heading').waitFor({timeout:15000});
  const board=await page.evaluate(()=>{
   const intro=document.querySelector('.native-leaderboard .leader-heading');
   const bg=document.querySelector('.native-bytequest-content');
   const hdr=document.querySelector('header.minimal-header');
   return {theme:document.documentElement.dataset.theme,
     heading:intro?.querySelector('h1')?.textContent?.trim(),
     grid:getComputedStyle(bg).backgroundImage,
     navRadius:parseFloat(getComputedStyle(hdr).borderTopLeftRadius),
     width:document.documentElement.scrollWidth,viewport:innerWidth};
  });
  assert.equal(board.theme,'dark');assert.equal(board.heading,'The leaderboard.');
  assert.match(board.grid,/linear-gradient/);assert.ok(board.navRadius>=30);
  assert.ok(board.width<=board.viewport+2,'Leaderboard overflows viewport');
  if(size.width>900){
   await page.evaluate(()=>localStorage.setItem('bytequest.theme','light'));
   await page.reload({waitUntil:'domcontentloaded'});
   await page.locator('.native-leaderboard .leader-heading').waitFor({timeout:12000});
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
   const light=await page.evaluate(()=>getComputedStyle(document.querySelector('header.minimal-header')).borderTopLeftRadius);
   assert.ok(parseFloat(light)<30,'Dark reference capsule should not leak into light mode');
  }
  assert.deepEqual(errors,[],'Angular page exceptions');
  await page.close();
 }
 console.log('PASS dark workspace/editor expansion and leaderboard shell; desktop/mobile, light mode isolated.');
}finally{
 if(browser)await browser.close();
 await new Promise(done=>server.close(done));
}
