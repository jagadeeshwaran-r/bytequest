// Run with: node tests/bench-cache.mjs
// Measures actual public-catalog Supabase fetch vs the same app's warm-cache
// path on the runner; leaderboard/profile are cache-read ONLY because auth is
// user-specific. Never prints tokens, profile details, or other private data.
import {performance} from 'node:perf_hooks';
import {Cloud} from '../dist/cloud.js';
import {createViewCache} from '../dist/view-cache.js';

function storage(){
  const map=new Map();
  return {
    map,
    get length(){return map.size;},
    key(i){return [...map.keys()][i]??null;},
    getItem:k=>map.get(k)??null,
    setItem:(k,v)=>map.set(k,v),
    removeItem:k=>map.delete(k)
  };
}
const stats=samples=>{
  if(!samples.length)return null;
  const sorted=[...samples].sort((a,b)=>a-b);
  const at=p=>sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)];
  return {n:samples.length,p50_ms:Number(at(.5).toFixed(3)),
    p95_ms:Number(at(.95).toFixed(3)),min_ms:Number(sorted[0].toFixed(3)),
    max_ms:Number(sorted.at(-1).toFixed(3))};
};
async function timed(fn){
  const start=performance.now();await fn();return performance.now()-start;
}
function timedSync(fn){
  const start=performance.now();const value=fn();
  if(value===null||value===undefined)throw Error('Unexpected cache miss');
  return performance.now()-start;
}
function exampleBoard(){
  return {total:1500,pageSize:25,discoverable:true,hasProfile:true,
    me:{rank:11,points:940,solved:140,avatar_url:''},
    users:Array.from({length:25},(_,i)=>({rank:i+1,username:'member_'+i,
      public_id:'user-'+i,display_name:'Member '+i,points:1000-i*3,
      solved:120-i,avatar_url:'',primary_language:'java'}))};
}
function exampleProfile(){
  return {profile:{public_id:'profile-example',username:'example',
    display_name:'Example Learner',avatar_url:'',bio:'Practice every day'},
    stats:{solved:140,points:940,days:Array.from({length:365},(_,i)=>({
      date:'2026-01-01',solves:i%5})),solves:Array.from({length:150},(_,i)=>({
      problem:'problem-'+i,topic:'Linked List',date:'2026-10-01'}))},
    isOwn:true,isFollowing:false,followers:12,following:8};
}

const report={timestamp:new Date().toISOString(),runner:'GitHub Actions, Node.js '+process.version,
  measurement:'Function response path, not full page paint; no Firebase browser session'};
const owner='firebase:benchmark:synthetic';
const boardQuery={scope:'global',period:'all',page:0};
const store=storage(),cache=createViewCache({storage:store});
const board=exampleBoard(),profile=exampleProfile();
cache.saveBoard(owner,boardQuery,board);cache.saveProfile(owner,'example',profile);
const boardWarm=[],profileWarm=[];
for(let i=0;i<100;i++){
  boardWarm.push(timedSync(()=>cache.board(owner,boardQuery,{allowStale:true})));
  profileWarm.push(timedSync(()=>cache.profile(owner,'example',{allowStale:true})));
}
report.leaderboard={source:'Real ByteQuest cache implementation with representative synthetic snapshot',
  warm:stats(boardWarm),cold:null,authRequired:true,networkRequestsOnWarm:0,
  note:'Cold authenticated server latency and Firebase initialization were NOT measured.'};
report.profile={source:'Real ByteQuest cache implementation with representative synthetic snapshot',
  warm:stats(profileWarm),cold:null,authRequired:true,networkRequestsOnWarm:0,
  note:'Online/last-seen remains a live request; this is only the stable profile snapshot.'};
report.sampleBytes={board:JSON.stringify(board).length,profile:JSON.stringify(profile).length};
const storeCatalog=storage();
let networkRequests=0;
const c=new Cloud(()=>{},{storage:storeCatalog,
  sessionFactory:()=>({}),
  fetchImpl:(...args)=>{networkRequests++;return fetch(...args);}});
if(!c.enabled){
  report.catalog={status:'invalid public config'};
}else{
  const cold=[],warm=[];
  let failure=null;
  try{
    for(let i=0;i<5;i++)cold.push(await timed(()=>c.publicCatalog({force:true})));
    if(!storeCatalog.map.size)throw Error('Catalog was not stored (size/quota/validation)');
    const callsBefore=networkRequests;
    for(let i=0;i<60;i++)warm.push(await timed(()=>c.publicCatalog()));
    report.catalog={status:'measured',source:'Live public Supabase REST from GitHub runner',
      cold:stats(cold),warm:stats(warm),coldCalls:5,
      warmCalls:networkRequests-callsBefore,bytes:[...storeCatalog.map.values()][0]?.length??null};
  }catch(e){
    failure=e?.message||String(e);
    report.catalog={status:'unavailable',cold:stats(cold),warm:stats(warm),error:failure,
      note:'No real backend timing result is claimed.'};
  }
}
const fmt=v=>v?('p50 '+v.p50_ms.toFixed(3)+' ms / p95 '+v.p95_ms.toFixed(3)+' ms'):'not measured';
const lines=[
  '# ByteQuest cache latency benchmark',
  'Source: '+report.runner+', '+report.timestamp,
  '**Method:** Time the current application code. Catalog cold path makes real public Supabase requests; warm paths read application cache. Signed-in Firebase pages were not accessed.',
  '',
  '| Data | Before cache (cold) | After cache (warm) | Network requests avoided |',
  '|---|---:|---:|---|',
  '| Problem catalog | '+fmt(report.catalog.cold)+' | '+fmt(report.catalog.warm)+' | '+(report.catalog.status==='measured'?(60-report.catalog.warmCalls)+' / 60 cache hits':'not measured')+' |',
  '| Leaderboard snapshot | Not measured (requires sign-in) | '+fmt(report.leaderboard.warm)+' | 1 ranking API request on a hit |',
  '| Profile snapshot | Not measured (requires sign-in) | '+fmt(report.profile.warm)+' | 1 profile API request on a hit; presence remains live |',
  '',
  'Leaderboard/profile cache reads use representative synthetic entries of '+report.sampleBytes.board+' and '+report.sampleBytes.profile+' bytes. They are not full page-load measurements. Cold catalog measurements reflect the GitHub runner network, not the user\'s home connection.',
  'Catalog status: '+report.catalog.status+(report.catalog.error?' ('+report.catalog.error+')':''),
  '',
  'Raw JSON:',
  '```json',
  JSON.stringify(report,null,2),
  '```'
];
console.log(lines.join('\n'));
if(process.env.GITHUB_STEP_SUMMARY){
  const {appendFileSync}=await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.slice(0,lines.indexOf('Raw JSON:')).join('\n')+'\n');
}
