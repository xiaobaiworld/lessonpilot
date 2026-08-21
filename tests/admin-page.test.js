const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const admin = require('../teacher-web/admin.js');

test('admin page preserves existing links and exposes complete account management states', () => {
  const page = fs.readFileSync('teacher-web/admin.html', 'utf8');

  for (const marker of [
    'href="/"',
    'href="/teacher-web/editor.html"',
    'href="/health"',
    'id="open-admin-login"',
    'id="admin-login-form"',
    'autocomplete="username"',
    'autocomplete="current-password"',
    'id="admin-logout"',
    'id="refresh-teachers"',
    'id="teacher-table-body"',
    'id="create-teacher-form"',
    'id="copy-temporary-password"',
    'id="dismiss-temporary-password"',
    'src="/teacher-web/admin.js?'
  ]) {
    assert.ok(page.includes(marker), `missing ${marker}`);
  }

  for (const id of [
    'admin-login-panel',
    'admin-workspace',
    'temporary-password-result'
  ]) {
    assert.match(page, new RegExp(`<[^>]*id="${id}"[^>]*\\shidden(?:\\s|>)`));
  }

  assert.doesNotMatch(page, /id="admin-password"[^>]*\svalue=/);
  assert.doesNotMatch(page, /teacher-test-01/);
  assert.doesNotMatch(page, /\/api\/v1\//);
});

test('admin API client uses the isolated credentialed endpoints', async () => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({}) };
  };

  try {
    await admin.login('admin', 'provided-password');
    await admin.me();
    await admin.listTeachers();
    await admin.createTeacher('teacher-02', '新教师');
    await admin.resetTeacherPassword('teacher-id');
    await admin.logout();
  } finally {
    global.fetch = originalFetch;
  }

  assert.deepEqual(
    calls.map(({ url, options }) => [url, options.method || 'GET', options.credentials]),
    [
      ['http://127.0.0.1:8000/api/v1/admin/auth/login', 'POST', 'include'],
      ['http://127.0.0.1:8000/api/v1/admin/auth/me', 'GET', 'include'],
      ['http://127.0.0.1:8000/api/v1/admin/teachers', 'GET', 'include'],
      ['http://127.0.0.1:8000/api/v1/admin/teachers', 'POST', 'include'],
      [
        'http://127.0.0.1:8000/api/v1/admin/teachers/teacher-id/reset-password',
        'POST',
        'include'
      ],
      ['http://127.0.0.1:8000/api/v1/admin/auth/logout', 'POST', 'include']
    ]
  );
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    login_name: 'admin',
    password: 'provided-password'
  });
  assert.deepEqual(JSON.parse(calls[3].options.body), {
    login_name: 'teacher-02',
    display_name: '新教师'
  });
  assert.equal(calls[4].options.body, undefined);
});

test('admin interaction coordinator rejects stale responses and serializes credentials', () => {
  const coordinator = admin.createInteractionCoordinator();

  const restoreGeneration = coordinator.currentSessionGeneration();
  coordinator.advanceSession();
  assert.equal(coordinator.isSessionCurrent(restoreGeneration), false);

  const teacherRequest = coordinator.beginTeacherRequest();
  coordinator.invalidateTeacherRequests();
  assert.equal(coordinator.isTeacherRequestCurrent(teacherRequest), false);

  assert.equal(coordinator.beginSensitiveOperation(), true);
  assert.equal(coordinator.beginSensitiveOperation(), false);
  coordinator.finishSensitiveOperation();

  coordinator.setTemporaryPasswordPresent(true);
  assert.equal(coordinator.beginSensitiveOperation(), false);
  coordinator.setTemporaryPasswordPresent(false);
  assert.equal(coordinator.beginSensitiveOperation(), true);
});

test('admin page keeps temporary credentials in memory and renders untrusted data safely', () => {
  const source = fs.readFileSync('teacher-web/admin.js', 'utf8');

  assert.match(source, /temporaryPassword:\s*null/);
  assert.match(source, /state\.temporaryPassword = null/);
  assert.match(source, /temporaryPasswordValue\.textContent/);
  assert.match(source, /navigator\.clipboard\.writeText\(state\.temporaryPassword\)/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
  assert.doesNotMatch(source, /console\.(log|info|warn|error)/);
  assert.match(source, /teacherTableBody\.replaceChildren\(\)/);
  assert.match(source, /adminDisplayName\.textContent = ''/);
  assert.match(source, /showEntryView\(\{ openLogin: true/);
  assert.match(source, /coordinator\.isSessionCurrent/);
  assert.match(source, /coordinator\.isTeacherRequestCurrent/);
  assert.match(source, /coordinator\.beginSensitiveOperation/);
  assert.match(source, /coordinator\.setTemporaryPasswordPresent/);
});
