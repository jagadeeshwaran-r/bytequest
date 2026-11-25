import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validPublicConfig} from '../dist/public-config.js';
import {fetchMaintenanceStatus} from '../dist/maintenance-api.js';

// Regression: legacy navigation must not load Cloud/Firebase/catalog modules
// just to perform its mandatory maintenance preflight.
const apiSource=readFileSync('dist/maintenance-api.js','utf8');
const cloudSource=readFileSync('dist/cloud.js','utf8');
assert.ok(apiSource.includes("from './public-config.js'"));
assert.ok(!apiSource.includes("from './cloud.js"),'Preflight must not import heavyweight Cloud');
assert.ok(cloudSource.includes('from "./public-config.js"'),'Cloud must share the same validation rules');
const config={url:'https://bytequest.test',publishableKey:'sb_publishable_test123'};
assert.equal(validPublicConfig(config),true);
assert.equal(validPublicConfig({...config,url:'http://bytequest.test'}),false);
assert.equal(validPublicConfig({...config,url:'https://bytequest.test/path'}),false);
assert.equal(validPublicConfig({...config,publishableKey:'bad'}),false);
let called=0;
const status=await fetchMaintenanceStatus({
  config,timeoutMs:1000,
  fetchImpl:async(url,options)=>{
    called++;
    assert.equal(url,'https://bytequest.test/functions/v1/bytequest-firebase/maintenance');
    assert.equal(options.headers.apikey,config.publishableKey);
    assert.equal(options.cache,'no-store','Status must still be freshly verified by the server');
    return {ok:true,json:async()=>({active:false,upcoming:false})};
  }
});
assert.equal(called,1);
assert.equal(status.active,false);
await assert.rejects(()=>fetchMaintenanceStatus({
  config,fetchImpl:async()=>({ok:true,json:async()=>({active:'false',upcoming:false})})
}),/Invalid maintenance status/);
const pendingBodyRule='html[data-bq-maintenance-check="pending"] body{visibility:hidden!important}';
for(const page of ['index','community','leaderboard','studio']){
  const html=readFileSync('dist/'+page+'.html','utf8');
  assert.ok(html.includes(pendingBodyRule),page+' must hide protected content until status approval');
  assert.ok(html.includes('html[data-bq-maintenance-check="pending"]::before{content:"ProSolver"'),
    page+' must show a branded, non-interactive placeholder instead of a blank screen');
  assert.ok(html.includes('prefers-reduced-motion:reduce'),page+' must respect reduced motion');
  assert.ok(html.includes('dataset.bqMaintenanceCheck="pending"'),page+' must initialize safely');
}
const gate=readFileSync('dist/maintenance-gate.js','utf8');
assert.ok(gate.includes('if(status.active===true){blockAndRedirect'),'Confirmed maintenance must still block all pages');
assert.ok(gate.includes('if(!launched)await launch()'),'Applications must launch only after server approval');
console.log('PASS: lightweight legacy preflight, branded pending state, strict maintenance enforcement');
