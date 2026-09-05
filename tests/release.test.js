// 定位: 初期统一发布入口 tools/release.sh（D-V1-013）。
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'tools/release.sh');
const source = fs.readFileSync(script, 'utf8');

function run(command, args) {
  return childProcess.spawnSync(command, args, { cwd: root, encoding: 'utf8' });
}

test('统一发布脚本语法正确，且是唯一实现', () => {
  const syntax = run('bash', ['-n', script]);
  assert.equal(syntax.status, 0, syntax.stderr);
  for (const marker of [
    'D-V1-013',
    'web-prod/',
    'deploy/releases',
    'v1/site/link.html',
    'aliyun-us'
  ]) {
    assert.ok(source.includes(marker), `missing ${marker}`);
  }
});

test('初期发布不把 CI、远端全测和备份演练当门禁', () => {
  assert.doesNotMatch(source, /check-runs/);
  assert.doesNotMatch(source, /required_checks/);
  assert.doesNotMatch(source, /node-test/);
  assert.doesNotMatch(source, /knownmap-restore-check/);
  assert.doesNotMatch(source, /npm test --silent/);
  assert.doesNotMatch(source, /run_commit_tests/);
});

test('本机构建静态产物，服务器按 lockfile 复用 venv', () => {
  assert.match(source, /npm ci/);
  assert.match(source, /npm run build/);
  assert.match(source, /KNOWNMAP_TARGET=production/);
  assert.match(source, /archive \"\$commit\" -- VERSION v1/);
  assert.match(source, /venv\.lock\.sha256/);
  assert.match(source, /sync --frozen --no-dev/);
  assert.match(source, /ln -sfn "\$shared_venv"/);
});

test('首次建库才 seed，不把密码打进日志', () => {
  assert.match(source, /KNOWNMAP_PRODUCTION_TEACHER_PASSWORD/);
  assert.match(source, /SEED_TEACHER_LOGIN_NAME=teacher-test-01/);
  assert.doesNotMatch(source, /TEACHER_PASSWORD=%s/);
  assert.match(source, /UV_VERSION="0\.11\.12"/);
});

test('版本化仍用 web-prod 标签和 deploy/releases JSON', () => {
  assert.match(source, /--arg gitTag "web-prod\/\$release_id"/);
  assert.match(source, /tag -a "\$tag"/);
  assert.match(source, /deploy\/releases\/\$release_id\.json/);
  assert.match(source, /source_dir\/VERSION/);
  assert.match(source, /productVersion/);
});

test('发布入口文档指向单一脚本', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const records = fs.readFileSync(path.join(root, 'deploy/releases/README.md'), 'utf8');
  assert.match(readme, /tools\/release\.sh deploy <git-ref>/);
  assert.match(readme, /tools\/release\.sh verify <release-id>/);
  assert.match(readme, /tools\/release\.sh rollback <release-id>/);
  assert.match(records, /gitCommit/);
  assert.match(records, /gitTag/);
});
