/**
 * The single course contract shared by the workspace page and the extension
 * background (A-DATA-01). Loaded in Node tests via require, in the page via a
 * plain script tag, and in the service worker via importScripts.
 *
 * Two rules shape everything here:
 *
 * 1. The schema is closed. Unknown fields are rejected rather than ignored, so a
 *    field added on the web side cannot silently reach an extension that does not
 *    understand it. This also means the validator never walks arbitrary input, so
 *    functions, DOM nodes and circular references are rejected by the field
 *    whitelist rather than by a separate traversal.
 * 2. Semantic errors are reported, never repaired. normalizeCourse fixes only
 *    representation (node order, derived courseId); validateCourse reports and
 *    stops. Rules that cannot run on both sides are listed in
 *    doc/data-spec.md section 13 (see D-011) and belong to the layer named there.
 *
 * Errors carry a stable code and a field path only. They must never echo course
 * prose: these objects reach debug logs and the diagnostics page, and A-SEC-01
 * forbids logging question text, captions or answers.
 */
(function initCourseContract(global, factory) {
  const api = factory();
  global.LessonPilotCourseContract = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof self !== 'undefined' ? self : globalThis, function createCourseContract() {
  const SCHEMA_VERSION = 1;
  const PLATFORMS = ['bilibili'];
  const TRIGGER_KINDS = ['time_cross'];
  const BLANK_NORMALIZE = ['trim', 'casefold'];
  const MAX_ID_LENGTH = 80;

  const BVID_PATTERN = /^BV[a-zA-Z0-9]+$/;
  const ID_PATTERN = /^[\x20-\x7E]+$/;
  const UTC_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  const LEGAL_NODE_COMBINATIONS = [
    { family: 'attention', interaction: 'notice' },
    { family: 'practice', interaction: 'choice' },
    { family: 'practice', interaction: 'blank' },
    { family: 'followup', interaction: 'free_text' }
  ];

  const ERROR_CODES = {
    INVALID_TYPE: 'INVALID_TYPE',
    MISSING_FIELD: 'MISSING_FIELD',
    UNKNOWN_FIELD: 'UNKNOWN_FIELD',
    INVALID_VALUE: 'INVALID_VALUE',
    INVALID_ENUM: 'INVALID_ENUM',
    INVALID_COMBINATION: 'INVALID_COMBINATION',
    DUPLICATE_ID: 'DUPLICATE_ID',
    EMPTY_COLLECTION: 'EMPTY_COLLECTION',
    OUT_OF_ORDER: 'OUT_OF_ORDER',
    UNRESOLVED_REFERENCE: 'UNRESOLVED_REFERENCE'
  };

  // ---------------------------------------------------------------- primitives

  function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  /** Non-empty after trimming. Blank-only user prose is a teacher mistake. */
  function isFilledString(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  /** Stable ids: printable ASCII, non-blank, bounded length. */
  function isValidId(value) {
    return isFilledString(value) && value.length <= MAX_ID_LENGTH && ID_PATTERN.test(value);
  }

  /** UTC ISO with milliseconds, and an actually existing instant. */
  function isUtcIsoString(value) {
    if (typeof value !== 'string' || !UTC_ISO_PATTERN.test(value)) return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
  }

  function collector() {
    const errors = [];
    return {
      errors,
      add(code, path, detail) {
        // detail is a bounded machine value (a field name, a count, an enum) and
        // never course prose. See the module header.
        errors.push(detail === undefined ? { code, path } : { code, path, detail });
      }
    };
  }

  /**
   * Reject unknown fields and report missing required ones. Returning early on a
   * non-object keeps every caller from repeating the same guard.
   */
  function checkShape(value, path, allowed, required, out) {
    if (!isPlainObject(value)) {
      out.add(ERROR_CODES.INVALID_TYPE, path, 'object');
      return false;
    }
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) out.add(ERROR_CODES.UNKNOWN_FIELD, `${path}.${key}`);
    }
    for (const key of required) {
      if (!Object.hasOwn(value, key)) out.add(ERROR_CODES.MISSING_FIELD, `${path}.${key}`);
    }
    return true;
  }

  function deriveCourseId(videoRef) {
    if (!isPlainObject(videoRef)) return null;
    const { platform, videoId } = videoRef;
    if (typeof platform !== 'string' || typeof videoId !== 'string') return null;
    if (!platform || !videoId) return null;
    return `${platform}:${videoId}`;
  }

  // ------------------------------------------------------------------ videoRef

  function validateVideoRef(videoRef, path, out) {
    if (!checkShape(videoRef, path, ['platform', 'videoId'], ['platform', 'videoId'], out)) return;

    if (!PLATFORMS.includes(videoRef.platform)) {
      out.add(ERROR_CODES.INVALID_ENUM, `${path}.platform`, PLATFORMS.join('|'));
    }
    if (typeof videoRef.videoId !== 'string' || !BVID_PATTERN.test(videoRef.videoId)) {
      out.add(ERROR_CODES.INVALID_VALUE, `${path}.videoId`, 'bvid');
    }
  }

  // -------------------------------------------------------------------- trigger

  function validateTrigger(trigger, path, out) {
    if (!checkShape(trigger, path, ['kind', 'timeSeconds', 'captionId'], ['kind', 'timeSeconds'], out)) return;

    if (!TRIGGER_KINDS.includes(trigger.kind)) {
      out.add(ERROR_CODES.INVALID_ENUM, `${path}.kind`, TRIGGER_KINDS.join('|'));
    }
    if (!isFiniteNumber(trigger.timeSeconds) || trigger.timeSeconds < 0) {
      out.add(ERROR_CODES.INVALID_VALUE, `${path}.timeSeconds`, 'finite>=0');
    }
    // Format only. Whether the id resolves to a caption is owned by the
    // WorkspaceDraft layer, because PluginCourseConfig carries no captions (D-011).
    if (Object.hasOwn(trigger, 'captionId') && trigger.captionId !== null) {
      if (!isValidId(trigger.captionId)) {
        out.add(ERROR_CODES.INVALID_VALUE, `${path}.captionId`, 'id');
      }
    }
  }

  // -------------------------------------------------------------- node displays

  function validateNoticeDisplay(display, path, out) {
    if (!checkShape(
      display, path,
      ['title', 'body', 'captionQuote', 'highlights'],
      ['title', 'body'],
      out
    )) return;

    if (!isFilledString(display.title)) out.add(ERROR_CODES.INVALID_VALUE, `${path}.title`, 'non-blank');
    if (!isFilledString(display.body)) out.add(ERROR_CODES.INVALID_VALUE, `${path}.body`, 'non-blank');

    if (Object.hasOwn(display, 'captionQuote') && !isFilledString(display.captionQuote)) {
      out.add(ERROR_CODES.INVALID_VALUE, `${path}.captionQuote`, 'non-blank');
    }

    if (!Object.hasOwn(display, 'highlights')) return;
    if (!Array.isArray(display.highlights)) {
      out.add(ERROR_CODES.INVALID_TYPE, `${path}.highlights`, 'array');
      return;
    }
    display.highlights.forEach((highlight, index) => {
      const highlightPath = `${path}.highlights[${index}]`;
      if (!checkShape(highlight, highlightPath, ['text'], ['text'], out)) return;
      if (!isFilledString(highlight.text)) {
        out.add(ERROR_CODES.INVALID_VALUE, `${highlightPath}.text`, 'non-blank');
      }
    });
  }

  function validateChoiceDisplay(display, path, out) {
    if (!checkShape(display, path, ['title', 'prompt', 'options'], ['title', 'prompt', 'options'], out)) {
      return [];
    }

    if (!isFilledString(display.title)) out.add(ERROR_CODES.INVALID_VALUE, `${path}.title`, 'non-blank');
    if (!isFilledString(display.prompt)) out.add(ERROR_CODES.INVALID_VALUE, `${path}.prompt`, 'non-blank');

    if (!Array.isArray(display.options)) {
      out.add(ERROR_CODES.INVALID_TYPE, `${path}.options`, 'array');
      return [];
    }
    if (display.options.length < 2) {
      out.add(ERROR_CODES.EMPTY_COLLECTION, `${path}.options`, 'min2');
    }

    const seen = new Set();
    const optionIds = [];
    display.options.forEach((option, index) => {
      const optionPath = `${path}.options[${index}]`;
      if (!checkShape(option, optionPath, ['id', 'label'], ['id', 'label'], out)) return;

      if (!isValidId(option.id)) {
        out.add(ERROR_CODES.INVALID_VALUE, `${optionPath}.id`, 'id');
      } else if (seen.has(option.id)) {
        out.add(ERROR_CODES.DUPLICATE_ID, `${optionPath}.id`);
      } else {
        seen.add(option.id);
        optionIds.push(option.id);
      }
      if (!isFilledString(option.label)) {
        out.add(ERROR_CODES.INVALID_VALUE, `${optionPath}.label`, 'non-blank');
      }
    });
    return optionIds;
  }

  function validatePromptOnlyDisplay(display, path, out) {
    if (!checkShape(display, path, ['title', 'prompt'], ['title', 'prompt'], out)) return;
    if (!isFilledString(display.title)) out.add(ERROR_CODES.INVALID_VALUE, `${path}.title`, 'non-blank');
    if (!isFilledString(display.prompt)) out.add(ERROR_CODES.INVALID_VALUE, `${path}.prompt`, 'non-blank');
  }

  // ----------------------------------------------------------- node evaluations

  function validateChoiceEvaluation(evaluation, path, optionIds, out) {
    if (!checkShape(evaluation, path, ['answer', 'explanation'], ['answer', 'explanation'], out)) return;

    if (!isFilledString(evaluation.answer)) {
      out.add(ERROR_CODES.INVALID_VALUE, `${path}.answer`, 'non-blank');
    } else if (!optionIds.includes(evaluation.answer)) {
      // Only meaningful when the option list itself parsed; otherwise the option
      // errors already explain the failure.
      if (optionIds.length > 0) out.add(ERROR_CODES.UNRESOLVED_REFERENCE, `${path}.answer`);
    }
    if (!isFilledString(evaluation.explanation)) {
      out.add(ERROR_CODES.INVALID_VALUE, `${path}.explanation`, 'non-blank');
    }
  }

  function validateBlankEvaluation(evaluation, path, out) {
    if (!checkShape(
      evaluation, path,
      ['acceptedAnswers', 'normalize', 'explanation'],
      ['acceptedAnswers', 'normalize', 'explanation'],
      out
    )) return;

    if (!isFilledString(evaluation.explanation)) {
      out.add(ERROR_CODES.INVALID_VALUE, `${path}.explanation`, 'non-blank');
    }

    // Fixed in stage one, so the extension and the page compare answers the same
    // way. A different list would change grading semantics silently.
    if (!Array.isArray(evaluation.normalize)
      || evaluation.normalize.length !== BLANK_NORMALIZE.length
      || evaluation.normalize.some((step, index) => step !== BLANK_NORMALIZE[index])) {
      out.add(ERROR_CODES.INVALID_VALUE, `${path}.normalize`, BLANK_NORMALIZE.join('+'));
    }

    if (!Array.isArray(evaluation.acceptedAnswers)) {
      out.add(ERROR_CODES.INVALID_TYPE, `${path}.acceptedAnswers`, 'array');
      return;
    }
    if (evaluation.acceptedAnswers.length === 0) {
      out.add(ERROR_CODES.EMPTY_COLLECTION, `${path}.acceptedAnswers`, 'min1');
      return;
    }

    // Answers are compared after trim+casefold, so two answers that collide under
    // that normalization are the same answer stored twice. Reporting it beats
    // deduping, which would hide a teacher-side editing mistake.
    const seen = new Set();
    evaluation.acceptedAnswers.forEach((answer, index) => {
      const answerPath = `${path}.acceptedAnswers[${index}]`;
      if (!isFilledString(answer)) {
        out.add(ERROR_CODES.INVALID_VALUE, answerPath, 'non-blank');
        return;
      }
      const normalized = answer.trim().toLowerCase();
      if (seen.has(normalized)) {
        out.add(ERROR_CODES.DUPLICATE_ID, answerPath, 'normalized');
      } else {
        seen.add(normalized);
      }
    });
  }

  function validateFreeTextEvaluation(evaluation, path, out) {
    // referenceFeedback only: stage one never judges the answer and never calls a
    // model, so answer keys or model config here mean the node was mis-edited (D-005).
    if (!checkShape(evaluation, path, ['referenceFeedback'], ['referenceFeedback'], out)) return;
    if (!isFilledString(evaluation.referenceFeedback)) {
      out.add(ERROR_CODES.INVALID_VALUE, `${path}.referenceFeedback`, 'non-blank');
    }
  }

  // ---------------------------------------------------------------------- nodes

  function isLegalCombination(family, interaction) {
    return LEGAL_NODE_COMBINATIONS.some(
      (combo) => combo.family === family && combo.interaction === interaction
    );
  }

  function validateNode(node, path, out) {
    if (!checkShape(
      node, path,
      ['id', 'enabled', 'family', 'interaction', 'trigger', 'display', 'evaluation', 'effects'],
      ['id', 'enabled', 'family', 'interaction', 'trigger', 'display', 'evaluation', 'effects'],
      out
    )) return;

    if (!isValidId(node.id)) out.add(ERROR_CODES.INVALID_VALUE, `${path}.id`, 'id');
    if (typeof node.enabled !== 'boolean') out.add(ERROR_CODES.INVALID_TYPE, `${path}.enabled`, 'boolean');

    validateTrigger(node.trigger, `${path}.trigger`, out);

    // Pause is fixed to true in stage one: every node stops the video.
    if (!checkShape(node.effects, `${path}.effects`, ['pause'], ['pause'], out)) {
      // shape error already reported
    } else if (node.effects.pause !== true) {
      out.add(ERROR_CODES.INVALID_VALUE, `${path}.effects.pause`, 'true');
    }

    if (!isLegalCombination(node.family, node.interaction)) {
      out.add(ERROR_CODES.INVALID_COMBINATION, path);
      // Without a known combination there is no display or evaluation shape to
      // check against; stop here rather than guess which branch was intended.
      return;
    }

    const displayPath = `${path}.display`;
    const evaluationPath = `${path}.evaluation`;

    if (node.interaction === 'notice') {
      validateNoticeDisplay(node.display, displayPath, out);
      if (node.evaluation !== null) out.add(ERROR_CODES.INVALID_VALUE, evaluationPath, 'null');
      return;
    }

    if (node.interaction === 'choice') {
      const optionIds = validateChoiceDisplay(node.display, displayPath, out);
      validateChoiceEvaluation(node.evaluation, evaluationPath, optionIds, out);
      return;
    }

    if (node.interaction === 'blank') {
      validatePromptOnlyDisplay(node.display, displayPath, out);
      validateBlankEvaluation(node.evaluation, evaluationPath, out);
      return;
    }

    validatePromptOnlyDisplay(node.display, displayPath, out);
    validateFreeTextEvaluation(node.evaluation, evaluationPath, out);
  }

  /**
   * Contract order: ascending trigger time, ties broken by ascending id. Used by
   * both the order check and normalizeCourse so they cannot disagree.
   */
  function compareNodes(left, right) {
    const leftTime = isFiniteNumber(left?.trigger?.timeSeconds) ? left.trigger.timeSeconds : 0;
    const rightTime = isFiniteNumber(right?.trigger?.timeSeconds) ? right.trigger.timeSeconds : 0;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return String(left?.id ?? '').localeCompare(String(right?.id ?? ''));
  }

  function validateNodes(nodes, path, out) {
    if (!Array.isArray(nodes)) {
      out.add(ERROR_CODES.INVALID_TYPE, path, 'array');
      return;
    }
    // Counted by array length, not by enabled (D-011).
    if (nodes.length === 0) {
      out.add(ERROR_CODES.EMPTY_COLLECTION, path, 'min1');
      return;
    }

    const seen = new Set();
    nodes.forEach((node, index) => {
      const nodePath = `${path}[${index}]`;
      validateNode(node, nodePath, out);
      const id = node?.id;
      if (typeof id === 'string' && id.length > 0) {
        if (seen.has(id)) out.add(ERROR_CODES.DUPLICATE_ID, `${nodePath}.id`);
        else seen.add(id);
      }
    });

    // Order is a semantic expectation of stored courses, not something validate
    // repairs. normalizeCourse does that, on the write path only (D-011).
    for (let index = 1; index < nodes.length; index += 1) {
      if (compareNodes(nodes[index - 1], nodes[index]) > 0) {
        out.add(ERROR_CODES.OUT_OF_ORDER, `${path}[${index}]`);
      }
    }
  }

  // ------------------------------------------------------------ PluginCourseConfig

  const COURSE_FIELDS = ['schemaVersion', 'courseId', 'videoRef', 'nodes', 'updatedAt'];

  /**
   * Validate a PluginCourseConfig. Returns { ok, errors } and never throws: it runs
   * on untrusted input from a web page, so a thrown error would become a bridge
   * failure that is harder to attribute than a rejection.
   */
  function validateCourse(course) {
    const out = collector();

    if (!checkShape(course, 'course', COURSE_FIELDS, COURSE_FIELDS, out)) {
      return { ok: false, errors: out.errors };
    }

    if (course.schemaVersion !== SCHEMA_VERSION) {
      out.add(ERROR_CODES.INVALID_VALUE, 'course.schemaVersion', String(SCHEMA_VERSION));
    }

    // updatedAt is produced by the page and echoed back unchanged by the
    // background, so this is the only place its format is enforced (D-011).
    if (!isUtcIsoString(course.updatedAt)) {
      out.add(ERROR_CODES.INVALID_VALUE, 'course.updatedAt', 'utc-iso-ms');
    }

    validateVideoRef(course.videoRef, 'course.videoRef', out);

    // courseId is derived, so a mismatch means the course would be stored under an
    // id the runtime never looks up.
    const derived = deriveCourseId(course.videoRef);
    if (typeof course.courseId !== 'string' || course.courseId.length === 0) {
      out.add(ERROR_CODES.INVALID_TYPE, 'course.courseId', 'string');
    } else if (derived !== null && course.courseId !== derived) {
      out.add(ERROR_CODES.INVALID_VALUE, 'course.courseId', 'derived');
    }

    validateNodes(course.nodes, 'course.nodes', out);

    return out.errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors: out.errors };
  }

  /**
   * Repair representation only: sort nodes into contract order and derive courseId.
   * Returns a new object and never mutates the input. Semantic errors are left for
   * validateCourse to report (A-DATA-01).
   *
   * Call order on the write path is normalize then validate. The extension
   * background only validates: it does not repair data on the page's behalf.
   */
  function normalizeCourse(course) {
    if (!isPlainObject(course)) return course;

    const normalized = { ...course };

    const derived = deriveCourseId(course.videoRef);
    if (derived !== null) normalized.courseId = derived;

    if (Array.isArray(course.nodes)) {
      normalized.nodes = course.nodes.slice().sort(compareNodes);
    }

    return normalized;
  }

  return {
    SCHEMA_VERSION,
    LEGAL_NODE_COMBINATIONS,
    ERROR_CODES,
    PLATFORMS,
    BLANK_NORMALIZE,
    MAX_ID_LENGTH,
    deriveCourseId,
    validateCourse,
    normalizeCourse,
    isUtcIsoString,
    isValidId
  };
});
