import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_WORKSPACE_LAYOUT,WORKSPACE_LAYOUT_KEY,normalizeWorkspaceLayout,readWorkspaceLayout} from '../dist/workspace-layout.js';

const defaults={left:42,editor:60};
assert.deepEqual(DEFAULT_WORKSPACE_LAYOUT,defaults);
assert.deepEqual(normalizeWorkspaceLayout(null),defaults);
assert.deepEqual(normalizeWorkspaceLayout({left:52,editor:64}),{left:52,editor:64});
assert.deepEqual(normalizeWorkspaceLayout({left:-200,editor:1000}),{left:35,editor:66});
assert.deepEqual(normalizeWorkspaceLayout({left:Infinity,editor:'bad'}),defaults);
assert.deepEqual(normalizeWorkspaceLayout([]),defaults);

const storage={getItem(key){assert.equal(key,WORKSPACE_LAYOUT_KEY);return JSON.stringify({left:48,editor:65});}};
assert.deepEqual(readWorkspaceLayout(storage),{left:48,editor:65});
assert.deepEqual(readWorkspaceLayout({getItem:()=>'{broken'}),defaults);
assert.deepEqual(readWorkspaceLayout({getItem:()=>{throw Error('Storage denied');}}),defaults);

const index=readFileSync('dist/index.html','utf8');
const app=readFileSync('dist/app.js','utf8');
const css=readFileSync('dist/workspace-premium.css','utf8');

for(const marker of [
 'workspace-premium.css?v=workspace-1',
 'class="pane-resizer"',
 'class="editor-resizer"',
 'id="toggleEditorFocus"',
 'id="editorSurface"',
 '<details class="hint-bar">',
 'id="hintText"',
 'id="hintBtn"',
 'id="codeEditor"',
 'id="testTabs"',
 'id="resultOutput"',
 'id="runBtn"',
 'id="submitBtn"'
])assert.ok(index.includes(marker),marker+' must remain in the practice UI');

assert.match(app,/mountWorkspaceLayout\(\$\("practiceView"\)\)/);
assert.ok(app.includes('class="problem-heading"'));
assert.ok(app.includes('class="problem-badges"'));
assert.ok(app.includes('className=\'verdict-metrics\''));
assert.ok(app.includes('className=\'verdict-link\''));

assert.ok(css.includes('#practiceView .lab'),'Scope layout changes to practice view');
assert.ok(css.includes('--pane-left'),'Use accessible horizontal splitter');
assert.ok(css.includes('--editor-split'),'Use accessible vertical splitter');
assert.ok(css.includes('overscroll-behavior:contain'),'Keep panel scroll independent');
assert.ok(css.includes('@media(max-width:900px)'),'Preserve narrow-screen stacking');
assert.ok(css.includes('.lab.editor-focus'),'Provide focus mode');
assert.ok(css.includes('prefers-reduced-motion'),'Honor reduced motion');
console.log('PASS: premium workspace identity, keyboard splitters, persistence, responsive layout and submission controls.');
