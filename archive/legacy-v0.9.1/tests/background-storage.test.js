/**
 * Stage 1A background storage and operation handlers.
 * Run: node --test tests/background-storage.test.js
 *
 * The handlers are tested against an in-memory storage adapter rather than real
 * Chrome (A-NFR-01). The adapter mimics the two properties of chrome.storage.local
 * that actually shape the code: values cross a structured-clone boundary, and
 * either call can fail.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { createStorage } = require('../src/background/storage.js');
const { createOperationHandlers } = require('../src/background/operations.js');
const protocol = require('../src/shared/bridge-protocol.js');

const COURSE_ID = 'bilibili:BV1WW4y1e7GL';
const UPDATED_AT = '2026-08-15T00:00:00.000Z';

function course(overrides = {}) {
  return {
    schemaVersion: 1,
    courseId: COURSE_ID,
    videoRef: { platform: 'bilibili', videoId: 'BV1WW4y1e7GL' },
    nodes: [
      {
        id: 'node-1',
        enabled: true,
        family: 'attention',
        interaction: 'notice',
        trigger: { kind: 'time_cross', timeSeconds: 39, captionId: null },
        display: { title: '能力词还需要证据', body: '需要具体经历证明。' },
        evaluation: null,
        effects: { pause: true }
      },
      {
        id: 'node-2',
        enabled: true,
        family: 'practice',
        interaction: 'choice',
        trigger: { kind: 'time_cross', timeSeconds: 72, captionId: null },
        display: {
          title: '判断哪一句有证据',
          prompt: '下面哪一句给出了具体证据？',
          options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]
        },
        evaluation: { answer: 'b', explanation: '第二句更具体。' },
        effects: { pause: true }
      }
    ],
    updatedAt: UPDATED_AT,
    ...overrides
  };
}

/**
 * In-memory chrome.storage.local stand-in. Values are structured-cloned on the way
 * in and out, because that is what the real API does: a handler that accidentally
 * kept a live reference would pass against a naive fake and corrupt state in Chrome.
 */
function fakeChromeStorage(initial = {}) {
  let backing = structuredClone(initial);
  const state = { failGet: false, failSet: false, failRemove: false, setCalls: 0 };

  return {
    state,
    peek: () => structuredClone(backing),
    seed: (value) => { backing = structuredClone(value); },
    local: {
      async get(keys) {
        if (state.failGet) throw new Error('simulated get failure');
        const wanted = Array.isArray(keys) ? keys : [keys];
        const out = {};
        for (const key of wanted) {
          if (Object.hasOwn(backing, key)) out[key] = structuredClone(backing[key]);
        }
        return out;
      },
      async set(items) {
        if (state.failSet) throw new Error('simulated set failure');
        state.setCalls += 1;
        Object.assign(backing, structuredClone(items));
      },
      async remove(keys) {
        if (state.failRemove) throw new Error('simulated remove failure');
        for (const key of Array.isArray(keys) ? keys : [keys]) delete backing[key];
      }
    }
  };
}

function setup(initial = {}) {
  const chromeStorage = fakeChromeStorage(initial);
  const storage = createStorage(chromeStorage.local);
  const handlers = createOperationHandlers({
    storage,
    extensionVersion: '0.7.0',
    // Injected so session ids and timestamps are assertable rather than incidental.
    createSessionId: () => 'session-550e8400-e29b-41d4-a716-446655440000',
    now: () => UPDATED_AT
  });
  return { chromeStorage, storage, handlers };
}

function handle(handlers, type, payload = {}) {
  return handlers.handle({ type, payload });
}

test('PING reports the extension version without touching storage', async () => {
  const { handlers, chromeStorage } = setup();
  const result = await handle(handlers, 'PING');

  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { extensionVersion: '0.7.0' });
  assert.deepEqual(chromeStorage.peek(), {}, 'PING must not write');
});

test('GET_CURRENT_COURSE returns null when nothing is stored', async () => {
  const { handlers } = setup();
  const result = await handle(handlers, 'GET_CURRENT_COURSE');

  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { course: null });
});

test('a saved course reads back deeply equal to what was written', async () => {
  // 1A completion criterion 4. This is why the background never rewrites
  // updatedAt: any field it regenerated would break this equality (D-011).
  const { handlers } = setup();
  const written = course();

  const saved = await handle(handlers, 'SAVE_CURRENT_COURSE', { course: written });
  assert.equal(saved.ok, true);
  assert.deepEqual(saved.data, { courseId: COURSE_ID, updatedAt: UPDATED_AT });

  const read = await handle(handlers, 'GET_CURRENT_COURSE');
  assert.deepEqual(read.data.course, written);
});

test('the stored course is insulated from later mutation of the caller object', async () => {
  // The message payload belongs to the caller. Keeping a live reference would let
  // a page mutate stored state after the write was reported successful.
  const { handlers } = setup();
  const written = course();
  await handle(handlers, 'SAVE_CURRENT_COURSE', { course: written });

  written.nodes[0].display.title = 'mutated after save';
  written.nodes.push({ id: 'node-injected' });

  const read = await handle(handlers, 'GET_CURRENT_COURSE');
  assert.equal(read.data.course.nodes.length, 2, 'injected node must not appear');
  assert.equal(read.data.course.nodes[0].display.title, '能力词还需要证据');
});

test('SAVE_CURRENT_COURSE rejects an invalid course and leaves storage untouched', async () => {
  const { handlers, chromeStorage } = setup();
  await handle(handlers, 'SAVE_CURRENT_COURSE', { course: course() });
  const before = chromeStorage.peek();

  const result = await handle(handlers, 'SAVE_CURRENT_COURSE', { course: course({ schemaVersion: 99 }) });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, protocol.ERROR_CODES.INVALID_COURSE);
  assert.deepEqual(chromeStorage.peek(), before, 'a rejected save must not modify storage');
});

test('SAVE_CURRENT_COURSE validates even though the message came from inside the extension', async () => {
  // A-BRIDGE-02: the background does not trust the content script. Every rejection
  // the shared contract makes must also apply here.
  const { handlers } = setup();
  for (const invalid of [
    course({ nodes: [] }),
    course({ captions: [] }),
    course({ courseId: 'bilibili:BV1Other00000' }),
    course({ updatedAt: '2026-08-15' }),
    {},
    null
  ]) {
    const result = await handle(handlers, 'SAVE_CURRENT_COURSE', { course: invalid });
    assert.equal(result.ok, false, `${JSON.stringify(invalid)?.slice(0, 40)} must be rejected`);
    assert.equal(result.error.code, protocol.ERROR_CODES.INVALID_COURSE);
  }
});

test('SAVE_CURRENT_COURSE does not normalize on the extension side', async () => {
  // D-011: the write path normalizes before validating; the extension only
  // validates. Sorting here would silently accept a course the page considered
  // invalid, and the two sides would no longer agree on what is storable.
  const { handlers } = setup();
  const outOfOrder = course();
  outOfOrder.nodes.reverse();

  const result = await handle(handlers, 'SAVE_CURRENT_COURSE', { course: outOfOrder });

  assert.equal(result.ok, false, 'out-of-order nodes must be rejected, not sorted');
  assert.equal(result.error.code, protocol.ERROR_CODES.INVALID_COURSE);
});

test('an invalid course error names no course prose', async () => {
  const { handlers } = setup();
  const secret = 'I finished the client deck before the deadline.';
  const invalid = course();
  invalid.nodes[1].display.options = [{ id: 'a', label: secret }];

  const result = await handle(handlers, 'SAVE_CURRENT_COURSE', { course: invalid });

  assert.equal(result.ok, false);
  assert.ok(!JSON.stringify(result).includes(secret), 'error must not echo course prose');
});

test('reading re-validates stored data so corruption cannot reach the runtime', async () => {
  // A-STORAGE-01. Storage can hold data written by an older build or edited by
  // hand; trusting it because "we wrote it" is how bad state reaches the learner.
  const { handlers, chromeStorage } = setup();
  chromeStorage.seed({ currentCourse: { schemaVersion: 1, courseId: COURSE_ID, nodes: 'not-an-array' } });

  const result = await handle(handlers, 'GET_CURRENT_COURSE');

  assert.equal(result.ok, false);
  assert.equal(result.error.code, protocol.ERROR_CODES.INVALID_COURSE);
  assert.ok(!Object.hasOwn(result, 'data'), 'corrupt data must not be returned');
});

test('CLEAR_CURRENT_COURSE removes the course and its preview session', async () => {
  // A-STORAGE-02: a session outliving its course would point at a course that is
  // no longer there.
  const { handlers, chromeStorage } = setup();
  await handle(handlers, 'SAVE_CURRENT_COURSE', { course: course() });
  await handle(handlers, 'START_PREVIEW_SESSION', { courseId: COURSE_ID });
  assert.ok(Object.hasOwn(chromeStorage.peek(), 'activePreviewSession'), 'precondition: session exists');

  const result = await handle(handlers, 'CLEAR_CURRENT_COURSE', { expectedCourseId: COURSE_ID });

  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { cleared: true });
  assert.deepEqual(chromeStorage.peek(), {}, 'both keys must be gone');
});

test('CLEAR_CURRENT_COURSE is idempotent when no course is stored', async () => {
  const { handlers } = setup();
  const result = await handle(handlers, 'CLEAR_CURRENT_COURSE', { expectedCourseId: COURSE_ID });

  assert.equal(result.ok, true, 'clearing nothing is success, not an error');
  assert.deepEqual(result.data, { cleared: true });
});

test('CLEAR_CURRENT_COURSE refuses a mismatched id and keeps the existing course', async () => {
  // The guard exists because the workspace holds one course at a time: without it,
  // a stale page could delete a course the teacher configured afterwards.
  const { handlers, chromeStorage } = setup();
  await handle(handlers, 'SAVE_CURRENT_COURSE', { course: course() });
  const before = chromeStorage.peek();

  const result = await handle(handlers, 'CLEAR_CURRENT_COURSE', { expectedCourseId: 'bilibili:BV1Other00000' });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, protocol.ERROR_CODES.COURSE_MISMATCH);
  assert.deepEqual(chromeStorage.peek(), before, 'the stored course must survive');
});

test('a mismatched clear leaves an existing preview session alone', async () => {
  const { handlers, chromeStorage } = setup();
  await handle(handlers, 'SAVE_CURRENT_COURSE', { course: course() });
  await handle(handlers, 'START_PREVIEW_SESSION', { courseId: COURSE_ID });
  const before = chromeStorage.peek();

  await handle(handlers, 'CLEAR_CURRENT_COURSE', { expectedCourseId: 'bilibili:BV1Other00000' });

  assert.deepEqual(chromeStorage.peek(), before);
});

test('START_PREVIEW_SESSION binds the session to the course id and updatedAt', async () => {
  // courseUpdatedAt distinguishes two saves of the same course without building a
  // version system: a session from before the last save can be recognised as stale.
  const { handlers } = setup();
  await handle(handlers, 'SAVE_CURRENT_COURSE', { course: course() });

  const result = await handle(handlers, 'START_PREVIEW_SESSION', { courseId: COURSE_ID });

  assert.equal(result.ok, true);
  assert.equal(result.data.sessionId, 'session-550e8400-e29b-41d4-a716-446655440000');
  assert.equal(result.data.startedAt, UPDATED_AT);

  const stored = await handlers.readPreviewSession();
  assert.equal(stored.courseId, COURSE_ID);
  assert.equal(stored.courseUpdatedAt, UPDATED_AT);
  assert.equal(stored.schemaVersion, 1);
});

test('a new preview session initialises every node as pending', async () => {
  const { handlers } = setup();
  await handle(handlers, 'SAVE_CURRENT_COURSE', { course: course() });
  await handle(handlers, 'START_PREVIEW_SESSION', { courseId: COURSE_ID });

  const stored = await handlers.readPreviewSession();
  assert.deepEqual(Object.keys(stored.nodeStates), ['node-1', 'node-2']);
  for (const state of Object.values(stored.nodeStates)) {
    assert.deepEqual(state, { status: 'pending', attempts: 0, answer: null });
  }
});

test('a new preview session replaces the old one without keeping history', async () => {
  // D-004: one current course, one active session. History would be a version
  // system, which stage one explicitly does not build.
  let sessionCounter = 0;
  const chromeStorage = fakeChromeStorage();
  const handlers = createOperationHandlers({
    storage: createStorage(chromeStorage.local),
    extensionVersion: '0.7.0',
    createSessionId: () => `session-550e8400-e29b-41d4-a716-44665544000${sessionCounter++}`,
    now: () => UPDATED_AT
  });

  await handlers.handle({ type: 'SAVE_CURRENT_COURSE', payload: { course: course() } });
  const first = await handlers.handle({ type: 'START_PREVIEW_SESSION', payload: { courseId: COURSE_ID } });
  const second = await handlers.handle({ type: 'START_PREVIEW_SESSION', payload: { courseId: COURSE_ID } });

  assert.notEqual(first.data.sessionId, second.data.sessionId);
  const stored = await handlers.readPreviewSession();
  assert.equal(stored.sessionId, second.data.sessionId, 'only the newest session remains');
});

test('START_PREVIEW_SESSION refuses when no course is stored', async () => {
  const { handlers, chromeStorage } = setup();
  const result = await handle(handlers, 'START_PREVIEW_SESSION', { courseId: COURSE_ID });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, protocol.ERROR_CODES.COURSE_MISMATCH);
  assert.deepEqual(chromeStorage.peek(), {}, 'no session may be created');
});

test('START_PREVIEW_SESSION refuses a courseId that is not the stored course', async () => {
  const { handlers, chromeStorage } = setup();
  await handle(handlers, 'SAVE_CURRENT_COURSE', { course: course() });
  const before = chromeStorage.peek();

  const result = await handle(handlers, 'START_PREVIEW_SESSION', { courseId: 'bilibili:BV1Other00000' });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, protocol.ERROR_CODES.COURSE_MISMATCH);
  assert.deepEqual(chromeStorage.peek(), before);
});

test('START_PREVIEW_SESSION refuses to build a session on top of corrupt stored data', async () => {
  const { handlers } = setup();
  const chromeStorage = fakeChromeStorage({ currentCourse: { schemaVersion: 1, courseId: COURSE_ID, nodes: [] } });
  const corruptHandlers = createOperationHandlers({
    storage: createStorage(chromeStorage.local),
    extensionVersion: '0.7.0',
    createSessionId: () => 'session-550e8400-e29b-41d4-a716-446655440000',
    now: () => UPDATED_AT
  });

  const result = await corruptHandlers.handle({ type: 'START_PREVIEW_SESSION', payload: { courseId: COURSE_ID } });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, protocol.ERROR_CODES.INVALID_COURSE);
  assert.ok(!Object.hasOwn(chromeStorage.peek(), 'activePreviewSession'));
  void handlers;
});

test('a storage write failure is reported instead of being swallowed', async () => {
  // A-BRIDGE-04 and the "no fake success" rule: the page may only show success
  // after the background actually persisted the course.
  const { handlers, chromeStorage } = setup();
  chromeStorage.state.failSet = true;

  const result = await handle(handlers, 'SAVE_CURRENT_COURSE', { course: course() });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, protocol.ERROR_CODES.STORAGE_FAILURE);
});

test('a storage read failure is reported as STORAGE_FAILURE, not as a missing course', async () => {
  // Returning `course: null` here would tell the teacher their course was gone and
  // invite them to redo the work, when the read simply failed.
  const { handlers, chromeStorage } = setup();
  chromeStorage.state.failGet = true;

  const result = await handle(handlers, 'GET_CURRENT_COURSE');

  assert.equal(result.ok, false);
  assert.equal(result.error.code, protocol.ERROR_CODES.STORAGE_FAILURE);
});

test('a failed remove during clear is reported rather than claimed as cleared', async () => {
  const { handlers, chromeStorage } = setup();
  await handle(handlers, 'SAVE_CURRENT_COURSE', { course: course() });
  chromeStorage.state.failRemove = true;

  const result = await handle(handlers, 'CLEAR_CURRENT_COURSE', { expectedCourseId: COURSE_ID });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, protocol.ERROR_CODES.STORAGE_FAILURE);
});

test('storage errors carry no internal paths or stack traces', async () => {
  // A-ERR-01: user-facing status must not expose internals.
  const { handlers, chromeStorage } = setup();
  chromeStorage.state.failSet = true;

  const result = await handle(handlers, 'SAVE_CURRENT_COURSE', { course: course() });
  const serialized = JSON.stringify(result);

  assert.ok(!serialized.includes('simulated set failure'), 'raw error text must not leak');
  assert.ok(!/\/Users\/|storage\.js|at /.test(serialized), 'no paths or stack frames');
});

test('an unknown operation reaching the handler is refused', async () => {
  // The protocol layer already rejects unknown types; this is the second line, so a
  // future caller that skips validation cannot reach storage.
  const { handlers, chromeStorage } = setup();
  const result = await handle(handlers, 'DELETE_EVERYTHING');

  assert.equal(result.ok, false);
  assert.equal(result.error.code, protocol.ERROR_CODES.UNKNOWN_OPERATION);
  assert.deepEqual(chromeStorage.peek(), {});
});

test('storage uses the exact keys named in the data spec', async () => {
  const { handlers, chromeStorage } = setup();
  await handle(handlers, 'SAVE_CURRENT_COURSE', { course: course() });
  await handle(handlers, 'START_PREVIEW_SESSION', { courseId: COURSE_ID });

  assert.deepEqual(Object.keys(chromeStorage.peek()).sort(), ['activePreviewSession', 'currentCourse']);
});

test('the manifest grants the storage permission the handlers depend on', () => {
  // Without it chrome.storage.local is undefined and every operation fails only at
  // runtime, in a way no Node test using an injected adapter would catch.
  const manifest = JSON.parse(require('node:fs').readFileSync('src/manifest.json', 'utf8'));
  assert.ok(
    Array.isArray(manifest.permissions) && manifest.permissions.includes('storage'),
    'manifest.permissions must include storage'
  );
});

test('saving replaces the whole course rather than merging fields', async () => {
  // A-STORAGE-01: whole-object replacement. A merge would leave nodes from a
  // previous course behind and produce a course no page ever authored.
  const { handlers } = setup();
  await handle(handlers, 'SAVE_CURRENT_COURSE', { course: course() });

  const replacement = course({
    nodes: [course().nodes[0]],
    updatedAt: '2026-08-16T00:00:00.000Z'
  });
  await handle(handlers, 'SAVE_CURRENT_COURSE', { course: replacement });

  const read = await handle(handlers, 'GET_CURRENT_COURSE');
  assert.deepEqual(read.data.course, replacement);
});
