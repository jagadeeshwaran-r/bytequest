import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {verifiedJavaVerdict} from '../angular/src/app/core/java-submission-contract.ts';

const screen=await readFile('angular/src/app/features/practice/practice.component.ts','utf8');

test('Server Submit feedback is separate from the clipped public Run results',()=>{
  const playground=screen.indexOf('<div class="result-output"');
  const playgroundEnd=screen.indexOf('<div class="runbar">',playground);
  const feedback=screen.indexOf('class="native-submit-feedback"',playground);
  assert.ok(playground>=0&&feedback>playground&&feedback<playgroundEnd,
    'Server verdict should stay near persistent Run/Submit buttons');
  assert.ok(screen.indexOf('</div>\n          </div>\n          <!-- Keep submission feedback',playground)>playground,
    'Feedback must not be inside the scrollable test playground');
  assert.match(screen,/@if\(verifying\(\) \|\| verifiedVerdict\(\) \|\| verificationError\(\)\)/);
  assert.match(screen,/aria-live="polite" aria-atomic="true"/);
  assert.match(screen,/<strong>Submission was not confirmed<\/strong>/);
  assert.match(screen,/role="alert"\>\{\{verificationError\(\)\}\}/);
  assert.match(screen,/✓ Accepted —/);
  assert.match(screen,/View saved submission/);
  assert.match(screen,/Submitting to ByteQuest staging/);
  assert.match(screen,/\.native-submit-feedback\{[^}]*max-height:168px/);
  assert.match(screen,/this\.verifiedVerdict\.set\(null\);\s*if\(!this\.verifying\(\)\)this\.verificationError\.set\(''\)/,
    'Editing source must clear stale accepted verdicts');
});
test('Successful public submission remains scoped to published cases',()=>{
  const accepted=verifiedJavaVerdict({
    status:'accepted',accepted:true,verificationScope:'public',
    submission:{id:'fixture-accepted-123'},message:'All 5 public cases passed.'
  },'public');
  assert.equal(accepted.accepted,true);
  assert.equal(accepted.scope,'public');
  assert.match(accepted.message,/public cases passed/);
  assert.equal(verifiedJavaVerdict({status:'accepted',accepted:true,verificationScope:'public',
    submission:{id:'fixture-accepted-123'}},'complete').accepted,false);
});
