import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rankingCachePlan} from '../dist/leaderboard-model.js';
import {createDatabase} from '../supabase/functions/bytequest-firebase/database.js';

const saved={users:[{username:'a'}],total:1};
assert.deepEqual(rankingCachePlan({fresh:saved,stale:saved}),{initial:saved,revalidate:false});
assert.deepEqual(rankingCachePlan({fresh:null,stale:saved}),{initial:saved,revalidate:true});
assert.deepEqual(rankingCachePlan({fresh:saved,force:true}),{initial:saved,revalidate:true});
assert.deepEqual(rankingCachePlan({}),{initial:null,revalidate:true});

const source=readFileSync('dist/leaderboard.js','utf8');
assert.ok(source.includes('renderRankings(plan.initial,{cached:true,key})'),
  'Saved results must paint before the live request');
assert.ok(source.includes('if(!plan.revalidate)'),
  'Fresh cached rankings should not generate a redundant request');
assert.ok(source.includes('if(plan.initial)setMessage'),
  'A failed background refresh must preserve saved rankings');
assert.ok(source.includes('loader.cancel();'), 'Switching filters cancels stale results');
assert.ok(source.includes("load({force:true})"),'Manual refresh must always fetch');
assert.ok(source.includes('cache.saveBoard(owner,filters,fresh)'),'Fresh responses must update the cache');

const baseProfile={public_id:'profile1',username:'one',display_name:'One'};
let pending=[],requests=[];
const fixtures={
 '/rpc/bytequest_community':{profile:{...baseProfile},stats:{solved:1,points:10},isFollowing:false},
 '/rpc/bytequest_read_presence':{presence:{visible:false}},
 '/rpc/bytequest_profile_rank':{rank:5,isAdmin:false,solved:7,points:90},
 '/rpc/bytequest_profile_activity':{days:['2026-11-21'],solves:[]},
 '/rpc/bytequest_profile_insights':{details:{github_url:'https://github.com/example'},skills:[]}
};
const db=createDatabase('https://fixture.supabase.co','test-key',{fetchImpl:async(url,options)=>{
 const path=new URL(url).pathname.replace('/rest/v1','');
 requests.push({path,body:JSON.parse(options.body)});
 if(path==='/rpc/bytequest_community')
   return new Response(JSON.stringify(fixtures[path]),{headers:{'Content-Type':'application/json'}});
 return new Promise(resolve=>pending.push({path,resolve}));
}});
const flight=db.community('verified-owner','profile',{target:'profile1'});
for(let i=0;i<12;i++)await Promise.resolve();
assert.equal(pending.length,4,'Presence, ranking, activity and insights must start concurrently');
for(const job of pending){
 job.resolve(new Response(JSON.stringify(fixtures[job.path]),{headers:{'Content-Type':'application/json'}}));
}
const result=await flight;
assert.equal(result.profile.github_url,'https://github.com/example');
assert.equal(result.stats.solved,7);
assert.equal(result.stats.points,90);
assert.equal(result.stats.days[0],'2026-11-21');
assert.equal(result.ranking.rank,5);
assert.equal(result.presence.visible,false);
assert.ok(requests.every(c=>c.body.viewer_id===undefined||c.body.viewer_id==='verified-owner'),
  'Every enrichment read must bind to verified token identity');
console.log('PASS: fast cached rankings, manual refresh, account-safe concurrent profile enrichment');
