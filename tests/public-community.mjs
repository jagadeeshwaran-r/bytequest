import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateCommunity} from '../supabase/functions/bytequest-firebase/community.js';
import {editorialSolutionGateMarkup} from '../dist/editorial-access.js';

const ownerId='123e4567-e89b-42d3-a456-426614174000';
assert.deepEqual(validateCommunity('submission-public-list',{problemId:'battery-full-arrivals',sort:'runtime',page:0}),
 {problemId:'battery-full-arrivals',sort:'runtime',page:0});
assert.deepEqual(validateCommunity('submission-public-share',{id:ownerId,shared:true}),{id:ownerId,shared:true});
assert.deepEqual(validateCommunity('submission-public-share',{id:ownerId,shared:false}),{id:ownerId,shared:false});
for(const bad of [{id:ownerId},{id:ownerId,shared:'true'},{id:'invalid',shared:true}]){
 assert.throws(()=>validateCommunity('submission-public-share',bad),/accepted public submission/);
}
assert.throws(()=>validateCommunity('submission-public-list',{problemId:'battery-full-arrivals',sort:'hidden',page:0}),/valid public-test submission board/);

const sql=readFileSync('database/public-java-community.sql','utf8');
const api=readFileSync('supabase/functions/bytequest-firebase/database.js','utf8');
const route=readFileSync('supabase/functions/bytequest-firebase/community.js','utf8');
const ui=readFileSync('dist/submissions.js','utf8');
const app=readFileSync('dist/app.js','utf8');
assert.match(sql,/s\.owner_id=bytequest_public_submissions\.owner_id/,'Only signed-in owners can change their own accepted record');
assert.match(sql,/attempt\.problem_revision/,'Stale problem revisions cannot join current community');
assert.match(sql,/attempt\.benchmark_version<>'bq-public-only-v1'/,'Full/hidden suite records are not modified via public share');
assert.match(sql,/s\.suite_kind='public'/,'Public ranking excludes private-suite results');
assert.match(sql,/s\.shared/,'Private submissions cannot appear without explicit sharing');
assert.match(sql,/p\.discoverable/,'Private profiles cannot be displayed in the community board');
assert.match(sql,/partition by e\.compiler/,'Public runtime rankings are separated by execution provider');
assert.match(sql,/s\.test_count=pg_catalog\.jsonb_array_length/,'The rank requires all published test cases');
assert.match(sql,/revoke all on function public\.bytequest_public_submissions\(text,text,jsonb\)/,'Browser roles cannot spoof Firebase owner identifiers');
assert.match(sql,/grant execute on function public\.bytequest_public_submissions\(text,text,jsonb\) to service_role/);
assert.ok(!sql.toLowerCase().includes('security definer'),'Function executes with restricted service credentials, not publicly elevated privileges');
assert.match(api,/owner_id:owner,action:action==='submission-public-list'\?'list':'share'/,'Backend obtains the owner only from authenticated token');
assert.match(route,/submission-public-share/,'Share action validates a proper UUID and explicit consent');
assert.match(ui,/Publish earlier accepted solution/,'Earlier private accepted solutions require deliberate publishing');
assert.match(ui,/data-publish-earlier/,'Existing private accepted results can be published with an explicit click');
assert.match(ui,/data-community-board="public"/,'Public tests have a visibly separate community board');
assert.match(ui,/data-community-board="full"/,'Full hidden-suite ranking remains available');
assert.match(ui,/compiler==='judge0-java-17'/,'The provider is visible to users');
assert.match(app,/editorialSolutionGateMarkup\(canCheckJavaReference\(current\),Boolean\(cloud\.user\)\)/,'Cross-browser accepted solutions can request permission even without local history');
const locked=editorialSolutionGateMarkup(false,false);
const checking=editorialSolutionGateMarkup(false,true);
assert.ok(!locked.includes('id="referenceBtn"'));
assert.ok(checking.includes('Check Java answer access'));
assert.ok(!checking.includes('<pre'),'No answer code is bundled into an access check');
console.log('PASS: owner-only public Java sharing, privacy, same-provider ranking, separate full-suite board and cross-device answer checks.');
