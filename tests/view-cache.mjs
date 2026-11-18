import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createViewCache,LEADERBOARD_TTL_MS,PROFILE_TTL_MS,ACCOUNT_TTL_MS,prefetchCommunityViews} from '../dist/view-cache.js';
import {companyIcons} from '../dist/companies.js';

const entries=new Map();
const store={
 get length(){return entries.size;},
 key(i){return [...entries.keys()][i]??null;},
 getItem(key){return entries.get(key)??null;},
 setItem(key,value){entries.set(key,value);},
 removeItem(key){entries.delete(key);}
};
let now=5000000;
const make=()=>createViewCache({storage:store,now:()=>now});
const cache=make(),viewer='firebase:project:alice',other='firebase:project:bob';
const query={scope:'friends',period:'week',page:1};
const ranking={users:[{username:'alice',rank:5,points:100}],total:30,me:{rank:5,points:100}};
assert.equal(cache.board(viewer,query),null);
cache.saveBoard(viewer,query,ranking);
assert.deepEqual(make().board(viewer,query),ranking,'Rankings must persist through a same-tab page navigation.');
assert.equal(cache.board(other,query),null,'Ranks must be isolated by signed-in viewer.');
assert.equal(cache.board(viewer,{...query,page:0}),null,'Different pages have distinct ranking caches.');
assert.equal(cache.board(viewer,{...query,scope:'global'}),null,'Friends and global rankings are separate.');
assert.equal(cache.board(viewer,{...query,period:'month'}),null,'Ranking periods have independent caches.');
assert.equal(entries.size,1,'A single rank query stores only one snapshot.');

const profile={profile:{public_id:'user-123',username:'fixture',display_name:'Example'},stats:{solved:20,streak:3},isFollowing:true,presence:{visible:true,online:true,lastSeenMs:Date.now()}};
cache.saveProfile(viewer,'fixture',profile);
const saved=make().profile(viewer,'FIXTURE');
assert.equal(saved.profile.display_name,'Example');
assert.equal(saved.isFollowing,true);
assert.equal('presence' in saved,false,'Online and last-seen must never be read from a cached profile.');
assert.ok(![...entries.values()].some(x=>x.includes('"lastSeenMs"')),'Last-seen must never be stored.');
assert.equal(cache.profile(other,'fixture'),null,'Other accounts must not see viewer-specific profile data.');

now+=PROFILE_TTL_MS+1;
assert.equal(cache.profile(viewer,'fixture'),null,'Profile caches expire after two minutes.');
assert.deepEqual(cache.board(viewer,query),ranking,'Leaderboard cache lives longer than profile cache.');
now+=LEADERBOARD_TTL_MS;
assert.equal(cache.board(viewer,query),null,'Rankings expire and must be refetched.');
now=5000000;

cache.saveProfile(viewer,'fixture',profile);
cache.invalidateProfile(viewer,'fixture');
assert.equal(cache.profile(viewer,'fixture'),null,'Follow/unfollow must be able to invalidate profile.');
cache.saveProfile(viewer,'fixture',profile);
cache.clearOwner(viewer);
assert.equal(cache.profile(viewer,'fixture'),null,'Account switches/sign-out clear previous viewer caches.');
assert.equal(cache.board(viewer,query),null);

cache.saveBoard(viewer,query,ranking);
const key=[...entries.keys()][0];
entries.set(key,'not json');
assert.equal(cache.board(viewer,query),null,'Corrupted browser cache is ignored.');
entries.clear();
const disabled={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
const safe=createViewCache({storage:disabled,now:()=>now});
assert.doesNotThrow(()=>safe.saveBoard(viewer,query,ranking));
assert.equal(safe.board(viewer,query),null);
assert.doesNotThrow(()=>safe.invalidateBoard(viewer,query));

const visible=companyIcons(['Google','Meta','Amazon']);
assert.equal((visible.match(/class="company-logo"/g)||[]).length,3);
assert.ok(!visible.includes('company-overflow-count'),'Three company tags must not show +N.');
const more=companyIcons(['Google','Meta','Amazon','Microsoft','Netflix']);
assert.equal((more.match(/class="company-logo"/g)||[]).length,5);
assert.ok(more.includes('class="company-overflow-count"'));
assert.ok(more.includes('>+2</button>'));
const pos=more.indexOf('class="company-overflow"');
assert.equal((more.slice(0,pos).match(/class="company-logo"/g)||[]).length,3,'Only first three logos are visible in the table.');
assert.equal((more.slice(pos).match(/class="company-logo"/g)||[]).length,2,'Two extra logos are in the hover panel.');
assert.equal(companyIcons([]),'');
assert.ok(companyIcons(['Google','<img src=x onerror=alert(1)>','Amazon','Netflix']).includes('&lt;img'));
assert.ok(!companyIcons(['Google','<img src=x onerror=alert(1)>','Amazon','Netflix']).includes('<img src=x onerror'));

const css=readFileSync('dist/company-overflow.css','utf8');
assert.ok(css.includes('visibility:hidden'));
assert.ok(css.includes('.company-overflow:hover .company-overflow-panel'));
assert.ok(css.includes('.company-overflow:has(:focus-visible) .company-overflow-panel'),'Keyboard focus keeps hidden tags accessible.');
for(const page of ['index.html','studio.html']){
 const html=readFileSync('dist/'+page,'utf8');
 assert.ok(html.includes('company-overflow.css?v=company-3'));
}
const app=readFileSync('dist/app.js','utf8');
assert.ok(app.includes('companyIcons(p.companies)'),'Problem listing must use the 3-plus-more renderer.');
const leader=readFileSync('dist/leaderboard.js','utf8');
assert.ok(leader.includes("cache.board(owner,filters,{allowStale:true})"));
assert.ok(leader.includes("load({force:true})"),'Refresh must bypass cached ranks.');
assert.ok(leader.includes("cache.saveBoard(owner,filters,fresh)"));
const community=readFileSync('dist/community.js','utf8');
assert.ok(community.includes('viewCache.profile(owner,target,{allowStale:true})'),'Profiles should use cached snapshots.');
assert.ok(community.includes('refreshPresence(true)'),'Cached profiles must immediately fetch live presence.');
assert.ok(community.includes("act('profile-presence'"),'Presence must still come from live database requests.');
assert.ok(community.includes("act('notifications'"),'Notifications must remain uncached.');
const chat=readFileSync('dist/chat.js','utf8');
assert.ok(chat.includes("cloud.request('chat-list'")&&chat.includes("cloud.request('chat-thread'"));

const account={admin:true,profile:{public_id:'user-123',username:'fixture',display_name:'Example'}};
entries.clear();now=9000000;
cache.saveSelf(viewer,account);
assert.deepEqual(make().self(viewer),account,'Verified account metadata must survive same-tab navigation.');
assert.equal(cache.self(other),null,'Account bootstrap must be partitioned by Firebase owner.');
now+=ACCOUNT_TTL_MS+1;assert.equal(cache.self(viewer),null,'Account bootstrap expires after two minutes.');
now=9000000;cache.saveBoard(viewer,query,ranking);cache.saveProfile(viewer,'fixture',profile);
now+=LEADERBOARD_TTL_MS+10;
assert.equal(cache.board(viewer,query),null,'Expired rankings are not fresh.');
assert.deepEqual(cache.board(viewer,query,{allowStale:true}),ranking,'Saved rankings render without waiting for manual refresh.');
assert.equal(cache.profile(viewer,'fixture'),null,'Expired profiles are not fresh.');
assert.equal(cache.profile(viewer,'fixture',{allowStale:true}).profile.username,'fixture','Expired snapshots render immediately then refresh in background.');
now+=24*60*60*1000;
assert.equal(cache.board(viewer,query,{allowStale:true}),null,'Never reuse a snapshot older than 24 hours.');
assert.equal(cache.profile(viewer,'fixture',{allowStale:true}),null,'Never reuse a profile older than 24 hours.');

entries.clear();now=11000000;
const warmRequests=[];
const warmCloud={
 user:{id:viewer},
 async request(action,body,owner){
   warmRequests.push([action,body,owner]);
   if(action==='leaderboard')return ranking;
   if(action==='profile')return profile;
   throw new Error('Prefetch must never fetch '+action);
 }
};
assert.equal((await prefetchCommunityViews(warmCloud,{owner:viewer,profile:account.profile,cache})).length,2);
assert.deepEqual(warmRequests.map(x=>x[0]),['leaderboard','profile'],'Prefetch fetches only ranking and own profile.');
assert.deepEqual(cache.board(viewer,{scope:'global',period:'all',page:0}),ranking);
assert.equal(cache.profile(viewer,'fixture').profile.username,'fixture');
await prefetchCommunityViews(warmCloud,{owner:viewer,profile:account.profile,cache});
assert.equal(warmRequests.length,2,'Fresh prewarmed data avoids extra database requests.');
await prefetchCommunityViews(warmCloud,{owner:other,profile:account.profile,cache});
assert.equal(warmRequests.length,2,'Never prefetch another user under the current Firebase session.');
let finishProfile;
const changedUser={
 user:{id:viewer},
 async request(action){
   if(action==='leaderboard')return ranking;
   return new Promise(resolve=>{finishProfile=resolve});
 }
};
entries.clear();
const warmFlight=prefetchCommunityViews(changedUser,{owner:viewer,profile:account.profile,cache});
changedUser.user={id:other};
finishProfile(profile);await warmFlight;
assert.equal(cache.profile(viewer,'fixture'),null,'An account switch must discard late profile prefetch results.');

const appSource=readFileSync('dist/app.js','utf8');
assert.ok(appSource.includes('communityCache.saveSelf(owner,value)'),'Self response still warms the current account cache without holding up progress');
assert.ok(appSource.includes('scheduleCommunityWarmup(owner,publicProfile)'));
const communitySource=readFileSync('dist/community.js','utf8');
assert.ok(!communitySource.includes('catalog=await cloud.publicCatalog()'),'Catalog must never block profile boot.');
assert.ok(communitySource.includes('const cachedSelf=viewCache.self(owner)'),'Profile should bootstrap from verified account cache.');
assert.ok(communitySource.includes("void act('self').then(own=>"),'Cached profile paints instantly but refreshes administrator permissions in the background.');
assert.ok(communitySource.includes('return;\n }'),'Cached profile should not block on a duplicate profile-render request.');
assert.ok(communitySource.includes('viewerProfile:self?.profile||null'),'Profile chart receives the already-verified viewer.');
assert.ok(communitySource.includes('void route();'),'Cached profile route should start without a backend self await.');
assert.ok(communitySource.includes('void refreshPresence(true)'),'Presence must stay independently live.');
const dashboardSource=readFileSync('dist/dashboard.js','utf8');
const dashboardOpen=dashboardSource.slice(dashboardSource.indexOf('async open()'),dashboardSource.indexOf('async render()'));
assert.ok(dashboardOpen.indexOf('this.render();')<dashboardOpen.indexOf("this.cloud.request('self')"),'Chart must paint before extra account and friends calls.');
assert.ok(dashboardOpen.includes('let viewer=this.viewerProfile;'),'Analytics must reuse existing verified account data.');
assert.ok(leader.includes('const savedAccount=cache.self(nextOwner)'),'Leaderboard should reuse the recent account snapshot.');
assert.ok(appSource.includes('communityCache.clearOwner(previousOwner)'),'Account switches must clear snapshots.');


// Avatar storage signed URLs are valid for 600 seconds; cached rankings/profiles
// can be displayed longer than that, but expired signed photos must not break.
entries.clear();now=15000000;
const signedAvatar='https://example.supabase.co/storage/v1/object/sign/bytequest-avatars/u/photo.jpg?token=short-lived';
const externalAvatar='https://lh3.googleusercontent.com/example.png';
const signedBoard={users:[{...ranking.users[0],avatar_url:signedAvatar},{username:'other',avatar_url:externalAvatar}],total:2,me:{avatar_url:signedAvatar}};
cache.saveBoard(viewer,query,signedBoard);
cache.saveProfile(viewer,'fixture',{...profile,profile:{...profile.profile,avatar_url:signedAvatar}});
assert.equal(cache.board(viewer,query).users[0].avatar_url,signedAvatar,'Fresh signed avatars should be visible.');
now+=9*60*1000;
const oldBoard=cache.board(viewer,query,{allowStale:true});
assert.equal(oldBoard.users[0].avatar_url,'','Expired signed rank avatars should use initials.');
assert.equal(oldBoard.me.avatar_url,'','Expired signed self avatars should use initials.');
assert.equal(oldBoard.users[1].avatar_url,externalAvatar,'Non-expiring external avatars stay visible.');
assert.equal(cache.profile(viewer,'fixture',{allowStale:true}).profile.avatar_url,'','Expired signed profile avatar should use initials.');
assert.equal(JSON.parse([...entries.values()].find(x=>x.includes('"users"'))).value.users[0].avatar_url,signedAvatar,
  'Rendering must not mutate the cached snapshot; server refresh can re-sign avatars.');

console.log('PASS: rankings/profile cache isolation and TTLs, manual rank refresh, live presence/chat/notifications, and +N company hover overflow.');
