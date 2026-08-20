/**
 * Multi-lesson course package contract.
 * Run: node --test tests/course-package-contract.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const contract = require('../src/shared/course-package-contract.js');

const COURSE_ID = '7a0c4a42-91c8-4f4d-8a2e-17b89c4f6d21';
const LESSON_ONE_ID = '1f7b6b18-6b1e-4d2f-bb5e-b5f2a6d7150f';
const LESSON_TWO_ID = '3b4a2d2c-44f8-4a27-93b5-7b4d4e4a5c91';
const UPDATED_AT = '2026-08-20T00:00:00.000Z';

function noticeNode(overrides = {}) {
  return {
    id: 'node-1',
    enabled: true,
    family: 'attention',
    interaction: 'notice',
    trigger: { kind: 'time_cross', timeSeconds: 39, captionId: 'caption-0018' },
    display: {
      title: '能力词还需要证据',
      body: '这些词概括了优势，但还需要具体经历证明。'
    },
    evaluation: null,
    effects: { pause: true },
    ...overrides
  };
}

function lesson(overrides = {}) {
  return {
    lessonId: LESSON_ONE_ID,
    title: '第一节：英文面试完整流程',
    videoRef: { platform: 'bilibili', videoId: 'BV1WW4y1e7GL' },
    nodes: [noticeNode()],
    updatedAt: UPDATED_AT,
    ...overrides
  };
}

function coursePackage(overrides = {}) {
  return {
    schemaVersion: 2,
    courseId: COURSE_ID,
    title: '英语面试表达：把答案说得具体',
    lessons: [
      lesson(),
      lesson({
        lessonId: LESSON_TWO_ID,
        title: '第二节：用证据支持能力词',
        videoRef: { platform: 'bilibili', videoId: 'BV1xx411c7mD' },
        updatedAt: '2026-08-20T00:01:00.000Z'
      })
    ],
    updatedAt: UPDATED_AT,
    ...overrides
  };
}

function legacyCourse(overrides = {}) {
  return {
    schemaVersion: 1,
    courseId: 'bilibili:BV1WW4y1e7GL',
    videoRef: { platform: 'bilibili', videoId: 'BV1WW4y1e7GL' },
    nodes: [noticeNode()],
    updatedAt: UPDATED_AT,
    ...overrides
  };
}

function expectAccepted(value, label = 'course package') {
  const result = contract.validateCoursePackage(value);
  assert.equal(result.ok, true, `${label}: ${JSON.stringify(result.errors)}`);
  assert.deepEqual(result.errors, []);
}

function expectRejected(value, label = 'course package') {
  const result = contract.validateCoursePackage(value);
  assert.equal(result.ok, false, `${label}: expected rejection`);
  assert.ok(result.errors.length > 0, `${label}: rejection must include errors`);
  return result.errors;
}

test('exports the version 2 package API separately from the legacy course contract', () => {
  assert.equal(contract.SCHEMA_VERSION, 2);
  assert.equal(typeof contract.validateCoursePackage, 'function');
  assert.equal(typeof contract.normalizeCoursePackage, 'function');
  assert.equal(typeof contract.legacyAdapter.fromSingleCourseEnvelope, 'function');
});

test('accepts a multi-lesson package with independent UUID identity', () => {
  expectAccepted(coursePackage());
});

test('rejects unknown fields at every package-owned layer', () => {
  expectRejected(coursePackage({ goal: 'not in schema v2' }), 'top-level field');
  expectRejected(
    coursePackage({ lessons: [lesson({ durationSeconds: 513 })] }),
    'lesson field'
  );
  expectRejected(
    coursePackage({
      lessons: [lesson({ videoRef: { platform: 'bilibili', videoId: 'BV1WW4y1e7GL', cid: 1 } })]
    }),
    'video field'
  );
  expectRejected(
    coursePackage({
      lessons: [lesson({ nodes: [noticeNode({ sourceUrl: 'https://example.com' })] })]
    }),
    'node field delegated to the old contract'
  );
});

test('requires schema version 2, non-blank titles, and at least one lesson', () => {
  expectRejected(coursePackage({ schemaVersion: 1 }), 'schema version');
  expectRejected(coursePackage({ title: '   ' }), 'course title');
  expectRejected(coursePackage({ lessons: [] }), 'empty lessons');
  expectRejected(coursePackage({ lessons: null }), 'non-array lessons');
  expectRejected(coursePackage({ lessons: [lesson({ title: '' })] }), 'lesson title');
});

test('requires canonical UUIDs and rejects identity reuse', () => {
  for (const courseId of [
    'bilibili:BV1WW4y1e7GL',
    '7A0C4A42-91C8-4F4D-8A2E-17B89C4F6D21',
    '7a0c4a4291c84f4d8a2e17b89c4f6d21',
    '00000000-0000-0000-0000-000000000000',
    42
  ]) {
    expectRejected(coursePackage({ courseId }), `courseId ${String(courseId)}`);
  }

  expectRejected(
    coursePackage({ lessons: [lesson({ lessonId: 'not-a-uuid' })] }),
    'invalid lessonId'
  );
  expectRejected(
    coursePackage({ lessons: [lesson(), lesson({ lessonId: LESSON_ONE_ID })] }),
    'duplicate lessonId'
  );
  expectRejected(
    coursePackage({ lessons: [lesson({ lessonId: COURSE_ID })] }),
    'courseId reused as lessonId'
  );
});

test('requires strict UTC timestamps for the package and every lesson', () => {
  for (const updatedAt of [
    '2026-08-20',
    '2026-08-20T00:00:00Z',
    '2026-08-20T00:00:00.000+08:00',
    '2026-13-20T00:00:00.000Z',
    Date.now()
  ]) {
    expectRejected(coursePackage({ updatedAt }), `package updatedAt ${String(updatedAt)}`);
    expectRejected(
      coursePackage({ lessons: [lesson({ updatedAt })] }),
      `lesson updatedAt ${String(updatedAt)}`
    );
  }
});

test('accepts only bilibili video references with a canonical BVID', () => {
  expectRejected(
    coursePackage({
      lessons: [lesson({ videoRef: { platform: 'youtube', videoId: 'BV1WW4y1e7GL' } })]
    }),
    'unsupported platform'
  );

  for (const videoId of [
    'bv1WW4y1e7GL',
    'BV1',
    'BV1WW4y1e7G',
    'BV1WW4y1e7GL0',
    'BV1WW4y1e7G-',
    ' BV1WW4y1e7GL',
    'BV1WW4y1e7GL '
  ]) {
    expectRejected(
      coursePackage({ lessons: [lesson({ videoRef: { platform: 'bilibili', videoId } })] }),
      `videoId ${JSON.stringify(videoId)}`
    );
  }
});

test('reuses the old node rules without applying its derived courseId rule', () => {
  expectAccepted(coursePackage({ courseId: '2d67a6c8-7f24-4fb5-9127-09c79fc31bf8' }));
  expectRejected(coursePackage({ lessons: [lesson({ nodes: [] })] }), 'empty nodes');
  expectRejected(
    coursePackage({
      lessons: [lesson({
        nodes: [noticeNode({ effects: { pause: false } })]
      })]
    }),
    'invalid old node semantics'
  );
});

test('maps delegated node errors to the containing lesson path without leaking prose', () => {
  const secret = 'This sentence must not appear in validation output.';
  const errors = expectRejected(
    coursePackage({
      lessons: [lesson({
        nodes: [noticeNode({ display: { title: secret, body: '' } })]
      })]
    })
  );

  assert.ok(errors.some((error) => error.path.includes('coursePackage.lessons[0].nodes[0]')));
  assert.equal(JSON.stringify(errors).includes(secret), false);
});

test('normalizes node order inside each lesson without mutating identities or input', () => {
  const input = coursePackage({
    lessons: [lesson({
      nodes: [
        noticeNode({
          id: 'node-b',
          trigger: { kind: 'time_cross', timeSeconds: 50, captionId: null }
        }),
        noticeNode({
          id: 'node-a',
          trigger: { kind: 'time_cross', timeSeconds: 10, captionId: null }
        })
      ]
    })]
  });
  const snapshot = structuredClone(input);

  const normalized = contract.normalizeCoursePackage(input);

  assert.deepEqual(input, snapshot);
  assert.notEqual(normalized, input);
  assert.equal(normalized.courseId, COURSE_ID);
  assert.equal(normalized.lessons[0].lessonId, LESSON_ONE_ID);
  assert.deepEqual(normalized.lessons[0].nodes.map((node) => node.id), ['node-a', 'node-b']);
  expectAccepted(normalized, 'normalized package');
});

test('does not let the package validator silently accept a legacy {course} envelope', () => {
  expectRejected({ course: legacyCourse() }, 'legacy envelope');
});

test('converts a valid legacy {course} envelope only through the explicit adapter', () => {
  const envelope = { course: legacyCourse() };
  const snapshot = structuredClone(envelope);

  const result = contract.legacyAdapter.fromSingleCourseEnvelope(envelope, {
    courseId: COURSE_ID,
    title: '英语面试表达',
    lessonId: LESSON_ONE_ID,
    lessonTitle: '第一节'
  });

  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(envelope, snapshot, 'adapter must not mutate legacy input');
  assert.equal(result.coursePackage.schemaVersion, 2);
  assert.equal(result.coursePackage.courseId, COURSE_ID);
  assert.equal(result.coursePackage.lessons[0].lessonId, LESSON_ONE_ID);
  assert.deepEqual(result.coursePackage.lessons[0].videoRef, envelope.course.videoRef);
  assert.deepEqual(result.coursePackage.lessons[0].nodes, envelope.course.nodes);
  expectAccepted(result.coursePackage, 'adapted legacy package');
});

test('legacy adapter rejects malformed envelopes, legacy courses, and replacement identity', () => {
  for (const [envelope, identity] of [
    [{}, {
      courseId: COURSE_ID,
      title: '课程',
      lessonId: LESSON_ONE_ID,
      lessonTitle: '课节'
    }],
    [{ course: legacyCourse(), extra: true }, {
      courseId: COURSE_ID,
      title: '课程',
      lessonId: LESSON_ONE_ID,
      lessonTitle: '课节'
    }],
    [{ course: legacyCourse({ nodes: [] }) }, {
      courseId: COURSE_ID,
      title: '课程',
      lessonId: LESSON_ONE_ID,
      lessonTitle: '课节'
    }],
    [{ course: legacyCourse() }, {
      courseId: 'bilibili:BV1WW4y1e7GL',
      title: '课程',
      lessonId: LESSON_ONE_ID,
      lessonTitle: '课节'
    }]
  ]) {
    const result = contract.legacyAdapter.fromSingleCourseEnvelope(envelope, identity);
    assert.equal(result.ok, false);
    assert.ok(result.errors.length > 0);
    assert.equal(Object.hasOwn(result, 'coursePackage'), false);
  }
});
