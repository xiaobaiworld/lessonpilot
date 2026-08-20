// 定位: 验证静态销售站的精确提交构建、白名单、校验和与回滚元数据。
// 入口参数: tools/web-release.sh 和临时 Git 仓库夹具。
// 返回参数: Node test 通过/失败结果。
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'tools/web-release.sh');

function run(command, args, options = {}) {
  return childProcess.spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    ...options
  });
}

function listFiles(directory) {
  const files = [];

  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else {
        files.push(path.relative(directory, absolute));
      }
    }
  }

  visit(directory);
  return files.sort();
}

test('web release script has valid shell syntax and traceability guards', () => {
  assert.equal(fs.existsSync(script), true, 'tools/web-release.sh must exist');

  const syntax = run('bash', ['-n', script]);
  assert.equal(syntax.status, 0, syntax.stderr);

  const source = fs.readFileSync(script, 'utf8');
  assert.match(source, /git\s+-C\s+"\$ROOT_DIR"\s+archive/);
  assert.match(source, /refs\/remotes/);
  assert.match(source, /release\.json/);
  assert.match(source, /SHA256SUMS/);
  assert.match(source, /web-prod\//);
  assert.match(source, /release-history\.jsonl/);
  assert.match(source, /mv -Tf/);
  assert.match(source, /teacher-web\/editor\.html/);
  assert.match(source, /SITE_URL\/health/);
  assert.match(source, /verify\)\s*$/m);
});

test('build packages the exact commit with only the sales-site whitelist', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'knownmap-release-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));

  const output = path.join(temporary, 'release');
  const result = run('bash', [script, 'build', 'HEAD', output], {
    env: { ...process.env, KNOWNMAP_PUBLISH_PROFILE: 'sales-static-v1' }
  });
  assert.equal(result.status, 0, result.stderr);

  assert.deepEqual(listFiles(output), [
    'SHA256SUMS',
    'public/assets/knownmap-icon.png',
    'public/demo-captions.js',
    'public/index.html',
    'public/robots.txt',
    'public/subtitle-context.js',
    'public/teacher-web/assets/knownmap-icon.png',
    'public/teacher-web/demo-captions.js',
    'public/teacher-web/forsales.html',
    'public/teacher-web/subtitle-context.js',
    'public/teacher-web/trial-intake.js',
    'public/trial-intake.js',
    'release.json'
  ]);

  const expectedHtml = run('git', ['show', 'HEAD:teacher-web/forsales.html']);
  assert.equal(expectedHtml.status, 0, expectedHtml.stderr);
  assert.equal(fs.readFileSync(path.join(output, 'public/index.html'), 'utf8'), expectedHtml.stdout);

  const metadata = JSON.parse(fs.readFileSync(path.join(output, 'release.json'), 'utf8'));
  const expectedCommit = run('git', ['rev-parse', 'HEAD']).stdout.trim();
  assert.equal(metadata.gitCommit, expectedCommit);
  assert.equal(metadata.publishProfile, 'sales-static-v1');
  assert.equal(metadata.site, 'https://knownmap.com');
  assert.equal(metadata.files.length, 11);

  for (const forbidden of ['doc', 'src', 'tests', 'teacher-web/editor.html', '.git', '.env']) {
    assert.equal(fs.existsSync(path.join(output, 'public', forbidden)), false, `${forbidden} must stay private`);
  }
});

test('teacher platform profile packages the editor without publishing the repository', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'knownmap-teacher-release-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));

  const output = path.join(temporary, 'release');
  const result = run('bash', [script, 'build', 'HEAD', output], {
    env: { ...process.env, KNOWNMAP_PUBLISH_PROFILE: 'teacher-platform-v1' }
  });
  assert.equal(result.status, 0, result.stderr);

  const metadata = JSON.parse(fs.readFileSync(path.join(output, 'release.json'), 'utf8'));
  assert.equal(metadata.publishProfile, 'teacher-platform-v1');
  assert.ok(fs.existsSync(path.join(output, 'public/teacher-web/editor.html')));
  assert.ok(fs.existsSync(path.join(output, 'public/teacher-web/api-client.js')));
  assert.ok(fs.existsSync(path.join(output, 'public/teacher-web/app.js')));
  assert.equal(fs.existsSync(path.join(output, 'public/backend')), false);
  assert.equal(fs.existsSync(path.join(output, 'public/.git')), false);
});

test('release documentation binds publish phrases to deploy, record, and rollback steps', () => {
  const design = fs.readFileSync(path.join(root, 'doc/web-production-release-design.md'), 'utf8');
  const records = fs.readFileSync(path.join(root, 'deploy/releases/README.md'), 'utf8');

  assert.match(design, /发布到网站/);
  assert.match(design, /发布到 Web 网站/);
  assert.match(design, /tools\/web-release\.sh deploy <git-ref>/);
  assert.match(design, /tools\/web-release\.sh verify <release-id>/);
  assert.match(design, /tools\/web-release\.sh rollback <release-id>/);
  assert.match(records, /gitCommit/);
  assert.match(records, /gitTag/);
});
