const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const assetPath = (relativePath) => path.join(root, relativePath);

const pageFiles = [
  'teacher-web/index.html',
  'teacher-web/editor.html',
  'teacher-web/forsales.html',
  'teacher-web/workspace.html'
];

function pngDimensions(relativePath) {
  const buffer = fs.readFileSync(assetPath(relativePath));
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${relativePath} must be PNG`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

test('canonical KnownMap logo defines the approved map-window geometry', () => {
  const svg = read('src/assets/knownmap-logo.svg');
  assert.match(svg, /#103B2B/i);
  assert.match(svg, /#CFE4D8/i);
  assert.match(svg, /#FFFDF8/i);
  assert.match(svg, /#D9A51E/i);
  assert.match(svg, /#A9654E/i);
  assert.match(svg, /stroke-opacity=["']0\.48["']/i);
  assert.match(svg, /M85 34v158M160 53v159/);
  assert.match(svg, /M55 160l43-38 33 29 61-70/);
  assert.match(svg, /transform=["']translate\(23\.4 23\.4\) scale\(0\.82\)["']/);
  assert.equal((svg.match(/stroke-opacity=/g) || []).length, 1, 'only the two weakened fold lines should use opacity');
});

test('all KnownMap logo variants share the reduced internal safe area', () => {
  for (const relativePath of [
    'src/assets/knownmap-logo.svg',
    'src/assets/knownmap/knownmap-circle.svg',
    'src/assets/knownmap/knownmap-square.svg',
    'src/assets/knownmap/knownmap-transparent.svg'
  ]) {
    assert.match(
      read(relativePath),
      /transform=["']translate\(23\.4 23\.4\) scale\(0\.82\)["']/,
      `${relativePath} must use the shared 82% internal geometry`
    );
  }
});

test('KnownMap logo exports exist at all required sizes', () => {
  for (const [relativePath, size] of [
    ['src/assets/icon-16.png', 16],
    ['src/assets/icon-24.png', 24],
    ['src/assets/icon-48.png', 48],
    ['src/assets/icon-128.png', 128],
    ['teacher-web/assets/knownmap-icon.png', 48]
  ]) {
    assert.deepEqual(pngDimensions(relativePath), { width: size, height: size }, `${relativePath} must be ${size}x${size}`);
  }
});

test('user-visible extension and pages use KnownMap and the logo asset', () => {
  const manifest = JSON.parse(read('src/manifest.json'));
  assert.equal(manifest.name, 'KnownMap');
  assert.deepEqual(manifest.icons, {
    '16': 'assets/icon-16.png',
    '24': 'assets/icon-24.png',
    '48': 'assets/icon-48.png',
    '128': 'assets/icon-128.png'
  });

  for (const relativePath of pageFiles) {
    const html = read(relativePath);
    assert.match(html, /KnownMap/);
    assert.match(html, /assets\/knownmap-icon\.png/);
    const visibleHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');
    assert.doesNotMatch(visibleHtml, /LessonPilot|>LP</);
  }
});

test('teacher application uses the interactive-course-tool name and colored K/M wordmark', () => {
  const html = read('teacher-web/editor.html');
  const app = read('teacher-web/app.js');
  const css = read('teacher-web/styles.css');

  assert.match(html, /KnownMap 互动课程工具/);
  assert.doesNotMatch(html, /课程设计平台/);
  assert.doesNotMatch(app, /课程设计平台/);
  assert.match(html, /class=["']brand-letter brand-letter-k["'][^>]*>K</);
  assert.match(html, /class=["']brand-letter brand-letter-m["'][^>]*>M</);
  assert.match(css, /\.brand-letter-k\s*\{[^}]*color:\s*#d9a51e/i);
  assert.match(css, /\.brand-letter-m\s*\{[^}]*color:\s*#a9654e/i);
});

test('legacy protocol and storage identifiers remain compatible', () => {
  // 只断言代码里真实存在的标识。原先还断言旧数据规范里的
  // `lessonpilot.workspaceDraft.v1`，但该键在代码中已不存在、且登记为「已替代」
  // （SRC-005），断言它等于把死标识和归档文档一起变成测试依赖。
  assert.match(read('src/shared/bridge-protocol.js'), /lessonpilot\.workspace\.v1/);
  assert.match(read('src/shared/bridge-protocol.js'), /lessonpilot\.extension\.v1/);
  assert.match(read('src/shared/bridge-protocol.js'), /global\.LessonPilotBridgeProtocol/);
  assert.match(read('src/shared/course-contract.js'), /global\.LessonPilotCourseContract/);
});
