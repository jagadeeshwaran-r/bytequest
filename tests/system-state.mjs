import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Cloud} from '../dist/cloud.js';
import {createCloudHealthStore} from '../dist/cloud-health.js';
import {
  classifyConnectionIssue,connectionPageUrl,issueFromCloudHealth,
  outagePageContent,safeReturnPage
} from '../dist/system-state.js';

assert.equal(classifyConnectionIssue(null,{online:false}),'offline');
for(const status of [429,503,504]){
 assert.equal(classifyConnectionIssue({httpStatus:status}),'busy',
  'Temporary service limits and 5xx busy responses show the delay screen');
}
assert.equal(classifyConnectionIssue({name:'TimeoutError'}),'busy');
assert.equal(classifyConnectionIssue({httpStatus:503,errorCode:'MAINTENANCE'}),'maintenance',
 'Maintenance requires an explicit server code, not a generic 503');
assert.equal(classifyConnectionIssue({httpStatus:503}),'busy',
 'A 503 alone does NOT establish planned maintenance');
assert.equal(classifyConnectionIssue({httpStatus:502}),'unreachable');
assert.equal(classifyConnectionIssue(new TypeError('fetch failed')),'unreachable');
for(const status of [400,401,403,404,409,422]){
 assert.equal(classifyConnectionIssue({httpStatus:status}),null,
  'User-specific authorization and validation failures must not be called service outages');
}
assert.equal(classifyConnectionIssue({httpStatus:503,action:'submission-create'}),null,
 'Private judge outage is not proof the entire platform is down');
assert.equal(classifyConnectionIssue({httpStatus:504,action:'native-run'}),null);
assert.deepEqual(['offline','busy','unreachable','maintenance'].map(k=>outagePageContent(k).kind),
 ['offline','busy','unreachable','maintenance']);
assert.match(outagePageContent('unreachable').detail,/not prove a widespread Supabase or Firebase outage/i);
assert.match(outagePageContent('offline').detail,/drafts/i);
assert.match(outagePageContent('busy').detail,/cloud save/i);
assert.match(outagePageContent('maintenance').intro,/reported/i);
assert.equal(safeReturnPage('community.html'),'community.html');
assert.equal(safeReturnPage('https://evil.test'),'index.html');
assert.equal(safeReturnPage('../studio.html'),'index.html');
assert.equal(safeReturnPage('//evil.test'),'index.html');
assert.equal(safeReturnPage('index.html?problem=two-sum'),'index.html');
assert.equal(connectionPageUrl('offline','leaderboard.html'),'./status.html?issue=offline&from=leaderboard.html');
assert.equal(connectionPageUrl('bogus','javascript:alert(1)'),'./status.html?issue=unreachable&from=index.html');

const store=createCloudHealthStore({clock:()=>1795000000000});
store.setOwner(null);
store.update({kind:'request-error',action:'public-catalog',status:503});
assert.equal(issueFromCloudHealth(store.getState()),'busy',
 'Guests see a recovery screen when even public catalog is unavailable');
store.update({kind:'request-ok',action:'public-catalog'});
assert.equal(store.getState(),null,'Successful public catalog recovery clears transient guest warning');
store.update({kind:'request-error',action:'public-catalog',status:503,errorCode:'MAINTENANCE'});
assert.equal(issueFromCloudHealth(store.getState()),'maintenance');
store.update({kind:'request-error',action:'public-catalog',status:401});
assert.equal(store.getState().kind,'maintenance',
 'An authorization failure must not replace an explicit maintenance incident');
assert.equal(issueFromCloudHealth(null,{online:false}),'offline');

const config={url:'https://example.supabase.co',publishableKey:'sb_publishable_fixture'};
const cloud=new Cloud(()=>{},{
 config,storage:null,sessionFactory:()=>({}),
 fetchImpl:async()=>new Response('Unavailable',{status:503,headers:{'content-type':'text/plain'}})
});
const events=[];cloud.onHealth=signal=>events.push(signal);
await assert.rejects(cloud.publicCatalog({force:true}),/Could not load the problem library/);
assert.equal(events.at(-1).action,'public-catalog');
assert.equal(events.at(-1).status,503);
assert.equal(events.at(-1).kind,'request-error');

const statusHtml=readFileSync('dist/status.html','utf8'),
 pageScript=readFileSync('dist/status-page.js','utf8'),
 styles=readFileSync('dist/system-state.css','utf8'),
 shell=readFileSync('dist/shell.js','utf8'),
 banner=readFileSync('dist/cloud-health.js','utf8');
for(const name of ['statusRetry','statusContinue','statusEyebrow','statusTitle','statusFeedback'])
 assert.ok(statusHtml.includes('id="'+name+'"'),'Page must contain '+name);
assert.ok(statusHtml.includes('aria-live="polite"'),'Recovery feedback must be accessible');
assert.ok(pageScript.includes('safeReturnPage(params.get(\'from\'))'),'Return navigation must be allowlisted');
assert.ok(pageScript.includes('navigator.onLine'),'Retry must respect offline device state');
assert.ok(!pageScript.includes('localStorage.clear(')&&!pageScript.includes('sessionStorage.clear('),
 'Outage display must NEVER erase drafts or auth state');
assert.ok(styles.includes('prefers-reduced-motion'),'Animation must honor reduced-motion preference');
assert.ok(styles.includes('@media(max-width:600px)'),'Full page must work on mobile');
assert.ok(shell.includes('cloud-health.js?v=outage-1'),'Shell must use current health warning');
assert.ok(banner.includes('connectionPageUrl(issue'),'Health warning must link to the appropriate full-page mode');
for(const html of ['index.html','leaderboard.html','community.html','studio.html']){
 assert.ok(readFileSync('dist/'+html,'utf8').includes('outage-page=1')||
  readFileSync('dist/'+html,'utf8').includes('outage-page-1'),
  html+' must load fresh outage-enabled network code');
}
console.log('PASS: offline, busy, unreachable, explicit maintenance, secure navigation and non-destructive recovery screens.');
