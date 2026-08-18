const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const api = require('../teacher-web/api-client.js');

test('teacher API client sends credentialed JSON requests to the local FastAPI service', async () => {
  let captured;
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    captured = { url, options };
    return { ok: true, json: async () => ({ id: 'teacher-1' }) };
  };

  try {
    await api.login('teacher-test-01', 'local-password');
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(captured.url, 'http://127.0.0.1:8000/api/v1/auth/login');
  assert.equal(captured.options.credentials, 'include');
  assert.equal(captured.options.method, 'POST');
  assert.deepEqual(JSON.parse(captured.options.body), {
    login_name: 'teacher-test-01',
    password: 'local-password'
  });
});

test('teacher API client exposes stable backend error codes to the workspace', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 409,
    json: async () => ({
      error: { code: 'DRAFT_NOT_READY', message: '课程还没有可发布的草稿。' }
    })
  });

  try {
    await assert.rejects(
      () => api.publishCourse('course-1'),
      (error) => error.code === 'DRAFT_NOT_READY' && error.status === 409
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('teacher editor loads auth, API, draft, publish and access-code controls', () => {
  const page = fs.readFileSync('teacher-web/editor.html', 'utf8');

  for (const marker of [
    'id="login-form"',
    'src="api-client.js?',
    'id="save-timeline"',
    'id="publish-course"',
    'id="create-access-code"',
    'id="access-code-value"'
  ]) {
    assert.ok(page.includes(marker), `missing ${marker}`);
  }
});
