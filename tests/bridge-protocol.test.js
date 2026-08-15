/**
 * Stage 1A message protocol and origin whitelist.
 * Run: node --test tests/bridge-protocol.test.js
 *
 * The protocol is validated three times on the way in (page, content script,
 * background) per A-BRIDGE-02, so all three call this one module. Constants live
 * here only; a second definition would let the layers drift apart and defeat the
 * point of validating repeatedly.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const protocol = require('../src/shared/bridge-protocol.js');
const origins = require('../src/shared/workspace-origins.js');

const REQUEST_ID = 'req-550e8400-e29b-41d4-a716-446655440000';
const COURSE_ID = 'bilibili:BV1WW4y1e7GL';

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

function minimalCourse() {
  return {
    schemaVersion: 1,
    courseId: COURSE_ID,
    videoRef: { platform: 'bilibili', videoId: 'BV1WW4y1e7GL' },
    nodes: [{
      id: 'node-1',
      enabled: true,
      family: 'attention',
      interaction: 'notice',
      trigger: { kind: 'time_cross', timeSeconds: 39, captionId: null },
      display: { title: 't', body: 'b' },
      evaluation: null,
      effects: { pause: true }
    }],
    updatedAt: '2026-08-15T00:00:00.000Z'
  };
}

function expectRequestRejected(input, expectedCode, label) {
  const result = protocol.validateRequest(input);
  assert.equal(result.ok, false, `${label}: expected rejection`);
  assert.equal(result.error.code, expectedCode, `${label}: wrong error code`);
  return result;
}

test('accepts all five open operations with their legal payloads', () => {
  const legal = [
    ['PING', {}],
    ['GET_CURRENT_COURSE', {}],
    ['SAVE_CURRENT_COURSE', { course: minimalCourse() }],
    ['CLEAR_CURRENT_COURSE', { expectedCourseId: COURSE_ID }],
    ['START_PREVIEW_SESSION', { courseId: COURSE_ID }]
  ];
  assert.equal(legal.length, protocol.OPERATIONS.length, 'test must cover every open operation');

  for (const [type, payload] of legal) {
    const result = protocol.validateRequest(request({ type, payload }));
    assert.equal(result.ok, true, `${type}: ${JSON.stringify(result.error)}`);
  }
});

test('treats a foreign channel as not addressed to this bridge', () => {
  // D-011: a mismatched channel must be dropped in silence. Other scripts on the
  // workspace page also postMessage; answering them with an error code would let
  // any third-party script probe whether the extension is installed.
  for (const channel of ['other.channel.v1', 'lessonpilot.extension.v1', '', undefined, 42]) {
    const result = protocol.validateRequest(request({ channel }));
    assert.equal(result.ok, false, `channel ${String(channel)} must not pass`);
    assert.equal(result.drop, true, `channel ${String(channel)} must be dropped silently`);
    assert.equal(result.error, undefined, 'a dropped message must carry no error to return');
  }
});

test('answers a matching channel with a bad version, rather than dropping it', () => {
  // The sender is speaking our protocol, so it deserves a diagnosable answer.
  for (const protocolVersion of [0, 2, 99, '1', null, undefined]) {
    const result = expectRequestRejected(
      request({ protocolVersion }),
      protocol.ERROR_CODES.UNSUPPORTED_VERSION,
      `version ${String(protocolVersion)}`
    );
    assert.notEqual(result.drop, true, 'a version error must be answered, not dropped');
  }
});

test('rejects operations outside the five that stage 1A opens', () => {
  for (const type of ['DELETE_ALL', 'ping', 'PING ', 'SAVE_DRAFT', '', null, undefined]) {
    expectRequestRejected(
      request({ type }),
      protocol.ERROR_CODES.UNKNOWN_OPERATION,
      `type ${String(type)}`
    );
  }
});

test('rejects a missing or malformed requestId', () => {
  // requestId pairs a response to its request; without a well-formed one the page
  // cannot tell which reply belongs to which call.
  for (const requestId of [
    undefined,
    '',
    'req-not-a-uuid',
    '550e8400-e29b-41d4-a716-446655440000',
    `req-${'0'.repeat(40)}`,
    'req-550E8400-E29B-41D4-A716-446655440000',
    42,
    null
  ]) {
    expectRequestRejected(
      request({ requestId }),
      protocol.ERROR_CODES.INVALID_REQUEST,
      `requestId ${String(requestId)}`
    );
  }
});

test('rejects unknown envelope fields', () => {
  expectRequestRejected(
    request({ extensionId: 'abc' }),
    protocol.ERROR_CODES.INVALID_REQUEST,
    'unknown envelope field'
  );
});

test('rejects non-object requests without throwing', () => {
  for (const input of [null, undefined, 'PING', 42, [], true]) {
    const result = protocol.validateRequest(input);
    assert.equal(result.ok, false, `input ${String(input)} must not pass`);
    assert.equal(result.drop, true, 'a non-envelope must be dropped, not answered');
  }
});

test('rejects a payload whose shape does not match its operation', () => {
  const mismatches = [
    ['PING', { course: minimalCourse() }, 'PING with course'],
    ['GET_CURRENT_COURSE', { courseId: COURSE_ID }, 'GET with courseId'],
    ['SAVE_CURRENT_COURSE', {}, 'SAVE without course'],
    ['SAVE_CURRENT_COURSE', { course: minimalCourse(), force: true }, 'SAVE with extra field'],
    ['CLEAR_CURRENT_COURSE', {}, 'CLEAR without expectedCourseId'],
    ['CLEAR_CURRENT_COURSE', { courseId: COURSE_ID }, 'CLEAR with wrong key'],
    ['START_PREVIEW_SESSION', {}, 'START without courseId'],
    ['START_PREVIEW_SESSION', { expectedCourseId: COURSE_ID }, 'START with wrong key']
  ];
  for (const [type, payload, label] of mismatches) {
    expectRequestRejected(request({ type, payload }), protocol.ERROR_CODES.INVALID_REQUEST, label);
  }
});

test('rejects a missing or non-object payload', () => {
  for (const payload of [undefined, null, 'course', 42, []]) {
    expectRequestRejected(
      request({ payload }),
      protocol.ERROR_CODES.INVALID_REQUEST,
      `payload ${String(payload)}`
    );
  }
});

test('rejects malformed course ids in payloads before storage is touched', () => {
  for (const courseId of ['', '   ', 'BV1WW4y1e7GL', 'a'.repeat(200), 42, null]) {
    expectRequestRejected(
      request({ type: 'CLEAR_CURRENT_COURSE', payload: { expectedCourseId: courseId } }),
      protocol.ERROR_CODES.INVALID_REQUEST,
      `expectedCourseId ${String(courseId)}`
    );
    expectRequestRejected(
      request({ type: 'START_PREVIEW_SESSION', payload: { courseId } }),
      protocol.ERROR_CODES.INVALID_REQUEST,
      `courseId ${String(courseId)}`
    );
  }
});

test('does not validate the course schema at the protocol layer', () => {
  // The protocol layer checks the envelope; the course schema is checked by the
  // background against the shared contract. Keeping these apart means an invalid
  // course yields INVALID_COURSE, not INVALID_REQUEST, so the teacher-facing
  // message can point at the actual problem.
  const result = protocol.validateRequest(
    request({ type: 'SAVE_CURRENT_COURSE', payload: { course: { schemaVersion: 99 } } })
  );
  assert.equal(result.ok, true, 'envelope is well formed even when the course is not');
});

test('builds success and failure responses that echo the requestId', () => {
  const success = protocol.buildSuccessResponse(REQUEST_ID, { extensionVersion: '0.7.0' });
  assert.equal(success.channel, protocol.RESPONSE_CHANNEL);
  assert.equal(success.protocolVersion, protocol.PROTOCOL_VERSION);
  assert.equal(success.requestId, REQUEST_ID);
  assert.equal(success.ok, true);
  assert.deepEqual(success.data, { extensionVersion: '0.7.0' });
  assert.ok(!Object.hasOwn(success, 'error'), 'a success must not carry error');

  const failure = protocol.buildErrorResponse(REQUEST_ID, protocol.ERROR_CODES.INVALID_COURSE, '课程配置未通过校验。');
  assert.equal(failure.ok, false);
  assert.equal(failure.error.code, protocol.ERROR_CODES.INVALID_COURSE);
  assert.ok(!Object.hasOwn(failure, 'data'), 'a failure must not carry data');
});

test('requests and responses use different channels, so a reply cannot re-enter as a request', () => {
  assert.notEqual(protocol.REQUEST_CHANNEL, protocol.RESPONSE_CHANNEL);
  const response = protocol.buildSuccessResponse(REQUEST_ID, {});
  const asRequest = protocol.validateRequest({ ...response, type: 'PING', payload: {} });
  assert.equal(asRequest.ok, false, 'a response envelope must not validate as a request');
});

test('rejects responses whose ok flag and body disagree', () => {
  const base = { channel: protocol.RESPONSE_CHANNEL, protocolVersion: protocol.PROTOCOL_VERSION, requestId: REQUEST_ID };
  const bad = [
    [{ ...base, ok: true }, 'success without data'],
    [{ ...base, ok: true, data: {}, error: { code: 'X', message: 'm' } }, 'success with error'],
    [{ ...base, ok: false }, 'failure without error'],
    [{ ...base, ok: false, data: {}, error: { code: 'STORAGE_FAILURE', message: 'm' } }, 'failure with data'],
    [{ ...base, ok: false, error: { code: 'NOT_A_REAL_CODE', message: 'm' } }, 'failure with unknown code'],
    [{ ...base, ok: 'true', data: {} }, 'ok not boolean'],
    [{ ...base, ok: true, data: {}, extra: 1 }, 'unknown response field']
  ];
  for (const [response, label] of bad) {
    assert.equal(protocol.validateResponse(response).ok, false, `${label} must be rejected`);
  }
  assert.equal(protocol.validateResponse({ ...base, ok: true, data: {} }).ok, true, 'well-formed success');
});

test('matchesRequest pairs a response only when channel, version and id all agree', () => {
  const response = protocol.buildSuccessResponse(REQUEST_ID, {});
  assert.equal(protocol.matchesRequest(response, REQUEST_ID), true);

  const otherId = 'req-550e8400-e29b-41d4-a716-446655440001';
  assert.equal(protocol.matchesRequest(response, otherId), false, 'different requestId');
  assert.equal(
    protocol.matchesRequest({ ...response, channel: protocol.REQUEST_CHANNEL }, REQUEST_ID),
    false,
    'request channel'
  );
  assert.equal(
    protocol.matchesRequest({ ...response, protocolVersion: 2 }, REQUEST_ID),
    false,
    'different version'
  );
  for (const input of [null, undefined, 'response', 42]) {
    assert.equal(protocol.matchesRequest(input, REQUEST_ID), false, `input ${String(input)}`);
  }
});

test('generates request ids that satisfy the protocol format', () => {
  const first = protocol.createRequestId();
  const second = protocol.createRequestId();
  assert.notEqual(first, second, 'ids must be unique per request');
  for (const id of [first, second]) {
    assert.equal(
      protocol.validateRequest(request({ requestId: id })).ok,
      true,
      `generated id ${id} must pass validation`
    );
  }
});

test('accepts only the exact public and local workspace origins', () => {
  assert.equal(origins.isAllowedOrigin('https://xiaobaiworld.github.io'), true);
  assert.equal(origins.isAllowedOrigin('http://localhost:4173'), true);

  for (const origin of [
    'http://xiaobaiworld.github.io',
    'https://xiaobaiworld.github.io.evil.com',
    'https://evil.xiaobaiworld.github.io',
    'https://xiaobaiworld.github.io:8443',
    'http://localhost',
    'http://localhost:8080',
    'http://127.0.0.1:4173',
    'https://localhost:4173',
    '',
    null
  ]) {
    assert.equal(origins.isAllowedOrigin(origin), false, `origin ${String(origin)} must be refused`);
  }
});

test('accepts only the exact workspace pathnames, refusing prefix and suffix tricks', () => {
  assert.equal(origins.isAllowedPathname('https://xiaobaiworld.github.io', '/lessonpilot/teacher-web/workspace.html'), true);
  assert.equal(origins.isAllowedPathname('http://localhost:4173', '/teacher-web/workspace.html'), true);

  for (const [origin, pathname] of [
    ['https://xiaobaiworld.github.io', '/teacher-web/workspace.html'],
    ['http://localhost:4173', '/lessonpilot/teacher-web/workspace.html'],
    ['https://xiaobaiworld.github.io', '/lessonpilot/teacher-web/workspace.htmlx'],
    ['https://xiaobaiworld.github.io', '/lessonpilot/teacher-web/workspace.html.evil'],
    ['https://xiaobaiworld.github.io', '/lessonpilot/teacher-web/workspace.html/sub'],
    ['https://xiaobaiworld.github.io', '/evil/lessonpilot/teacher-web/workspace.html'],
    ['https://xiaobaiworld.github.io', '/lessonpilot/teacher-web/'],
    ['https://xiaobaiworld.github.io', ''],
    ['https://xiaobaiworld.github.io', null]
  ]) {
    assert.equal(
      origins.isAllowedPathname(origin, pathname),
      false,
      `${origin}${String(pathname)} must be refused`
    );
  }
});

test('isAllowedWorkspace requires the origin and pathname to belong to the same entry', () => {
  // The public path is /lessonpilot/... and the local path is not; crossing them
  // must fail even though each half is individually on the list.
  assert.equal(
    origins.isAllowedWorkspace('https://xiaobaiworld.github.io', '/lessonpilot/teacher-web/workspace.html'),
    true
  );
  assert.equal(
    origins.isAllowedWorkspace('https://xiaobaiworld.github.io', '/teacher-web/workspace.html'),
    false,
    'public origin with local path'
  );
  assert.equal(
    origins.isAllowedWorkspace('http://localhost:4173', '/lessonpilot/teacher-web/workspace.html'),
    false,
    'local origin with public path'
  );
});

// The manifest-covers-the-whitelist assertion lives in tests/workspace-bridge.test.js,
// alongside the content script registration it constrains.

test('protocol constants and origins are each defined in exactly one place', () => {
  // Three layers validate the same envelope; two copies of a constant would let
  // them disagree while every individual check still looks correct.
  const sources = [
    'src/shared/course-contract.js',
    'src/shared/bridge-protocol.js',
    'src/shared/workspace-origins.js',
    'src/content/workspace-bridge.js',
    'src/background/service-worker.js',
    'src/background/storage.js',
    'teacher-web/workspace-bridge-client.js'
  ].filter((file) => fs.existsSync(file));

  const literals = [
    ["'lessonpilot.workspace.v1'", 'src/shared/bridge-protocol.js'],
    ["'lessonpilot.extension.v1'", 'src/shared/bridge-protocol.js'],
    ["'https://xiaobaiworld.github.io'", 'src/shared/workspace-origins.js'],
    ["'http://localhost:4173'", 'src/shared/workspace-origins.js']
  ];

  for (const [literal, owner] of literals) {
    const holders = sources.filter((file) => fs.readFileSync(file, 'utf8').includes(literal));
    assert.deepEqual(holders, [owner], `${literal} must only be defined in ${owner}`);
  }
});

test('exposes the closed error code set from data-spec', () => {
  assert.deepEqual(
    Object.keys(protocol.ERROR_CODES).sort(),
    [
      'COURSE_MISMATCH',
      'EXTENSION_UNAVAILABLE',
      'INVALID_CHANNEL',
      'INVALID_COURSE',
      'INVALID_REQUEST',
      'STORAGE_FAILURE',
      'UNKNOWN_OPERATION',
      'UNSUPPORTED_VERSION'
    ]
  );
  assert.equal(protocol.RESPONSE_TIMEOUT_MS, 3000);
});
