import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {problems} from "../dist/problems.js";
import {validateProblem} from "../dist/catalog.js";

const original=problems[0];
const image="./assets/problem-illustrations/battery-full-arrivals.svg";
const enriched=validateProblem({
 ...original,
 illustration:image,
 illustrationAlt:"Battery charge timeline",
 illustrationCaption:"Full transitions highlighted",
 exampleExplanations:["First example explanation.","Second example explanation."]
});
assert.equal(enriched.illustration,image);
assert.equal(enriched.illustrationAlt,"Battery charge timeline");
assert.deepEqual(enriched.exampleExplanations,["First example explanation.","Second example explanation."]);
assert.deepEqual(validateProblem(original).exampleExplanations,[]);
assert.equal(validateProblem(original).illustration,"");
assert.throws(()=>validateProblem({...original,illustration:"javascript:alert(1)"}));
assert.throws(()=>validateProblem({...original,illustration:"data:image/svg+xml;base64,deadbeef"}));
assert.throws(()=>validateProblem({...original,exampleExplanations:["one","two","three"]}));
assert.throws(()=>validateProblem({...original,exampleExplanations:[null]}));

const ids=[
 "battery-full-arrivals","wind-vane-reversals","museum-record-low-rooms",
 "paint-bucket-refills","campus-door-checkpoints","parcel-parity-handoffs",
 "notebook-underline-counter","tram-quiet-gap","watering-splash-rule",
 "mosaic-missing-corner"
];
for(const id of ids){
 const path="dist/assets/problem-illustrations/"+id+".svg";
 assert.ok(existsSync(path),path+" exists");
 const source=readFileSync(path,"utf8");
 assert.match(source,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
 assert.match(source,/<\/svg>\s*$/);
 assert.ok(!/script|foreignObject|onload=|onclick=/i.test(source),"SVG is static and self-contained");
}
const app=readFileSync("dist/app.js","utf8");
const studio=readFileSync("dist/studio.js","utf8");
const html=readFileSync("dist/studio.html","utf8");
const index=readFileSync("dist/index.html","utf8");
assert.match(app,/function problemIllustrationMarkup/);
assert.match(app,/class="example-explanation"/);
assert.match(app,/html\(explanation\)/);
assert.match(studio,/exampleExplanations=JSON\.parse/);
assert.match(studio,/illustration:v\("Illustration"\)/);
assert.match(html,/id="pExampleExplanations"/);
assert.match(html,/id="pIllustration"/);
assert.match(index,/problem-statement-rich\.css/);
console.log("✓ Illustrated statements, examples, safe URLs, creator round-trip fields and 10 assets.");
