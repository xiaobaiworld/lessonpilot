// 定位: 验证 V1 站点的精确提交构建、白名单、校验和与兼容入口。
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

test('发布脚本只接受 v1-apps，并保留追溯与回滚保护', () => {
  const syntax = run('bash', ['-n', script]);
  assert.equal(syntax.status, 0, syntax.stderr);

  const source = fs.readFileSync(script, 'utf8');
  for (const marker of [
    'KNOWNMAP_PUBLISH_PROFILE:-v1-apps',
    'git -C "$ROOT_DIR" archive',
    'release.json',
    'SHA256SUMS',
    'release-history.jsonl',
    'web-prod/$release_id',
    'mv -Tf',
    'v1/public-site/index.html',
    'v1/web/shared/src/styles/base.css',
    'KNOWNMAP_TARGET=production'
  ]) {
    assert.ok(source.includes(marker), `缺少 ${marker}`);
  }
  assert.doesNotMatch(source, /sales-static-v1|teacher-platform-v1/);
  assert.doesNotMatch(source, /source_dir\/src|build_student_plugin_package/);
});

test('生产探针覆盖 V1 应用、兼容入口和两个插件文件名', () => {
  const source = fs.readFileSync(script, 'utf8');
  const verifier = source.slice(
    source.indexOf('verify_public_site()'),
    source.indexOf('validate_release_in_worktree()')
  );

  for (const publicPath of [
    '/admin/',
    '/teacher/',
    '/admin.html',
    '/link.html',
    '/teacher-web/student-guide.html',
    '/teacher-web/editor.html',
    '/downloads/student-plugin/knownmap-v1.zip',
    '/downloads/student-plugin/knownmapplugin.zip'
  ]) {
    assert.ok(verifier.includes(publicPath), `生产探针缺少 ${publicPath}`);
  }
  assert.match(verifier, /knownmap-v1\.zip[\s\S]*knownmapplugin\.zip/);
  assert.match(verifier, /cmp -s/);
  assert.match(verifier, /unzip -p[\s\S]*manifest\.json/);
  assert.match(verifier, /action\.default_popup == "popup\/index\.html"/);
});

test('兼容下载名复制 V1 包，不再构建旧插件', () => {
  const source = fs.readFileSync(script, 'utf8');
  assert.match(
    source,
    /knownmap-v1\.zip"[\s\S]*cp[\s\S]*knownmapplugin\.zip"/
  );
  assert.doesNotMatch(source, /extension-src|archive\/legacy-v0\.9\.1/);
});

test('V1 发布白名单覆盖站点、应用与兼容路径，不放行源码目录', () => {
  const source = fs.readFileSync(script, 'utf8');
  const patterns = source
    .slice(source.indexOf('V1_ALLOWED_PATTERNS=('))
    .split(')')[0];

  for (const required of [
    'public/index.html',
    'public/link.html',
    'public/admin/index.html',
    'public/teacher/index.html',
    'public/admin/assets/*',
    'public/teacher/assets/*',
    'public/teacher-web/*',
    'public/downloads/student-plugin/*',
    'public/robots.txt'
  ]) {
    assert.ok(patterns.includes(required), `白名单缺少 ${required}`);
  }
  for (const forbidden of ['public/v1/', 'public/src/', 'public/archive/']) {
    assert.ok(!patterns.includes(forbidden), `白名单不应放行 ${forbidden}`);
  }
});

test('V1 构建从归档提交运行锁定依赖、测试和应用构建', () => {
  const source = fs.readFileSync(script, 'utf8');
  const build = source.slice(
    source.indexOf('build_v1_apps() {'),
    source.indexOf('build_release() {')
  );

  assert.match(build, /cd "\$source_dir\/v1" && npm ci/);
  assert.match(build, /cd "\$source_dir\/v1" && npm test/);
  assert.match(build, /cd "\$source_dir\/v1\/web\/\$app" && npm run build/);
  assert.match(build, /package-lock\.json missing in archived commit/);
  assert.match(build, /base\.css missing from archived commit/);
  assert.doesNotMatch(build, /ROOT_DIR\/v1/);
});

test('两个应用都使用子路径可用的相对 base', () => {
  for (const app of ['admin', 'teacher']) {
    const config = fs.readFileSync(
      path.join(root, `v1/web/${app}/vite.config.ts`),
      'utf8'
    );
    assert.match(config, /base: '\.\/'/, `${app} 缺少相对 base`);
  }
});

test('当前提交可构建完整 V1 发布候选', { timeout: 180000 }, (t) => {
  if (run('git', ['status', '--porcelain']).stdout.trim()) {
    t.skip('工作区有未提交改动；精确提交候选在归档提交后验证');
    return;
  }

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'knownmap-v1-release-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const output = path.join(temporary, 'release');
  const result = run('bash', [script, 'build', 'HEAD', output], {
    env: { ...process.env, KNOWNMAP_PUBLISH_PROFILE: 'v1-apps' },
    timeout: 170000
  });
  assert.equal(result.status, 0, result.stderr);

  for (const relativePath of [
    'release.json',
    'SHA256SUMS',
    'public/index.html',
    'public/link.html',
    'public/admin/index.html',
    'public/teacher/index.html',
    'public/admin.html',
    'public/teacher-web/editor.html',
    'public/teacher-web/student-guide.html',
    'public/downloads/student-plugin/knownmap-v1.zip',
    'public/downloads/student-plugin/knownmapplugin.zip'
  ]) {
    assert.equal(fs.existsSync(path.join(output, relativePath)), true, relativePath);
  }

  const v1Zip = fs.readFileSync(
    path.join(output, 'public/downloads/student-plugin/knownmap-v1.zip')
  );
  const compatibilityZip = fs.readFileSync(
    path.join(output, 'public/downloads/student-plugin/knownmapplugin.zip')
  );
  assert.deepEqual(compatibilityZip, v1Zip);

  const metadata = JSON.parse(
    fs.readFileSync(path.join(output, 'release.json'), 'utf8')
  );
  assert.equal(metadata.publishProfile, 'v1-apps');
  assert.equal(metadata.gitCommit, run('git', ['rev-parse', 'HEAD']).stdout.trim());
});

test('发布验证会把线上兼容下载名核对为同一份 V1 包', () => {
  const source = fs.readFileSync(script, 'utf8');
  assert.match(source, /expected_plugin_sha/);
  assert.match(
    source,
    /select\(\.path == "downloads\/student-plugin\/knownmap-v1\.zip"\)/
  );
  assert.match(source, /verify_public_site "\$release_id" "\$expected_index_sha" "\$expected_plugin_sha"/);
});

test('发布文档绑定部署、记录、验证和回滚命令', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const records = fs.readFileSync(path.join(root, 'deploy/releases/README.md'), 'utf8');

  assert.match(readme, /KNOWNMAP_PUBLISH_PROFILE=v1-apps/);
  assert.match(readme, /tools\/teacher-platform-release\.sh deploy <git-ref>/);
  assert.match(readme, /tools\/web-release\.sh verify <release-id>/);
  assert.match(readme, /tools\/web-release\.sh rollback <release-id>/);
  assert.match(records, /gitCommit/);
  assert.match(records, /gitTag/);
});

test('本地插件刷新脚本使用生产目标和删除同步', () => {
  const refreshScript = fs.readFileSync(
    path.join(root, 'tools/refresh-local-plugin.sh'),
    'utf8'
  );
  assert.match(refreshScript, /KNOWNMAP_TARGET=production/);
  assert.match(refreshScript, /rsync -a --delete/);
  assert.match(refreshScript, /popup\/index\.html/);
  assert.match(refreshScript, /content\/index\.js/);
});
