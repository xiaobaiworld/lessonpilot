/**
 * The versioned request/response protocol between the workspace page and the
 * extension (doc/data-spec.md section 10).
 *
 * Validated three times on the way in — page, content script, background — per
 * A-BRIDGE-02. The background does not trust the content script simply because the
 * message arrived over an extension-internal channel. All three layers call this
 * module, so the constants exist exactly once; a second copy would let the layers
 * disagree and turn defence-in-depth into three chances to be inconsistent.
 *
 * This layer checks the envelope only. Course schema validation belongs to
 * course-contract.js, so an invalid course reports INVALID_COURSE rather than
 * INVALID_REQUEST and the teacher-facing message can name the real problem.
 */
(function initBridgeProtocol(global, factory) {
  const api = factory();
  global.LessonPilotBridgeProtocol = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof self !== 'undefined' ? self : globalThis, function createBridgeProtocol() {
  const PROTOCOL_VERSION = 1;
  const REQUEST_CHANNEL = 'lessonpilot.workspace.v1';
  const RESPONSE_CHANNEL = 'lessonpilot.extension.v1';
  const RESPONSE_TIMEOUT_MS = 3000;

  const MAX_COURSE_ID_LENGTH = 120;
  const REQUEST_ID_PATTERN = /^req-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  const ERROR_CODES = {
    INVALID_CHANNEL: 'INVALID_CHANNEL',
    UNSUPPORTED_VERSION: 'UNSUPPORTED_VERSION',
    UNKNOWN_OPERATION: 'UNKNOWN_OPERATION',
    INVALID_REQUEST: 'INVALID_REQUEST',
    INVALID_COURSE: 'INVALID_COURSE',
    COURSE_MISMATCH: 'COURSE_MISMATCH',
    STORAGE_FAILURE: 'STORAGE_FAILURE',
    EXTENSION_UNAVAILABLE: 'EXTENSION_UNAVAILABLE'
  };

  /**
   * The five operations stage 1A opens, with the exact payload keys each accepts.
   * Anything else is refused: an unknown operation must never fall through to a
   * default that touches storage.
   */
  const OPERATION_PAYLOADS = {
    PING: { required: [], optional: [] },
    GET_CURRENT_COURSE: { required: [], optional: [] },
    SAVE_CURRENT_COURSE: { required: ['course'], optional: [] },
    CLEAR_CURRENT_COURSE: { required: ['expectedCourseId'], optional: [] },
    START_PREVIEW_SESSION: { required: ['courseId'], optional: [] }
  };

  const OPERATIONS = Object.keys(OPERATION_PAYLOADS);
  const ENVELOPE_FIELDS = ['channel', 'protocolVersion', 'requestId', 'type', 'payload'];
  const RESPONSE_FIELDS = ['channel', 'protocolVersion', 'requestId', 'ok', 'data', 'error'];

  function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  function isValidCourseId(value) {
    return typeof value === 'string'
      && value.trim() === value
      && value.length > 0
      && value.length <= MAX_COURSE_ID_LENGTH
      && value.includes(':');
  }

  /** Silently ignored: the message was not addressed to this bridge. */
  function dropped() {
    return { ok: false, drop: true };
  }

  function rejected(code) {
    return { ok: false, error: { code } };
  }

  /**
   * Validate an inbound request envelope.
   *
   * Returns `{ ok: true, request }`, or `{ ok: false, drop: true }` when the
   * message is not ours, or `{ ok: false, error: { code } }` when it is ours but
   * malformed.
   *
   * The drop/reject split matters for security, not just tidiness. The workspace
   * page carries other scripts, all of which can postMessage. Replying to a
   * foreign message — even with an error — tells any third-party script that the
   * extension is installed. So a wrong channel is silence, while a correct channel
   * with a bad version gets a diagnosable answer (D-011).
   */
  function validateRequest(message) {
    if (!isPlainObject(message)) return dropped();
    if (message.channel !== REQUEST_CHANNEL) return dropped();

    // From here the sender is speaking our protocol and deserves an answer.
    if (message.protocolVersion !== PROTOCOL_VERSION) {
      return rejected(ERROR_CODES.UNSUPPORTED_VERSION);
    }
    for (const key of Object.keys(message)) {
      if (!ENVELOPE_FIELDS.includes(key)) return rejected(ERROR_CODES.INVALID_REQUEST);
    }
    if (typeof message.requestId !== 'string' || !REQUEST_ID_PATTERN.test(message.requestId)) {
      return rejected(ERROR_CODES.INVALID_REQUEST);
    }
    if (typeof message.type !== 'string' || !Object.hasOwn(OPERATION_PAYLOADS, message.type)) {
      return rejected(ERROR_CODES.UNKNOWN_OPERATION);
    }
    if (!isPlainObject(message.payload)) return rejected(ERROR_CODES.INVALID_REQUEST);

    const spec = OPERATION_PAYLOADS[message.type];
    const allowed = [...spec.required, ...spec.optional];
    for (const key of Object.keys(message.payload)) {
      if (!allowed.includes(key)) return rejected(ERROR_CODES.INVALID_REQUEST);
    }
    for (const key of spec.required) {
      if (!Object.hasOwn(message.payload, key)) return rejected(ERROR_CODES.INVALID_REQUEST);
    }

    // Course ids are checked here because they select which stored object an
    // operation acts on; a malformed id must not reach storage at all. The course
    // body itself is left to course-contract.js.
    if (message.type === 'CLEAR_CURRENT_COURSE' && !isValidCourseId(message.payload.expectedCourseId)) {
      return rejected(ERROR_CODES.INVALID_REQUEST);
    }
    if (message.type === 'START_PREVIEW_SESSION' && !isValidCourseId(message.payload.courseId)) {
      return rejected(ERROR_CODES.INVALID_REQUEST);
    }
    if (message.type === 'SAVE_CURRENT_COURSE' && !isPlainObject(message.payload.course)) {
      return rejected(ERROR_CODES.INVALID_REQUEST);
    }

    return { ok: true, request: message };
  }

  function buildSuccessResponse(requestId, data) {
    return {
      channel: RESPONSE_CHANNEL,
      protocolVersion: PROTOCOL_VERSION,
      requestId,
      ok: true,
      data: data ?? {}
    };
  }

  function buildErrorResponse(requestId, code, message) {
    return {
      channel: RESPONSE_CHANNEL,
      protocolVersion: PROTOCOL_VERSION,
      requestId,
      ok: false,
      error: { code, message }
    };
  }

  /** Success and failure are mutually exclusive: exactly one of data/error. */
  function validateResponse(response) {
    if (!isPlainObject(response)) return { ok: false };
    if (response.channel !== RESPONSE_CHANNEL) return { ok: false };
    if (response.protocolVersion !== PROTOCOL_VERSION) return { ok: false };
    if (typeof response.requestId !== 'string' || !REQUEST_ID_PATTERN.test(response.requestId)) {
      return { ok: false };
    }
    for (const key of Object.keys(response)) {
      if (!RESPONSE_FIELDS.includes(key)) return { ok: false };
    }
    if (typeof response.ok !== 'boolean') return { ok: false };

    if (response.ok) {
      if (!isPlainObject(response.data)) return { ok: false };
      if (Object.hasOwn(response, 'error')) return { ok: false };
      return { ok: true };
    }

    if (Object.hasOwn(response, 'data')) return { ok: false };
    if (!isPlainObject(response.error)) return { ok: false };
    if (!Object.hasOwn(ERROR_CODES, response.error.code)) return { ok: false };
    return { ok: true };
  }

  /**
   * Whether this response answers this specific request. The page must not accept a
   * reply on channel or version alone, or a stale response could be shown as the
   * result of the current save.
   */
  function matchesRequest(response, requestId) {
    if (!isPlainObject(response)) return false;
    return response.channel === RESPONSE_CHANNEL
      && response.protocolVersion === PROTOCOL_VERSION
      && response.requestId === requestId;
  }

  function createRequestId() {
    return `req-${crypto.randomUUID()}`;
  }

  return {
    PROTOCOL_VERSION,
    REQUEST_CHANNEL,
    RESPONSE_CHANNEL,
    RESPONSE_TIMEOUT_MS,
    REQUEST_ID_PATTERN,
    ERROR_CODES,
    OPERATIONS,
    OPERATION_PAYLOADS,
    isValidCourseId,
    validateRequest,
    validateResponse,
    matchesRequest,
    buildSuccessResponse,
    buildErrorResponse,
    createRequestId
  };
});
