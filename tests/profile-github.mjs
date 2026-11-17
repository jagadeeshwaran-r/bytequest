import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {profileDetails as clientDetails} from '../dist/profile-fields.js';
import {profileDetails as serverDetails} from '../supabase/functions/bytequest-firebase/domain/profile-fields.js';
import {validateCommunity} from '../supabase/functions/bytequest-firebase/community.js';
import {profileMarkup} from '../dist/profile-view.js';

for(const parse of [clientDetails,serverDetails]){
 const d=parse({github_url:'https://www.github.com/byte-quest/?tab=repositories#readme'});
 assert.equal(d.github_url,'https://github.com/byte-quest/','Canonical public profile URL');
 assert.equal(parse({github_url:''}).github_url,'','Profile may have no GitHub link');
 for(const url of [
  'http://github.com/member',
  'javascript:alert(1)',
  'https://github.com.evil.test/member',
  'https://user:pass@github.com/member',
  'https://github.com/owner/repository',
  'https://gist.github.com/member',
  'https://github.com/-invalid',
  'https://github.com/invalid-'
 ])assert.throws(()=>parse({github_url:url}),url);
}

const profile={username:'learner',display_name:'Learner',public_id:'fixture',discoverable:true,github_url:'https://github.com/learner'};
const markup=profileMarkup({profile,isOwn:true,stats:{solved:0,days:[],streak:0,serverDay:'2026-11-18'},ranking:{rank:0,points:0},insights:{skills:[],languages:[]}});
assert.ok(markup.includes('class="profile-github"'));
assert.ok(markup.includes('aria-label="Open GitHub profile"'));
assert.ok(markup.includes('href="https://github.com/learner"'));
assert.ok(!profileMarkup({profile:{...profile,github_url:''},isOwn:true,stats:{solved:0,days:[],streak:0,serverDay:'2026-11-18'},insights:{skills:[],languages:[]}}).includes('class="profile-github"'));
const payload={username:'learner',display_name:'Learner',bio:'',avatar_url:'',github_url:'https://github.com/learner'};
assert.equal(validateCommunity('profile-save',payload).github_url,'https://github.com/learner');
assert.throws(()=>validateCommunity('profile-save',{...payload,github_url:'https://github.com/owner/repo'}));

const html=readFileSync('dist/community.html','utf8');
const script=readFileSync('dist/community.js','utf8');
const sql=readFileSync('database/profile-github.sql','utf8');
assert.ok(html.includes('id="detail_github_url"'));
assert.ok(script.includes("'organization_url','linkedin_url','github_url'"));
assert.ok(sql.includes("case when data ? 'github_url'"),'Old clients must not clear a saved GitHub link');
assert.ok(sql.includes('security invoker'),'Existing owner-checking RPC permissions must be preserved');
console.log('PASS: GitHub profile links validate on both sides, render safely, and retain backward compatibility.');
