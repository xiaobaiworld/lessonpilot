/**
 * A thin adapter over chrome.storage.local for the two stage 1A keys.
 *
 * The adapter exists so the operation handlers can be tested in Node without real
 * Chrome (A-NFR-01). It deliberately does almost nothing beyond naming the keys and
 * turning API failures into a single recognisable outcome: every caller has to
 * distinguish "there is no course" from "the read failed", and that decision is
 * easier to get right when the failure has one shape.
 */
(function initBackgroundStorage(global, factory) {
  const api = factory();
  global.LessonPilotBackgroundStorage = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundStorageModule() {
  const CURRENT_COURSE_KEY = 'currentCourse';
  const ACTIVE_PREVIEW_SESSION_KEY = 'activePreviewSession';
  const INSTALLED_COURSE_KEY = 'installedCourse';
  const LEARNING_STATE_KEY = 'learningState';

  /** Marks a chrome.storage failure so handlers can map it to STORAGE_FAILURE. */
  class StorageFailure extends Error {
    constructor(operation) {
      // The message names the operation only. The underlying error text can contain
      // internal paths, and this value must never reach a teacher-facing status
      // (A-ERR-01), so the original is dropped here rather than filtered later.
      super(`storage ${operation} failed`);
      this.name = 'StorageFailure';
      this.operation = operation;
    }
  }

  function createStorage(area) {
    async function readKey(key) {
      let result;
      try {
        result = await area.get([key]);
      } catch {
        throw new StorageFailure('get');
      }
      // Absent and explicitly-undefined both mean "nothing stored".
      return result && Object.hasOwn(result, key) ? result[key] ?? null : null;
    }

    async function writeKey(key, value) {
      try {
        await area.set({ [key]: value });
      } catch {
        throw new StorageFailure('set');
      }
    }

    async function writeKeys(values) {
      try {
        await area.set(values);
      } catch {
        throw new StorageFailure('set');
      }
    }

    async function removeKeys(keys) {
      try {
        await area.remove(keys);
      } catch {
        throw new StorageFailure('remove');
      }
    }

    return {
      readCurrentCourse: () => readKey(CURRENT_COURSE_KEY),
      writeCurrentCourse: (course) => writeKey(CURRENT_COURSE_KEY, course),
      readPreviewSession: () => readKey(ACTIVE_PREVIEW_SESSION_KEY),
      writePreviewSession: (session) => writeKey(ACTIVE_PREVIEW_SESSION_KEY, session),
      readInstalledCourse: () => readKey(INSTALLED_COURSE_KEY),
      readLearningState: () => readKey(LEARNING_STATE_KEY),
      /** One chrome.storage.local.set call is the student-side commit boundary. */
      writeInstalledCourseAndState: (course, learningState) => writeKeys({
        [INSTALLED_COURSE_KEY]: course,
        [LEARNING_STATE_KEY]: learningState
      }),
      /** Clearing a course always clears its session: a session without a course
       *  would reference something that is no longer there (A-STORAGE-02). */
      removeCourseAndSession: () => removeKeys([CURRENT_COURSE_KEY, ACTIVE_PREVIEW_SESSION_KEY])
    };
  }

  return {
    createStorage,
    StorageFailure,
    CURRENT_COURSE_KEY,
    ACTIVE_PREVIEW_SESSION_KEY,
    INSTALLED_COURSE_KEY,
    LEARNING_STATE_KEY
  };
});
