import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(p,'utf8');
test('Dark workspace retains Angular editor and all verified submission behavior',async()=>{
 const [practice,global]=await Promise.all([
  read('angular/src/app/features/practice/practice.component.ts'),read('angular/src/styles.css')
 ]);
 for(const needle of ['class="view native-practice"','class="lab"',
   '[class.editor-focus]="editorExpanded()"','{{problemOrdinal()}}. {{problem()!.title}}',
   'native-solved-badge','readonly solved=signal(false)',
   "this.api.request<{payload?:{solved?:Record<string,unknown>}}>('progress')",
   'ticket!==this.progressGeneration','readonly editorExpanded=signal(false)',
   'native-expand-editor','(click)="editorExpanded.set(!editorExpanded())"',
   'aria-label="Reset to starter"','<bq-editor [value]="code()"',
   'class="test-panel"','class="native-submit-feedback"','class="runbar"',
   "submitVerified('public')",'submissionRefresh.update(value=>value+1)',
   '<bq-submissions [problemId]="problem()!.id"']){
  assert.ok(practice.includes(needle),'Missing existing functionality: '+needle);
 }
 assert.doesNotMatch(practice,/\.innerHTML\s*=/);
 assert.match(global,/bq-root \.native-practice \.lab\.editor-focus/);
 assert.match(global,/bq-root \.native-practice \.editor-pane \.test-panel/);
 assert.match(global,/bq-root \.native-practice \.runbar \.button\.primary/);
 assert.match(global,/html\[data-theme="dark"\] bq-root \.native-practice \.native-editor-area/);
});
test('Dark leaderboard keeps real server ranking, public profiles and responsiveness',async()=>{
 const [board,global]=await Promise.all([
  read('angular/src/app/features/leaderboard/leaderboard.component.ts'),read('angular/src/styles.css')
 ]);
 for(const label of ['The leaderboard.','Community','Your rank','Points','Solved','Learners',
    'Global','Friends','All time','Find me','Refresh ranks','Easy','Medium','Hard',
    'leader-summary','leader-table','leader-practice','leader-avatar','leader-you',
    "api.request<Ranking>('leaderboard'","this.scope.set(next)","this.period.set(value)"]){
   assert.ok(board.toLowerCase().includes(label.toLowerCase()),'Missing ranking behavior: '+label);
 }
 assert.match(global,/html\[data-theme="dark"\] bq-root \.native-leaderboard \.leader-summary/);
 assert.match(global,/html\[data-theme="dark"\] bq-root \.native-leaderboard \.leader-table-wrap/);
 assert.match(global,/html\[data-theme="dark"\] bq-root \.native-leaderboard \.leader-points/);
 assert.match(global,/bq-root:has\(:is\(\.native-catalog,\.native-practice,\.native-leaderboard\)\) \.minimal-header/);
 assert.match(global,/@media\(max-width:650px\)/);
 assert.doesNotMatch(board,/\.innerHTML\s*=/);
});
test('Screenshot dark styles do not target light theme or classic compatibility pages',async()=>{
 const [global,index,previews]=await Promise.all([
  read('angular/src/styles.css'),
  read('angular/src/index.html'),read('angular/src/app/app.routes.ts')
 ]);
 const start=global.indexOf('November 2026 ByteQuest dark reference:');
 assert.ok(start>0);
 const addition=global.slice(start);
 assert.ok(addition.includes('html[data-theme="dark"]'));
 assert.doesNotMatch(addition,/html\[data-theme="light"\]/);
 assert.ok(index.includes('bytequest.theme'));
 assert.ok(previews.includes("path:'classic/problems'"));
 assert.ok(previews.includes("path:'classic/leaderboard'"));
});
