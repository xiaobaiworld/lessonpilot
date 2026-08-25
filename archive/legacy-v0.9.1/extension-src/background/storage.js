/**
 * Chrome local-storage adapter for teacher preview state and the v2 student
 * course library. The student side has one canonical key and no legacy path.
 */
(function initBackgroundStorage(global, factory) {
  const api = factory();
  global.LessonPilotBackgroundStorage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundStorageModule() {
  const CURRENT_COURSE_KEY = 'currentCourse';
  const ACTIVE_PREVIEW_SESSION_KEY = 'activePreviewSession';
  const STUDENT_COURSE_STORE_KEY = 'studentCourseStore';
  const STUDENT_COURSE_STORAGE_VERSION = 2;

  class StorageFailure extends Error {
    constructor(operation) {
      super(`storage ${operation} failed`);
      this.name = 'StorageFailure';
      this.operation = operation;
    }
  }

  function createStorage(area) {
    function emptyStudentCourseStore() {
      return {
        storageVersion: STUDENT_COURSE_STORAGE_VERSION,
        installedCourses: {},
        learningStates: {}
      };
    }

    async function readKey(key) {
      try {
        const result = await area.get([key]);
        return result && Object.hasOwn(result, key) ? result[key] ?? null : null;
      } catch {
        throw new StorageFailure('get');
      }
    }

    async function writeKey(key, value) {
      try {
        await area.set({ [key]: value });
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

    async function readStudentCourseStore() {
      const stored = await readKey(STUDENT_COURSE_STORE_KEY);
      return stored ?? emptyStudentCourseStore();
    }

    async function writeStudentCourseStore(store) {
      await writeKey(STUDENT_COURSE_STORE_KEY, store);
    }

    async function mergeStudentCourse(courseId, installedCourse, learningStates) {
      const store = await readStudentCourseStore();
      const merged = {
        ...store,
        installedCourses: {
          ...store.installedCourses,
          [courseId]: installedCourse
        },
        learningStates: {
          ...store.learningStates,
          [courseId]: learningStates
        }
      };
      await writeStudentCourseStore(merged);
      return merged;
    }

    async function ensureStudentCourse(courseId, installedCourse, learningStates) {
      const store = await readStudentCourseStore();
      if (Object.hasOwn(store.installedCourses, courseId)) return store;
      return mergeStudentCourse(courseId, installedCourse, learningStates);
    }

    return {
      readCurrentCourse: () => readKey(CURRENT_COURSE_KEY),
      writeCurrentCourse: (course) => writeKey(CURRENT_COURSE_KEY, course),
      readPreviewSession: () => readKey(ACTIVE_PREVIEW_SESSION_KEY),
      writePreviewSession: (session) => writeKey(ACTIVE_PREVIEW_SESSION_KEY, session),
      readStudentCourseStore,
      writeStudentCourseStore,
      mergeStudentCourse,
      ensureStudentCourse,
      removeCourseAndSession: () => removeKeys([CURRENT_COURSE_KEY, ACTIVE_PREVIEW_SESSION_KEY])
    };
  }

  return {
    createStorage,
    StorageFailure,
    CURRENT_COURSE_KEY,
    ACTIVE_PREVIEW_SESSION_KEY,
    STUDENT_COURSE_STORE_KEY,
    STUDENT_COURSE_STORAGE_VERSION
  };
});
