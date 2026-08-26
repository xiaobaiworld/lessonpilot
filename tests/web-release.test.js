// 当前 v1 Web 发布入口的最小结构门禁；实现已并入 tools/release.sh。
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'tools/release.sh');
const source = fs.readFileSync(script, 'utf8');

test('web release is implemented by tools/release.sh', () => {
  const result = childProcess.spawnSync('bash', ['-n', script], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(source, /PUBLISH_PROFILE="\$\{KNOWNMAP_PUBLISH_PROFILE:-v1-apps\}"/);
  assert.doesNotMatch(source, /sales-static-v1|teacher-platform-v1|teacher-web/);
});

test('release packages the current site, both apps and the production extension', () => {
  for (const marker of [
    'v1/site/index.html',
    'v1/site/student-guide.html',
    'v1/site/link.html',
    'npm ci',
    'KNOWNMAP_TARGET=production',
    'knownmap-v1.zip',
    'knownmapplugin.zip',
    'public/$app',
  ]) {
    assert.ok(source.includes(marker), `missing ${marker}`);
  }
});

test('release verification covers current public entries', () => {
  for (const publicPath of ['/admin/', '/teacher/']) {
    assert.ok(source.includes(publicPath), `verification missing ${publicPath}`);
  }
});
