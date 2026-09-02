const assert = require('node:assert/strict');
const test = require('node:test');

test('版本治理清单能解析所有组件来源', async () => {
  const { loadManifest, resolveVersions, validateManifest } = await import('../tools/version-check.mjs');
  const manifest = loadManifest();
  assert.deepEqual(validateManifest(manifest), []);
  const versions = resolveVersions();
  assert.equal(versions.product, '0.1.0');
  assert.equal(versions.studentExtension, '1.2.3');
  assert.equal(versions.httpApi, '2.2.0');
  assert.equal(versions.database, '20260901_local_trial_application');
});

test('路径分类会把应用层和架构层分到不同审计等级', async () => {
  const { classifyFiles, loadManifest, requiredAudit } = await import('../tools/version-check.mjs');
  const manifest = loadManifest();
  const classified = classifyFiles([
    'v1/web/teacher/src/pages/CoursesPage.tsx',
    'v1/contracts/schemas/course-package.schema.json',
    'v1/backend/alembic/versions/20260901_local_trial_application.py',
  ], manifest);
  assert.equal(classified[0].auditProfile, 'page');
  assert.equal(classified[1].auditProfile, 'contract');
  assert.equal(classified[2].auditProfile, 'database');
  assert.equal(requiredAudit(classified, manifest), 'database');
});

test('变更记录必须覆盖代码改动影响的组件', async () => {
  const { classifyFiles, loadManifest, resolveVersions, validateChangeRecord } = await import('../tools/version-check.mjs');
  const manifest = loadManifest();
  const files = ['v1/web/teacher/src/pages/CoursesPage.tsx'];
  const classifications = classifyFiles(files, manifest);
  const versions = resolveVersions();
  const valid = {
    schemaVersion: 1,
    id: 'test',
    changeType: 'application',
    auditProfile: 'page',
    components: ['teacherWeb'],
    versionChanges: [{ component: 'teacherWeb', from: '0.0.9', to: versions.teacherWeb }],
    compatibility: { businessBehaviorChanged: false },
    requiredAudits: ['page'],
    evidence: ['test'],
    rollback: 'revert',
  };
  assert.deepEqual(validateChangeRecord(valid, classifications, versions, manifest), []);
  assert.match(validateChangeRecord({ ...valid, versionChanges: [] }, classifications, versions, manifest).join('\n'), /teacherWeb/);
});

test('变更记录缺少审计证据时会失败', async () => {
  const { classifyFiles, loadManifest, resolveVersions, validateChangeRecord } = await import('../tools/version-check.mjs');
  const manifest = loadManifest();
  const classifications = classifyFiles(['v1/web/teacher/src/pages/CoursesPage.tsx'], manifest);
  const versions = resolveVersions();
  const errors = validateChangeRecord({ schemaVersion: 1, id: 'test', auditProfile: 'page', versionChanges: [] }, classifications, versions, manifest);
  assert.match(errors.join('\n'), /requiredAudits/);
  assert.match(errors.join('\n'), /teacherWeb/);
});

test('纯文档或测试改动不强制升级产品版本', async () => {
  const { classifyFiles, loadManifest } = await import('../tools/version-check.mjs');
  const manifest = loadManifest();
  const classified = classifyFiles(['docs/VERSIONING.md', 'tests/version-check.test.js'], manifest);
  assert.equal(classified.every((item) => !item.versionRequired), true);
});
