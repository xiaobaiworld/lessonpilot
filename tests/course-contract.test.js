/**
 * Stage 1A shared course contract.
 * Run: node --test tests/course-contract.test.js
 *
 * The same module validates on the workspace page and inside the extension
 * background (A-DATA-01), so every rule here is asserted against one
 * implementation. Layer ownership for rules that cannot run in both places is
 * recorded in doc/data-spec.md section 13 and D-011.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const contract = require('../teacher-web/shared/course-contract.js');

const UPDATED_AT = '2026-08-15T00:00:00.000Z';

/** A notice node: the only family that carries no evaluation. */
function noticeNode(overrides = {}) {
  return {
    id: 'node-1',
    enabled: true,
    family: 'attention',
    interaction: 'notice',
    trigger: { kind: 'time_cross', timeSeconds: 39, captionId: 'caption-0018' },
    display: {
      title: '能力词还需要证据',
      body: '这些词概括了优势，但还需要具体经历证明。',
      captionQuote: 'I am hard-working and loyal.',
      highlights: [{ text: 'hard-working' }, { text: 'loyal' }]
    },
    evaluation: null,
    effects: { pause: true },
    ...overrides
  };
}

function choiceNode(overrides = {}) {
  return {
    id: 'node-2',
    enabled: true,
    family: 'practice',
    interaction: 'choice',
    trigger: { kind: 'time_cross', timeSeconds: 72, captionId: null },
    display: {
      title: '判断哪一句有证据',
      prompt: '下面哪一句给出了具体证据？',
      options: [
        { id: 'a', label: 'I am hard-working.' },
        { id: 'b', label: 'I finished the client deck before the deadline.' }
      ]
    },
    evaluation: { answer: 'b', explanation: '第二句说明了具体做过的事。' },
    effects: { pause: true },
    ...overrides
  };
}

function blankNode(overrides = {}) {
  return {
    id: 'node-3',
    enabled: true,
    family: 'practice',
    interaction: 'blank',
    trigger: { kind: 'time_cross', timeSeconds: 105, captionId: null },
    display: { title: '补上动作动词', prompt: 'I ______ a different approach.' },
    evaluation: {
      acceptedAnswers: ['suggested'],
      normalize: ['trim', 'casefold'],
      explanation: '视频中的动作动词是 suggested。'
    },
    effects: { pause: true },
    ...overrides
  };
}

function freeTextNode(overrides = {}) {
  return {
    id: 'node-4',
    enabled: true,
    family: 'followup',
    interaction: 'free_text',
    trigger: { kind: 'time_cross', timeSeconds: 140, captionId: null },
    display: { title: '用自己的经历回答', prompt: 'How do you handle stress?' },
    evaluation: {
      referenceFeedback: '可以按保持冷静、询问信息、评估选择、采取行动四步组织。'
    },
    effects: { pause: true },
    ...overrides
  };
}

/** All four legal families, already in contract order. */
function validCourse(overrides = {}) {
  return {
    schemaVersion: 1,
    courseId: 'bilibili:BV1WW4y1e7GL',
    videoRef: { platform: 'bilibili', videoId: 'BV1WW4y1e7GL' },
    nodes: [noticeNode(), choiceNode(), blankNode(), freeTextNode()],
    updatedAt: UPDATED_AT,
    ...overrides
  };
}

/** Assert rejection and return the error codes, so tests can pin the reason. */
function expectRejected(course, label) {
  const result = contract.validateCourse(course);
  assert.equal(result.ok, false, `${label}: expected rejection`);
  assert.ok(result.errors.length > 0, `${label}: rejection must carry errors`);
  return result.errors;
}

function expectAccepted(course, label) {
  const result = contract.validateCourse(course);
  assert.equal(result.ok, true, `${label}: expected acceptance, got ${JSON.stringify(result.errors)}`);
  return result;
}

test('accepts a course carrying all four legal node families', () => {
  expectAccepted(validCourse(), 'four families');
});

test('accepts each legal family on its own', () => {
  for (const [label, node] of [
    ['attention+notice', noticeNode()],
    ['practice+choice', choiceNode()],
    ['practice+blank', blankNode()],
    ['followup+free_text', freeTextNode()]
  ]) {
    expectAccepted(validCourse({ nodes: [node] }), label);
  }
});

test('accepts a structured clone, so the contract survives the message bridge', () => {
  // The bridge passes courses through structuredClone semantics. A contract that
  // depended on prototypes or non-cloneable values would pass in-process and
  // fail in the real extension.
  const cloned = structuredClone(validCourse());
  expectAccepted(cloned, 'structured clone');
  assert.deepEqual(cloned, validCourse(), 'clone must be deeply equal to the source');
});

test('rejects an unknown schemaVersion instead of guessing a migration', () => {
  expectRejected(validCourse({ schemaVersion: 2 }), 'schemaVersion 2');
  expectRejected(validCourse({ schemaVersion: '1' }), 'schemaVersion string');
  const missing = validCourse();
  delete missing.schemaVersion;
  expectRejected(missing, 'schemaVersion missing');
});

test('rejects unknown top-level fields to stop web/extension schema drift', () => {
  expectRejected(validCourse({ title: '英语面试表达' }), 'unknown title field');
  expectRejected(validCourse({ schemaversion: 1 }), 'case-variant duplicate');
});

test('rejects workspace-only fields that must never reach the extension', () => {
  // A-DATA-02 and A-SEC-01: full captions and page state stay on the workspace.
  expectRejected(validCourse({ captions: [] }), 'captions');
  expectRejected(validCourse({ sourceUrl: 'https://www.bilibili.com/video/BV1WW4y1e7GL/' }), 'sourceUrl');
  expectRejected(validCourse({ subtitlesConfirmed: true }), 'subtitlesConfirmed');
});

test('rejects executable or non-cloneable content anywhere in the course', () => {
  expectRejected(validCourse({ onLoad: () => {} }), 'top-level function');
  expectRejected(
    validCourse({ nodes: [noticeNode({ display: { title: 'a', body: 'b', render: () => {} } })] }),
    'function inside display'
  );
  const cyclic = validCourse();
  cyclic.self = cyclic;
  expectRejected(cyclic, 'circular reference');
});

test('rejects a courseId that does not match videoRef', () => {
  // courseId is derived from platform:videoId. Accepting a mismatch would let a
  // course be stored under an id the runtime never looks up.
  expectRejected(validCourse({ courseId: 'bilibili:BV1OtherId0' }), 'courseId mismatch');
  expectRejected(validCourse({ courseId: 'BV1WW4y1e7GL' }), 'courseId missing platform');
  expectRejected(validCourse({ courseId: 'youtube:BV1WW4y1e7GL' }), 'courseId wrong platform');
});

test('rejects an unsupported platform or malformed BVID', () => {
  expectRejected(
    validCourse({ courseId: 'youtube:abc', videoRef: { platform: 'youtube', videoId: 'abc' } }),
    'youtube platform'
  );
  for (const videoId of ['bv1WW4y1e7GL', 'BV', 'BV1WW4y1e7GL ', ' BV1WW4y1e7GL', 'BV1WW4y1e7G-', '']) {
    expectRejected(
      validCourse({ courseId: `bilibili:${videoId}`, videoRef: { platform: 'bilibili', videoId } }),
      `videoId ${JSON.stringify(videoId)}`
    );
  }
});

test('rejects a malformed or non-UTC updatedAt', () => {
  // The page produces updatedAt and the background echoes it back (D-011), so a
  // malformed value would otherwise persist unchecked.
  for (const updatedAt of [
    '2026-08-15',
    '2026-08-15T00:00:00Z',
    '2026-08-15T00:00:00.000+08:00',
    '2026-13-15T00:00:00.000Z',
    Date.now(),
    null
  ]) {
    expectRejected(validCourse({ updatedAt }), `updatedAt ${JSON.stringify(updatedAt)}`);
  }
  expectAccepted(validCourse({ updatedAt: '2026-08-15T23:59:59.999Z' }), 'valid UTC updatedAt');
});

test('rejects an empty node array', () => {
  // A-DATA-02: at least one node. A course with no nodes would store fine and
  // then do nothing at runtime, which reads as a silent failure to the teacher.
  expectRejected(validCourse({ nodes: [] }), 'empty nodes');
  expectRejected(validCourse({ nodes: null }), 'null nodes');
  expectRejected(validCourse({ nodes: {} }), 'non-array nodes');
});

test('counts nodes by array length, not by enabled', () => {
  // D-011: enabled is type-checked only in stage one; 1C defines runtime meaning.
  expectAccepted(validCourse({ nodes: [noticeNode({ enabled: false })] }), 'single disabled node');
  expectRejected(validCourse({ nodes: [noticeNode({ enabled: 'true' })] }), 'enabled as string');
  expectRejected(validCourse({ nodes: [noticeNode({ enabled: 1 })] }), 'enabled as number');
});

test('rejects duplicate node ids', () => {
  expectRejected(
    validCourse({ nodes: [noticeNode({ id: 'dup' }), choiceNode({ id: 'dup' })] }),
    'duplicate ids'
  );
});

test('rejects malformed node ids', () => {
  for (const id of ['', '   ', 'a'.repeat(81), '节点一', null, 42]) {
    expectRejected(validCourse({ nodes: [noticeNode({ id })] }), `id ${JSON.stringify(id)}`);
  }
  expectAccepted(validCourse({ nodes: [noticeNode({ id: 'a'.repeat(80) })] }), 'id at 80 chars');
});

test('rejects non-finite, negative, or non-numeric trigger times', () => {
  for (const timeSeconds of [-1, Number.NaN, Number.POSITIVE_INFINITY, '39', null]) {
    expectRejected(
      validCourse({ nodes: [noticeNode({ trigger: { kind: 'time_cross', timeSeconds, captionId: null } })] }),
      `timeSeconds ${String(timeSeconds)}`
    );
  }
  expectAccepted(
    validCourse({ nodes: [noticeNode({ trigger: { kind: 'time_cross', timeSeconds: 0, captionId: null } })] }),
    'timeSeconds 0'
  );
});

test('rejects trigger kinds other than time_cross', () => {
  expectRejected(
    validCourse({ nodes: [noticeNode({ trigger: { kind: 'caption_enter', timeSeconds: 39, captionId: null } })] }),
    'caption_enter'
  );
});

test('validates captionId format only, leaving reference integrity to the draft layer', () => {
  // D-011: PluginCourseConfig carries no captions, so the extension cannot check
  // that a captionId resolves. Format is checkable here; reference integrity is
  // owned by the WorkspaceDraft layer in 1B.
  expectAccepted(
    validCourse({ nodes: [noticeNode({ trigger: { kind: 'time_cross', timeSeconds: 39, captionId: null } })] }),
    'null captionId'
  );
  expectAccepted(
    validCourse({ nodes: [noticeNode({ trigger: { kind: 'time_cross', timeSeconds: 39, captionId: 'caption-9999' } })] }),
    'unresolvable but well-formed captionId'
  );
  for (const captionId of ['', '   ', 'a'.repeat(81), '字幕-1', 42]) {
    expectRejected(
      validCourse({ nodes: [noticeNode({ trigger: { kind: 'time_cross', timeSeconds: 39, captionId } })] }),
      `captionId ${JSON.stringify(captionId)}`
    );
  }
});

test('rejects effects.pause other than true', () => {
  for (const effects of [{ pause: false }, {}, { pause: true, resume: true }, null]) {
    expectRejected(
      validCourse({ nodes: [noticeNode({ effects })] }),
      `effects ${JSON.stringify(effects)}`
    );
  }
});

test('rejects unknown family and interaction combinations', () => {
  for (const [family, interaction] of [
    ['attention', 'choice'],
    ['practice', 'notice'],
    ['practice', 'free_text'],
    ['followup', 'blank'],
    ['quiz', 'choice'],
    ['attention', 'unknown']
  ]) {
    expectRejected(
      validCourse({ nodes: [choiceNode({ family, interaction })] }),
      `${family}+${interaction}`
    );
  }
});

test('rejects unknown fields inside a node, its trigger, or its display', () => {
  expectRejected(validCourse({ nodes: [noticeNode({ weight: 1 })] }), 'unknown node field');
  expectRejected(
    validCourse({ nodes: [noticeNode({ trigger: { kind: 'time_cross', timeSeconds: 39, captionId: null, tolerance: 1 } })] }),
    'unknown trigger field'
  );
  expectRejected(
    validCourse({ nodes: [noticeNode({ display: { title: 'a', body: 'b', html: '<b>x</b>' } })] }),
    'unknown display field'
  );
});

test('rejects a notice node missing title or body', () => {
  expectRejected(validCourse({ nodes: [noticeNode({ display: { body: 'b' } })] }), 'missing title');
  expectRejected(validCourse({ nodes: [noticeNode({ display: { title: 'a' } })] }), 'missing body');
  expectRejected(validCourse({ nodes: [noticeNode({ display: { title: '   ', body: 'b' } })] }), 'whitespace title');
  expectRejected(validCourse({ nodes: [noticeNode({ display: { title: 'a', body: '  ' } })] }), 'whitespace body');
  expectAccepted(
    validCourse({ nodes: [noticeNode({ display: { title: 'a', body: 'b' } })] }),
    'optional captionQuote and highlights omitted'
  );
});

test('rejects notice highlights that carry empty text', () => {
  expectRejected(
    validCourse({ nodes: [noticeNode({ display: { title: 'a', body: 'b', highlights: [{ text: '' }] } })] }),
    'empty highlight'
  );
  expectRejected(
    validCourse({ nodes: [noticeNode({ display: { title: 'a', body: 'b', highlights: [{ text: 'x', color: 'red' }] } })] }),
    'unknown highlight field'
  );
  expectRejected(
    validCourse({ nodes: [noticeNode({ display: { title: 'a', body: 'b', highlights: 'hard-working' } })] }),
    'highlights not an array'
  );
});

test('rejects a notice node that carries an evaluation', () => {
  // attention+notice has nothing to evaluate; a stray evaluation would signal the
  // node was edited into the wrong family.
  expectRejected(
    validCourse({ nodes: [noticeNode({ evaluation: { answer: 'a' } })] }),
    'notice with evaluation'
  );
});

test('rejects a choice node with fewer than two options', () => {
  expectRejected(
    validCourse({ nodes: [choiceNode({
      display: { title: 'a', prompt: 'p', options: [{ id: 'a', label: 'only' }] },
      evaluation: { answer: 'a', explanation: 'e' }
    })] }),
    'one option'
  );
  expectRejected(
    validCourse({ nodes: [choiceNode({
      display: { title: 'a', prompt: 'p', options: [] },
      evaluation: { answer: 'a', explanation: 'e' }
    })] }),
    'zero options'
  );
});

test('rejects duplicate choice option ids and empty labels', () => {
  expectRejected(
    validCourse({ nodes: [choiceNode({
      display: { title: 'a', prompt: 'p', options: [{ id: 'a', label: 'x' }, { id: 'a', label: 'y' }] },
      evaluation: { answer: 'a', explanation: 'e' }
    })] }),
    'duplicate option ids'
  );
  expectRejected(
    validCourse({ nodes: [choiceNode({
      display: { title: 'a', prompt: 'p', options: [{ id: 'a', label: '  ' }, { id: 'b', label: 'y' }] },
      evaluation: { answer: 'a', explanation: 'e' }
    })] }),
    'whitespace option label'
  );
});

test('rejects a choice answer that does not reference an existing option', () => {
  expectRejected(validCourse({ nodes: [choiceNode({ evaluation: { answer: 'z', explanation: 'e' } })] }), 'unknown answer');
  expectRejected(validCourse({ nodes: [choiceNode({ evaluation: { answer: '', explanation: 'e' } })] }), 'empty answer');
  expectRejected(validCourse({ nodes: [choiceNode({ evaluation: { explanation: 'e' } })] }), 'missing answer');
  expectRejected(validCourse({ nodes: [choiceNode({ evaluation: { answer: 'b' } })] }), 'missing explanation');
});

test('rejects a blank node without a usable accepted answer', () => {
  const withEval = (evaluation) => validCourse({ nodes: [blankNode({ evaluation })] });
  expectRejected(withEval({ acceptedAnswers: [], normalize: ['trim', 'casefold'], explanation: 'e' }), 'empty answers');
  expectRejected(withEval({ acceptedAnswers: [''], normalize: ['trim', 'casefold'], explanation: 'e' }), 'empty string answer');
  expectRejected(withEval({ acceptedAnswers: ['  '], normalize: ['trim', 'casefold'], explanation: 'e' }), 'whitespace answer');
  expectRejected(withEval({ normalize: ['trim', 'casefold'], explanation: 'e' }), 'missing acceptedAnswers');
  expectRejected(withEval({ acceptedAnswers: 'suggested', normalize: ['trim', 'casefold'], explanation: 'e' }), 'answers not an array');
});

test('rejects blank answers that collide after the fixed normalization', () => {
  // normalize is fixed to trim+casefold, so 'Suggested' and 'suggested ' are the
  // same answer. Storing both is a teacher-side mistake worth surfacing, not a
  // duplicate to silently dedupe.
  expectRejected(
    validCourse({ nodes: [blankNode({ evaluation: {
      acceptedAnswers: ['suggested', 'Suggested '],
      normalize: ['trim', 'casefold'],
      explanation: 'e'
    } })] }),
    'answers colliding under trim+casefold'
  );
});

test('rejects a blank normalize list other than the fixed trim+casefold', () => {
  const withNormalize = (normalize) => validCourse({ nodes: [blankNode({ evaluation: {
    acceptedAnswers: ['suggested'], normalize, explanation: 'e'
  } })] });
  for (const normalize of [[], ['trim'], ['casefold', 'trim'], ['trim', 'casefold', 'strip_punctuation'], 'trim', null]) {
    expectRejected(withNormalize(normalize), `normalize ${JSON.stringify(normalize)}`);
  }
});

test('rejects a free_text node without teacher reference feedback', () => {
  expectRejected(validCourse({ nodes: [freeTextNode({ evaluation: {} })] }), 'missing referenceFeedback');
  expectRejected(validCourse({ nodes: [freeTextNode({ evaluation: { referenceFeedback: '  ' } })] }), 'whitespace feedback');
  expectRejected(validCourse({ nodes: [freeTextNode({ evaluation: null })] }), 'null evaluation');
});

test('rejects a free_text node that smuggles in answer judging or AI config', () => {
  // D-005: stage one stores the raw answer and shows preset feedback only.
  expectRejected(
    validCourse({ nodes: [freeTextNode({ evaluation: { referenceFeedback: 'f', answer: 'x' } })] }),
    'free_text with answer'
  );
  expectRejected(
    validCourse({ nodes: [freeTextNode({ evaluation: { referenceFeedback: 'f', model: 'claude-opus-5' } })] }),
    'free_text with model config'
  );
});

test('rejects nodes that are out of contract order rather than silently sorting', () => {
  // A-DATA-01 forbids silently repairing semantic errors. Ordering is repaired by
  // normalizeCourse on the write path only; validateCourse reports it.
  const outOfOrder = validCourse({ nodes: [choiceNode(), noticeNode()] });
  expectRejected(outOfOrder, 'time out of order');

  const tiedTimes = validCourse({
    nodes: [
      choiceNode({ id: 'node-b', trigger: { kind: 'time_cross', timeSeconds: 39, captionId: null } }),
      noticeNode({ id: 'node-a' })
    ]
  });
  expectRejected(tiedTimes, 'tied times ordered by descending id');
});

test('accepts equal trigger times when node ids are ascending', () => {
  expectAccepted(
    validCourse({ nodes: [
      noticeNode({ id: 'node-a' }),
      choiceNode({ id: 'node-b', trigger: { kind: 'time_cross', timeSeconds: 39, captionId: null } })
    ] }),
    'tied times, ascending ids'
  );
});

test('normalizeCourse sorts nodes without mutating its input', () => {
  const input = validCourse({ nodes: [choiceNode(), noticeNode()] });
  const snapshot = structuredClone(input);

  const normalized = contract.normalizeCourse(input);

  assert.deepEqual(input, snapshot, 'input must not be mutated');
  assert.notEqual(normalized, input, 'must return a new object');
  assert.deepEqual(
    normalized.nodes.map((node) => node.id),
    ['node-1', 'node-2'],
    'nodes must be sorted by time'
  );
  expectAccepted(normalized, 'normalized output');
});

test('normalizeCourse breaks tied trigger times by ascending id', () => {
  const normalized = contract.normalizeCourse(validCourse({ nodes: [
    choiceNode({ id: 'node-z', trigger: { kind: 'time_cross', timeSeconds: 39, captionId: null } }),
    noticeNode({ id: 'node-a' })
  ] }));
  assert.deepEqual(normalized.nodes.map((node) => node.id), ['node-a', 'node-z']);
});

test('normalizeCourse derives courseId from videoRef', () => {
  const normalized = contract.normalizeCourse(validCourse({ courseId: 'bilibili:BV1Stale00000' }));
  assert.equal(normalized.courseId, 'bilibili:BV1WW4y1e7GL');
});

test('normalizeCourse does not repair semantic errors', () => {
  // Sorting is a representation concern. A missing title is not, and must still be
  // rejected after normalization rather than filled in with a placeholder.
  const broken = validCourse({ nodes: [noticeNode({ display: { title: '', body: 'b' } })] });
  expectRejected(contract.normalizeCourse(broken), 'normalized but still invalid');
});

test('normalizeCourse leaves an already-ordered course deeply equal', () => {
  const input = validCourse();
  assert.deepEqual(contract.normalizeCourse(input), input);
});

test('errors carry a stable code and a locatable field path', () => {
  const errors = expectRejected(
    validCourse({ nodes: [choiceNode({ evaluation: { answer: 'z', explanation: 'e' } })] }),
    'unknown answer'
  );
  const error = errors[0];
  assert.equal(typeof error.code, 'string');
  assert.ok(error.code.length > 0, 'code must be non-empty');
  assert.equal(error.code, error.code.toUpperCase(), 'code must be a stable uppercase constant');
  assert.equal(typeof error.path, 'string');
  assert.match(error.path, /nodes\[0\]/, 'path must locate the offending node');
});

test('errors never leak course prose, so logs and UI stay safe to show', () => {
  // A-SEC-01 and A-ERR-01: error text must not carry question prose, captions, or
  // answers, because these errors reach logs and the diagnostics page.
  const secret = 'I finished the client deck before the deadline.';
  const errors = expectRejected(
    validCourse({ nodes: [choiceNode({
      display: { title: '判断哪一句有证据', prompt: secret, options: [{ id: 'a', label: secret }] },
      evaluation: { answer: 'a', explanation: secret }
    })] }),
    'single option with prose'
  );
  const serialized = JSON.stringify(errors);
  assert.ok(!serialized.includes(secret), 'errors must not echo course prose');
  assert.ok(!serialized.includes('判断哪一句有证据'), 'errors must not echo titles');
});

test('validateCourse rejects non-object input without throwing', () => {
  for (const input of [null, undefined, 'course', 42, [], true]) {
    expectRejected(input, `input ${JSON.stringify(input) ?? 'undefined'}`);
  }
});

test('deriveCourseId builds the id from platform and videoId', () => {
  assert.equal(
    contract.deriveCourseId({ platform: 'bilibili', videoId: 'BV1WW4y1e7GL' }),
    'bilibili:BV1WW4y1e7GL'
  );
  assert.equal(contract.deriveCourseId(null), null);
  assert.equal(contract.deriveCourseId({ platform: 'bilibili' }), null);
});

test('exposes the schema version and node combinations as single sources of truth', () => {
  assert.equal(contract.SCHEMA_VERSION, 1);
  assert.deepEqual(
    contract.LEGAL_NODE_COMBINATIONS.map((combo) => `${combo.family}+${combo.interaction}`).sort(),
    ['attention+notice', 'followup+free_text', 'practice+blank', 'practice+choice']
  );
});
