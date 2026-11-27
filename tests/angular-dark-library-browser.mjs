// Browser visual regression: editorial DARK catalog, unchanged LIGHT catalog.
// Runs only against compiled Angular preview; no account tokens or production writes.
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
  let path;
  try{path=decodeURIComponent(new URL(req.url||'/', 'http://localhost').pathname);}
  catch{res.writeHead(400);res.end();return;}
  const file=resolve(root,'.'+(path==='/'?'/index.html':path));
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  try{const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(bytes);}
  catch{res.writeHead(404);res.end();}
});
let browser;
await new Promise(done=>server.listen(0,'127.0.0.1',done));
try{
  let executablePath;
  for(const candidate of ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser']){
    try{await access(candidate);executablePath=candidate;break}catch{}
  }
  browser=await chromium.launch({headless:true,...executablePath?{executablePath}:{},
    args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    const page=await browser.newPage({viewport,colorScheme:'dark'});
    await page.addInitScript(()=>{if(!localStorage.getItem('bytequest.theme'))localStorage.setItem('bytequest.theme','dark');});
    const origin='http://127.0.0.1:'+server.address().port;
    await page.goto(origin+'/#/angular',{waitUntil:'domcontentloaded',timeout:35000});
    await page.locator('#mapView .problem-table tbody tr').first().waitFor({timeout:25000});
    const metrics=await page.evaluate(()=>{
      const catalog=document.querySelector('#mapView'),nav=document.querySelector('header.minimal-header'),
        table=document.querySelector('#mapView .problem-table'),grid=document.querySelector('#mapView .quest-grid'),
        wrapper=document.querySelector('#mapView .filters');
      const css=element=>getComputedStyle(element);
      const bounds=element=>{const r=element.getBoundingClientRect();
        return {width:r.width,left:r.left,right:r.right};};
      return {
        theme:document.documentElement.dataset.theme,
        navRadius:parseFloat(css(nav).borderTopLeftRadius),
        navBackground:css(nav).backgroundColor,
        tableBackground:css(table).backgroundColor,
        gridBackground:css(grid).backgroundColor,
        mainBackground:css(document.querySelector('.native-bytequest-content')).backgroundImage,
        headerLink:!!document.querySelector('header.minimal-header .minimal-nav a[href*="find"]'),
        cells:table.querySelectorAll('thead th').length,
        points:css(table.querySelector('.problem-points')).display,
        logos:table.querySelectorAll('.company-logo img').length,
        title:catalog.querySelector('h2')?.textContent,
        filters:bounds(wrapper),main:bounds(catalog),scrollWidth:grid.scrollWidth,
        gridClientWidth:grid.clientWidth,
        layoutWidth:document.documentElement.scrollWidth,
        viewWidth:window.innerWidth
      };
    });
    assert.equal(metrics.theme,'dark');
    assert.equal(metrics.title,'Problem library');
    assert.equal(metrics.cells,5,'Missing screenshot reference table columns');
    assert.ok(metrics.navRadius>=30,'Dark glass header not rounded: '+JSON.stringify(metrics));
    assert.equal(metrics.gridBackground,'rgb(14, 14, 18)','Editorial dark table palette mismatch');
    assert.match(metrics.mainBackground,/linear-gradient/,'No subtle grid background');
    assert.equal(metrics.points,'inline','Points must remain visible next to difficulty');
    assert.ok(metrics.logos>0,'Bundled canonical catalog logos did not load');
    assert.ok(metrics.headerLink,'Find friends search shortcut disappeared');
    assert.ok(metrics.layoutWidth<=metrics.viewWidth+2,'Dark layout overflows viewport');
    if(viewport.width<600){
      assert.ok(metrics.scrollWidth>metrics.gridClientWidth,'Mobile table should scroll within its container');
    }
    if(viewport.width>600){
      await page.evaluate(()=>localStorage.setItem('bytequest.theme','light'));
      await page.reload({waitUntil:'domcontentloaded'});
      await page.locator('#mapView .problem-table tbody tr').first().waitFor({timeout:20000});
      const light=await page.evaluate(()=>({
        theme:document.documentElement.dataset.theme,
        table:getComputedStyle(document.querySelector('#mapView .quest-grid')).backgroundColor,
        navRadius:parseFloat(getComputedStyle(document.querySelector('.minimal-header')).borderTopLeftRadius)
      }));
      assert.equal(light.theme,'light');
      assert.notEqual(light.table,'rgb(14, 14, 18)','Light mode must not inherit screenshot dark table');
    }
    await page.close();
  }
  console.log('PASS dark ByteQuest library geometry, genuine logos, visible points, mobile scroll and unchanged light mode');
}finally{
  if(browser)await browser.close();
  await new Promise(done=>server.close(done));
}
