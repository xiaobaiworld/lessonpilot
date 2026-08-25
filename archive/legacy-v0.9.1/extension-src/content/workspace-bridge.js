/**
 * The workspace content script: the trust boundary between a web page and the
 * teacher's stored course (D-006, A-BRIDGE-02).
 *
 * This is the only layer that can judge where a message really came from, so it
 * carries the origin checks the other layers cannot make. It holds no business
 * logic: it validates provenance and envelope, forwards, and relays one reply.
 *
 * Two behaviours here are deliberate and easy to "fix" wrongly:
 *
 * 1. A message on a foreign channel gets no reply at all. The workspace page runs
 *    other scripts, all of which can postMessage. Answering a foreign message —
 *    even with an error — would tell any third-party script that the extension is
 *    installed. A message on our channel that is malformed does get an answer,
 *    because its sender is speaking our protocol (D-011).
 * 2. The exact origin and pathname are checked in JavaScript, not left to the
 *    manifest. A Chrome match pattern cannot pin a port, so
 *    `http://localhost/...` matches localhost on *any* port. Without this check,
 *    any local dev server the teacher happens to run would sit inside the boundary.
 */
(function initWorkspaceBridgeModule(global, factory) {
  const api = factory(global);
  global.LessonPilotWorkspaceBridge = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof self !== 'undefined' ? self : globalThis, function createWorkspaceBridgeModule(global) {
  const protocol = global.LessonPilotBridgeProtocol
    ?? (typeof require === 'function' ? require('../shared/bridge-protocol.js') : null);
  const origins = global.LessonPilotWorkspaceOrigins
    ?? (typeof require === 'function' ? require('../shared/workspace-origins.js') : null);

  /**
   * Marks a window as already bridged. Chrome can inject a content script again
   * after an extension reload or an SPA navigation; without this, each injection
   * adds a listener and every request is forwarded and answered N times (A-NFR-01).
   */
  const INSTALLED_FLAG = '__lessonPilotWorkspaceBridgeInstalled';

  function createWorkspaceBridge({ window: win, runtime }) {
    function replyToPage(response) {
      // Always the exact origin, never '*': a wildcard would broadcast the reply to
      // whatever document occupies this window.
      win.postMessage(response, win.location.origin);
    }

    async function forward(request) {
      let response;
      try {
        response = await runtime.sendMessage(request);
      } catch {
        // Typically the extension was reloaded and this script is orphaned. Saying so
        // lets the page offer a retry now instead of waiting out its timeout.
        replyToPage(protocol.buildErrorResponse(request.requestId, protocol.ERROR_CODES.EXTENSION_UNAVAILABLE));
        return;
      }

      // The background is trusted to be well-behaved, but not assumed to be: relaying
      // an off-protocol reply would push the inconsistency into the page, where it
      // could be mistaken for a successful write.
      if (!protocol.validateResponse(response).ok || !protocol.matchesRequest(response, request.requestId)) {
        replyToPage(protocol.buildErrorResponse(request.requestId, protocol.ERROR_CODES.EXTENSION_UNAVAILABLE));
        return;
      }

      replyToPage(response);
    }

    async function handleMessage(event) {
      // Provenance first. event.source identifies the actual sender, and comparing the
      // event origin against this window's origin rejects anything cross-document,
      // before the envelope is even looked at.
      if (event.source !== win) return;
      if (event.origin !== win.location.origin) return;

      const validation = protocol.validateRequest(event.data);

      // Not addressed to this bridge: stay silent (see the module header).
      if (validation.drop === true) return;

      if (!validation.ok) {
        replyToPage(protocol.buildErrorResponse(
          typeof event.data?.requestId === 'string' ? event.data.requestId : null,
          validation.error.code
        ));
        return;
      }

      await forward(validation.request);
    }

    /**
     * Register the listener, but only on an exact whitelisted workspace location.
     * Returns whether the bridge is now active; on refusal nothing is registered at
     * all, so a non-whitelisted page has no way to reach storage.
     */
    function start() {
      if (win.top !== win) return false;
      if (!origins.isAllowedWorkspace(win.location.origin, win.location.pathname)) return false;
      if (win[INSTALLED_FLAG] === true) return false;

      win[INSTALLED_FLAG] = true;
      win.addEventListener('message', handleMessage);
      return true;
    }

    return { start, handleMessage };
  }

  return { createWorkspaceBridge, INSTALLED_FLAG };
});

// Auto-start when injected as a content script. Guarded so Node tests can require
// this file and drive createWorkspaceBridge with fakes instead.
if (typeof window !== 'undefined' && typeof chrome !== 'undefined' && chrome?.runtime?.sendMessage) {
  self.LessonPilotWorkspaceBridge
    .createWorkspaceBridge({ window, runtime: chrome.runtime })
    .start();
}
