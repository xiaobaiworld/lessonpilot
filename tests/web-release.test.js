// 当前 v1 Web 发布入口的最小结构门禁。
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'tools/web-release.sh');
const source = fs.readFileSync(script, 'utf8');

test('web release script has valid shell syntax and traceability guards', () => {
  const result = childProcess.spawnSync('bash', ['-n', script], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
  for (const marker of [
    'git -C "$ROOT_DIR" archive',
    'release.json',
    'SHA256SUMS',
    'web-prod/',
    'release-history.jsonl',
    'mv -Tf'
  ]) {
    assert.ok(source.includes(marker), `missing ${marker}`);
  }
});

test('release has one current profile and no legacy web source', () => {
  assert.match(source, /PUBLISH_PROFILE="\$\{KNOWNMAP_PUBLISH_PROFILE:-v1-apps\}"/);
  assert.match(source, /SOURCE_FILES=\("v1"\)/);
  assert.doesNotMatch(source, /sales-static-v1|teacher-platform-v1|teacher-web/);
});

test('release packages the current site, both apps and the production extension', () => {
  for (const marker of [
    'v1/site/index.html',
    'v1/site/student-guide.html',
    'v1/site/link.html',
    'build_v1_apps "$source_dir" "$output"',
    'npm ci --silent',
    'KNOWNMAP_TARGET=production',
    'knownmap-v1.zip',
    'knownmapplugin.zip',
    'public/admin/index.html',
    'public/teacher/index.html'
  ]) {
    assert.ok(source.includes(marker), `missing ${marker}`);
  }
});

test('release verification covers current public entries', () => {
  for (const publicPath of [
    '/admin/',
    '/teacher/',
    '/student-guide.html',
    '/link.html',
    '/downloads/student-plugin/knownmap-v1.zip',
    '/downloads/student-plugin/knownmapplugin.zip'
  ]) {
    assert.ok(source.includes(publicPath), `verification missing ${publicPath}`);
  }
});

test('release documentation binds deploy and rollback commands', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const records = fs.readFileSync(path.join(root, 'deploy/releases/README.md'), 'utf8');
  assert.match(readme, /KNOWNMAP_PUBLISH_PROFILE=v1-apps/);
  assert.match(readme, /tools\/teacher-platform-release\.sh deploy <git-ref>/);
  assert.match(readme, /tools\/web-release\.sh verify <release-id>/);
  assert.match(readme, /tools\/web-release\.sh rollback <release-id>/);
  assert.match(records, /gitCommit/);
  assert.match(records, /gitTag/);
});
