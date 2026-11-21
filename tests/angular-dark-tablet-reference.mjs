// Split-screen visual regression for the original dark ByteQuest reference (~790px).
// Uses the locally built Angular catalog; never reads user data or performs backend writes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,access} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('../angular/node_modules/playwright-core');
const root=resolve('angular/dist/angular-preview');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url||'/','http://localhost').pathname);}
  catch{res.writeHead(400);res.end();return;}
  const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  try{const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(data);}
  catch{res.writeHead(404);res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
  let binary;
  for(const p of ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser']){
    try{await access(p);binary=p;break}catch{}
  }
  browser=await chromium.launch({headless:true,...binary?{executablePath:binary}:{},args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:794,height:920},colorScheme:'dark'});
  await page.addInitScript(()=>{if(!localStorage.getItem('bytequest.theme'))localStorage.setItem('bytequest.theme','dark');});
  await page.goto('http://127.0.0.1:'+server.address().port+'/#/angular',{waitUntil:'domcontentloaded'});
  await page.locator('.native-catalog .problem-table tbody tr').first().waitFor({timeout:25000});
  const rect=s=>{const r=s.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  const m=await page.evaluate(()=>{
    const sel=s=>document.querySelector(s);
    const r=s=>{const b=s.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom};};
    const nav=sel('.minimal-header'),find=sel('.native-compact-find'),chat=sel('.native-shell-tools'),
      brand=sel('.minimal-brand'),profile=sel('.profile-dropdown'),
      content=sel('.native-catalog'),input=sel('.native-catalog .search-box'),
      filters=[...sel('.native-catalog .filters').querySelectorAll('select')],
      table=sel('.native-catalog .problem-table'),cols=[...table.querySelectorAll('thead th')];
    return {theme:document.documentElement.dataset.theme,grid:getComputedStyle(nav).display,
      header:r(nav),brand:r(brand),profile:r(profile),find:r(find),chat:r(chat),
      findDisplay:getComputedStyle(find).display,findText:find.textContent.trim(),
      content:r(content),input:r(input),selectors:filters.map(r),
      table:r(table),columns:cols.map(r),hintVisible:getComputedStyle(sel('.catalog-meta-hint')).display!=='none',
      scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,
      logoCount:table.querySelectorAll('.company-logo img').length};
  });
  assert.equal(m.theme,'dark');
  assert.equal(m.grid,'grid','Compact header must use two rows');
  assert.ok(m.header.height>=105&&m.header.height<=125,'Header height mismatch: '+JSON.stringify(m));
  assert.equal(m.findDisplay,'flex');
  assert.match(m.findText,/Find friends/);
  assert.ok(m.find.y>m.brand.y+12,'Search must sit below the logo/nav row');
  assert.ok(m.chat.y>=m.find.y-5&&m.chat.x>=m.find.right-5,'Chat must be beside search');
  assert.ok(m.profile.y<m.find.y,'Profile should occupy upper-right');
  assert.ok(m.content.x>=10&&m.content.x<=22,'Catalog should have compact side gutters');
  assert.ok(m.input.width>=m.content.width-8,'Search should span catalog width');
  assert.equal(m.selectors.length,2);
  assert.ok(Math.abs(m.selectors[0].width-m.selectors[1].width)<10,'Filters should be two equal columns');
  assert.ok(Math.abs(m.selectors[0].y-m.selectors[1].y)<2,'Filters should share row');
  assert.ok(m.columns[1].width>240,'Title column should not be squeezed');
  assert.ok(m.columns[2].width>=160&&m.columns[2].width<=180,'Company column mismatch');
  assert.ok(m.columns[3].width>=110&&m.columns[3].width<=130,'Difficulty column mismatch');
  assert.ok(m.columns[4].width>=90&&m.columns[4].width<=110,'Status column mismatch');
  assert.ok(m.hintVisible,'Reference hint must be visible in catalog metadata');
  assert.ok(m.logoCount>0,'Company logos must remain loaded');
  assert.ok(m.scrollWidth<=m.viewport+2,'Tablet layout must not overflow viewport');

  // The search shortcut is an actual navigable control, not a decorative mock.
  await page.getByRole('link',{name:'Find friends'}).filter({visible:true}).last().click();
  await page.getByText('Sign in to discover learners.').waitFor({timeout:12000});
  await page.evaluate(()=>localStorage.setItem('bytequest.theme','light'));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('header.minimal-header').waitFor();
  const light=await page.evaluate(()=>({
    theme:document.documentElement.dataset.theme,
    compactDisplay:getComputedStyle(document.querySelector('.native-compact-find')).display
  }));
  assert.equal(light.theme,'light');
  assert.equal(light.compactDisplay,'none','Light mode should keep its independent layout');
  await page.close();
  console.log('PASS tablet 794px reference: two-row header, search/chat, table geometry, navigation, light isolation');
}finally{
 if(browser)await browser.close();
 await new Promise(done=>server.close(done));
}
