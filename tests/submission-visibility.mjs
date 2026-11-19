import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const migration=readFileSync("database/submissions-bq-v2-visibility.sql","utf8");
const benchmark=readFileSync("supabase/functions/bytequest-firebase/benchmark.js","utf8");
const submissions=readFileSync("dist/submissions.js","utf8");
const practice=readFileSync("dist/app.js","utf8");
const practiceHtml=readFileSync("dist/index.html","utf8");
const leaderboard=readFileSync("dist/leaderboard.html","utf8");
const rankings=readFileSync("dist/leaderboard.js","utf8");
const styles=readFileSync("dist/leaderboard-refined.css","utf8");

// Avoid filtering out accepted Java submissions that carry a newer benchmark
// version. SQL keeps server-side owner/revision authorization intact.
assert.ok(benchmark.includes("language==='java'?'bq-v2-single-pass'"));
assert.ok(migration.includes("s.benchmark_version in ('bq-v1','bq-v2-single-pass','bq-private-v1')"));
assert.ok(migration.includes("s.problem_revision=q.revision"));
assert.ok(migration.includes("s.shared"));
assert.ok(migration.includes("not unlocked"));
assert.ok(migration.includes("s.owner_id=bytequest_submissions.owner_id"));

// Recent accepted attempts should be visible even if not shared, while
// community rankings remain a separate opt-in view.
assert.match(submissions,/page=0,history=true,owner=null/);
assert.ok(submissions.includes("history=true;board=Number(p?.hiddenCount)>0?'public':'full';load();"),'My submissions stays the default and full/public boards are separate');
assert.ok(submissions.includes("Community rankings"));
assert.ok(submissions.includes("My submissions"));
assert.ok(submissions.includes('New accepted solutions are publicly showcased'),'New server-accepted solutions join the showcase; old private solutions are not backfilled');
assert.ok(submissions.includes('Browser practice is private and not verified'));

// The problem number stays in the IDE toolbar while changing tabs, and in
// the description title when the Description tab is selected.
assert.ok(practiceHtml.includes('id="editorProblemNumber"'));
assert.ok(practice.includes('$("editorProblemNumber").textContent='));
assert.ok(practice.includes("'. '+html(current.title)"));

// Leaderboard remains keyboard-friendly and can jump to the signed-in row
// without another network request.
assert.ok(leaderboard.includes('id="leaderFindMe"'));
assert.ok(leaderboard.includes("leaderboard-refined.css?v=leaderboard-2"));
assert.ok(rankings.includes("row.scrollIntoView"));
assert.ok(rankings.includes("row.focus({preventScroll:true})"));
assert.ok(styles.includes(".leader-table .your-ranking td"));
assert.ok(styles.includes("@media(max-width:760px)"));
console.log("PASS: v2 Java submission visibility, personal history default, persistent problem number and leaderboard navigation.");
