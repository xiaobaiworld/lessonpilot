const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

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

test('teacher API client keeps localhost pages and API cookies on the same host', async () => {
  let capturedUrl;
  const context = {
    fetch: async (url) => {
      capturedUrl = url;
      return { ok: true, json: async () => ({}) };
    },
    window: {
      location: { hostname: 'localhost' }
    }
  };
  vm.runInNewContext(fs.readFileSync('teacher-web/api-client.js', 'utf8'), context);

  await context.window.KnownMapApi.login('teacher-test-01', 'password');

  assert.equal(capturedUrl, 'http://localhost:8000/api/v1/auth/login');
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
    'id="access-code-value"',
    'id="node-plugin-bar"',
    'id="visual-timeline-track"',
    'id="timeline-node-layer"',
    'id="timeline-subtitle-list"',
    'id="node-editor-dialog"',
    'src="subtitle-context.js?',
    'src="node-plugin-registry.js?',
    'src="timeline-model.js?',
    'src="editor-logger.js?',
    'src="visual-node-editor.js?'
  ]) {
    assert.ok(page.includes(marker), `missing ${marker}`);
  }

  assert.equal(page.includes('id="caption-list"'), false);
  assert.equal(page.includes('class="event-options"'), false);
});

test('teacher editor presents a production-like interactive course tool login', () => {
  const page = fs.readFileSync('teacher-web/editor.html', 'utf8');
  const app = fs.readFileSync('teacher-web/app.js', 'utf8');
  const envExample = fs.readFileSync('backend/.env.example', 'utf8');

  assert.ok(page.includes('id="login-name" name="login_name" value="teacher-test-01"'));
  assert.ok(page.includes('KnownMap 互动课程工具'));
  assert.ok(page.includes('<span>用户名</span>'));
  assert.equal(page.includes('登录账号'), false);
  assert.equal(page.includes('使用教师账号继续设计和发布课程。'), false);
  assert.ok(page.includes('id="login-password" name="password" type="password"'));
  assert.equal(/id="login-password"[^>]*\svalue=/.test(page), false);
  assert.ok(page.includes('id="toggle-password"'));
  assert.ok(page.includes('aria-pressed="false"'));
  assert.ok(page.includes('id="login-button"'));
  assert.ok(page.includes('id="workspace-nav"'));
  assert.ok(page.includes('id="workspace-account"'));
  assert.ok(page.includes('id="course-title-input" type="text" required'));
  assert.ok(page.includes('id="lesson-title-input" type="text" required'));
  assert.ok(page.includes('id="choose-subtitle-file"'));
  assert.ok(page.includes('role="group"'));
  assert.equal(page.includes('value="英语面试表达：把答案说得具体"'), false);
  assert.equal(page.includes('value="第一课 · 用具体经历回答"'), false);
  assert.ok(app.includes("loginPassword.type === 'password' ? 'text' : 'password'"));
  assert.ok(app.includes("loginButton.disabled = true"));
  assert.ok(app.includes("loginButton.disabled = false"));
  assert.ok(app.includes("reason.code === 'AUTH_INVALID_CREDENTIALS'"));
  assert.ok(app.includes("'用户名或密码错误'"));
  assert.ok(app.includes("window.scrollTo({ top: 0, behavior: 'auto' })"));
  assert.ok(envExample.includes('SEED_TEACHER_PASSWORD=password'));
  assert.equal(page.includes('knownmap-local-2026'), false);
  assert.ok(app.includes('let captions = [];'));
  assert.equal(app.includes('Today we are going to talk about'), false);
  assert.ok(page.includes('styles.css?v=editor-completion-1'));
  assert.ok(page.includes('api-client.js?v=access-history-1'));
  assert.ok(page.includes('app.js?v=editor-completion-1'));
  assert.ok(page.includes('src="timeline-model.js?v=course-platform-3"'));
  assert.ok(page.includes('src="visual-node-editor.js?v=course-platform-3"'));
  assert.ok(app.includes('captions = [];'));
  assert.ok(app.includes('state.editor.setCaptions(captions)'));
  assert.ok(app.includes('state.nodes = state.editor?.getState().nodes'));
  assert.ok(app.includes("loginPassword.value = ''"));
  assert.ok(app.includes("accessCodeValue.textContent = '尚未创建'"));
  assert.ok(app.includes("courseTitleInput.value = ''"));
  assert.ok(app.includes("lessonTitleInput.value = ''"));
  assert.ok(app.includes("createAccessCodeButton.textContent = '创建授权码'"));
  assert.ok(app.includes('setEditorInteractionLocked(true)'));
  assert.ok(app.includes('setEditorInteractionLocked(false)'));
  assert.ok(app.includes("window.history.replaceState(null, '', '#home')"));
  assert.ok(app.includes('if (!publishInProgress)'));
  assert.ok(app.includes('if (!state.lesson && !confirmCourseUrl())'));
  assert.equal(page.includes('开发测试账号'), false);
  assert.equal(page.includes('本地 API'), false);
  assert.equal(fs.readFileSync('teacher-web/visual-node-editor.js', 'utf8').includes('本地 API'), false);
});

test('teacher editor uses real course-workflow language instead of prototype explanations', () => {
  const page = fs.readFileSync('teacher-web/editor.html', 'utf8');

  for (const marker of [
    'id="home-title">我的课程',
    'id="course-workspace"',
    'id="course-materials"',
    'id="continue-course"',
    'id="timeline-lesson-title"',
    'id="save-timeline"',
    'id="publish-course"',
    'id="access-code-panel"'
  ]) {
    assert.ok(page.includes(marker), `missing ${marker}`);
  }

  for (const forbidden of [
    '课堂设计原型',
    '功能原型',
    'W0 当前范围',
    '当前 W0',
    '后续这些过程会沉淀为学习证据',
    'overview-video',
    '正在连接本地 API'
  ]) {
    assert.equal(page.includes(forbidden), false, `found obsolete copy: ${forbidden}`);
  }
});
