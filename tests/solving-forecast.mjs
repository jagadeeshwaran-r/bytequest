import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {forecastSolvePace,straightPath} from '../dist/dashboard-model.js';
import {analyticsMarkup} from '../dist/profile-analytics.js';

const today='2026-11-17';
const history=[
 {day:'2026-11-15',topic:'Hash maps'},
 {day:'2026-11-16',topic:'Hash maps'},
 {day:'2026-11-17',topic:'Hash maps'},
 {day:'2026-11-07',topic:'Strings'}
];
const predicted=forecastSolvePace(history,{today});
assert.equal(predicted.sample,4,'Count accepted events from the last 14 UTC days');
assert.equal(predicted.days.length,7);
assert.equal(predicted.days[0],'2026-11-18');
assert.equal(predicted.days.at(-1),'2026-11-24');
assert.equal(predicted.values.length,7);
assert.ok(predicted.values.every(v=>Number.isFinite(v)&&v>=0&&v<3),'Forecast is a conservative expected pace, not a guaranteed count');
assert.ok(predicted.values.every(v=>Number(v.toFixed(2))===v),'Predictions are rounded to hundredths');
assert.deepEqual(forecastSolvePace(history,{today}),predicted,'Forecast must be deterministic');

const hashOnly=forecastSolvePace(history,{today,topic:'Hash maps'});
assert.equal(hashOnly.sample,3);
assert.equal(hashOnly.values.length,7);
assert.equal(forecastSolvePace(history,{today,topic:'Strings'}).values.length,0,'Require at least three recent solves within the selected topic');

const future=[...history,{day:'2026-11-25',topic:'Hash maps'},{day:'2026-12-01',topic:'Hash maps'}];
assert.deepEqual(forecastSolvePace(future,{today}),predicted,'Future-dated events cannot influence the estimate');
assert.equal(forecastSolvePace([{day:'2026-10-01',topic:'Hash maps'}],{today}).sample,0);
assert.equal(forecastSolvePace([],{today}).values.length,0,'Do not invent a forecast from zero history');
assert.equal(forecastSolvePace(history,{today,horizon:1}).days.length,1);
assert.equal(forecastSolvePace(history,{today,horizon:100}).days.length,7,'Bound the forecast to one week');
assert.equal(forecastSolvePace(history,{today,horizon:-1}).days.length,0);
assert.throws(()=>forecastSolvePace(history,{today:'2026-02-31'}),/valid UTC/);
assert.throws(()=>forecastSolvePace(history,{today:'tomorrow'}),/valid UTC/);

assert.match(analyticsMarkup,/id="graphForecast"/);
assert.match(analyticsMarkup,/id="graphForecastNote"/);
assert.match(analyticsMarkup,/Forecast next 7 days/);
assert.match(analyticsMarkup,/illustrative and not guaranteed/);

const dashboard=readFileSync('dist/dashboard.js','utf8');
const css=readFileSync('dist/forecast-rhythm.css','utf8');
const community=readFileSync('dist/community.js','utf8');
const html=readFileSync('dist/community.html','utf8');
const index=readFileSync('dist/index.html','utf8');
assert.ok(dashboard.includes('forecastSolvePace(s.events||[]'),'Forecast each learner only from their actual events');
assert.ok(dashboard.includes("const requested=!!toggle?.checked&&inCurrentMonth;"),'Never forecast historical or future-only selected months');
assert.ok(dashboard.includes('Math.min(7,keys.length-visible)'),'Constrain forecasts to visible calendar period');
assert.ok(dashboard.includes('keys[visible-1]===today'),'Prediction must begin at the exact current UTC day');
assert.ok(dashboard.includes('straightPath(historical)'),'Actual solving history remains exact');
assert.ok(dashboard.includes('smoothPath(path)'),'Only forecasts receive smooth interpolation');
assert.ok(dashboard.includes('forecast[i-visible]'),'Forecast values displayed separately from actual values');
assert.ok(dashboard.includes('if(i<0||i>last){hide();return;}'),'Tooltips never extend beyond displayed forecast');
assert.ok(dashboard.includes("' (estimate)'"),'Accessible table labels predicted entries as estimates');
assert.ok(dashboard.includes('estimate from the past 14 UTC days'),'Explain the forecast basis');
assert.ok(dashboard.includes('this.cloud.request(\'friend-analytics\''));
assert.ok(dashboard.includes("if(control)control.onchange"),'Preserve optional controls on legacy Problems page');
assert.ok(!index.includes('id="graphForecast"'),'Problems page must still initialize without the forecast controls');
assert.ok(!dashboard.includes("own.topics.length?own.topics.map"),'Do not replace accurate Patterns growing with old relative bars');
assert.ok(community.includes("dashboard.js?v=forecast-1"));
assert.ok(html.includes('community.js?v=forecast-1'));
assert.ok(html.includes('forecast-rhythm.css?v=forecast-1'));
assert.ok(css.includes('stroke-dasharray'));
assert.ok(css.includes('@keyframes forecast-appear'));
assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
assert.equal(straightPath([[1,1],[2,2]]),'M1,1 L2,2','Historical interpolation remains straight');
console.log('PASS: conservative seven-day forecasts, labelled dotted paths, friend projection, accessible tooltips, smooth transitions, and legacy Problems compatibility.');
