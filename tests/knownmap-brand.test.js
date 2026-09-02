const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const assetPath = (relativePath) => path.join(root, relativePath);
const tokens = JSON.parse(read('v1/assets/brand/knownmap-tokens.json'));
const hex = (key) => tokens.colors[key].hex;

const pageFiles = [
  'v1/site/index.html',
  'v1/site/trial-application.html',
  'v1/site/student/guide.html',
  'v1/site/link.html'
];

function pngDimensions(relativePath) {
  const buffer = fs.readFileSync(assetPath(relativePath));
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${relativePath} must be PNG`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

test('canonical KnownMap logo matches knownmap-tokens.json', () => {
  const svg = read(tokens.files.canonicalSvg);
  const [tx, ty] = tokens.canvas.innerTranslate;
  const scale = tokens.canvas.innerScale;
  assert.match(svg, new RegExp(hex('containerGreen'), 'i'));
  assert.match(svg, new RegExp(hex('mapStroke'), 'i'));
  assert.match(svg, new RegExp(hex('pathStroke'), 'i'));
  assert.match(svg, new RegExp(hex('pathStart'), 'i'));
  assert.match(svg, new RegExp(hex('pathEnd'), 'i'));
  assert.match(svg, new RegExp(`stroke-opacity=["']${tokens.colors.foldStroke.opacity}["']`, 'i'));
  assert.match(svg, new RegExp(tokens.geometry.foldD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(svg, new RegExp(tokens.geometry.pathD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(svg, new RegExp(`transform=["']translate\\(${tx} ${ty}\\) scale\\(${scale}\\)["']`));
  assert.equal((svg.match(/stroke-opacity=/g) || []).length, 1, 'only the two weakened fold lines should use opacity');
});

test('all KnownMap logo variants share the reduced internal safe area', () => {
  const [tx, ty] = tokens.canvas.innerTranslate;
  const scale = tokens.canvas.innerScale;
  const transform = new RegExp(`transform=["']translate\\(${tx} ${ty}\\) scale\\(${scale}\\)["']`);
  for (const relativePath of [tokens.files.canonicalSvg, ...tokens.files.variants, ...tokens.files.extensionCopies]) {
    assert.match(read(relativePath), transform, `${relativePath} must use the shared ${scale * 100}% internal geometry`);
    assert.match(read(relativePath), new RegExp(hex('pathStart'), 'i'), `${relativePath} must use pathStart`);
    assert.match(read(relativePath), new RegExp(hex('pathEnd'), 'i'), `${relativePath} must use pathEnd`);
  }
});

test('KnownMap logo exports exist at all required sizes', () => {
  for (const { path: relativePath, size } of tokens.files.png) {
    assert.deepEqual(pngDimensions(relativePath), { width: size, height: size }, `${relativePath} must be ${size}x${size}`);
  }
});

test('user-visible extension and pages use KnownMap and the logo asset', () => {
  const manifestSource = read('v1/extension/manifest/targets.ts');
  assert.match(manifestSource, /name: target\.name === 'local' \? 'KnownMap（本机）' : 'KnownMap'/);
  assert.match(manifestSource, /'16': 'assets\/icon-16\.png'/);
  assert.match(manifestSource, /'24': 'assets\/icon-24\.png'/);
  assert.match(manifestSource, /'48': 'assets\/icon-48\.png'/);
  assert.match(manifestSource, /'128': 'assets\/icon-128\.png'/);

  for (const relativePath of pageFiles) {
    const html = read(relativePath);
    assert.match(html, /KnownMap/);
    const visibleHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');
    assert.doesNotMatch(visibleHtml, /LessonPilot|>LP</);
  }
  assert.match(read('v1/site/index.html'), /assets\/knownmap-icon\.png/);
});

test('teacher application uses the interactive-course-tool name and colored K/M wordmark', () => {
  const shell = read('v1/web/shared/src/components/AppShell.tsx');
  const css = read('v1/web/shared/src/styles/base.css');

  assert.match(shell, /KnownMapWordmark/);
  assert.match(shell, /className="brand-letter-k"/);
  assert.match(shell, /className="brand-letter-m"/);
  assert.match(css, new RegExp(`\\.brand-letter-k\\s*\\{[^}]*color:\\s*${hex('pathStart')}`, 'i'));
  assert.match(css, new RegExp(`\\.brand-letter-m\\s*\\{[^}]*color:\\s*${hex('pathEnd')}`, 'i'));

  const popupCss = read('v1/extension/popup/popup.css');
  assert.match(popupCss, new RegExp(`\\.brand-letter-k\\s*\\{[^}]*color:\\s*${hex('pathStart')}`, 'i'));
  assert.match(popupCss, new RegExp(`\\.brand-letter-m\\s*\\{[^}]*color:\\s*${hex('pathEnd')}`, 'i'));
});

test('sales and public pages color KnownMap K/M to the logo path endpoints', () => {
  const pagesWithInlineColor = [
    'v1/site/index.html',
    'v1/site/student/guide.html',
    'v1/site/link.html'
  ];
  for (const relativePath of pagesWithInlineColor) {
    const html = read(relativePath);
    assert.match(html, /brand-letter-k/, `${relativePath} must color K`);
    assert.match(html, /brand-letter-m/, `${relativePath} must color M`);
  }
  for (const relativePath of pagesWithInlineColor) {
    const html = read(relativePath);
    if (relativePath === 'v1/site/student/guide.html') {
      assert.match(html, /var\(--accent\)/, `${relativePath} must use the pathStart token`);
      assert.match(html, /var\(--end\)/, `${relativePath} must use the pathEnd token`);
    } else {
      assert.match(html, new RegExp(hex('pathStart'), 'i'), `${relativePath} must use pathStart`);
      assert.match(html, new RegExp(hex('pathEnd'), 'i'), `${relativePath} must use pathEnd`);
    }
  }
});
