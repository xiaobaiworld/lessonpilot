/**
 * Page-side client for the workspace bridge.
 *
 * It owns request/response pairing and the timeout, which together enforce the one
 * rule the teacher can actually be harmed by: the page must never show a save the
 * extension did not perform (A-BRIDGE-04).
 *
 * Two decisions worth keeping:
 *
 * 1. A timed-out write is never retried. The request may well have reached storage
 *    before the reply was lost, so retrying risks saving twice. The result carries
 *    `outcomeUnknown` so the UI can say "unconfirmed" rather than claiming failure.
 * 2. A reply is accepted only when it came from this window and this origin, and
 *    matches on channel, protocol version and requestId. Anything less would let a
 *    frame or a stale reply settle a pending write.
 *
 * Requests resolve rather than reject: every caller has to render an outcome either
 * way, and a rejection would just be re-caught at each call site.
 */
(function initWorkspaceBridgeClient(global, factory) {
  const api = factory(global);
  global.LessonPilotBridgeClient = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function createBridgeClientModule(global) {
  const protocol = global.LessonPilotBridgeProtocol
    ?? (typeof require === 'function' ? require('./shared/bridge-protocol.js') : null);

  /** Operations whose outcome is unknown after a timeout, so they must not retry. */
  const WRITE_OPERATIONS = ['SAVE_CURRENT_COURSE', 'CLEAR_CURRENT_COURSE', 'START_PREVIEW_SESSION'];

  function createBridgeClient({ window: win }) {
    /** requestId -> { settle, timerId, type } */
    const pending = new Map();

    function settle(requestId, result) {
      const entry = pending.get(requestId);
      // Absent means already settled or timed out. A late duplicate must be inert,
      // not overwrite a decided outcome.
      if (entry === undefined) return;

      pending.delete(requestId);
      win.clearTimeout(entry.timerId);
      entry.settle(result);
    }

    function handleMessage(event) {
      // Only this window and this origin. A reply from anywhere else could satisfy a
      // pending write that never reached storage.
      if (event.source !== win) return;
      if (event.origin !== win.location.origin) return;

      const response = event.data;
      if (!protocol.validateResponse(response).ok) return;

      const requestId = response.requestId;
      if (!pending.has(requestId)) return;
      if (!protocol.matchesRequest(response, requestId)) return;

      settle(requestId, response.ok
        ? { ok: true, data: response.data }
        : { ok: false, error: response.error });
    }

    // One listener for the client's whole lifetime: per-request listeners would
    // accumulate across a long editing session.
    win.addEventListener('message', handleMessage);

    /**
     * Send one operation and resolve with `{ ok, data }` or `{ ok, error }`.
     * A timeout resolves with EXTENSION_UNAVAILABLE, plus `outcomeUnknown: true`
     * for write operations.
     */
    function request(type, payload) {
      const requestId = protocol.createRequestId();
      const envelope = {
        channel: protocol.REQUEST_CHANNEL,
        protocolVersion: protocol.PROTOCOL_VERSION,
        requestId,
        type,
        payload: payload ?? {}
      };

      // Validate before sending. Catching a bad request here keeps a page-side
      // mistake from being reported to the teacher as an extension problem.
      const validation = protocol.validateRequest(envelope);
      if (!validation.ok) {
        const code = validation.drop === true
          ? protocol.ERROR_CODES.INVALID_REQUEST
          : validation.error.code;
        return Promise.resolve({ ok: false, error: { code } });
      }

      return new Promise((resolve) => {
        const timerId = win.setTimeout(() => {
          pending.delete(requestId);
          resolve({
            ok: false,
            error: { code: protocol.ERROR_CODES.EXTENSION_UNAVAILABLE },
            // The write may have landed before the reply was lost, so the UI must
            // report this as unconfirmed rather than as a failure, and must not retry.
            outcomeUnknown: WRITE_OPERATIONS.includes(type)
          });
        }, protocol.RESPONSE_TIMEOUT_MS);

        pending.set(requestId, { settle: resolve, timerId, type });
        win.postMessage(envelope, win.location.origin);
      });
    }

    return {
      request,
      ping: () => request('PING', {}),
      getCurrentCourse: () => request('GET_CURRENT_COURSE', {}),
      saveCurrentCourse: (course) => request('SAVE_CURRENT_COURSE', { course }),
      clearCurrentCourse: (expectedCourseId) => request('CLEAR_CURRENT_COURSE', { expectedCourseId }),
      startPreviewSession: (courseId) => request('START_PREVIEW_SESSION', { courseId }),
      pendingCount: () => pending.size,
      dispose: () => win.removeEventListener('message', handleMessage)
    };
  }

  return { createBridgeClient, WRITE_OPERATIONS };
});
