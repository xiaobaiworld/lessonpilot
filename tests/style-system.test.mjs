import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { buildTokensCss, contrast, validateContrast } from '../tools/build-tokens.mjs';
import { checkStyles } from '../tools/style-check.mjs';

const root = path.resolve(import.meta.dirname, '..');

test('视觉 token 生成物与设计系统角色一致且通过对比度校准', () => {
  validateContrast();
  const css = buildTokensCss();
  assert.match(css, /--canvas:\s*#F5F1E7/);
  assert.match(css, /--surface:\s*#FFFDF8/);
  assert.match(css, /--sunken:\s*#EDE8DA/);
  assert.match(css, /--ink-2:\s*#43544C/);
  assert.match(css, /--line:\s*#D8D2C2/);
  assert.match(css, /prefers-reduced-motion/);
  assert.ok(contrast('#43544C', '#F5F1E7') >= 4.5);
});

test('tokens.css 是可重复生成的最新产物', () => {
  execFileSync(process.execPath, ['tools/build-tokens.mjs', '--check'], { cwd: root, stdio: 'pipe' });
  const generated = buildTokensCss();
  assert.equal(readFileSync(path.join(root, 'v1/web/shared/src/styles/tokens.css'), 'utf8'), generated);
});

test('四端都从同一份 tokens.css 建立消费入口', () => {
  for (const file of ['v1/web/teacher/src/index.css', 'v1/web/admin/src/index.css']) {
    assert.match(readFileSync(path.join(root, file), 'utf8'), /shared\/src\/styles\/tokens\.css/);
  }
  for (const [file, href] of [['index.html', 'tokens.css'], ['link.html', 'tokens.css'], ['student/guide.html', '../tokens.css'], ['trial-application.html', 'tokens.css']]) {
    assert.match(readFileSync(path.join(root, 'v1/site', file), 'utf8'), new RegExp(`href="${href.replace('.', '\\.')}`));
  }
  assert.match(readFileSync(path.join(root, 'v1/site/tokens.css'), 'utf8'), /web\/shared\/src\/styles\/tokens\.css/);
  assert.match(readFileSync(path.join(root, 'v1/extension/content/index.ts'), 'utf8'), /styles\/tokens\.css\?inline/);
  for (const file of ['v1/extension/popup/index.html', 'v1/extension/settings/index.html']) {
    assert.match(readFileSync(path.join(root, file), 'utf8'), /href="\.\.\/assets\/tokens\.css"/);
  }
  assert.match(readFileSync(path.join(root, 'tools/release.sh'), 'utf8'), /shared\/src\/styles\/tokens\.css/);
});

test('样式检查允许已登记历史值，但拦截新裸色值', () => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'knownmap-style-check-'));
  const cssDir = path.join(temporaryRoot, 'v1/web');
  const file = path.join(cssDir, 'new.css');
  mkdirSync(cssDir, { recursive: true });
  // 只读检查器的测试夹具故意不写入仓库，模拟一次新 CSS 提交。
  writeFileSync(file, 'body { color: #123456; }');
  const result = checkStyles({
    scanDirectory: temporaryRoot,
    baseline: { 'v1/web/new.css': [] },
  });
  assert.deepEqual(result.failures, [{ file: 'v1/web/new.css', value: '#123456' }]);
});
