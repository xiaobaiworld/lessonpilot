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
  assert.match(source, /KNOWNMAP_RELEASE_ID:-\$\(release_id_for_commit/);
  assert.match(source, /verify\)\s*$/m);
  assert.match(source, /knownmapplugin\.zip/);
  assert.match(source, /downloads\/student-plugin/);
});

test('v1 production verification covers new apps, redirects and both plugin URLs', () => {
  const source = fs.readFileSync(script, 'utf8');
  const verifier = source.slice(
    source.indexOf('verify_public_site()'),
    source.indexOf('validate_release_in_worktree()')
  );

  assert.match(verifier, /PUBLISH_PROFILE" == "v1-apps/);
  for (const path of [
    '/admin/',
    '/teacher/',
    '/admin.html',
    '/link.html',
    '/teacher-web/student-guide.html',
    '/teacher-web/editor.html',
    '/downloads/student-plugin/knownmap-v1.zip',
    '/downloads/student-plugin/knownmapplugin.zip'
  ]) {
    assert.ok(verifier.includes(path), `v1 public verification missing ${path}`);
  }
  const v1Branch = verifier.slice(
    verifier.indexOf('elif [[ "$PUBLISH_PROFILE" == "v1-apps" ]]'),
    verifier.indexOf('  else', verifier.indexOf('elif [[ "$PUBLISH_PROFILE" == "v1-apps" ]]'))
  );
  assert.doesNotMatch(v1Branch, /private_paths\+=/);
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
    'public/downloads/student-plugin/knownmapplugin.zip',
    'public/index.html',
    'public/robots.txt',
    'public/subtitle-context.js',
    'public/teacher-web/assets/knownmap-icon.png',
    'public/teacher-web/assets/student-guide/step-download-and-unzip.png',
    'public/teacher-web/assets/student-guide/step-load-unpacked.png',
    'public/teacher-web/assets/student-guide/step-open-extensions.png',
    'public/teacher-web/demo-captions.js',
    'public/teacher-web/forsales.html',
    'public/teacher-web/student-guide.html',
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
  assert.equal(metadata.files.length, 16);

  const pluginZip = path.join(output, 'public/downloads/student-plugin/knownmapplugin.zip');
  const zipListing = run('unzip', ['-Z1', pluginZip]);
  assert.equal(zipListing.status, 0, zipListing.stderr);
  assert.match(zipListing.stdout, /(^|\n)manifest\.json\n/);
  assert.doesNotMatch(zipListing.stdout, /(^|\n)src\/manifest\.json\n/);
  assert.match(zipListing.stdout, /(^|\n)background\/service-worker\.js\n/);

  for (const forbidden of ['doc', 'src', 'tests', 'teacher-web/editor.html', '.git', '.env']) {
    assert.equal(fs.existsSync(path.join(output, 'public', forbidden)), false, `${forbidden} must stay private`);
  }

  assert.equal(fs.existsSync(path.join(output, 'public/teacher-web/student-guide.html')), true);
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
  assert.ok(fs.existsSync(path.join(output, 'public/admin.html')));
  assert.ok(fs.existsSync(path.join(output, 'public/teacher-web/admin.js')));
  assert.ok(metadata.files.some((file) => file.path === 'admin.html'));
  assert.ok(metadata.files.some((file) => file.path === 'teacher-web/admin.js'));
  assert.ok(fs.existsSync(path.join(output, 'public/teacher-web/editor.html')));
  assert.ok(fs.existsSync(path.join(output, 'public/teacher-web/api-client.js')));
  assert.ok(fs.existsSync(path.join(output, 'public/teacher-web/app.js')));
  assert.equal(fs.existsSync(path.join(output, 'public/backend')), false);
  assert.equal(fs.existsSync(path.join(output, 'public/.git')), false);
});

test('admin index exposes only the approved production entry points', () => {
  const adminPage = path.join(root, 'teacher-web/admin.html');
  assert.equal(fs.existsSync(adminPage), true, 'teacher-web/admin.html must exist');

  const source = fs.readFileSync(adminPage, 'utf8');
  assert.match(source, /<meta name="robots" content="noindex, noarchive">/);
  assert.match(source, /href="\/"/);
  assert.match(source, /href="\/teacher-web\/editor\.html"/);
  assert.match(source, /href="\/health"/);
  assert.match(source, /src="\/teacher-web\/admin\.js\?/);
  assert.doesNotMatch(source, /\/api\/v1\//);
  assert.doesNotMatch(source, /43\.110\.33\.202/);
});

test('release documentation binds publish phrases to deploy, record, and rollback steps', () => {
  // 断言活跃文档，不断言归档：README 是当前发布入口说明，deploy/releases 是发布记录格式。
  // 旧发布设计已按 SRC-030 归档，只作历史追溯，不能成为测试依赖。
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const records = fs.readFileSync(path.join(root, 'deploy/releases/README.md'), 'utf8');

  assert.match(readme, /发布到网站/);
  assert.match(readme, /发布到 Web 网站/);
  assert.match(readme, /KNOWNMAP_PUBLISH_PROFILE=v1-apps/);
  assert.match(readme, /tools\/teacher-platform-release\.sh deploy <git-ref>/);
  assert.match(readme, /tools\/web-release\.sh verify <release-id>/);
  assert.match(readme, /tools\/web-release\.sh rollback <release-id>/);
  assert.match(records, /gitCommit/);
  assert.match(records, /gitTag/);
});

// v1 应用的发布契约。
//
// 不在这里跑完整构建：那要 npm ci 和网络，几分钟一次。
// 这些断言检查的是发布契约本身——profile 声明、白名单形状、防护是否存在，
// 这些是改脚本时最容易悄悄改坏的部分。
const v1Script = fs.readFileSync(script, 'utf8');

test('v1 profile 从归档目录构建而非工作树', () => {
  // 用工作树构建会让发布内容和记录的提交不是同一份
  assert.match(v1Script, /build_v1_apps\(\) \{/);
  assert.match(v1Script, /cd "\$source_dir\/v1" && npm ci/);
  assert.doesNotMatch(v1Script, /cd "\$ROOT_DIR\/v1" && npm run build/);
});

test('v1 依赖按锁文件安装，缺锁文件直接失败', () => {
  assert.match(v1Script, /npm ci/);
  assert.doesNotMatch(v1Script, /cd "\$source_dir\/v1" && npm install/);
  assert.match(v1Script, /package-lock\.json missing in archived commit/);
});

test('v1 构建前先跑测试', () => {
  const buildFn = v1Script.slice(
    v1Script.indexOf('build_v1_apps() {'),
    v1Script.indexOf('build_release() {')
  );
  const testAt = buildFn.indexOf('npm test');
  const buildAt = buildFn.indexOf('npm run build');
  assert.ok(testAt > 0, '构建函数里应当有 npm test');
  assert.ok(testAt < buildAt, '测试必须排在构建之前');
});

test('生产插件包发布前检查本机地址', () => {
  // 带着本机地址发出去等于给每个安装者开一条通往自己机器的通道
  assert.match(v1Script, /127\\\.0\\\.0\\\.1\|localhost/);
  assert.match(v1Script, /contains a localhost reference; refusing to publish/);
  assert.match(v1Script, /KNOWNMAP_TARGET=production/);
});

test('v1 两个插件下载名来自同一份生产包并按候选摘要和版本校验', () => {
  const buildFn = v1Script.slice(
    v1Script.indexOf('build_v1_apps() {'),
    v1Script.indexOf('build_release() {')
  );
  const verifier = v1Script.slice(
    v1Script.indexOf('verify_public_site()'),
    v1Script.indexOf('validate_release_in_worktree()')
  );

  assert.match(
    buildFn,
    /cp\s+\\?\s*"\$output\/public\/downloads\/student-plugin\/knownmap-v1\.zip"\s+\\?\s*"\$output\/public\/downloads\/student-plugin\/knownmapplugin\.zip"/
  );
  assert.match(verifier, /cmp -s "\$plugin_v1" "\$plugin_compat"/);
  assert.match(verifier, /== "\$expected_plugin_sha"/);
  assert.match(verifier, /\.version == \$expected_version/);
  assert.match(verifier, /\.action\.default_popup == "popup\/index\.html"/);
});

test('v1 插件发布只跑插件范围测试，综合发布仍跑完整测试', () => {
  const buildFn = v1Script.slice(
    v1Script.indexOf('build_v1_apps() {'),
    v1Script.indexOf('build_release() {')
  );

  assert.match(buildFn, /RELEASE_SCOPE" == "plugin"/);
  assert.match(buildFn, /npm test --silent -- extension/);
  assert.match(buildFn, /npm test --silent\)/);
});

test('v1 白名单覆盖应用和链接导航且不含仓库源码路径', () => {
  const patterns = v1Script
    .slice(v1Script.indexOf('V1_ALLOWED_PATTERNS=('))
    .split(')')[0];

  for (const required of [
    'public/admin/index.html',
    'public/teacher/index.html',
    'public/link.html',
    'public/admin/assets/*',
    'public/teacher/assets/*',
    'public/robots.txt'
  ]) {
    assert.ok(patterns.includes(required), `白名单缺少 ${required}`);
  }

  // 源码不得出现在发布产物里
  assert.ok(!patterns.includes('public/v1/'), '白名单不应放行 v1 源码目录');
  assert.ok(!patterns.includes('public/src/'), '白名单不应放行 src 目录');
});

test('v1 发布缺任一应用入口时失败', () => {
  assert.match(v1Script, /admin entry missing from release/);
  assert.match(v1Script, /teacher entry missing from release/);
  assert.match(v1Script, /link navigation missing from release/);
});

test('v1 发布从精确提交归档链接导航', () => {
  const profile = v1Script.slice(
    v1Script.indexOf('elif [[ "$PUBLISH_PROFILE" == "v1-apps" ]]'),
    v1Script.indexOf('  fail "unsupported publish profile')
  );
  assert.match(profile, /"link\.html"/);
  assert.match(v1Script, /cp "\$source_dir\/link\.html" "\$output\/public\/link\.html"/);
});

test('v1 校验和按实测文件生成，静态 profile 仍用固定白名单', () => {
  assert.match(v1Script, /released_files\(\) \{/);
  // v1 走 find，其它 profile 走 PUBLIC_FILES
  assert.match(v1Script, /find public -type f/);
  assert.match(v1Script, /printf '%s\\n' "\$\{PUBLIC_FILES\[@\]\}"/);
});

test('v1 归档带上被 @import 的样式表', () => {
  // 它在 v1/ 之外，不归档的话 postcss 在构建时解析不到
  const profile = v1Script.slice(
    v1Script.indexOf('elif [[ "$PUBLISH_PROFILE" == "v1-apps" ]]'),
    v1Script.indexOf('  fail "unsupported publish profile')
  );
  assert.ok(profile.includes('teacher-web/styles.css'), 'v1 profile 应归档共用样式表');
});

test('销售页不随 v1 迁移改写', () => {
  const profile = v1Script.slice(
    v1Script.indexOf('elif [[ "$PUBLISH_PROFILE" == "v1-apps" ]]'),
    v1Script.indexOf('  fail "unsupported publish profile')
  );
  assert.ok(profile.includes('SALES_SOURCE_FILES'), 'v1 发布应原样带上销售页');
});

test('发布校验拦下站点根绝对资源路径', () => {
  // 应用挂在 /admin/ 与 /teacher/ 子路径下，绝对路径资源全部 404，
  // 页面白屏。dev server 挂在根路径，所以这个问题只在发布产物上才出现。
  assert.match(v1Script, /使用站点根绝对资源路径/);
  assert.match(v1Script, /for app in admin teacher; do/);
});

test('两个应用都设了相对 base', () => {
  for (const app of ['admin', 'teacher']) {
    const config = fs.readFileSync(
      path.join(root, `v1/web/${app}/vite.config.ts`),
      'utf8'
    );
    assert.match(config, /base: '\.\/'/, `${app} 缺少相对 base`);
  }
});
