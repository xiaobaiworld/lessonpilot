/**
 * LessonPilot background service worker.
 *
 * Thin by design: it wires real Chrome APIs to the shared contract, the protocol
 * and the operation handlers, and holds no validation logic of its own. Everything
 * it delegates to is unit-tested in Node without Chrome (A-NFR-01).
 *
 * A service worker is restarted freely by Chrome, so this file must be safe to
 * evaluate repeatedly. The listener is registered once at top level — registering
 * inside a callback is what produces duplicate responses to a single request.
 */

importScripts(
  '../shared/course-contract.js',
  '../shared/bridge-protocol.js',
  './storage.js',
  './operations.js'
);

(function initServiceWorker(global) {
  const protocol = global.LessonPilotBridgeProtocol;
  const { createStorage } = global.LessonPilotBackgroundStorage;
  const { createOperationHandlers } = global.LessonPilotBackgroundOperations;

  const handlers = createOperationHandlers({
    storage: createStorage(chrome.storage.local),
    extensionVersion: chrome.runtime.getManifest().version,
    createSessionId: () => `session-${crypto.randomUUID()}`,
    now: () => new Date().toISOString()
  });

  /**
   * Debug log for one bridge operation.
   *
   * The field set is fixed and enumerated here rather than spread across call
   * sites, because A-SEC-01 forbids logging question prose, captions, student
   * answers or browsing history. Node count is a number, never the nodes.
   */
  function logOperation(request, response) {
    console.debug('[LessonPilot] bridge', {
      operation: request.type,
      requestId: request.requestId,
      courseId: request.payload?.course?.courseId
        ?? request.payload?.courseId
        ?? request.payload?.expectedCourseId
        ?? null,
      nodeCount: Array.isArray(request.payload?.course?.nodes)
        ? request.payload.course.nodes.length
        : null,
      result: response.ok ? 'success' : 'failure',
      errorCode: response.ok ? null : response.error.code
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // Re-validate the envelope. The content script already checked it, but it
    // forwards data that originated in a web page, so this layer does not treat
    // "arrived over chrome.runtime" as evidence of anything (A-BRIDGE-02).
    const validation = protocol.validateRequest(message);

    if (!validation.ok) {
      // A dropped message is one the content script should never have forwarded:
      // the channel did not match. That is an internal inconsistency rather than a
      // page error, so it is reported as INVALID_CHANNEL (D-011).
      const code = validation.drop
        ? protocol.ERROR_CODES.INVALID_CHANNEL
        : validation.error.code;
      sendResponse(protocol.buildErrorResponse(message?.requestId ?? null, code));
      return false;
    }

    const request = validation.request;

    handlers.handle(request)
      .then((result) => {
        const response = result.ok
          ? protocol.buildSuccessResponse(request.requestId, result.data)
          : protocol.buildErrorResponse(request.requestId, result.error.code);
        logOperation(request, result);
        sendResponse(response);
      })
      .catch(() => {
        // handlers.handle already fails closed; this guard covers a throw in
        // response building or logging, so the page still gets exactly one reply
        // instead of waiting out its timeout.
        sendResponse(
          protocol.buildErrorResponse(request.requestId, protocol.ERROR_CODES.STORAGE_FAILURE)
        );
      });

    // Keeps the message channel open for the async response above.
    return true;
  });
})(self);
