import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {studioAccessState} from '../dist/studio-access.js';

const access=values=>studioAccessState(values);
const loading=access({loginReady:false,user:null});
assert.equal(loading.kind,'connecting');
assert.equal(loading.buttonVisible,false,'Do not offer another Google login while session is restoring');

const signedOut=access({loginReady:true,user:null});
assert.equal(signedOut.kind,'signed-out');
assert.equal(signedOut.buttonVisible,true);

const retry=access({loginReady:false,user:null,loginError:'The Firebase SDK is unavailable'});
assert.equal(retry.kind,'auth-error');
assert.equal(retry.buttonText,'Retry connection');
assert.match(retry.message,/Firebase SDK/);

const owner={id:'firebase:project:existing-user'};
const checking=access({loginReady:true,user:owner,canCreate:false,accessChecking:true});
assert.equal(checking.kind,'checking');
assert.equal(checking.buttonVisible,false,'Never offer a second sign-in to an authenticated user');

const denied=access({loginReady:true,user:owner,canCreate:false,accessChecking:false});
assert.equal(denied.kind,'needs-creator');
assert.equal(denied.buttonVisible,false);
assert.match(denied.message,/creator access/);

const error=access({loginReady:true,user:owner,canCreate:false,accessError:'Connection timed out'});
assert.equal(error.kind,'permission-error');
assert.equal(error.buttonText,'Retry access check');
assert.equal(error.buttonVisible,true);

const creator=access({loginReady:true,user:owner,canCreate:true});
assert.equal(creator.kind,'ready');
assert.equal(creator.allowed,true);
assert.equal(creator.buttonVisible,false);
assert.equal(access({loginReady:true,user:null,canCreate:true}).allowed,false,
  'A cached permission without authenticated user never unlocks Studio');

const boot=readFileSync('dist/studio-page.js','utf8');
const studioController=readFileSync('dist/studio.js','utf8');
const shell=readFileSync('dist/shell.js','utf8');
const community=readFileSync('dist/community.js','utf8');
const leaderboard=readFileSync('dist/leaderboard.js','utf8');
assert.match(boot,/await cloud\.init\(\)/);
assert.match(boot,/await cloud\.checkAdmin\(owner\)/);
assert.match(boot,/void accountChanged\(\)/);
assert.match(boot,/cloud\.signIn\(\)/,'The Studio Google button must reuse the existing Firebase popup');
assert.match(boot,/if\(!cloud\.loginReady\)\{location\.reload\(\);return;\}/,'Retry failed SDK startup without another Google popup');
assert.match(boot,/if\(cloud\.user\)\{void verifyAccess\(\);return;\}/,'Authenticated Studio users retry permissions, not sign-in');
assert.match(boot,/void studio\.open\(\)/,'Show the Studio screen before network requests complete');
assert.ok(!boot.includes('mountEditorTools'),'Studio boot must not require the Problem editor DOM');
assert.match(studioController,/studioAccessState\(this\.cloud\)/);
assert.match(studioController,/button\.hidden=!access\.buttonVisible/);

assert.match(shell,/setAdmin\(authorized\)/);
assert.match(shell,/cloud\?\.user&&authorized/);
assert.match(shell,/document\.querySelectorAll\('\[data-admin-link\]'\)/);
assert.match(boot,/shell\.setAdmin\(cloud\.admin\)/);
assert.match(community,/shell\.setAdmin\(self\.admin===true\)/);
assert.match(leaderboard,/shell\.setAdmin\(own\.admin===true\)/);
for(const name of ['index','studio','community','leaderboard']){
  const html=readFileSync('dist/'+name+'.html','utf8');
  assert.ok(html.includes('href="./community.html#roles" data-admin-link hidden>Manage creators'),name+' must hide admin links before auth');
}
const index=readFileSync('dist/index.html','utf8');
const studio=readFileSync('dist/studio.html','utf8');
assert.ok(studio.includes('<h3 id="studioGateTitle">Restoring your session…</h3>'));
assert.ok(studio.includes('id="studioSignIn" class="button primary" type="button" hidden'));
assert.ok(studio.includes('studio-access.css?v=studio-access-1'));
assert.ok(index.includes('studio-access.css?v=studio-access-1'));
assert.ok(studio.includes('studio-page.js?v=dedicated-1'),'Studio uses a dedicated module');
assert.ok(!studio.includes('app.js?v='),'Studio never loads the Problems application');
console.log('PASS: Studio Firebase session reuse, immediate permission gate, and admin-only creator navigation.');
