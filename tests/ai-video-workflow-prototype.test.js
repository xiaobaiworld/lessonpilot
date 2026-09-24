const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('video brief follows the chosen topic, duration and scenes', async () => {
  const html = fs.readFileSync('prototypes/ai-video-workflow.html', 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);

  const elements = new Map();
  let downloaded;
  let file;
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, {
        children: [], dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
        addEventListener() {}, setAttribute() {},
      });
      return elements.get(id);
    },
    createElement() { return { click() { downloaded = true; } }; },
  };
  const context = vm.createContext({ document, Blob, URL: { createObjectURL(blob) { file = blob; return 'blob:test'; }, revokeObjectURL() {} }, setTimeout() {}, setInterval() {}, clearInterval() {} });
  vm.runInContext(script, context);
  vm.runInContext("state.topic='一颗种子'; state.claim='变化需要时间'; state.duration=30;", context);
  assert.equal(vm.runInContext('scenes()[0].title', context), '一颗种子');
  assert.equal(vm.runInContext('scenes()[2].line', context), '变化需要时间');
  assert.equal(vm.runInContext('sceneSeconds(4)', context), 30);
  vm.runInContext("state.pace='fast'; state.transition='cut'; renderPreview();", context);
  assert.equal(elements.get('screen').dataset.pace, 'fast');
  assert.equal(elements.get('screen').dataset.transition, 'cut');
  vm.runInContext('downloadBrief()', context);
  assert.equal(downloaded, true);
  const brief = await file.text();
  assert.match(brief, /主题：一颗种子/);
  assert.match(brief, /片长：30 秒/);
  assert.match(brief, /叙事要点：变化需要时间/);
});
