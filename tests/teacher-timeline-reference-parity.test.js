const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const registry = require('../teacher-web/node-plugin-registry.js');
const demoCaptions = require('../teacher-web/demo-captions.js');

const page = fs.readFileSync('teacher-web/editor.html', 'utf8');
const app = fs.readFileSync('teacher-web/app.js', 'utf8');
const editor = fs.readFileSync('teacher-web/visual-node-editor.js', 'utf8');
const styles = fs.readFileSync('teacher-web/styles.css', 'utf8');

test('fixed interview course loads its verified bundled captions by default', () => {
  assert.equal(demoCaptions.captions.length, 177);
  assert.match(page, /src="demo-captions\.js\?v=[^"]+"/);
  assert.ok(
    page.indexOf('demo-captions.js') < page.indexOf('app.js'),
    'bundled captions must be available before the workspace starts'
  );
  assert.match(app, /LessonPilotDemoCaptions/);
  assert.match(app, /内置课程字幕/);
});

test('timeline keeps the end boundary label separate from the 08:33 duration', () => {
  assert.match(page, /class="timeline-boundary timeline-boundary-end">结束<\/span>/);
  assert.doesNotMatch(page, /id="timeline-end-label"/);
  assert.doesNotMatch(editor, /endLabel\.textContent/);
  assert.match(page, /id="timeline-duration-label">08:33/);
});

test('component bar and markers use the same website SVG icon set', () => {
  assert.match(page, /<symbol id="node-icon-attention"/);
  assert.match(page, /<symbol id="node-icon-choice"/);
  assert.match(page, /<symbol id="node-icon-blank"/);
  assert.match(page, /<symbol id="node-icon-qa"/);

  assert.deepEqual(
    registry.listPlugins().map((plugin) => plugin.iconId),
    ['attention', 'choice', 'blank', 'qa']
  );
  assert.match(editor, /createPluginIcon\(plugin\.iconId/);
  assert.doesNotMatch(editor, /textContent:\s*plugin\.icon/);
});

test('summary connectors reach one shared axis without moving marker icons off it', () => {
  assert.match(styles, /--timeline-axis-y:/);
  assert.match(styles, /\.timeline-boundary-start\s*\{[\s\S]*transform:\s*translate\(-50%, -50%\)/);
  assert.match(styles, /\.timeline-boundary-end\s*\{[\s\S]*transform:\s*translate\(50%, -50%\)/);
  assert.match(styles, /--timeline-summary-connector:/);
  assert.match(styles, /\.timeline-node-summary::after\s*\{[\s\S]*height:\s*var\(--timeline-summary-connector\)/);
  assert.doesNotMatch(styles, /\.timeline-marker\[data-lane="1"\]/);
  assert.match(styles, /\.timeline-marker-icon svg\s*\{/);
});
