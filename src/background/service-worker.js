/**
 * LessonPilot background service worker.
 * Spike: message passthrough only. AI backend wiring comes in Phase 3.
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'PING') {
    sendResponse({ ok: true, from: 'background' });
    return false;
  }
  return false;
});
