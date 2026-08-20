/** Download, validate and atomically merge v2 course packages. */
(function initCourseDownloader(global, factory) {
  const api = factory();
  global.LessonPilotCourseDownloader = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis, function createCourseDownloaderModule() {
  const ACCESS_CODE_PATTERN = /^KM-[A-Z2-7]{5}(?:-[A-Z2-7]{5}){3}$/;
  const MAX_RESPONSE_BYTES = 1024 * 1024;
  const MAX_STUDENT_ANSWER_LENGTH = 2000;

  function sanitizeNodeState(state) {
    if (!state || typeof state !== 'object' || Array.isArray(state)
      || !['completed', 'retry'].includes(state.status)
      || !Number.isSafeInteger(state.attempts) || state.attempts < 1) {
      return null;
    }
    const clean = { status: state.status, attempts: state.attempts };
    if (Object.hasOwn(state, 'lastAnswer')) {
      if (state.lastAnswer !== null
        && (typeof state.lastAnswer !== 'string'
          || state.lastAnswer.length > MAX_STUDENT_ANSWER_LENGTH)) {
        return null;
      }
      clean.lastAnswer = state.lastAnswer;
    }
    return clean;
  }

  function initialLessonLearningState(coursePackage, lesson) {
    return {
      schemaVersion: 1,
      courseId: coursePackage.courseId,
      lessonId: lesson.lessonId,
      courseUpdatedAt: coursePackage.updatedAt,
      lessonUpdatedAt: lesson.updatedAt,
      nodeStates: {}
    };
  }

  function migrateLessonLearningState(previous, coursePackage, lesson) {
    const next = initialLessonLearningState(coursePackage, lesson);
    if (!previous
      || previous.courseId !== coursePackage.courseId
      || previous.lessonId !== lesson.lessonId) {
      return next;
    }
    const validNodeIds = new Set(lesson.nodes.map((node) => node.id));
    for (const [nodeId, state] of Object.entries(previous.nodeStates ?? {})) {
      const clean = sanitizeNodeState(state);
      if (validNodeIds.has(nodeId) && clean) next.nodeStates[nodeId] = clean;
    }
    return next;
  }

  function migratePackageLearningStates(previous, coursePackage) {
    const states = {};
    for (const lesson of coursePackage.lessons) {
      states[lesson.lessonId] = migrateLessonLearningState(
        previous?.[lesson.lessonId],
        coursePackage,
        lesson
      );
    }
    return states;
  }

  async function readJson(response) {
    if (typeof response.text !== 'function') return response.json();
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
      throw new Error('response too large');
    }
    return JSON.parse(text);
  }

  function publicError(response, body) {
    const code = body?.error?.code;
    if (response.status === 401 && code === 'INVALID_ACCESS_CODE') return code;
    if (response.status === 404 && code === 'COURSE_NOT_AVAILABLE') return code;
    return 'SERVICE_UNAVAILABLE';
  }

  function createCourseDownloader({
    fetchImpl,
    storage,
    packageContract,
    exampleCoursePackage,
    endpoint,
    now
  }) {
    let courseStoreQueue = Promise.resolve();

    function withCourseStoreLock(operation) {
      const pending = courseStoreQueue.then(operation, operation);
      courseStoreQueue = pending.catch(() => {});
      return pending;
    }

    function installedPackage(coursePackage, source) {
      return {
        schemaVersion: 2,
        courseId: coursePackage.courseId,
        title: coursePackage.title,
        installedAt: source === 'example' ? coursePackage.updatedAt : now(),
        source,
        readOnly: source === 'example',
        course: structuredClone(coursePackage)
      };
    }

    function validInstalledPackage(record) {
      return Boolean(
        record
        && record.schemaVersion === 2
        && record.courseId === record.course?.courseId
        && packageContract.validateCoursePackage(record.course).ok
      );
    }

    function validStore(store) {
      return store
        && store.storageVersion === 2
        && store.installedCourses
        && typeof store.installedCourses === 'object'
        && !Array.isArray(store.installedCourses)
        && store.learningStates
        && typeof store.learningStates === 'object'
        && !Array.isArray(store.learningStates);
    }

    async function ensureExampleCourse() {
      const store = await storage.readStudentCourseStore();
      if (!validStore(store)) throw new Error('invalid student course store');
      if (!packageContract.validateCoursePackage(exampleCoursePackage).ok) {
        throw new Error('invalid bundled example course');
      }
      if (Object.hasOwn(store.installedCourses, exampleCoursePackage.courseId)) return store;
      return storage.ensureStudentCourse(
        exampleCoursePackage.courseId,
        installedPackage(exampleCoursePackage, 'example'),
        migratePackageLearningStates(null, exampleCoursePackage)
      );
    }

    async function installCoursePackages(coursePackages) {
      if (!Array.isArray(coursePackages) || coursePackages.length === 0) {
        return { ok: false, error: 'INVALID_RESPONSE' };
      }
      const seen = new Set();
      for (const coursePackage of coursePackages) {
        if (!packageContract.validateCoursePackage(coursePackage).ok
          || seen.has(coursePackage.courseId)) {
          return { ok: false, error: 'INVALID_COURSE' };
        }
        seen.add(coursePackage.courseId);
      }

      const store = await ensureExampleCourse();
      const next = structuredClone(store);
      let added = false;
      let changed = false;
      for (const coursePackage of coursePackages) {
        const current = next.installedCourses[coursePackage.courseId];
        const migratedStates = migratePackageLearningStates(
          next.learningStates[coursePackage.courseId],
          coursePackage
        );
        const courseChanged = JSON.stringify(current?.course ?? null)
          !== JSON.stringify(coursePackage);
        const stateChanged = JSON.stringify(next.learningStates[coursePackage.courseId] ?? null)
          !== JSON.stringify(migratedStates);
        if (!current) added = true;
        if (courseChanged) {
          next.installedCourses[coursePackage.courseId] = installedPackage(
            coursePackage,
            'authorization'
          );
        }
        next.learningStates[coursePackage.courseId] = migratedStates;
        changed = changed || courseChanged || stateChanged;
      }
      if (changed) await storage.writeStudentCourseStore(next);
      return {
        ok: true,
        status: changed ? (added ? 'installed' : 'updated') : 'current',
        courses: structuredClone(coursePackages),
        installedCourses: Object.values(next.installedCourses),
        learningStates: structuredClone(next.learningStates)
      };
    }

    async function download(payload) {
      const authorizationCode = typeof payload?.authorizationCode === 'string'
        ? payload.authorizationCode.trim().toUpperCase()
        : '';
      if (!ACCESS_CODE_PATTERN.test(authorizationCode)) {
        return { ok: false, error: 'INVALID_ACCESS_CODE' };
      }

      let response;
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'omit',
          cache: 'no-store',
          body: JSON.stringify({ access_code: authorizationCode })
        });
      } catch {
        return { ok: false, error: 'NETWORK_FAILURE' };
      }

      let body;
      try {
        body = await readJson(response);
      } catch {
        return { ok: false, error: response.ok ? 'INVALID_RESPONSE' : 'SERVICE_UNAVAILABLE' };
      }
      if (!response.ok) return { ok: false, error: publicError(response, body) };
      if (!body || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'courses')) {
        return { ok: false, error: 'INVALID_RESPONSE' };
      }

      try {
        return await withCourseStoreLock(() => installCoursePackages(body.courses));
      } catch {
        return { ok: false, error: 'STORAGE_FAILURE' };
      }
    }

    async function getInstalledCourses() {
      return withCourseStoreLock(async () => {
        try {
          const store = await ensureExampleCourse();
          const installedCourses = Object.values(store.installedCourses);
          if (!installedCourses.every(validInstalledPackage)) {
            return { ok: false, error: 'INVALID_COURSE' };
          }
          return {
            ok: true,
            installedCourses: structuredClone(installedCourses),
            learningStates: structuredClone(store.learningStates)
          };
        } catch {
          return { ok: false, error: 'STORAGE_FAILURE' };
        }
      });
    }

    async function recordNodeAttempt(payload) {
      return withCourseStoreLock(async () => {
        try {
          const store = await ensureExampleCourse();
          const installedCourse = store.installedCourses[payload?.courseId];
          if (!validInstalledPackage(installedCourse)) {
            return { ok: false, error: 'INVALID_COURSE' };
          }
          const coursePackage = installedCourse.course;
          const lesson = coursePackage.lessons.find((item) => item.lessonId === payload.lessonId);
          const node = lesson?.nodes.find((item) => item.id === payload.nodeId);
          const answer = payload.answer ?? null;
          if (!node || typeof payload.correct !== 'boolean'
            || (answer !== null && typeof answer !== 'string')
            || (typeof answer === 'string' && answer.length > MAX_STUDENT_ANSWER_LENGTH)) {
            return { ok: false, error: 'INVALID_REQUEST' };
          }
          const learningState = migrateLessonLearningState(
            store.learningStates[payload.courseId]?.[payload.lessonId],
            coursePackage,
            lesson
          );
          const prior = learningState.nodeStates[node.id];
          learningState.nodeStates[node.id] = {
            status: payload.correct ? 'completed' : 'retry',
            attempts: (prior?.attempts ?? 0) + 1,
            lastAnswer: answer
          };
          const next = structuredClone(store);
          next.learningStates[payload.courseId][payload.lessonId] = learningState;
          await storage.writeStudentCourseStore(next);
          return { ok: true, nodeId: node.id, status: learningState.nodeStates[node.id].status };
        } catch {
          return { ok: false, error: 'STORAGE_FAILURE' };
        }
      });
    }

    return { download, getInstalledCourses, recordNodeAttempt };
  }

  return {
    ACCESS_CODE_PATTERN,
    MAX_RESPONSE_BYTES,
    MAX_STUDENT_ANSWER_LENGTH,
    sanitizeNodeState,
    initialLessonLearningState,
    migrateLessonLearningState,
    migratePackageLearningStates,
    createCourseDownloader
  };
});
