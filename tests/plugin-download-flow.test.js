const test = require('node:test');
const assert = require('node:assert/strict');

const { createCourseDownloader } = require('../src/background/course-downloader.js');
const {
  createStorage,
  INSTALLED_COURSE_KEY,
  LEARNING_STATE_KEY
} = require('../src/background/storage.js');
const contract = require('../src/shared/course-contract.js');

const UPDATED_AT = '2026-08-19T00:00:00.000Z';

function course(videoId = 'BV1WW4y1e7GL', updatedAt = UPDATED_AT) {
  return {
    schemaVersion: 1,
    courseId: `bilibili:${videoId}`,
    videoRef: { platform: 'bilibili', videoId },
    nodes: [{
      id: 'node-1', enabled: true, family: 'attention', interaction: 'notice',
      trigger: { kind: 'time_cross', timeSeconds: 10, captionId: null },
      display: { title: '重点', body: '正文' }, evaluation: null, effects: { pause: true }
    }],
    updatedAt
  };
}

function setup({ response, installedCourse = null, learningState = null } = {}) {
  const calls = [];
  let installed = structuredClone(installedCourse);
  let learning = structuredClone(learningState);
  let writes = 0;
  const storage = {
    async readInstalledCourse() { return structuredClone(installed); },
    async readLearningState() { return structuredClone(learning); },
    async writeInstalledCourseAndState(nextInstalled, nextLearning) {
      writes += 1;
      installed = structuredClone(nextInstalled);
      learning = structuredClone(nextLearning);
    }
  };
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (response instanceof Error) throw response;
    return response ?? {
      ok: true,
      status: 200,
      async json() { return { course: course() }; }
    };
  };
  const downloader = createCourseDownloader({
    fetchImpl,
    storage,
    contract,
    endpoint: 'http://127.0.0.1:8000/api/v1/public/course-download',
    now: () => UPDATED_AT
  });
  return { downloader, calls, peek: () => ({ installed, learning, writes }) };
}

test('posts only the normalized access code to the fixed download endpoint', async () => {
  const { downloader, calls } = setup();
  const result = await downloader.download({ authorizationCode: 'KM-ABCDE-FGHIJ-KLMNO-PQRST' });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://127.0.0.1:8000/api/v1/public/course-download');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    access_code: 'KM-ABCDE-FGHIJ-KLMNO-PQRST'
  });
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.cache, 'no-store');
});

for (const [label, response, expected] of [
  ['network failure', new Error('offline'), 'NETWORK_FAILURE'],
  ['invalid code', { ok: false, status: 401, async json() { return { error: { code: 'INVALID_ACCESS_CODE' } }; } }, 'INVALID_ACCESS_CODE'],
  ['missing course', { ok: false, status: 404, async json() { return { error: { code: 'COURSE_NOT_AVAILABLE' } }; } }, 'COURSE_NOT_AVAILABLE'],
  ['malformed json', { ok: true, status: 200, async json() { throw new SyntaxError('bad json'); } }, 'INVALID_RESPONSE'],
  ['invalid contract', { ok: true, status: 200, async json() { return { course: { schemaVersion: 99 } }; } }, 'INVALID_COURSE']
]) {
  test(`${label} never overwrites the installed course or learning state`, async () => {
    const old = { schemaVersion: 1, courseId: course().courseId, installedAt: UPDATED_AT, course: course() };
    const state = { schemaVersion: 1, courseId: course().courseId, courseUpdatedAt: UPDATED_AT, nodeStates: { 'node-1': { status: 'completed', attempts: 1 } } };
    const { downloader, peek } = setup({ response, installedCourse: old, learningState: state });

    const result = await downloader.download({ authorizationCode: 'KM-ABCDE-FGHIJ-KLMNO-PQRST' });

    assert.equal(result.ok, false);
    assert.equal(result.error, expected);
    assert.deepEqual(peek(), { installed: old, learning: state, writes: 0 });
  });
}

test('an unreadable server error remains service unavailable rather than invalid course data', async () => {
  const response = {
    ok: false,
    status: 500,
    async text() { return '<html>internal server error</html>'; }
  };
  const { downloader, peek } = setup({ response });

  const result = await downloader.download({ authorizationCode: 'KM-ABCDE-FGHIJ-KLMNO-PQRST' });

  assert.deepEqual(result, { ok: false, error: 'SERVICE_UNAVAILABLE' });
  assert.equal(peek().writes, 0);
});

test('same-course update atomically writes the course and preserves matching node state', async () => {
  const oldCourse = course('BV1WW4y1e7GL', '2026-08-18T00:00:00.000Z');
  const old = { schemaVersion: 1, courseId: oldCourse.courseId, installedAt: oldCourse.updatedAt, course: oldCourse };
  const state = {
    schemaVersion: 1,
    courseId: oldCourse.courseId,
    courseUpdatedAt: oldCourse.updatedAt,
    nodeStates: {
      'node-1': { status: 'completed', attempts: 1 },
      removed: { status: 'completed', attempts: 2 }
    }
  };
  const { downloader, peek } = setup({ installedCourse: old, learningState: state });

  const result = await downloader.download({ authorizationCode: 'KM-ABCDE-FGHIJ-KLMNO-PQRST' });

  assert.equal(result.status, 'updated');
  assert.equal(peek().writes, 1);
  assert.deepEqual(peek().learning.nodeStates, { 'node-1': { status: 'completed', attempts: 1 } });
});

test('same-course migration drops unknown or malformed local node-state fields', async () => {
  const oldCourse = course('BV1WW4y1e7GL', '2026-08-18T00:00:00.000Z');
  const old = { schemaVersion: 1, courseId: oldCourse.courseId, installedAt: oldCourse.updatedAt, course: oldCourse };
  const state = {
    schemaVersion: 1,
    courseId: oldCourse.courseId,
    courseUpdatedAt: oldCourse.updatedAt,
    nodeStates: {
      'node-1': {
        status: 'completed',
        attempts: 2,
        lastAnswer: 'kept locally',
        injected: 'must not survive'
      }
    }
  };
  const { downloader, peek } = setup({ installedCourse: old, learningState: state });

  const result = await downloader.download({ authorizationCode: 'KM-ABCDE-FGHIJ-KLMNO-PQRST' });

  assert.equal(result.status, 'updated');
  assert.deepEqual(peek().learning.nodeStates['node-1'], {
    status: 'completed',
    attempts: 2,
    lastAnswer: 'kept locally'
  });
});

test('different course requires confirmation and cancellation performs no write', async () => {
  const oldCourse = course('BVold123');
  const old = { schemaVersion: 1, courseId: oldCourse.courseId, installedAt: UPDATED_AT, course: oldCourse };
  const state = { schemaVersion: 1, courseId: oldCourse.courseId, courseUpdatedAt: UPDATED_AT, nodeStates: {} };
  const incoming = course('BVnew123');
  const response = { ok: true, status: 200, async json() { return { course: incoming }; } };
  const { downloader, peek } = setup({ response, installedCourse: old, learningState: state });

  const result = await downloader.download({ authorizationCode: 'KM-ABCDE-FGHIJ-KLMNO-PQRST' });

  assert.equal(result.error, 'COURSE_REPLACEMENT_REQUIRED');
  assert.deepEqual(peek(), { installed: old, learning: state, writes: 0 });
});

test('confirmed different course resets state only when expected current course still matches', async () => {
  const oldCourse = course('BVold123');
  const old = { schemaVersion: 1, courseId: oldCourse.courseId, installedAt: UPDATED_AT, course: oldCourse };
  const state = { schemaVersion: 1, courseId: oldCourse.courseId, courseUpdatedAt: UPDATED_AT, nodeStates: { old: { status: 'completed', attempts: 1 } } };
  const incoming = course('BVnew123');
  const response = { ok: true, status: 200, async json() { return { course: incoming }; } };
  const { downloader, peek } = setup({ response, installedCourse: old, learningState: state });

  const result = await downloader.download({
    authorizationCode: 'KM-ABCDE-FGHIJ-KLMNO-PQRST',
    replaceCourse: true,
    expectedCourseId: oldCourse.courseId
  });

  assert.equal(result.status, 'replaced');
  assert.equal(peek().installed.courseId, incoming.courseId);
  assert.deepEqual(peek().learning.nodeStates, {});
  assert.equal(peek().writes, 1);
});

test('recording an interaction stores the bounded local answer but omits it from the response', async () => {
  const installedCourse = {
    schemaVersion: 1,
    courseId: course().courseId,
    installedAt: UPDATED_AT,
    course: course()
  };
  const { downloader, peek } = setup({ installedCourse });

  const result = await downloader.recordNodeAttempt({
    nodeId: 'node-1',
    correct: true,
    answer: 'student answer'
  });

  assert.equal(result.ok, true);
  assert.deepEqual(peek().learning.nodeStates, {
    'node-1': { status: 'completed', attempts: 1, lastAnswer: 'student answer' }
  });
  assert.equal(JSON.stringify(result).includes('student answer'), false);
});

test('an oversized student answer is rejected before local state is written', async () => {
  const installedCourse = {
    schemaVersion: 1,
    courseId: course().courseId,
    installedAt: UPDATED_AT,
    course: course()
  };
  const { downloader, peek } = setup({ installedCourse });

  const result = await downloader.recordNodeAttempt({
    nodeId: 'node-1',
    correct: true,
    answer: 'x'.repeat(2001)
  });

  assert.deepEqual(result, { ok: false, error: 'INVALID_REQUEST' });
  assert.equal(peek().writes, 0);
});

test('installed course lookup returns sanitized learning state for runtime resume', async () => {
  const installedCourse = {
    schemaVersion: 1,
    courseId: course().courseId,
    installedAt: UPDATED_AT,
    course: course()
  };
  const learningState = {
    schemaVersion: 1,
    courseId: course().courseId,
    courseUpdatedAt: UPDATED_AT,
    nodeStates: {
      'node-1': { status: 'completed', attempts: 1, lastAnswer: null, extra: true }
    }
  };
  const { downloader } = setup({ installedCourse, learningState });

  const result = await downloader.getInstalledCourse();

  assert.equal(result.ok, true);
  assert.deepEqual(result.learningState.nodeStates, {
    'node-1': { status: 'completed', attempts: 1, lastAnswer: null }
  });
});

test('student course and learning state share one chrome.storage.local set boundary', async () => {
  const writes = [];
  const storage = createStorage({
    async get() { return {}; },
    async set(values) { writes.push(structuredClone(values)); },
    async remove() {}
  });
  const installedCourse = { courseId: course().courseId, course: course() };
  const learningState = { schemaVersion: 1, courseId: course().courseId, nodeStates: {} };

  await storage.writeInstalledCourseAndState(installedCourse, learningState);

  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0], {
    [INSTALLED_COURSE_KEY]: installedCourse,
    [LEARNING_STATE_KEY]: learningState
  });
});
