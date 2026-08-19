/** Download, validate and atomically install one student course. */
(function initCourseDownloader(global, factory) {
  const api = factory(global);
  global.LessonPilotCourseDownloader = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis, function createCourseDownloaderModule(global) {
  const ACCESS_CODE_PATTERN = /^KM-[A-Z2-7]{5}(?:-[A-Z2-7]{5}){3}$/;
  const MAX_RESPONSE_BYTES = 1024 * 1024;
  const MAX_STUDENT_ANSWER_LENGTH = 2000;

  function initialLearningState(course) {
    return {
      schemaVersion: 1,
      courseId: course.courseId,
      courseUpdatedAt: course.updatedAt,
      nodeStates: {}
    };
  }

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

  function migrateLearningState(previous, course) {
    if (!previous || previous.courseId !== course.courseId) return initialLearningState(course);
    const validIds = new Set(course.nodes.map((node) => node.id));
    const nodeStates = {};
    for (const [nodeId, state] of Object.entries(previous.nodeStates ?? {})) {
      const clean = sanitizeNodeState(state);
      if (validIds.has(nodeId) && clean) nodeStates[nodeId] = clean;
    }
    return {
      schemaVersion: 1,
      courseId: course.courseId,
      courseUpdatedAt: course.updatedAt,
      nodeStates
    };
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

  function createCourseDownloader({ fetchImpl, storage, contract, endpoint, now }) {
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
      if (!body || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'course')) {
        return { ok: false, error: 'INVALID_RESPONSE' };
      }

      const incoming = body.course;
      if (!contract.validateCourse(incoming).ok) return { ok: false, error: 'INVALID_COURSE' };

      try {
        const current = await storage.readInstalledCourse();
        const previousState = await storage.readLearningState();
        if (current && current.courseId !== incoming.courseId) {
          if (!payload.replaceCourse || payload.expectedCourseId !== current.courseId) {
            return {
              ok: false,
              error: 'COURSE_REPLACEMENT_REQUIRED',
              currentCourseId: current.courseId,
              incomingCourseId: incoming.courseId
            };
          }
        }

        if (current && current.courseId === incoming.courseId
          && current.course?.updatedAt === incoming.updatedAt) {
          return {
            ok: true,
            status: 'current',
            course: structuredClone(incoming),
            learningState: migrateLearningState(previousState, incoming)
          };
        }

        const installedCourse = {
          schemaVersion: 1,
          courseId: incoming.courseId,
          installedAt: now(),
          course: structuredClone(incoming)
        };
        const learningState = current?.courseId === incoming.courseId
          ? migrateLearningState(previousState, incoming)
          : initialLearningState(incoming);
        await storage.writeInstalledCourseAndState(installedCourse, learningState);
        return {
          ok: true,
          status: current ? (current.courseId === incoming.courseId ? 'updated' : 'replaced') : 'installed',
          course: structuredClone(incoming),
          learningState: structuredClone(learningState)
        };
      } catch {
        return { ok: false, error: 'STORAGE_FAILURE' };
      }
    }

    async function getInstalledCourse() {
      try {
        const installedCourse = await storage.readInstalledCourse();
        if (installedCourse === null) return { ok: true, installedCourse: null };
        if (!installedCourse.course || !contract.validateCourse(installedCourse.course).ok
          || installedCourse.courseId !== installedCourse.course.courseId) {
          return { ok: false, error: 'INVALID_COURSE' };
        }
        const previousState = await storage.readLearningState();
        return {
          ok: true,
          installedCourse,
          learningState: migrateLearningState(previousState, installedCourse.course)
        };
      } catch {
        return { ok: false, error: 'STORAGE_FAILURE' };
      }
    }

    async function recordNodeAttempt(payload) {
      try {
        const installedCourse = await storage.readInstalledCourse();
        if (!installedCourse?.course || !contract.validateCourse(installedCourse.course).ok) {
          return { ok: false, error: 'INVALID_COURSE' };
        }
        const node = installedCourse.course.nodes.find((item) => item.id === payload?.nodeId);
        const answer = payload?.answer ?? null;
        if (!node || typeof payload?.correct !== 'boolean'
          || (answer !== null && typeof answer !== 'string')
          || (typeof answer === 'string' && answer.length > MAX_STUDENT_ANSWER_LENGTH)) {
          return { ok: false, error: 'INVALID_REQUEST' };
        }
        const previous = await storage.readLearningState();
        const learningState = migrateLearningState(previous, installedCourse.course);
        const prior = learningState.nodeStates[node.id];
        learningState.nodeStates[node.id] = {
          status: payload.correct ? 'completed' : 'retry',
          attempts: (prior?.attempts ?? 0) + 1,
          lastAnswer: answer
        };
        await storage.writeInstalledCourseAndState(installedCourse, learningState);
        return { ok: true, nodeId: node.id, status: learningState.nodeStates[node.id].status };
      } catch {
        return { ok: false, error: 'STORAGE_FAILURE' };
      }
    }

    return { download, getInstalledCourse, recordNodeAttempt };
  }

  return {
    ACCESS_CODE_PATTERN,
    MAX_RESPONSE_BYTES,
    MAX_STUDENT_ANSWER_LENGTH,
    initialLearningState,
    sanitizeNodeState,
    migrateLearningState,
    createCourseDownloader
  };
});
