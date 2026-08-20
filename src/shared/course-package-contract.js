/**
 * The schema version 2 multi-lesson course package contract.
 *
 * Package identity is independent from video identity. Node semantics are
 * delegated to the version 1 course contract through a temporary legacy course
 * whose derived courseId is deliberately kept inside this module.
 */
(function initCoursePackageContract(global, factory) {
  const legacyContract = typeof module !== 'undefined' && module.exports
    ? require('./course-contract.js')
    : global.LessonPilotCourseContract;
  const api = factory(legacyContract);
  global.LessonPilotCoursePackageContract = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof self !== 'undefined' ? self : globalThis, function createCoursePackageContract(legacyContract) {
  const SCHEMA_VERSION = 2;
  const PLATFORM = 'bilibili';
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const BVID_PATTERN = /^BV[0-9A-Za-z]{10}$/;

  const ERROR_CODES = legacyContract.ERROR_CODES;
  const PACKAGE_FIELDS = ['schemaVersion', 'courseId', 'title', 'lessons', 'updatedAt'];
  const LESSON_FIELDS = ['lessonId', 'title', 'videoRef', 'nodes', 'updatedAt'];
  const VIDEO_REF_FIELDS = ['platform', 'videoId'];
  const LEGACY_ENVELOPE_FIELDS = ['course'];
  const LEGACY_IDENTITY_FIELDS = ['courseId', 'title', 'lessonId', 'lessonTitle'];

  function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  function isFilledString(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function isUuid(value) {
    return typeof value === 'string' && UUID_PATTERN.test(value);
  }

  function collector() {
    const errors = [];
    return {
      errors,
      add(code, path, detail) {
        errors.push(detail === undefined ? { code, path } : { code, path, detail });
      }
    };
  }

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

  function validateVideoRef(videoRef, path, out) {
    if (!checkShape(videoRef, path, VIDEO_REF_FIELDS, VIDEO_REF_FIELDS, out)) return;

    if (videoRef.platform !== PLATFORM) {
      out.add(ERROR_CODES.INVALID_ENUM, `${path}.platform`, PLATFORM);
    }
    if (typeof videoRef.videoId !== 'string' || !BVID_PATTERN.test(videoRef.videoId)) {
      out.add(ERROR_CODES.INVALID_VALUE, `${path}.videoId`, 'bvid');
    }
  }

  function validateNodesWithLegacyContract(lesson, path, out) {
    const legacyCourseId = legacyContract.deriveCourseId(lesson.videoRef);
    const result = legacyContract.validateCourse({
      schemaVersion: legacyContract.SCHEMA_VERSION,
      courseId: legacyCourseId ?? '',
      videoRef: lesson.videoRef,
      nodes: lesson.nodes,
      updatedAt: lesson.updatedAt
    });

    for (const error of result.errors) {
      if (!error.path.startsWith('course.nodes')) continue;
      const mappedPath = error.path.replace(/^course\.nodes/, `${path}.nodes`);
      out.add(error.code, mappedPath, error.detail);
    }
  }

  function validateLesson(lesson, path, usedIds, out) {
    if (!checkShape(lesson, path, LESSON_FIELDS, LESSON_FIELDS, out)) return;

    if (!isUuid(lesson.lessonId)) {
      out.add(ERROR_CODES.INVALID_VALUE, `${path}.lessonId`, 'uuid');
    } else if (usedIds.has(lesson.lessonId)) {
      out.add(ERROR_CODES.DUPLICATE_ID, `${path}.lessonId`);
    } else {
      usedIds.add(lesson.lessonId);
    }

    if (!isFilledString(lesson.title)) {
      out.add(ERROR_CODES.INVALID_VALUE, `${path}.title`, 'non-blank');
    }
    if (!legacyContract.isUtcIsoString(lesson.updatedAt)) {
      out.add(ERROR_CODES.INVALID_VALUE, `${path}.updatedAt`, 'utc-iso-ms');
    }

    validateVideoRef(lesson.videoRef, `${path}.videoRef`, out);
    validateNodesWithLegacyContract(lesson, path, out);
  }

  function validateCoursePackage(coursePackage) {
    const out = collector();

    if (!checkShape(
      coursePackage,
      'coursePackage',
      PACKAGE_FIELDS,
      PACKAGE_FIELDS,
      out
    )) {
      return { ok: false, errors: out.errors };
    }

    if (coursePackage.schemaVersion !== SCHEMA_VERSION) {
      out.add(ERROR_CODES.INVALID_VALUE, 'coursePackage.schemaVersion', String(SCHEMA_VERSION));
    }
    if (!isFilledString(coursePackage.title)) {
      out.add(ERROR_CODES.INVALID_VALUE, 'coursePackage.title', 'non-blank');
    }
    if (!legacyContract.isUtcIsoString(coursePackage.updatedAt)) {
      out.add(ERROR_CODES.INVALID_VALUE, 'coursePackage.updatedAt', 'utc-iso-ms');
    }

    const usedIds = new Set();
    if (!isUuid(coursePackage.courseId)) {
      out.add(ERROR_CODES.INVALID_VALUE, 'coursePackage.courseId', 'uuid');
    } else {
      usedIds.add(coursePackage.courseId);
    }

    if (!Array.isArray(coursePackage.lessons)) {
      out.add(ERROR_CODES.INVALID_TYPE, 'coursePackage.lessons', 'array');
    } else if (coursePackage.lessons.length === 0) {
      out.add(ERROR_CODES.EMPTY_COLLECTION, 'coursePackage.lessons', 'min1');
    } else {
      coursePackage.lessons.forEach((lesson, index) => {
        validateLesson(lesson, `coursePackage.lessons[${index}]`, usedIds, out);
      });
    }

    return out.errors.length === 0
      ? { ok: true, errors: [] }
      : { ok: false, errors: out.errors };
  }

  function normalizeCoursePackage(coursePackage) {
    if (!isPlainObject(coursePackage)) return coursePackage;

    const normalized = { ...coursePackage };
    if (!Array.isArray(coursePackage.lessons)) return normalized;

    normalized.lessons = coursePackage.lessons.map((lesson) => {
      if (!isPlainObject(lesson)) return lesson;

      const normalizedLesson = { ...lesson };
      if (!Array.isArray(lesson.nodes)) return normalizedLesson;

      const legacyCourseId = legacyContract.deriveCourseId(lesson.videoRef);
      const normalizedLegacy = legacyContract.normalizeCourse({
        schemaVersion: legacyContract.SCHEMA_VERSION,
        courseId: legacyCourseId ?? '',
        videoRef: lesson.videoRef,
        nodes: lesson.nodes,
        updatedAt: lesson.updatedAt
      });
      normalizedLesson.nodes = normalizedLegacy.nodes;
      return normalizedLesson;
    });

    return normalized;
  }

  function mapLegacyErrors(errors, out) {
    for (const error of errors) {
      const mappedPath = error.path.replace(/^course/, 'legacyEnvelope.course');
      out.add(error.code, mappedPath, error.detail);
    }
  }

  function fromSingleCourseEnvelope(envelope, identity) {
    const out = collector();
    const envelopeOk = checkShape(
      envelope,
      'legacyEnvelope',
      LEGACY_ENVELOPE_FIELDS,
      LEGACY_ENVELOPE_FIELDS,
      out
    );
    const identityOk = checkShape(
      identity,
      'legacyIdentity',
      LEGACY_IDENTITY_FIELDS,
      LEGACY_IDENTITY_FIELDS,
      out
    );

    if (!envelopeOk || !identityOk) return { ok: false, errors: out.errors };

    const legacyResult = legacyContract.validateCourse(envelope.course);
    if (!legacyResult.ok) mapLegacyErrors(legacyResult.errors, out);

    const candidate = {
      schemaVersion: SCHEMA_VERSION,
      courseId: identity.courseId,
      title: identity.title,
      lessons: [{
        lessonId: identity.lessonId,
        title: identity.lessonTitle,
        videoRef: isPlainObject(envelope.course?.videoRef)
          ? { ...envelope.course.videoRef }
          : envelope.course?.videoRef,
        nodes: Array.isArray(envelope.course?.nodes)
          ? envelope.course.nodes.slice()
          : envelope.course?.nodes,
        updatedAt: envelope.course?.updatedAt
      }],
      updatedAt: envelope.course?.updatedAt
    };

    const packageResult = validateCoursePackage(candidate);
    for (const error of packageResult.errors) {
      out.add(error.code, error.path, error.detail);
    }

    if (out.errors.length > 0) return { ok: false, errors: out.errors };
    return { ok: true, errors: [], coursePackage: candidate };
  }

  return {
    SCHEMA_VERSION,
    ERROR_CODES,
    isUuid,
    validateCoursePackage,
    normalizeCoursePackage,
    legacyAdapter: Object.freeze({
      fromSingleCourseEnvelope
    })
  };
});
