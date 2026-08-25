/**
 * The five stage 1A operation handlers (A-BRIDGE-03).
 *
 * These run in the background service worker and are the last line before storage.
 * Two rules drive the design:
 *
 * 1. The background re-validates everything. A message arriving over
 *    chrome.runtime is not trusted merely because it came from inside the
 *    extension: the content script forwards data that originated in a web page
 *    (A-BRIDGE-02).
 * 2. Nothing reports success it did not achieve. Every handler awaits the real
 *    storage write before returning ok, so the page can never show a save that did
 *    not happen (A-BRIDGE-04).
 *
 * Clock and id generation are injected, so the tests assert real values instead of
 * whatever the machine clock produced.
 */
(function initBackgroundOperations(global, factory) {
  const api = factory(global);
  global.LessonPilotBackgroundOperations = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof self !== 'undefined' ? self : globalThis, function createOperationsModule(global) {
  const contract = global.LessonPilotCourseContract
    ?? (typeof require === 'function' ? require('../shared/course-contract.js') : null);
  const protocol = global.LessonPilotBridgeProtocol
    ?? (typeof require === 'function' ? require('../shared/bridge-protocol.js') : null);
  const storageModule = global.LessonPilotBackgroundStorage
    ?? (typeof require === 'function' ? require('./storage.js') : null);

  const { ERROR_CODES } = protocol;
  const { StorageFailure } = storageModule;

  const SESSION_SCHEMA_VERSION = 1;
  const INITIAL_NODE_STATE = { status: 'pending', attempts: 0, answer: null };

  function ok(data) {
    return { ok: true, data: data ?? {} };
  }

  function fail(code) {
    // Only the code crosses this boundary. Messages for the teacher are composed on
    // the page from the code, so internal text cannot leak into the UI (A-ERR-01).
    return { ok: false, error: { code } };
  }

  function createOperationHandlers({ storage, extensionVersion, createSessionId, now }) {
    /**
     * Read the stored course and validate it again.
     *
     * Stored data is re-validated on every read because storage can hold a course
     * written by an earlier build or edited by hand. Trusting it because "we wrote
     * it" is precisely how corrupt configuration reaches a learner mid-lesson
     * (A-STORAGE-01).
     *
     * Returns { state: 'empty' | 'valid' | 'invalid', course }.
     */
    async function loadValidCourse() {
      const stored = await storage.readCurrentCourse();
      if (stored === null) return { state: 'empty', course: null };
      return contract.validateCourse(stored).ok
        ? { state: 'valid', course: stored }
        : { state: 'invalid', course: null };
    }

    async function handlePing() {
      return ok({ extensionVersion });
    }

    async function handleGetCurrentCourse() {
      const { state, course } = await loadValidCourse();
      if (state === 'invalid') return fail(ERROR_CODES.INVALID_COURSE);
      return ok({ course: state === 'empty' ? null : course });
    }

    async function handleSaveCurrentCourse(payload) {
      // Validate before writing, and do not normalize: the write path normalizes on
      // the page. Sorting here would accept a course the page rejected, leaving the
      // two sides disagreeing about what is storable (D-011).
      if (!contract.validateCourse(payload.course).ok) return fail(ERROR_CODES.INVALID_COURSE);

      // Store a clone: the payload object belongs to the caller, and keeping a live
      // reference would let it mutate persisted state after the write reported success.
      const course = structuredClone(payload.course);
      await storage.writeCurrentCourse(course);

      // updatedAt is echoed, never regenerated, so a saved course reads back deeply
      // equal to what was written (1A completion criterion 4, D-011).
      return ok({ courseId: course.courseId, updatedAt: course.updatedAt });
    }

    async function handleClearCurrentCourse(payload) {
      const stored = await storage.readCurrentCourse();

      // Nothing stored is success: the caller's goal — no current course — already
      // holds, and an error would push a page into a pointless retry (A-STORAGE-02).
      if (stored === null) return ok({ cleared: true });

      // The id guard protects against a stale page deleting a course the teacher
      // configured after that page was loaded. Compared against raw stored data so a
      // corrupt course can still be cleared with the right id.
      if (stored.courseId !== payload.expectedCourseId) return fail(ERROR_CODES.COURSE_MISMATCH);

      await storage.removeCourseAndSession();
      return ok({ cleared: true });
    }

    async function handleStartPreviewSession(payload) {
      const { state, course } = await loadValidCourse();
      if (state === 'invalid') return fail(ERROR_CODES.INVALID_COURSE);
      // No course, or a different one, means the caller is working from a stale view
      // of the extension; binding a session to it would produce a session that
      // references a course the runtime will not find.
      if (state === 'empty' || course.courseId !== payload.courseId) {
        return fail(ERROR_CODES.COURSE_MISMATCH);
      }

      const nodeStates = {};
      for (const node of course.nodes) {
        nodeStates[node.id] = { ...INITIAL_NODE_STATE };
      }

      const startedAt = now();
      const session = {
        schemaVersion: SESSION_SCHEMA_VERSION,
        sessionId: createSessionId(),
        courseId: course.courseId,
        // Pins the session to this exact save. It distinguishes two saves of the same
        // course without building a version system (D-004).
        courseUpdatedAt: course.updatedAt,
        startedAt,
        nodeStates
      };

      // Whole-object write: the new session replaces the old one and no history is kept.
      await storage.writePreviewSession(session);
      return ok({ sessionId: session.sessionId, startedAt });
    }

    const HANDLERS = {
      PING: handlePing,
      GET_CURRENT_COURSE: handleGetCurrentCourse,
      SAVE_CURRENT_COURSE: handleSaveCurrentCourse,
      CLEAR_CURRENT_COURSE: handleClearCurrentCourse,
      START_PREVIEW_SESSION: handleStartPreviewSession
    };

    /**
     * Dispatch one validated request. The protocol layer has already checked the
     * envelope; the unknown-operation guard here is the second line, so a future
     * caller that forgets to validate still cannot reach storage.
     */
    async function handle(request) {
      const handler = Object.hasOwn(HANDLERS, request?.type) ? HANDLERS[request.type] : null;
      if (handler === null) return fail(ERROR_CODES.UNKNOWN_OPERATION);

      try {
        return await handler(request.payload ?? {});
      } catch (error) {
        if (error instanceof StorageFailure) return fail(ERROR_CODES.STORAGE_FAILURE);
        // An unexpected throw is still a refusal: failing closed keeps a bug from
        // being reported to the page as a successful write.
        return fail(ERROR_CODES.STORAGE_FAILURE);
      }
    }

    return { handle, readPreviewSession: () => storage.readPreviewSession() };
  }

  return { createOperationHandlers, SESSION_SCHEMA_VERSION };
});
