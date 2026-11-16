import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createViewCache,LEADERBOARD_TTL_MS,PROFILE_TTL_MS} from '../dist/view-cache.js';
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
assert.ok(leader.includes("cache.board(owner,filters)"));
assert.ok(leader.includes("load({force:true})"),'Refresh must bypass cached ranks.');
assert.ok(leader.includes("cache.saveBoard(owner,filters,fresh)"));
const community=readFileSync('dist/community.js','utf8');
assert.ok(community.includes('viewCache.profile(owner,target)'),'Profiles should use cached snapshots.');
assert.ok(community.includes('refreshPresence(true)'),'Cached profiles must immediately fetch live presence.');
assert.ok(community.includes("act('profile-presence'"),'Presence must still come from live database requests.');
assert.ok(community.includes("act('notifications'"),'Notifications must remain uncached.');
const chat=readFileSync('dist/chat.js','utf8');
assert.ok(chat.includes("cloud.request('chat-list'")&&chat.includes("cloud.request('chat-thread'"));
console.log('PASS: rankings/profile cache isolation and TTLs, manual rank refresh, live presence/chat/notifications, and +N company hover overflow.');
