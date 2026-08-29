const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const test = require('node:test');

const faviconEntries = [
  ['v1/site/index.html', 'assets/knownmap-icon.png'],
  ['v1/site/student-guide.html', 'assets/knownmap-icon.png'],
  ['v1/site/link.html', 'assets/knownmap-icon.png'],
  ['v1/web/admin/index.html', '../../extension/assets/knownmap/knownmap-square.svg'],
  ['v1/web/teacher/index.html', '../../extension/assets/knownmap/knownmap-square.svg'],
];

test('all browser entrypoints declare the KnownMap favicon', () => {
  for (const [entryPath, faviconPath] of faviconEntries) {
    const html = readFileSync(entryPath, 'utf8');
    assert.match(
      html,
      new RegExp(`<link\\s+rel=["']icon["'][^>]+href=["']${faviconPath.replaceAll('/', '\\/')}["']`),
      `${entryPath} must reference ${faviconPath}`
    );
  }
  assert.equal(existsSync('v1/site/assets/knownmap-icon.png'), true);
  assert.equal(existsSync('v1/extension/assets/knownmap/knownmap-square.svg'), true);
});
