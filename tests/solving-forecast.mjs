import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {forecastSolvePace,straightPath} from '../dist/dashboard-model.js';
import {analyticsMarkup} from '../dist/profile-analytics.js';

const today='2026-11-17',end=Date.UTC(2026,10,17),dayMs=86400000;
const history=[];
for(let daysAgo=89;daysAgo>=0;daysAgo--){
 const date=new Date(end-daysAgo*dayMs).toISOString().slice(0,10);
 const dow=new Date(end-daysAgo*dayMs).getUTCDay();
 if([1,3,5].includes(dow))history.push({day:date,topic:'Hash maps'});
 if(daysAgo%11===0)history.push({day:date,topic:'Strings'});
}
const predicted=forecastSolvePace(history,{today,horizon:30});
assert.ok(predicted.historyDays>=89&&predicted.historyDays<=90);
assert.ok(predicted.sample>=30&&predicted.activeDays>=30);
assert.equal(predicted.days.length,30,'Long-term forecast supports a month');
assert.equal(predicted.days[0],'2026-11-18');
assert.equal(predicted.days.at(-1),'2026-12-17');
assert.equal(predicted.values.length,30);
assert.ok(predicted.values.every(v=>Number.isFinite(v)&&v>=0&&v<5),'Expected solve pace is nonnegative and bounded');
assert.ok(predicted.values.every(v=>Number(v.toFixed(2))===v),'Predictions are rounded to hundredths');
assert.ok(['28-day moving average','EWMA','Weekly seasonal EWMA','Damped Holt'].includes(predicted.model));
assert.ok(Number.isFinite(predicted.mae)&&predicted.mae>=0,'Rolling historical MAE is displayed');
assert.ok(predicted.backtests>=3,'Method selection is based on rolling held-out weeks');
assert.deepEqual(forecastSolvePace(history,{today,horizon:30}),predicted,'Statistical prediction is deterministic and offline');

const hashOnly=forecastSolvePace(history,{today,topic:'Hash maps',horizon:14});
assert.equal(hashOnly.values.length,14);
assert.ok(hashOnly.sample<predicted.sample);
assert.ok(hashOnly.historyDays>=89);
assert.equal(forecastSolvePace(history,{today,topic:'Not published'}).days.length,0,'Empty topic cannot be forecast');
const future=[...history,{day:'2026-11-25',topic:'Hash maps'},{day:'2026-12-01',topic:'Hash maps'}];
assert.deepEqual(forecastSolvePace(future,{today,horizon:30}),predicted,'Future events cannot leak into the backtest or forecast');
assert.equal(forecastSolvePace([],{today}).values.length,0,'Do not invent forecast from zero accepted solves');
assert.equal(forecastSolvePace([{day:'2026-11-17',topic:'Hash maps'}],{today}).values.length,0,'One-day history is not reliable');
const tooFewDates=Array.from({length:12},()=>({day:'2026-09-01',topic:'Hash maps'}));
assert.equal(forecastSolvePace(tooFewDates,{today}).values.length,0,'One burst does not represent sustained practice');
assert.equal(forecastSolvePace(history,{today,horizon:7}).days.length,7);
assert.equal(forecastSolvePace(history,{today,horizon:100}).days.length,30,'Forecast cannot exceed 30 days');
assert.equal(forecastSolvePace(history,{today,horizon:-1}).days.length,0);
assert.throws(()=>forecastSolvePace(history,{today:'2026-02-31'}),/valid UTC/);
assert.throws(()=>forecastSolvePace(history,{today:'tomorrow'}),/valid UTC/);
assert.deepEqual(
 forecastSolvePace([...history,{day:'2026-02-31',topic:'Hash maps'}],{today}),
 forecastSolvePace(history,{today}),
 'Invalid dates cannot enter the training or validation series'
);

assert.match(analyticsMarkup,/id="graphForecast"/);
assert.match(analyticsMarkup,/id="graphForecastHorizon"/);
assert.match(analyticsMarkup,/id="graphForecastNote"/);
assert.match(analyticsMarkup,/Show forecast/);
assert.match(analyticsMarkup,/value="30"/);
assert.match(analyticsMarkup,/future solving is never guaranteed/);

const dashboard=readFileSync('dist/dashboard.js','utf8');
const model=readFileSync('dist/forecast-model.js','utf8');
const css=readFileSync('dist/forecast-rhythm.css','utf8');
const community=readFileSync('dist/community.js','utf8');
const html=readFileSync('dist/community.html','utf8');
const index=readFileSync('dist/index.html','utf8');
const app=readFileSync('dist/app.js','utf8');
assert.ok(dashboard.includes('forecastSolvePace(s.events||[]'),'Forecast each learner from their own verified history');
assert.ok(dashboard.includes('const requested=!!toggle?.checked&&inCurrentMonth;'),'Current UTC month only');
assert.ok(dashboard.includes('const keys=projectionDays'),'Long-term forecast extends beyond selected month');
assert.ok(dashboard.includes("const horizon=requested?([7,14,30].includes(chosenDays)?chosenDays:7):0;"));
assert.ok(dashboard.includes('baseKeys[visible-1]===today'),'Prediction starts from the exact UTC day');
assert.ok(dashboard.includes('straightPath(historical)'),'Past accepted solve counts remain precise');
assert.ok(dashboard.includes('smoothPath(path)'),'Smooth interpolation applies only to forecast values');
assert.ok(dashboard.includes('forecast[i-visible]'),'Projected tooltip values remain separate from actuals');
assert.ok(dashboard.includes('if(i<0||i>last){hide();return;}'),'Tooltip is bounded to actual+forecast dates');
assert.ok(dashboard.includes("' (estimate)'"),'Forecast tables must distinguish estimates from history');
assert.ok(dashboard.includes('up to 180 UTC days'),'Clearly disclose history window');
assert.ok(dashboard.includes('past MAE'),'Surface measured historical error');
assert.ok(dashboard.includes("this.cloud.request('friend-analytics'"),'Keep private friend comparison');
assert.ok(dashboard.includes("if(control)control.onchange"),'Maintain legacy Problems page boot path');
assert.ok(!index.includes('id="graphForecast"'),'Legacy Problems page has no forecast controls');
assert.ok(!dashboard.includes("own.topics.length?own.topics.map"),'Do not overwrite accurate topic completion');
assert.ok(community.includes("dashboard.js?v=backtested-1"));
assert.ok(html.includes('community.js?v=backtested-1'));
assert.ok(html.includes('forecast-rhythm.css?v=forecast-1'));
assert.ok(index.includes('app.js?v=backtested-1'));
assert.ok(app.includes('dashboard.js?v=backtested-1'));
assert.ok(css.includes('stroke-dasharray'));
assert.ok(css.includes('@keyframes forecast-appear'));
assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
assert.ok(model.includes('scoreCandidates('),'Models selected via walk-forward validation');
assert.ok(model.includes('duration<56||sample<10||activeDays<7'),'Reject statistically thin histories');
assert.equal(straightPath([[1,1],[2,2]]),'M1,1 L2,2');
console.log('PASS: non-ML six-month/30-day walk-forward forecasting, per-user trend, MAE, guardrails and legacy page safety.');
