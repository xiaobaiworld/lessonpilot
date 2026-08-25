const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('旧系统集中归档，当前运行目录不再混放旧前端和旧插件', () => {
  assert.equal(exists('teacher-web'), false, '根目录 teacher-web/ 应进入旧系统归档');
  assert.equal(exists('src'), false, '根目录 src/ 旧插件应进入旧系统归档');

  for (const relativePath of [
    'archive/legacy-v0.9.1/README.md',
    'archive/legacy-v0.9.1/teacher-web/editor.html',
    'archive/legacy-v0.9.1/extension-src/manifest.json',
    'archive/legacy-v0.9.1/tests/admin-page.test.js',
    'archive/legacy-v0.9.1/tools/assemble-workspace.js',
    'archive/legacy-v0.9.1/github/workflows/pages.yml',
  ]) {
    assert.equal(exists(relativePath), true, `旧系统归档缺少 ${relativePath}`);
  }
});

test('仍在使用的静态站点和视觉样式已经归入 v1', () => {
  for (const relativePath of [
    'v1/public-site/index.html',
    'v1/public-site/student-guide.html',
    'v1/public-site/trial-intake.js',
    'v1/public-site/assets/knownmap-icon.png',
    'v1/web/shared/src/styles/base.css',
  ]) {
    assert.equal(exists(relativePath), true, `当前 v1 资产缺少 ${relativePath}`);
  }

  for (const relativePath of [
    'v1/web/admin/src/index.css',
    'v1/web/teacher/src/index.css',
  ]) {
    const source = read(relativePath);
    assert.match(source, /shared\/src\/styles\/base\.css/);
    assert.doesNotMatch(source, /teacher-web\/styles\.css/);
  }
});

test('生产发布只从 v1 取当前资产和插件，不再打包旧系统', () => {
  const release = read('tools/web-release.sh');

  assert.match(release, /v1\/public-site\/index\.html/);
  assert.match(release, /v1\/web\/shared\/src\/styles\/base\.css/);
  assert.match(release, /downloads\/student-plugin\/knownmap-v1\.zip/);
  assert.doesNotMatch(release, /source_dir\/teacher-web/);
  assert.doesNotMatch(release, /build_student_plugin_package/);
  assert.doesNotMatch(release, /source_dir\/src/);
  assert.match(
    release,
    /knownmap-v1\.zip"[\s\S]*knownmapplugin\.zip"/,
    '旧下载文件名只能是 V1 插件包的兼容副本'
  );
});

test('当前生产后端保留在 backend，并在归档说明中明确不是旧代码', () => {
  assert.equal(exists('backend/app/main.py'), true);
  const archiveReadme = read('archive/legacy-v0.9.1/README.md');
  assert.match(archiveReadme, /backend\/.*当前生产 V1 API/s);
  assert.match(archiveReadme, /git revert|git restore/);
});
