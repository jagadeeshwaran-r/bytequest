import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync("dist/scroll-performance.css","utf8");
assert.match(css,/body::before\s*\{/);
assert.match(css,/position:absolute!important/,"Background should move with document instead of being fixed to viewport.");
assert.match(css,/animation:none!important/,"The large ambient background must not continuously animate.");
assert.match(css,/\.minimal-header\s*\{/);
assert.match(css,/-webkit-backdrop-filter:none!important/);
assert.match(css,/backdrop-filter:none!important/,"Sticky header cannot recompute a full backdrop blur while scrolling.");
assert.match(css,/\.profile-expertise/);
assert.match(css,/\.month-calendar-scroll/);
assert.match(css,/content-visibility:auto/);
assert.ok(!css.includes('.company-overflow'),'Company overflow hover tooltips must remain untouched.');
const motion=readFileSync("dist/reference-motion.js","utf8");
assert.ok(motion.includes("const revealSelector='#mapView>.section-heading,.leader-heading,#studioView>.section-heading'"),
  "Large tables, profile cards and code editors must not receive scroll-enter animations.");
assert.ok(!motion.includes("duration:650"),"Avoid long scroll-entry animations.");
assert.ok(motion.includes("addEventListener('scroll'"),"Keep existing lightweight passive scroll handler.");
assert.ok(motion.includes("{passive:true}"),"Scroll events must remain passive.");
for(const page of ["index.html","studio.html","leaderboard.html","community.html"]){
  const html=readFileSync("dist/"+page,"utf8");
  assert.ok(html.includes('scroll-performance.css?v=scroll-1'),page+": load new stylesheet");
  assert.ok(html.includes('reference-motion.js?v=scroll-1'),page+": update cached motion script");
  assert.ok(html.indexOf('scroll-performance.css?v=scroll-1')>html.indexOf('reference-style.css'),
    page+": performance overrides must follow original theme styles");
}
const app=readFileSync("dist/app.js","utf8");
assert.ok(app.includes('function renderMap()'),"Problem navigation must remain untouched.");
const community=readFileSync("dist/community.js","utf8");
assert.ok(community.includes("act('profile-presence'"),"Live presence behavior must remain untouched.");
console.log("PASS: scroll paint optimizations, preserved theme/interaction/navigation and live presence.");
