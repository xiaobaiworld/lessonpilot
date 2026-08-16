/**
 * Stage 1A workspace content script: the trust boundary between a web page and the
 * extension.
 * Run: node --test tests/workspace-bridge.test.js
 *
 * The content script is the only layer that can judge where a message really came
 * from, so these tests are the ones that matter most for security. They drive it
 * through a fake window and a fake chrome.runtime, and assert on what it forwards
 * and what it refuses to answer at all.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { createWorkspaceBridge } = require('../src/content/workspace-bridge.js');
const protocol = require('../src/shared/bridge-protocol.js');
const origins = require('../src/shared/workspace-origins.js');

const PUBLIC = origins.ALLOWED_WORKSPACES.find((entry) => entry.label === 'public');
const LOCAL = origins.ALLOWED_WORKSPACES.find((entry) => entry.label === 'local');
const REQUEST_ID = 'req-550e8400-e29b-41d4-a716-446655440000';

function request(overrides = {}) {
  return {
    channel: protocol.REQUEST_CHANNEL,
    protocolVersion: protocol.PROTOCOL_VERSION,
    requestId: REQUEST_ID,
    type: 'PING',
    payload: {},
    ...overrides
  };
}

/**
 * A fake page window. `postedBack` records replies the bridge sends to the page;
 * `listeners` lets a test check that repeated initialisation does not accumulate
 * handlers.
 */
function fakeWindow({ origin = PUBLIC.origin, pathname = PUBLIC.pathname, isTop = true } = {}) {
  const listeners = [];
  const postedBack = [];
  const win = {
    location: { origin, pathname },
    listeners,
    postedBack,
    addEventListener(type, handler) {
      if (type === 'message') listeners.push(handler);
    },
    removeEventListener(type, handler) {
      if (type !== 'message') return;
      const index = listeners.indexOf(handler);
      if (index >= 0) listeners.splice(index, 1);
    },
    postMessage(message, targetOrigin) {
      postedBack.push({ message, targetOrigin });
    }
  };
  win.top = isTop ? win : {};
  return win;
}

/** A fake chrome.runtime that records what the bridge forwarded. */
function fakeRuntime({ respondWith, fail = false } = {}) {
  const sent = [];
  return {
    sent,
    runtime: {
      async sendMessage(message) {
        sent.push(message);
        if (fail) throw new Error('extension context invalidated');
        return respondWith ?? protocol.buildSuccessResponse(message.requestId, { extensionVersion: '0.7.0' });
      }
    }
  };
}

/** Start a bridge and return the handles a test needs to drive it. */
function start(options = {}) {
  const win = fakeWindow(options.window);
  const { runtime, sent } = fakeRuntime(options.runtime);
  const bridge = createWorkspaceBridge({ window: win, runtime });
  const started = bridge.start();
  return { win, runtime, sent, bridge, started };
}

/**
 * Strip comments so source guards inspect code rather than prose. Without this, a
 * comment explaining why innerHTML is avoided would itself fail the check.
 *
 * Approximate by design: a `//` inside a string literal truncates the rest of that
 * line. That can only cause a guard to look at less code, never to accept code it
 * should reject, so the trade-off is acceptable for these assertions.
 */
function stripJsComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function stripHtmlComments(source) {
  return source.replace(/<!--[\s\S]*?-->/g, '');
}

/** Deliver a message event to every registered listener, as the browser would. */
async function deliver(win, event) {
  for (const handler of win.listeners.slice()) {
    await handler({ source: win, origin: win.location.origin, data: null, ...event });
  }
  // Let the bridge's async forward settle before assertions.
  await new Promise((resolve) => setImmediate(resolve));
}

test('starts on both whitelisted workspace locations', async () => {
  for (const entry of origins.ALLOWED_WORKSPACES) {
    const { started, win } = start({ window: { origin: entry.origin, pathname: entry.pathname } });
    assert.equal(started, true, `${entry.label} workspace must start`);
    assert.equal(win.listeners.length, 1);
  }
});

test('forwards a valid request and returns the reply to the page', async () => {
  const { win, sent } = start();
  await deliver(win, { data: request() });

  assert.equal(sent.length, 1, 'exactly one forward');
  assert.deepEqual(sent[0], request());
  assert.equal(win.postedBack.length, 1, 'exactly one reply');
  assert.equal(win.postedBack[0].message.requestId, REQUEST_ID, 'reply echoes the requestId');
  assert.equal(win.postedBack[0].message.ok, true);
});

test('replies to the page with its exact origin, never a wildcard', async () => {
  // A wildcard target origin would broadcast the reply to whatever document ends up
  // in that window, which can include a course the teacher is editing.
  const { win } = start();
  await deliver(win, { data: request() });

  assert.equal(win.postedBack[0].targetOrigin, PUBLIC.origin);
  assert.notEqual(win.postedBack[0].targetOrigin, '*');
});

test('refuses to start anywhere outside the exact whitelist', async () => {
  // The manifest match pattern cannot pin a port, so this JS check is what actually
  // keeps other local dev servers out of the trust boundary.
  const rejected = [
    { origin: 'http://localhost:8080', pathname: LOCAL.pathname, label: 'wrong port' },
    { origin: 'http://localhost', pathname: LOCAL.pathname, label: 'no port' },
    { origin: 'https://xiaobaiworld.github.io.evil.com', pathname: PUBLIC.pathname, label: 'suffix domain' },
    { origin: 'http://xiaobaiworld.github.io', pathname: PUBLIC.pathname, label: 'http not https' },
    { origin: PUBLIC.origin, pathname: '/lessonpilot/teacher-web/workspace.htmlx', label: 'path suffix' },
    { origin: PUBLIC.origin, pathname: '/lessonpilot/teacher-web/workspace.html/sub', label: 'path child' },
    { origin: PUBLIC.origin, pathname: '/evil/lessonpilot/teacher-web/workspace.html', label: 'path prefix' },
    { origin: PUBLIC.origin, pathname: LOCAL.pathname, label: 'local path on public origin' },
    { origin: LOCAL.origin, pathname: PUBLIC.pathname, label: 'public path on local origin' },
    { origin: PUBLIC.origin, pathname: '/lessonpilot/teacher-web/index.html', label: 'sales page' }
  ];

  for (const { origin, pathname, label } of rejected) {
    const { started, win } = start({ window: { origin, pathname } });
    assert.equal(started, false, `${label} must not start`);
    assert.equal(win.listeners.length, 0, `${label} must register no listener`);
  }
});

test('a non-whitelisted page cannot reach storage even by sending a valid message', async () => {
  // The end-to-end version of 1A completion criterion 11.
  const { win, sent } = start({ window: { origin: 'https://evil.example.com', pathname: PUBLIC.pathname } });
  await deliver(win, { data: request({ type: 'CLEAR_CURRENT_COURSE', payload: { expectedCourseId: 'bilibili:BV1WW4y1e7GL' } }) });

  assert.equal(sent.length, 0, 'nothing may be forwarded');
  assert.equal(win.postedBack.length, 0, 'and nothing may be answered');
});

test('does not start in a frame, so an embedded workspace cannot bridge', async () => {
  const { started, win } = start({ window: { isTop: false } });
  assert.equal(started, false);
  assert.equal(win.listeners.length, 0);
});

test('ignores messages that did not come from this window', async () => {
  // event.source identifies the actual sender. Without this check, any frame or
  // opener that knows the protocol could drive the bridge (A-BRIDGE-02).
  const { win, sent } = start();
  await deliver(win, { source: { other: 'window' }, data: request() });

  assert.equal(sent.length, 0);
  assert.equal(win.postedBack.length, 0);
});

test('ignores messages whose event origin disagrees with the window origin', async () => {
  const { win, sent } = start();
  await deliver(win, { origin: 'https://evil.example.com', data: request() });

  assert.equal(sent.length, 0);
  assert.equal(win.postedBack.length, 0);
});

test('stays silent for messages on another channel', async () => {
  // The workspace page runs other scripts, all of which can postMessage. Answering
  // a foreign message — even with an error — would tell any third-party script that
  // the extension is installed (D-011).
  const { win, sent } = start();
  for (const data of [
    request({ channel: 'other.channel.v1' }),
    { type: 'PING' },
    'a string',
    null,
    42,
    protocol.buildSuccessResponse(REQUEST_ID, {})
  ]) {
    await deliver(win, { data });
  }

  assert.equal(sent.length, 0, 'nothing forwarded');
  assert.equal(win.postedBack.length, 0, 'and no reply at all');
});

test('answers a malformed request on our channel instead of dropping it', async () => {
  // The sender is speaking our protocol, so it gets a diagnosable answer.
  const cases = [
    [request({ protocolVersion: 99 }), protocol.ERROR_CODES.UNSUPPORTED_VERSION],
    [request({ type: 'DELETE_ALL' }), protocol.ERROR_CODES.UNKNOWN_OPERATION],
    [request({ requestId: 'not-a-request-id' }), protocol.ERROR_CODES.INVALID_REQUEST],
    [request({ payload: { unexpected: true } }), protocol.ERROR_CODES.INVALID_REQUEST]
  ];

  for (const [data, expectedCode] of cases) {
    const { win, sent } = start();
    await deliver(win, { data });

    assert.equal(sent.length, 0, `${expectedCode}: must not reach the background`);
    assert.equal(win.postedBack.length, 1, `${expectedCode}: must be answered`);
    assert.equal(win.postedBack[0].message.ok, false);
    assert.equal(win.postedBack[0].message.error.code, expectedCode);
  }
});

test('a malformed request never reaches the background', async () => {
  // Defence in depth is only real if the outer layer actually stops traffic; the
  // background validating again is the backstop, not the primary gate.
  const { win, sent } = start();
  await deliver(win, { data: request({ type: 'DROP_DATABASE', payload: {} }) });

  assert.equal(sent.length, 0);
});

test('produces exactly one response per request', async () => {
  // A duplicate reply would make the page resolve a request twice; for a write that
  // reads as a second, unintended save.
  const { win } = start();
  await deliver(win, { data: request({ type: 'SAVE_CURRENT_COURSE', payload: { course: { schemaVersion: 1 } } }) });

  assert.equal(win.postedBack.length, 1);
});

test('repeated initialisation does not accumulate listeners or duplicate forwards', async () => {
  // Chrome can inject a content script again after an extension reload or an SPA
  // navigation. Without a guard, each injection adds a listener and every request
  // gets forwarded and answered N times (A-NFR-01).
  const win = fakeWindow();
  const { runtime, sent } = fakeRuntime();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    createWorkspaceBridge({ window: win, runtime }).start();
  }

  assert.equal(win.listeners.length, 1, 'only one listener may be registered');

  await deliver(win, { data: request() });
  assert.equal(sent.length, 1, 'one forward');
  assert.equal(win.postedBack.length, 1, 'one reply');
});

test('reports the extension being unavailable rather than leaving the page waiting', async () => {
  // After an extension reload the old content script's sendMessage throws. Silence
  // would leave the page to time out; a real error lets it show a retry now.
  const { win, sent } = start({ runtime: { fail: true } });
  await deliver(win, { data: request() });

  assert.equal(sent.length, 1, 'the attempt was made');
  assert.equal(win.postedBack.length, 1);
  assert.equal(win.postedBack[0].message.ok, false);
  assert.equal(win.postedBack[0].message.error.code, protocol.ERROR_CODES.EXTENSION_UNAVAILABLE);
});

test('does not relay a malformed reply from the background', async () => {
  // If the background ever answered with something off-protocol, forwarding it would
  // push the inconsistency into the page. Fail closed instead.
  const { win } = start({ runtime: { respondWith: { ok: true, data: {} } } });
  await deliver(win, { data: request() });

  assert.equal(win.postedBack.length, 1);
  assert.equal(win.postedBack[0].message.ok, false);
  assert.equal(win.postedBack[0].message.error.code, protocol.ERROR_CODES.EXTENSION_UNAVAILABLE);
});

test('does not relay a reply whose requestId does not match the request', async () => {
  const mismatched = protocol.buildSuccessResponse('req-550e8400-e29b-41d4-a716-446655440999', {});
  const { win } = start({ runtime: { respondWith: mismatched } });
  await deliver(win, { data: request() });

  assert.equal(win.postedBack[0].message.ok, false);
  assert.equal(win.postedBack[0].message.requestId, REQUEST_ID, 'the page still learns which request failed');
});

test('the manifest content script covers every whitelisted workspace entry', () => {
  // Chrome match patterns cannot express a port, so the manifest is deliberately
  // coarser than the JS whitelist and the content script re-checks the exact origin
  // at runtime. This keeps the coarse patterns from drifting away from the entries
  // they are meant to cover.
  const manifest = JSON.parse(fs.readFileSync('src/manifest.json', 'utf8'));
  const workspaceScript = manifest.content_scripts.find(
    (entry) => entry.js.some((file) => file.includes('workspace-bridge'))
  );
  assert.ok(workspaceScript, 'manifest must register the workspace bridge content script');

  for (const entry of origins.ALLOWED_WORKSPACES) {
    const host = new URL(entry.origin).host.replace(/:\d+$/, '');
    const covered = workspaceScript.matches.some(
      (pattern) => pattern.includes(host) && pattern.endsWith(entry.pathname)
    );
    assert.ok(covered, `manifest matches must cover ${entry.origin}${entry.pathname}`);
  }
});

test('the diagnostics page stays inside the 1A boundary', () => {
  // 1A must not grow into 1B. The page is allowed to prove the protocol works; the
  // moment it imports subtitles or edits nodes it has become the 1B workspace
  // without meeting the 1B gate.
  const html = fs.readFileSync('teacher-web/workspace.html', 'utf8');
  const script = fs.readFileSync('teacher-web/workspace-diagnostics.js', 'utf8');

  assert.ok(html.includes('1B'), 'the page must say course editing arrives in 1B');
  for (const forbidden of ['type="file"', 'subtitle', 'timeline', 'srt', 'vtt']) {
    assert.ok(
      !html.toLowerCase().includes(forbidden),
      `the diagnostics page must not carry ${forbidden}`
    );
  }
  for (const id of ['btn-ping', 'btn-get', 'btn-save', 'btn-preview', 'btn-clear']) {
    assert.ok(html.includes(id), `missing control ${id}`);
    assert.ok(script.includes(id), `${id} must be wired`);
  }
});

test('the page renders dynamic text without any HTML injection point', () => {
  // A-SEC-01: course prose and error detail are untrusted as far as this page is
  // concerned, and innerHTML would be an injection point into the teacher's browser.
  for (const file of [
    'teacher-web/workspace-diagnostics.js',
    'teacher-web/workspace-bridge-client.js',
    'src/content/workspace-bridge.js'
  ]) {
    const source = stripJsComments(fs.readFileSync(file, 'utf8'));
    for (const unsafe of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(']) {
      assert.ok(!source.includes(unsafe), `${file} must not use ${unsafe}`);
    }
  }
  // The page must actually render through textContent, not merely avoid innerHTML.
  const diagnostics = fs.readFileSync('teacher-web/workspace-diagnostics.js', 'utf8');
  assert.ok(diagnostics.includes('textContent'), 'dynamic text must be written with textContent');
});

test('the page loads the shared contract from the assembled path, not by hostname', () => {
  // D-010: local and published deployments load the identical path because the
  // contract is copied beside the page in both. A hostname branch would be a second
  // code path that only one environment ever exercises.
  const html = stripHtmlComments(fs.readFileSync('teacher-web/workspace.html', 'utf8'));
  assert.ok(html.includes('shared/course-contract.js'), 'must load the shared contract');
  assert.ok(html.includes('shared/bridge-protocol.js'), 'must load the shared protocol');
  assert.ok(!html.includes('../src/shared/'), 'must not reach into src/ from the page');
  assert.ok(!/hostname|localhost/.test(html), 'must not branch on hostname');
});

test('the assembler copies exactly the files the page loads', () => {
  // Drift here is silent: the page would 404 on a missing file, or the workflow would
  // publish a file the page never asked for.
  const { SHARED_FILES } = require('../tools/assemble-workspace.js');
  const html = stripHtmlComments(fs.readFileSync('teacher-web/workspace.html', 'utf8'));

  const loaded = [...html.matchAll(/src="shared\/([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(loaded.slice().sort(), SHARED_FILES.slice().sort());
  for (const file of SHARED_FILES) {
    assert.ok(fs.existsSync(`src/shared/${file}`), `src/shared/${file} must exist`);
  }
});

test('the assembled shared copy is git-ignored, so the contract cannot be duplicated', () => {
  // A committed copy would be a second definition of the contract, free to drift
  // from src/shared/ with no test noticing.
  const gitignore = fs.readFileSync('.gitignore', 'utf8');
  assert.ok(gitignore.includes('teacher-web/shared/'), '.gitignore must exclude teacher-web/shared/');
});

test('the bilibili content script is not granted the workspace bridge', () => {
  // The learner runtime has no reason to carry the configuration bridge, and giving
  // it one would widen the trust boundary to every bilibili video page.
  const manifest = JSON.parse(fs.readFileSync('src/manifest.json', 'utf8'));
  const bilibiliScript = manifest.content_scripts.find(
    (entry) => entry.matches.some((pattern) => pattern.includes('bilibili.com'))
  );
  assert.ok(bilibiliScript, 'the bilibili runtime script must still exist');
  assert.ok(
    !bilibiliScript.js.some((file) => file.includes('workspace-bridge')),
    'workspace-bridge must not be injected into bilibili pages'
  );
});
