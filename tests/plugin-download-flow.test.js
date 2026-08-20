const test = require('node:test');
const assert = require('node:assert/strict');

const packageContract = require('../src/shared/course-package-contract.js');
const {
  EXAMPLE_COURSE_PACKAGE
} = require('../src/content/config/example-course.js');
const { createStorage } = require('../src/background/storage.js');
const { createCourseDownloader } = require('../src/background/course-downloader.js');

const NOW = '2026-08-20T12:00:00.000Z';

function coursePackage({
  courseId = '4c93245a-c981-4cab-b8fb-ff8f49cc9ee8',
  lessonId = '0eb6fdbf-0ba6-4a1c-9fc4-96fe637129a2',
  title = '授权课程',
  updatedAt = NOW
} = {}) {
  return {
    schemaVersion: 2,
    courseId,
    title,
    lessons: [{
      lessonId,
      title: '第一节',
      videoRef: { platform: 'bilibili', videoId: 'BV1xx411c7mD' },
      nodes: [{
        id: 'node-1',
        enabled: true,
        family: 'attention',
        interaction: 'notice',
        trigger: { kind: 'time_cross', timeSeconds: 10, captionId: null },
        display: { title: '重点', body: '正文' },
        evaluation: null,
        effects: { pause: true }
      }],
      updatedAt
    }],
    updatedAt
  };
}

function fakeChromeStorage() {
  let backing = {};
  let writes = 0;
  return {
    local: {
      async get(keys) {
        const result = {};
        for (const key of keys) {
          if (Object.hasOwn(backing, key)) result[key] = structuredClone(backing[key]);
        }
        return result;
      },
      async set(values) {
        writes += 1;
        Object.assign(backing, structuredClone(values));
      },
      async remove(keys) {
        for (const key of keys) delete backing[key];
      }
    },
    peek: () => structuredClone(backing),
    writes: () => writes
  };
}

function setup(response = null) {
  const calls = [];
  const chromeStorage = fakeChromeStorage();
  const storage = createStorage(chromeStorage.local);
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (response instanceof Error) throw response;
    return response ?? {
      ok: true,
      status: 200,
      async json() { return { courses: [coursePackage()] }; }
    };
  };
  const downloader = createCourseDownloader({
    fetchImpl,
    storage,
    packageContract,
    exampleCoursePackage: EXAMPLE_COURSE_PACKAGE,
    endpoint: 'http://127.0.0.1:8000/api/v1/public/course-download',
    now: () => NOW
  });
  return { calls, chromeStorage, downloader };
}

test('posts only the normalized access code to the fixed endpoint', async () => {
  const { calls, downloader } = setup();
  const result = await downloader.download({
    authorizationCode: '  km-abcde-fghij-klmno-pqrst  '
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    access_code: 'KM-ABCDE-FGHIJ-KLMNO-PQRST'
  });
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.cache, 'no-store');
});

for (const [label, response, expected] of [
  ['network failure', new Error('offline'), 'NETWORK_FAILURE'],
  ['invalid code', {
    ok: false,
    status: 401,
    async json() { return { error: { code: 'INVALID_ACCESS_CODE' } }; }
  }, 'INVALID_ACCESS_CODE'],
  ['missing course', {
    ok: false,
    status: 404,
    async json() { return { error: { code: 'COURSE_NOT_AVAILABLE' } }; }
  }, 'COURSE_NOT_AVAILABLE'],
  ['malformed json', {
    ok: true,
    status: 200,
    async json() { throw new SyntaxError('bad json'); }
  }, 'INVALID_RESPONSE'],
  ['old single-course envelope', {
    ok: true,
    status: 200,
    async json() { return { course: coursePackage() }; }
  }, 'INVALID_RESPONSE'],
  ['invalid v2 course', {
    ok: true,
    status: 200,
    async json() { return { courses: [{ schemaVersion: 1 }] }; }
  }, 'INVALID_COURSE']
]) {
  test(`${label} never overwrites the canonical course library`, async () => {
    const { chromeStorage, downloader } = setup(response);
    const before = await downloader.getInstalledCourses();
    const writesBefore = chromeStorage.writes();

    const result = await downloader.download({
      authorizationCode: 'KM-ABCDE-FGHIJ-KLMNO-PQRST'
    });

    assert.equal(result.ok, false);
    assert.equal(result.error, expected);
    assert.equal(chromeStorage.writes(), writesBefore);
    assert.deepEqual(await downloader.getInstalledCourses(), before);
  });
}

test('same-course update preserves valid matching node progress and drops removed nodes', async () => {
  const original = coursePackage({ updatedAt: '2026-08-19T00:00:00.000Z' });
  const { downloader } = setup({
    ok: true,
    status: 200,
    async json() { return { courses: [original] }; }
  });
  await downloader.download({ authorizationCode: 'KM-ABCDE-FGHIJ-KLMNO-PQRST' });
  await downloader.recordNodeAttempt({
    courseId: original.courseId,
    lessonId: original.lessons[0].lessonId,
    nodeId: 'node-1',
    correct: true,
    answer: 'kept'
  });

  const updated = coursePackage();
  const updateSetup = setup({
    ok: true,
    status: 200,
    async json() { return { courses: [updated] }; }
  });
  const stored = await downloader.getInstalledCourses();
  await updateSetup.chromeStorage.local.set({
    studentCourseStore: {
      storageVersion: 2,
      installedCourses: Object.fromEntries(
        stored.installedCourses.map((item) => [item.courseId, item])
      ),
      learningStates: stored.learningStates
    }
  });

  const result = await updateSetup.downloader.download({
    authorizationCode: 'KM-ABCDE-FGHIJ-KLMNO-PQRST'
  });

  assert.equal(result.status, 'updated');
  assert.deepEqual(
    result.learningStates[updated.courseId][updated.lessons[0].lessonId].nodeStates,
    { 'node-1': { status: 'completed', attempts: 1, lastAnswer: 'kept' } }
  );
});

test('recording an attempt requires course and lesson identity and omits the answer from response', async () => {
  const incoming = coursePackage();
  const { downloader } = setup();
  await downloader.download({ authorizationCode: 'KM-ABCDE-FGHIJ-KLMNO-PQRST' });

  const invalid = await downloader.recordNodeAttempt({
    nodeId: 'node-1',
    correct: true,
    answer: 'answer'
  });
  const saved = await downloader.recordNodeAttempt({
    courseId: incoming.courseId,
    lessonId: incoming.lessons[0].lessonId,
    nodeId: 'node-1',
    correct: true,
    answer: 'answer'
  });

  assert.deepEqual(invalid, { ok: false, error: 'INVALID_COURSE' });
  assert.equal(saved.ok, true);
  assert.equal(JSON.stringify(saved).includes('answer'), false);
});

test('oversized student answers are rejected without a course-store write', async () => {
  const incoming = coursePackage();
  const { chromeStorage, downloader } = setup();
  await downloader.download({ authorizationCode: 'KM-ABCDE-FGHIJ-KLMNO-PQRST' });
  const writesBefore = chromeStorage.writes();

  const result = await downloader.recordNodeAttempt({
    courseId: incoming.courseId,
    lessonId: incoming.lessons[0].lessonId,
    nodeId: 'node-1',
    correct: true,
    answer: 'x'.repeat(2001)
  });

  assert.deepEqual(result, { ok: false, error: 'INVALID_REQUEST' });
  assert.equal(chromeStorage.writes(), writesBefore);
});
