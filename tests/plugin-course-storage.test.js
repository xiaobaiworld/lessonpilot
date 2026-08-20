const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createStorage,
  StorageFailure,
  STUDENT_COURSE_STORE_KEY
} = require('../src/background/storage.js');

function fakeChromeStorage(initial = {}) {
  let backing = structuredClone(initial);
  const state = { failGet: false, failSet: false, setPayloads: [] };
  return {
    state,
    peek: () => structuredClone(backing),
    local: {
      async get(keys) {
        if (state.failGet) throw new Error('get failed');
        const result = {};
        for (const key of keys) {
          if (Object.hasOwn(backing, key)) result[key] = structuredClone(backing[key]);
        }
        return result;
      },
      async set(values) {
        if (state.failSet) throw new Error('set failed');
        state.setPayloads.push(structuredClone(values));
        Object.assign(backing, structuredClone(values));
      },
      async remove(keys) {
        for (const key of keys) delete backing[key];
      }
    }
  };
}

function installedCourse(courseId, title) {
  return { courseId, title, installedAt: '2026-08-20T00:00:00.000Z' };
}

test('an empty browser starts with one empty v2 student course store shape', async () => {
  const chromeStorage = fakeChromeStorage();
  const storage = createStorage(chromeStorage.local);

  assert.deepEqual(await storage.readStudentCourseStore(), {
    storageVersion: 2,
    installedCourses: {},
    learningStates: {}
  });
  assert.deepEqual(chromeStorage.state.setPayloads, []);
});

test('student course writes use one canonical atomic storage key', async () => {
  const chromeStorage = fakeChromeStorage();
  const storage = createStorage(chromeStorage.local);
  const store = {
    storageVersion: 2,
    installedCourses: { a: installedCourse('a', 'A') },
    learningStates: { a: {} }
  };

  await storage.writeStudentCourseStore(store);

  assert.deepEqual(chromeStorage.state.setPayloads, [{ [STUDENT_COURSE_STORE_KEY]: store }]);
  assert.deepEqual(Object.keys(chromeStorage.peek()), [STUDENT_COURSE_STORE_KEY]);
});

test('merging courses retains every course id and its independent learning states', async () => {
  const chromeStorage = fakeChromeStorage();
  const storage = createStorage(chromeStorage.local);

  await storage.mergeStudentCourse('a', installedCourse('a', 'A'), { lessonA: {} });
  const result = await storage.mergeStudentCourse(
    'b',
    installedCourse('b', 'B'),
    { lessonB: {} }
  );

  assert.deepEqual(Object.keys(result.installedCourses), ['a', 'b']);
  assert.deepEqual(result.learningStates, { a: { lessonA: {} }, b: { lessonB: {} } });
});

test('ensuring a bundled course never overwrites an existing course with the same UUID', async () => {
  const chromeStorage = fakeChromeStorage();
  const storage = createStorage(chromeStorage.local);
  const original = installedCourse('a', 'Original');
  await storage.mergeStudentCourse('a', original, { lessonA: { nodeStates: {} } });

  const result = await storage.ensureStudentCourse(
    'a',
    installedCourse('a', 'Replacement'),
    {}
  );

  assert.deepEqual(result.installedCourses.a, original);
  assert.equal(chromeStorage.state.setPayloads.length, 1);
});

test('student course storage failures use a stable public error type', async () => {
  const chromeStorage = fakeChromeStorage();
  const storage = createStorage(chromeStorage.local);
  chromeStorage.state.failGet = true;
  await assert.rejects(
    storage.readStudentCourseStore(),
    (error) => error instanceof StorageFailure && error.operation === 'get'
  );

  chromeStorage.state.failGet = false;
  chromeStorage.state.failSet = true;
  await assert.rejects(
    storage.writeStudentCourseStore({
      storageVersion: 2,
      installedCourses: {},
      learningStates: {}
    }),
    (error) => error instanceof StorageFailure && error.operation === 'set'
  );
});
