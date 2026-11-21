// Browser end-to-end checks for behavior actually executable without user credentials.
// Never fabricates authenticated success or posts to the production Supabase backend.
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
// Regression for the inherited legacy [data-theme=dark] textarea background,
// which covered the syntax layer and made valid starter Java look blank.
async function assertVisibleEditor(page,label){
 const state=await page.evaluate(()=>{
  const input=document.querySelector('bq-editor textarea.source-input');
  const mirror=document.querySelector('bq-editor pre.syntax-layer');
  const code=mirror?.querySelector('code');
  if(!input||!mirror||!code)return null;
  const inputStyle=getComputedStyle(input),mirrorStyle=getComputedStyle(mirror),
    codeStyle=getComputedStyle(code),rect=mirror.getBoundingClientRect();
  return{
   content:input.value,
   syntax:code.textContent||'',
   inputBackground:inputStyle.backgroundColor,
   inputTextFill:inputStyle.webkitTextFillColor,
   mirrorColor:codeStyle.color,
   mirrorDisplay:mirrorStyle.display,
   mirrorVisibility:mirrorStyle.visibility,
   mirrorOpacity:Number(mirrorStyle.opacity),
   mirrorWidth:rect.width,mirrorHeight:rect.height,
   theme:document.documentElement.getAttribute('data-theme')
  };
 });
 assert.ok(state,label+': missing highlighted editor DOM');
 assert.match(state.content,/class Solution/,label+': Java starter source missing');
 assert.equal(state.syntax,state.content+'\n',label+': highlighted Java mirror is empty or stale');
 assert.match(state.inputBackground,/^rgba\(0, 0, 0, 0\)$|^transparent$/,
  label+': opaque textarea hides visible syntax layer: '+JSON.stringify(state));
 assert.equal(state.mirrorDisplay,'block',label+': highlight layer is hidden');
 assert.equal(state.mirrorVisibility,'visible',label+': highlight layer is invisible');
 assert.equal(state.mirrorOpacity,1,label+': highlight layer is fully transparent');
 assert.ok(state.mirrorWidth>100&&state.mirrorHeight>100,label+': highlight layer has no visible area');
 assert.doesNotMatch(state.mirrorColor,/rgba\(.+, 0\)|transparent/,
  label+': highlight text is transparent');
 console.log('PASS visible Java starter in '+state.theme+' mode: '+label);
}
const server=createServer(async(req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url||'/','http://localhost').pathname);}
 catch{res.writeHead(400);res.end();return;}
 const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 try{const bytes=await readFile(file);
   res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});
   res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
 const origin='http://127.0.0.1:'+server.address().port;
 let binary;
 for(const p of ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser']){
  try{await access(p);binary=p;break;}catch{}
 }
 browser=await chromium.launch({headless:true,...binary?{executablePath:binary}:{},
  args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const page=await browser.newPage({viewport,colorScheme:'dark'});
  const faults=[];
  const writes=[];
  const productionRequests=[];
  page.on('pageerror',error=>faults.push(error.message));
  page.on('request',request=>{
   if(request.url().includes('zwubrziriuppkldrdoos.supabase.co'))
    productionRequests.push(request.method()+' '+request.url());
  });
  page.on('request',request=>{
   if(request.method()!=='GET'&&/supabase\.co/.test(request.url()))
    writes.push({method:request.method(),url:request.url()});
  });
  await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:30000});
  const nav=page.getByRole('navigation',{name:'Main navigation'});
  await nav.getByRole('link',{name:'Problems'}).waitFor({timeout:30000});
  await page.locator('.native-catalog .problem-table tbody tr a.problem-title').first().waitFor({timeout:25000});
  const firstLink=page.locator('.native-catalog .problem-table tbody tr a.problem-title').first();
  const name=(await firstLink.innerText()).trim();
  assert.ok(name,'A published problem must appear');
  // Filter/clear must update only the problem list, not replace the header.
  const header=await page.locator('header.minimal-header').elementHandle();
  const search=page.getByRole('textbox',{name:'Search problems'});
  await search.fill(name);
  const remaining=await page.locator('.native-catalog .problem-table tbody tr a.problem-title').allInnerTexts();
  assert.ok(remaining.some(x=>x.trim()===name),'Search loses its matching problem');
  await page.getByRole('button',{name:'Clear search'}).click();
  await page.waitForFunction(()=>document.querySelector('input[aria-label="Search problems"]')?.value==='',undefined,{timeout:6000});
  assert.equal(await search.inputValue(),'');
  // Open and edit a real published problem. No server writes may follow.
  await firstLink.click();
  const editor=page.getByRole('textbox',{name:'Java solution code'});
  await editor.waitFor({timeout:20000});
  const starter=await editor.inputValue();
  assert.ok(starter.includes('class Solution')||starter.includes('Solution'),'Starter Java is missing');
  await assertVisibleEditor(page,'initial problem on '+viewport.width+'px');
  // Insert a synthetic status banner solely to test the layout without
  // forging an authenticated submission. The real banner is Angular-owned.
  const layout=await page.evaluate(()=>{
    const pane=document.querySelector('.native-practice .editor-pane');
    const bar=pane?.querySelector('.runbar');
    if(!pane||!bar)return null;
    const banner=document.createElement('div');
    banner.className='native-submit-feedback is-accepted';
    banner.innerHTML='<strong>✓ Accepted — public tests verified</strong>'+
      '<span>All 5 published cases passed. Your accepted solution is stored in staging.</span>';
    bar.before(banner);
    const rect=element=>{const r=element.getBoundingClientRect();
      return {top:r.top,bottom:r.bottom,height:r.height};};
    const result={pane:rect(pane),bar:rect(bar),banner:rect(banner)};
    banner.remove();
    return result;
  });
  assert.ok(layout,'No editable workspace geometry');
  assert.ok(layout.banner.height>20,'Submission result banner collapsed');
  assert.ok(layout.banner.bottom<=layout.bar.top+2,
    'Result banner overlaps Submit buttons: '+JSON.stringify(layout));
  assert.ok(layout.bar.bottom<=layout.pane.bottom+3,
    'Submit buttons were clipped when a server verdict appeared: '+JSON.stringify(layout));
  assert.ok(layout.banner.top>=layout.pane.top,
    'Server verdict is outside the visible editor: '+JSON.stringify(layout));
  console.log('PASS visible Submit feedback geometry at '+viewport.width+'px');

  // Explicit regression for the problem where the user saw a blank code pane.
  await page.goto(origin+'/#/angular/problem/contains-duplicate',{waitUntil:'domcontentloaded'});
  await editor.waitFor({timeout:25000});
  await page.waitForFunction(()=>{
    const code=document.querySelector('bq-editor textarea.source-input');
    return code?.value.includes('containsDuplicate');
  },undefined,{timeout:20000});
  await assertVisibleEditor(page,'Contains Duplicate on '+viewport.width+'px');
  await page.goto(origin+'/#/angular/problem/two-sum',{waitUntil:'domcontentloaded'});
  await editor.waitFor({timeout:20000});
  await assertVisibleEditor(page,'Two Sum re-opened on '+viewport.width+'px');

  // Exercise actual editor keystrokes in Chromium: IntelliJ-style pair insertion,
  // pair highlight and paired backspace (unit tests alone cannot catch wiring issues).
  await editor.fill('');
  await editor.press('{');
  await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Java solution code"]')?.value==='{}',
    undefined,{timeout:5000});
  assert.equal(await page.locator('.syntax-layer .matching-brace').count(),2,
    'Typing an opening brace did not highlight the matching pair');
  await page.waitForFunction(()=>{
    const el=document.querySelector('textarea[aria-label="Java solution code"]');
    return el?.selectionStart===1 && el?.selectionEnd===1;
  },undefined,{timeout:5000});
  await editor.press('Backspace');
  await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Java solution code"]')?.value==='',
    undefined,{timeout:5000});
  assert.equal(await page.locator('.syntax-layer .matching-brace').count(),0,
    'Pair highlight remained after deleting both braces');
  const marker='// staging browser test draft '+viewport.width;
  await editor.fill(starter+'\n'+marker);
  await page.getByRole('tab',{name:'Editorial'}).click();
  assert.equal(await page.locator('.native-practice .reference-code').count(),0,
    'Guest must not see a private Java reference');
  await page.getByRole('tab',{name:'Submissions'}).click();
  assert.equal(await page.getByRole('button',{name:'Submit solution'}).isDisabled(),true,
    'Verified submission must remain unavailable without isolated staging');
  await page.getByRole('link',{name:'← Problems'}).click();
  assert.equal(await page.locator('header.minimal-header').count(),1);
  assert.equal(await header.evaluate(el=>el.isConnected),true,'Navigating destroyed persistent header');
  // Query state survives route transitions by design.
  const again=page.locator('.native-catalog a.problem-title').filter({hasText:name}).first();
  await again.click();
  assert.ok((await editor.inputValue()).includes(marker),'Draft was lost on navigation');
  await page.reload({waitUntil:'domcontentloaded'});
  await editor.waitFor({timeout:20000});
  assert.ok((await editor.inputValue()).includes(marker),'Draft was lost on hard reload');
  // Guest accounts cannot silently edit profile, chat or Creator Studio.
  await nav.getByRole('link',{name:'Leaderboard'}).click();
  await page.getByText('Better, together.').waitFor();
  await nav.getByRole('link',{name:'Find friends'}).click();
  await page.getByText('Sign in to discover learners.').waitFor();
  await page.getByRole('button',{name:/Account/}).first().click();
  await page.getByRole('link',{name:'Problem studio'}).click();
  await page.getByText('Connect your ByteQuest account').waitFor();
  await page.getByRole('button',{name:/Account/}).first().click();
  await page.getByRole('link',{name:'Edit profile'}).click();
  await page.getByText('Sign in to edit your profile.').waitFor();
  await page.getByRole('button',{name:'Messages and updates'}).click();
  await page.getByText('Sign in to read private messages and notifications.').waitFor();
  await page.getByRole('button',{name:'Close messages'}).click();
  // Light/dark settings must survive navigation and refresh.
  await page.getByRole('button',{name:/Account/}).first().click();
  await page.getByRole('button',{name:'☀ Light'}).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.reload({waitUntil:'domcontentloaded'});
  await nav.getByRole('link',{name:'Problems'}).waitFor({timeout:15000});
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.goto(origin+'/#/angular/problem/contains-duplicate',{waitUntil:'domcontentloaded'});
  await editor.waitFor({timeout:25000});
  await assertVisibleEditor(page,'Contains Duplicate light theme on '+viewport.width+'px');
  const ui=await page.evaluate(()=>({
    app:!!document.querySelector('bq-root'),
    iframe:document.querySelectorAll('iframe').length,
    css:document.querySelectorAll('link[data-bq-static-style]').length
  }));
  assert.equal(ui.app,true);assert.equal(ui.iframe,0);assert.equal(ui.css,30);
  assert.deepEqual(writes,[],'Guest testing made unexpected production backend writes');
  assert.deepEqual(productionRequests,[],
    'Staging must not call live Supabase, including maintenance/status reads');
  assert.deepEqual(faults,[],'Angular runtime errors encountered: '+faults.join(' | '));
  console.log('PASS guest '+viewport.width+'px: search, editor, draft persistence, routes, auth gates, theme, no API writes');
  await page.close();
 }
 // Deliberately drop all Supabase traffic. The canonical public snapshot must
 // still render usable navigation and never reveal private challenge material.
 const bundled=JSON.parse(await readFile(resolve(root,'catalog.json'),'utf8'));
 assert.ok(bundled.length>0,'No offline catalog is available');
 assert.ok(bundled.every(problem=>!Object.hasOwn(problem,'hiddenTests')
   &&!Object.hasOwn(problem,'reference')&&!Object.hasOwn(problem,'hidden')),
   'Offline starter catalog accidentally includes protected tests or editorial code');
 const disconnected=await browser.newPage({viewport:{width:390,height:844}});
 const offlineFaults=[];
 const unsafeWrites=[];
 disconnected.on('pageerror',error=>offlineFaults.push(error.message));
 disconnected.on('request',request=>{
   if(request.method()!=='GET'&&/supabase\\.co/.test(request.url()))
     unsafeWrites.push(request.url());
 });
 await disconnected.route(/supabase\.co/,route=>route.abort('internetdisconnected'));
 await disconnected.goto(origin+'/#/angular',{waitUntil:'domcontentloaded',timeout:30000});
 await disconnected.locator('.native-catalog .problem-table tbody tr a.problem-title')
   .first().waitFor({timeout:25000});
 await disconnected.goto(origin+'/#/angular/problem/not-a-real-problem',
   {waitUntil:'domcontentloaded',timeout:30000});
 await disconnected.getByText('Problem not found.').waitFor({timeout:10000});
 await disconnected.getByRole('link',{name:'Back to library'}).click();
 await disconnected.locator('.native-catalog .problem-table tbody tr a.problem-title')
   .first().waitFor({timeout:15000});
 assert.deepEqual(unsafeWrites,[],'Offline guest traffic attempted a database write');
 assert.deepEqual(offlineFaults,[],'Angular crashed without its remote API');
 console.log('PASS offline API: safe starter catalog, missing route, recovered navigation, no data writes');
 await disconnected.close();
}finally{
 if(browser)await browser.close();
 await new Promise(done=>server.close(done));
}
