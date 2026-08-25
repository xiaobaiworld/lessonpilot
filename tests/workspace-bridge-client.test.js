/**
 * Stage 1A page-side bridge client.
 * Run: node --test tests/workspace-bridge-client.test.js
 *
 * The client owns request/response pairing and the timeout. Its job is to make sure
 * the page never reports a save the extension did not perform (A-BRIDGE-04), so the
 * timeout and pairing tests here are the load-bearing ones.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { createBridgeClient } = require('../teacher-web/workspace-bridge-client.js');
const protocol = require('../teacher-web/shared/bridge-protocol.js');

const ORIGIN = 'https://xiaobaiworld.github.io';

/**
 * A fake window with a controllable clock. Timers are driven manually so the tests
 * assert the real 3000ms boundary without waiting for it.
 */
function fakeWindow({ origin = ORIGIN } = {}) {
  const listeners = [];
  const posted = [];
  const timers = new Map();
  let nextTimerId = 1;

  const win = {
    location: { origin },
    listeners,
    posted,
    addEventListener(type, handler) {
      if (type === 'message') listeners.push(handler);
    },
    removeEventListener(type, handler) {
      if (type !== 'message') return;
      const index = listeners.indexOf(handler);
      if (index >= 0) listeners.splice(index, 1);
    },
    postMessage(message) {
      posted.push(message);
    },
    setTimeout(callback, delay) {
      const id = nextTimerId++;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    /** Fire every pending timer whose delay is at or below `ms`. */
    advance(ms) {
      for (const [id, timer] of [...timers]) {
        if (timer.delay <= ms) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
    pendingTimers: () => timers.size
  };
  win.self = win;
  return win;
}

/** Deliver a reply to the client as the content script would. */
function reply(win, message, { origin = win.location.origin, source = win } = {}) {
  for (const handler of win.listeners.slice()) {
    handler({ source, origin, data: message });
  }
}

function setup() {
  const win = fakeWindow();
  const client = createBridgeClient({ window: win });
  return { win, client };
}

/** The request the client just sent. */
function lastRequest(win) {
  return win.posted[win.posted.length - 1];
}

test('sends a well-formed request that the protocol layer accepts', async () => {
  const { win, client } = setup();
  const pending = client.request('PING', {});

  const sent = lastRequest(win);
  assert.equal(protocol.validateRequest(sent).ok, true, 'the client must emit a valid envelope');
  assert.equal(sent.channel, protocol.REQUEST_CHANNEL);
  assert.equal(sent.type, 'PING');

  reply(win, protocol.buildSuccessResponse(sent.requestId, { extensionVersion: '0.7.0' }));
  const result = await pending;

  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { extensionVersion: '0.7.0' });
});

test('refuses to send an operation the protocol does not open', async () => {
  // Catching this locally keeps a typo from being reported to the teacher as an
  // extension problem.
  const { win, client } = setup();
  const result = await client.request('DELETE_EVERYTHING', {});

  assert.equal(result.ok, false);
  assert.equal(result.error.code, protocol.ERROR_CODES.UNKNOWN_OPERATION);
  assert.equal(win.posted.length, 0, 'nothing may be sent');
});

test('gives every request a unique id', async () => {
  const { win, client } = setup();
  client.request('PING', {});
  client.request('GET_CURRENT_COURSE', {});

  const [first, second] = win.posted;
  assert.notEqual(first.requestId, second.requestId);
});

test('routes each reply to the request that asked for it', async () => {
  // Two operations in flight at once must not resolve each other; for a save and a
  // clear, crossing them would report the wrong outcome for both.
  const { win, client } = setup();
  const firstPending = client.request('PING', {});
  const secondPending = client.request('GET_CURRENT_COURSE', {});
  const [first, second] = win.posted;

  reply(win, protocol.buildSuccessResponse(second.requestId, { course: null }));
  reply(win, protocol.buildSuccessResponse(first.requestId, { extensionVersion: '0.7.0' }));

  assert.deepEqual((await firstPending).data, { extensionVersion: '0.7.0' });
  assert.deepEqual((await secondPending).data, { course: null });
});

test('ignores replies that do not match on channel, version and requestId', async () => {
  const { win, client } = setup();
  const pending = client.request('PING', {});
  const sent = lastRequest(win);
  const good = protocol.buildSuccessResponse(sent.requestId, { extensionVersion: '0.7.0' });

  reply(win, { ...good, channel: protocol.REQUEST_CHANNEL });
  reply(win, { ...good, protocolVersion: 99 });
  reply(win, { ...good, requestId: 'req-550e8400-e29b-41d4-a716-446655440999' });
  reply(win, null);
  reply(win, 'a string');

  assert.equal(win.pendingTimers(), 1, 'the request must still be waiting');

  reply(win, good);
  assert.equal((await pending).ok, true);
});

test('ignores a reply that came from another window or origin', async () => {
  // Without this, any frame could satisfy a pending write and the page would show a
  // save that never reached storage.
  const { win, client } = setup();
  const pending = client.request('SAVE_CURRENT_COURSE', { course: { schemaVersion: 1 } });
  const sent = lastRequest(win);
  const good = protocol.buildSuccessResponse(sent.requestId, { courseId: 'x', updatedAt: 'y' });

  reply(win, good, { source: { other: 'window' } });
  reply(win, good, { origin: 'https://evil.example.com' });
  assert.equal(win.pendingTimers(), 1, 'neither may resolve the request');

  reply(win, good);
  assert.equal((await pending).ok, true);
});

test('ignores a malformed reply even when the requestId matches', async () => {
  const { win, client } = setup();
  const pending = client.request('PING', {});
  const sent = lastRequest(win);

  reply(win, { channel: protocol.RESPONSE_CHANNEL, protocolVersion: 1, requestId: sent.requestId, ok: true });
  assert.equal(win.pendingTimers(), 1, 'a success without data must not resolve');

  reply(win, protocol.buildSuccessResponse(sent.requestId, {}));
  assert.equal((await pending).ok, true);
});

test('ignores a second reply to the same request', async () => {
  // One request, one outcome. A late duplicate must not overwrite a settled result.
  const { win, client } = setup();
  const pending = client.request('PING', {});
  const sent = lastRequest(win);

  reply(win, protocol.buildSuccessResponse(sent.requestId, { extensionVersion: '0.7.0' }));
  reply(win, protocol.buildErrorResponse(sent.requestId, protocol.ERROR_CODES.STORAGE_FAILURE));

  const result = await pending;
  assert.equal(result.ok, true, 'the first reply wins');
  assert.deepEqual(result.data, { extensionVersion: '0.7.0' });
});

test('ends a silent request with EXTENSION_UNAVAILABLE after the timeout', async () => {
  const { win, client } = setup();
  const pending = client.request('PING', {});

  win.advance(protocol.RESPONSE_TIMEOUT_MS);
  const result = await pending;

  assert.equal(result.ok, false);
  assert.equal(result.error.code, protocol.ERROR_CODES.EXTENSION_UNAVAILABLE);
});

test('waits the full 3000ms before giving up', async () => {
  const { win, client } = setup();
  const pending = client.request('PING', {});

  win.advance(protocol.RESPONSE_TIMEOUT_MS - 1);
  assert.equal(win.pendingTimers(), 1, 'must not time out early');

  reply(win, protocol.buildSuccessResponse(lastRequest(win).requestId, {}));
  assert.equal((await pending).ok, true);
});

test('a write that timed out is not retried automatically', async () => {
  // A-BRIDGE-04. The request may well have reached storage before the reply was
  // lost, so an automatic retry risks saving twice. Retrying is the teacher's call.
  const { win, client } = setup();
  const pending = client.request('SAVE_CURRENT_COURSE', { course: { schemaVersion: 1 } });
  const sentCount = win.posted.length;

  win.advance(protocol.RESPONSE_TIMEOUT_MS);
  await pending;

  assert.equal(win.posted.length, sentCount, 'no second send');
  assert.equal(win.pendingTimers(), 0, 'no rescheduled attempt');
});

test('a timeout is reported as unknown, not as a failed write', async () => {
  // The page must not tell the teacher the save failed: it may have succeeded. This
  // flag is what lets the diagnostics page say "unconfirmed" instead of guessing.
  const { win, client } = setup();
  const pending = client.request('SAVE_CURRENT_COURSE', { course: { schemaVersion: 1 } });

  win.advance(protocol.RESPONSE_TIMEOUT_MS);
  const result = await pending;

  assert.equal(result.ok, false);
  assert.equal(result.outcomeUnknown, true, 'a timed-out write has an unknown outcome');
});

test('a completed request leaves no timer or listener state behind', async () => {
  // Leaked timers and handlers accumulate across a long editing session and would
  // eventually let a stale reply resolve an unrelated request.
  const { win, client } = setup();
  const listenersBefore = win.listeners.length;

  const pending = client.request('PING', {});
  reply(win, protocol.buildSuccessResponse(lastRequest(win).requestId, {}));
  await pending;

  assert.equal(win.pendingTimers(), 0, 'the timeout must be cleared');
  assert.equal(client.pendingCount(), 0, 'no pending request may remain');
  assert.equal(win.listeners.length, listenersBefore, 'no listener may be left behind');
});

test('a timed-out request is forgotten, so a late reply cannot resolve it', async () => {
  const { win, client } = setup();
  const pending = client.request('PING', {});
  const sent = lastRequest(win);

  win.advance(protocol.RESPONSE_TIMEOUT_MS);
  await pending;
  assert.equal(client.pendingCount(), 0);

  // A late reply must be inert rather than throwing on a settled promise.
  reply(win, protocol.buildSuccessResponse(sent.requestId, { extensionVersion: '0.7.0' }));
  assert.equal(client.pendingCount(), 0);
});

test('registers exactly one message listener regardless of request count', async () => {
  const { win, client } = setup();
  assert.equal(win.listeners.length, 1, 'one listener at construction');

  client.request('PING', {});
  client.request('GET_CURRENT_COURSE', {});
  assert.equal(win.listeners.length, 1, 'still one');
});

test('sends to its own origin, never a wildcard', async () => {
  // postMessage on the page side: a wildcard would expose course data to any
  // document that later occupies this window.
  const win = fakeWindow();
  const posted = [];
  win.postMessage = (message, targetOrigin) => posted.push({ message, targetOrigin });
  const client = createBridgeClient({ window: win });

  client.request('PING', {});
  assert.equal(posted[0].targetOrigin, ORIGIN);
  assert.notEqual(posted[0].targetOrigin, '*');
});
