import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Cloud} from '../dist/cloud.js';
import {studioAccessState} from '../dist/studio-access.js';

const owner='firebase:fixture:existing-user';
const accountResult={admin:true,canCreate:true,progress:{payload:{},revision:0}};
const cloud=Object.create(Cloud.prototype);
cloud.user={id:owner};cloud.admin=false;cloud.canCreate=false;
cloud.account=async identity=>{assert.equal(identity,owner);return accountResult;};
assert.equal(await cloud.checkAdmin(owner),true,'Publishing permission should still work');
assert.equal(cloud.canCreate,true,'Creator remains allowed to publish');
assert.equal(cloud.admin,false,'The legacy editor flag MUST NOT grant administrator navigation');
assert.equal(studioAccessState(cloud).kind,'ready','Studio remains usable for delegated creator');
cloud.admin=true;await cloud.checkAdmin(owner);
assert.equal(cloud.admin,true,'Confirmed administrator identity must not be erased by creator access refresh');
cloud.user={id:'different-user'};cloud.canCreate=false;cloud.admin=false;
assert.equal(await cloud.checkAdmin(owner),true);
assert.equal(cloud.canCreate,false,'Stale owner response must not grant publishing access');

const app=readFileSync('dist/app.js','utf8');
const studio=readFileSync('dist/studio-page.js','utf8');
const community=readFileSync('dist/community.js','utf8');
const leaderboard=readFileSync('dist/leaderboard.js','utf8');
const shell=readFileSync('dist/shell.js','utf8');
const backend=readFileSync('supabase/functions/bytequest-firebase/handler.js','utf8');
assert.ok(backend.includes('db.isEditor(identity.id)'),'Legacy account.admin also includes delegated creators');
assert.ok(app.includes('cloud.admin=value.admin===true'),'Problems must use actual admin role from the asynchronous self response');
assert.ok(app.includes('cloud.request("self",{},owner).then(value=>'),'Self profile checks must not block progress synchronization');
assert.ok(studio.includes("cloud.request('self',{},owner)"),'Studio must independently fetch actual administrator role');
assert.ok(studio.includes('cloud.admin=response.admin===true'),'Studio must show link to verified admin');
assert.ok(community.includes("void act('self').then(own=>"),'Profile cache must not freeze administrator role');
assert.ok(community.includes('shell.setAdmin(own.admin===true)'),'Profile must restore admin menu once backend confirms it');
assert.ok(leaderboard.includes("const own=await cloud.request('self')"),'Leaderboard must refresh role even with cached profile');
assert.ok(leaderboard.includes('shell.setAdmin(own.admin===true)'));
assert.ok(shell.includes('authorized===true'),'Admin link must require explicit boolean true');
assert.ok(shell.includes('link.hidden=!show'),'Admin link must be hidden for ordinary creators');
for(const page of ['index','studio','leaderboard']){
 const html=readFileSync('dist/'+page+'.html','utf8');
 assert.ok(html.includes('href="./community.html#roles" data-admin-link hidden>Manage creators'),'Start hidden on '+page);
}
console.log('PASS: actual admin versus creator separation and live menu restoration across all ByteQuest pages.');
