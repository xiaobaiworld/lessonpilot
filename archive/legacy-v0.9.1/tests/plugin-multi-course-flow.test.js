const test = require('node:test');
const assert = require('node:assert/strict');

const packageContract = require('../src/shared/course-package-contract.js');
const {
  EXAMPLE_COURSE_ID,
  EXAMPLE_COURSE_PACKAGE
} = require('../src/content/config/example-course.js');
const { createStorage } = require('../src/background/storage.js');
const { createCourseDownloader } = require('../src/background/course-downloader.js');

const NOW = '2026-08-20T12:00:00.000Z';

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

function authorizedCourse({
  courseId = '4c93245a-c981-4cab-b8fb-ff8f49cc9ee8',
  lessonId = '0eb6fdbf-0ba6-4a1c-9fc4-96fe637129a2',
  title = '第二门授权课程',
  videoId = 'BV1xx411c7mD'
} = {}) {
  return {
    schemaVersion: 2,
    courseId,
    title,
    lessons: [{
      lessonId,
      title: '授权课第一节',
      videoRef: { platform: 'bilibili', videoId },
      nodes: [{
        id: 'authorized-node',
        enabled: true,
        family: 'attention',
        interaction: 'notice',
        trigger: { kind: 'time_cross', timeSeconds: 8, captionId: null },
        display: { title: '授权课程节点', body: '正文' },
        evaluation: null,
        effects: { pause: true }
      }],
      updatedAt: NOW
    }],
    updatedAt: NOW
  };
}

function setup(responseBody) {
  const chromeStorage = fakeChromeStorage();
  const storage = createStorage(chromeStorage.local);
  const downloader = createCourseDownloader({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() { return responseBody; }
    }),
    storage,
    packageContract,
    exampleCoursePackage: EXAMPLE_COURSE_PACKAGE,
    endpoint: 'http://127.0.0.1:8000/api/v1/public/course-download',
    now: () => NOW
  });
  return { chromeStorage, downloader };
}

test('first course-library read stores the bundled example exactly once', async () => {
  const { chromeStorage, downloader } = setup({ courses: [authorizedCourse()] });

  const first = await downloader.getInstalledCourses();
  const second = await downloader.getInstalledCourses();

  assert.equal(first.ok, true);
  assert.equal(first.installedCourses.length, 1);
  assert.equal(first.installedCourses[0].courseId, EXAMPLE_COURSE_ID);
  assert.equal(first.installedCourses[0].course.title, EXAMPLE_COURSE_PACKAGE.title);
  assert.equal(first.installedCourses[0].source, 'example');
  assert.equal(first.installedCourses[0].readOnly, true);
  assert.deepEqual(second, first);
  assert.equal(chromeStorage.writes(), 1);
});

test('authorized courses are added beside the example instead of replacing it', async () => {
  const incoming = authorizedCourse();
  const { downloader } = setup({ courses: [incoming] });
  await downloader.getInstalledCourses();

  const downloaded = await downloader.download({
    authorizationCode: 'KM-ABCDE-FGHIJ-KLMNO-PQRST'
  });
  const library = await downloader.getInstalledCourses();

  assert.equal(downloaded.ok, true);
  assert.equal(downloaded.status, 'installed');
  assert.deepEqual(
    library.installedCourses.map((item) => [item.courseId, item.course.title]),
    [
      [EXAMPLE_COURSE_ID, EXAMPLE_COURSE_PACKAGE.title],
      [incoming.courseId, incoming.title]
    ]
  );
});

test('node attempts are isolated by course id and lesson id', async () => {
  const incoming = authorizedCourse();
  const { downloader } = setup({ courses: [incoming] });
  await downloader.download({ authorizationCode: 'KM-ABCDE-FGHIJ-KLMNO-PQRST' });

  const saved = await downloader.recordNodeAttempt({
    courseId: incoming.courseId,
    lessonId: incoming.lessons[0].lessonId,
    nodeId: 'authorized-node',
    correct: true,
    answer: 'student answer'
  });
  const library = await downloader.getInstalledCourses();

  assert.equal(saved.ok, true);
  assert.deepEqual(
    library.learningStates[incoming.courseId][incoming.lessons[0].lessonId].nodeStates,
    {
      'authorized-node': {
        status: 'completed',
        attempts: 1,
        lastAnswer: 'student answer'
      }
    }
  );
  assert.deepEqual(
    library.learningStates[EXAMPLE_COURSE_ID][EXAMPLE_COURSE_PACKAGE.lessons[0].lessonId].nodeStates,
    {}
  );
});

test('concurrent downloads are serialized so neither course is lost', async () => {
  const first = authorizedCourse();
  const second = authorizedCourse({
    courseId: '61e94964-e72b-47b8-b8bf-7b9369d2f886',
    lessonId: '6bedbccc-e6d7-4db1-896d-01f1b86647ac',
    title: '第三门授权课程',
    videoId: 'BV1mK4y1C7Bz'
  });
  const chromeStorage = fakeChromeStorage();
  const baseStorage = createStorage(chromeStorage.local);
  let activeReads = 0;
  let maxActiveReads = 0;
  const storage = {
    ...baseStorage,
    async readStudentCourseStore() {
      activeReads += 1;
      maxActiveReads = Math.max(maxActiveReads, activeReads);
      await new Promise((resolve) => setTimeout(resolve, 5));
      try {
        return await baseStorage.readStudentCourseStore();
      } finally {
        activeReads -= 1;
      }
    }
  };
  const downloader = createCourseDownloader({
    fetchImpl: async (_url, options) => {
      const code = JSON.parse(options.body).access_code;
      await new Promise((resolve) => setTimeout(resolve, code.includes('ABCDE') ? 5 : 0));
      return {
        ok: true,
        status: 200,
        async json() {
          return { courses: [code.includes('ABCDE') ? first : second] };
        }
      };
    },
    storage,
    packageContract,
    exampleCoursePackage: EXAMPLE_COURSE_PACKAGE,
    endpoint: 'http://127.0.0.1:8000/api/v1/public/course-download',
    now: () => NOW
  });

  await Promise.all([
    downloader.download({ authorizationCode: 'KM-ABCDE-FGHIJ-KLMNO-PQRST' }),
    downloader.download({ authorizationCode: 'KM-ZYXWV-TSRQP-NMLKJ-HGFED' })
  ]);
  const library = await downloader.getInstalledCourses();

  assert.deepEqual(
    new Set(library.installedCourses.map((item) => item.courseId)),
    new Set([EXAMPLE_COURSE_ID, first.courseId, second.courseId])
  );
  assert.equal(maxActiveReads, 1);
});
