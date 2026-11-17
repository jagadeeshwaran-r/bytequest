import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {profileCatalogNumbers,hydrateRecentProblemNumbers,recentSolvesMarkup,profileMetrics} from '../dist/profile-extras.js';
import {profileMarkup} from '../dist/profile-view.js';

const catalog=[{id:'two-sum',title:'Two Sum'},{id:'valid-anagram',title:'Valid Anagram'},{id:'middle-of-linked-list',title:'Middle of the Linked List'}];
const numbers=profileCatalogNumbers(catalog);
assert.equal(numbers.get('two-sum'),1);
assert.equal(numbers.get('middle-of-linked-list'),3);
assert.equal(numbers.has('not-in-catalog'),false);
assert.equal(profileCatalogNumbers(null).size,0);
assert.equal(profileCatalogNumbers([{id:'two-sum'},{id:'two-sum'}]).get('two-sum'),1);
const solves=[
 {problemId:'middle-of-linked-list',title:'Middle of the Linked List',difficulty:'Easy',solvedAt:'2026-11-15T13:25:00Z'},
 {problemId:'two-sum',title:'Two Sum',difficulty:'Easy',solvedAt:'2026-11-15T12:25:00Z'},
 {problemId:'valid-anagram',title:'Valid Anagram',difficulty:'Easy',solvedAt:'2026-11-15T11:25:00Z'},
 {problemId:'unknown-id',title:'Different problem',difficulty:'Medium',solvedAt:'2026-11-15T10:25:00Z'}
];
const markup=recentSolvesMarkup(solves,catalog);
assert.ok(markup.includes('data-recent-problem-number="middle-of-linked-list" aria-label="Problem 3">03</span>'));
assert.ok(markup.includes('data-recent-problem-number="two-sum" aria-label="Problem 1">01</span>'));
assert.ok(markup.includes('data-recent-problem-number="unknown-id" aria-label="Problem number unavailable">—</span>'));
assert.ok(markup.includes('./index.html?problem=two-sum#practice'),'Solved rows remain navigable');
assert.ok(markup.includes('data-recent-toggle'),'Keep the 3/25 expand interaction');
assert.equal((markup.match(/data-recent-row/g)||[]).length,4);
assert.equal((markup.match(/hidden data-recent-row/g)||[]).length,1);
assert.ok(!recentSolvesMarkup(solves.slice(0,3),catalog).includes('data-recent-toggle'));
const malicious=recentSolvesMarkup([{...solves[0],problemId:'"><script>alert(1)</script>',title:'<script>bad</script>'}],catalog);
assert.ok(!malicious.includes('<script>'));
assert.ok(malicious.includes('&lt;script&gt;'));

const nodes=[{
 getAttribute:key=>key==='data-recent-problem-number'?'middle-of-linked-list':null,
 textContent:'',setAttribute(key,value){this[key]=value;}
},{
 getAttribute:key=>key==='data-recent-problem-number'?'not-in-catalog':null,
 textContent:'',setAttribute(key,value){this[key]=value;}
}];
hydrateRecentProblemNumbers({querySelectorAll:()=>nodes},catalog);
assert.equal(nodes[0].textContent,'03');
assert.equal(nodes[0]['aria-label'],'Problem 3');
assert.equal(nodes[1].textContent,'—');

const stats=profileMetrics({solved:6,total:20,streak:3},60,20);
assert.ok(stats.includes('6<small> / 20</small>'));
assert.ok(stats.includes('width:30%'));
assert.ok(stats.includes('Consecutive solve days'));

const profile=profileMarkup({
 profile:{public_id:'1',username:'fixture',display_name:'Fixture',discoverable:true},
 isOwn:true,followers:1,following:1,
 ranking:{rank:2,points:60},
 stats:{solved:6,total:20,streak:3,days:[],serverDay:'2026-11-15'},
 insights:{recentSolves:solves,skills:[{name:'Hash maps',solved:2}],languages:[{language:'python',solved:1},{language:'java',solved:5}]}
},{catalog,catalogCount:20});
assert.ok(profile.includes('profile-inline-rank'));
assert.ok(profile.includes('id="profileSolvedCount"'));
assert.ok(profile.indexOf('data-language="java"')<profile.indexOf('data-language="python"'),'Most-used language is first');
assert.ok(profile.includes('data-recent-problem-number="middle-of-linked-list"'));
assert.ok(profile.includes('data-connections="followers"'));
assert.ok(profile.includes('Edit profile'));
assert.ok(profile.includes('calendar-month-grid'));

const html=readFileSync('dist/community.html','utf8');
const ui=readFileSync('dist/community.js','utf8');
const css=readFileSync('dist/profile-compact.css','utf8');
assert.ok(html.includes('profile-compact.css?v=profile-compact-1'));
assert.ok(html.includes('community.js?v=lifetime-awards-1'),'Updated community bundle still includes the compact profile');
assert.ok(ui.includes('hydrateRecentProblemNumbers($(\'profileContent\'),catalog)'));
assert.ok(ui.includes('catalogCount:catalog.length,catalog'));
assert.ok(css.includes('social-stats.profile-metrics'));
assert.ok(css.includes('repeat(3,minmax(0,1fr))'));
assert.ok(css.includes('background:var(--surface-2)!important'));
assert.ok(css.includes('recent-problem-number'));
assert.ok(css.includes('@media(max-width:580px)'));
assert.ok(css.includes('prefers-reduced-motion'));
console.log('PASS: compact profile, catalog-aligned solve numbers, safe avatar/activity details, language ranking, and existing interactions.');
