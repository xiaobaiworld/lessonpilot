const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const api = require('../teacher-web/api-client.js');

test('teacher editor uses the authoritative 08:33 course duration', () => {
  const page = fs.readFileSync('teacher-web/editor.html', 'utf8');
  const app = fs.readFileSync('teacher-web/app.js', 'utf8');

  assert.ok(page.includes('id="timeline-duration-label">08:33'));
  assert.ok(app.includes('const fixedVideoDurationSeconds = 513'));
  assert.ok(app.includes('minimumDurationSeconds: fixedVideoDurationSeconds'));
  assert.equal(app.includes('minimumDurationSeconds: 222'), false);
});

test('teacher editor exposes persistent bottom-right completion actions', () => {
  const page = fs.readFileSync('teacher-web/editor.html', 'utf8');
  const app = fs.readFileSync('teacher-web/app.js', 'utf8');
  const styles = fs.readFileSync('teacher-web/styles.css', 'utf8');

  for (const marker of [
    'id="editor-quick-actions"',
    'id="quick-open-video"',
    'id="quick-publish-course"',
    'id="complete-editor"'
  ]) {
    assert.ok(page.includes(marker), `missing ${marker}`);
  }
  assert.ok(app.includes("await saveDraft(true);\n      setRoute('home');"));
  assert.ok(styles.includes('.editor-quick-actions {'));
  assert.ok(styles.includes('position: fixed;'));
});

test('access-code UI includes typed creation, counts and filterable history', () => {
  const page = fs.readFileSync('teacher-web/editor.html', 'utf8');
  const app = fs.readFileSync('teacher-web/app.js', 'utf8');

  for (const marker of [
    'id="access-code-type"',
    'value="short_term"',
    'value="long_term"',
    'id="access-code-total"',
    'data-code-filter="short_term"',
    'data-code-filter="long_term"',
    'id="access-code-list"'
  ]) {
    assert.ok(page.includes(marker), `missing ${marker}`);
  }
  assert.ok(app.includes('await api.listAccessCodes(state.course.id)'));
  assert.ok(app.includes('item.code_hint'));
  assert.equal(app.includes('item.access_code'), false);
});

test('teacher API client creates a typed code and lists course code records', async () => {
  const requests = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ items: [] }) };
  };

  try {
    await api.createAccessCode('course-1', 'short_term');
    await api.listAccessCodes('course-1');
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(requests[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(requests[0].options.body), { code_type: 'short_term' });
  assert.equal(
    requests[1].url,
    'http://127.0.0.1:8000/api/v1/teacher/courses/course-1/access-codes'
  );
  assert.equal(requests[1].options.method, undefined);
});
