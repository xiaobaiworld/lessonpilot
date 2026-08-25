import test from 'node:test';
import assert from 'node:assert';
import {
  FIXTURE_BUNDLE,
  FIXTURE_TEACHERS,
  FIXTURE_LOCAL_IDENTITIES,
  FIXTURE_COURSE,
  FIXTURE_RELEASES,
  FIXTURE_ACCESS_CODES,
  FIXTURE_REDEMPTIONS,
  FIXTURE_CORRUPTED_CONTRACTS
} from './anonymous-courses.js';

test('v1 fixtures: teacher data', () => {
  assert.strictEqual(FIXTURE_TEACHERS.length, 2, 'Two teachers');
  assert.match(FIXTURE_TEACHERS[0].name, /^Teacher/);
  assert.match(FIXTURE_TEACHERS[0].email, /@example\.com$/);
});

test('v1 fixtures: local identities', () => {
  assert.strictEqual(FIXTURE_LOCAL_IDENTITIES.length, 2, 'Two local identities');
  assert(FIXTURE_LOCAL_IDENTITIES[0].clientId, 'has clientId');
  assert(FIXTURE_LOCAL_IDENTITIES[0].proof, 'has proof');
});

test('v1 fixtures: course structure', () => {
  assert(FIXTURE_COURSE.courseId, 'has courseId');
  assert.strictEqual(FIXTURE_COURSE.lessons.length, 3, 'Three lessons total');

  // Lesson 1 and 2 use same video (Bilibili)
  const l1 = FIXTURE_COURSE.lessons[0];
  const l2 = FIXTURE_COURSE.lessons[1];
  assert.strictEqual(l1.videoPlatformId, l2.videoPlatformId, 'Lesson 1 and 2 same video');
  assert.notStrictEqual(l1.lessonId, l2.lessonId, 'Different lesson IDs');
  assert.notStrictEqual(l1.sequence, l2.sequence, 'Different sequences');
});

test('v1 fixtures: releases demonstrate versioning', () => {
  assert.strictEqual(FIXTURE_RELEASES.length, 2, 'Two releases');
  assert.strictEqual(FIXTURE_RELEASES[0].releaseNumber, 1);
  assert.strictEqual(FIXTURE_RELEASES[1].releaseNumber, 2);
  assert.deepStrictEqual(FIXTURE_RELEASES[0].lessons, ['lesson-001', 'lesson-002']);
  assert.deepStrictEqual(FIXTURE_RELEASES[1].lessons, ['lesson-001', 'lesson-002', 'lesson-003']);
});

test('v1 fixtures: access codes with multi-level grants', () => {
  assert.strictEqual(FIXTURE_ACCESS_CODES.length, 3, 'Three access codes');

  const ac1 = FIXTURE_ACCESS_CODES[0];
  assert.strictEqual(ac1.grants[0].type, 'course', 'AC1 grants full course');

  const ac2 = FIXTURE_ACCESS_CODES[1];
  assert.strictEqual(ac2.grants[0].type, 'lesson', 'AC2 grants specific lessons');
  assert.strictEqual(ac2.grants[0].lessonIds.length, 2);

  const ac3 = FIXTURE_ACCESS_CODES[2];
  assert.strictEqual(ac3.status, 'expired', 'AC3 is expired');
});

test('v1 fixtures: redemptions - device L1 has AC1 and AC2; L2 has AC1', () => {
  const l1Redemptions = FIXTURE_REDEMPTIONS.filter(r => r.clientProofHash === 'proof_hash_001');
  const l2Redemptions = FIXTURE_REDEMPTIONS.filter(r => r.clientProofHash === 'proof_hash_002');

  assert.strictEqual(l1Redemptions.length, 2, 'L1 has two redemptions');
  assert.strictEqual(l2Redemptions.length, 1, 'L2 has one redemption');

  const l1Codes = l1Redemptions.map(r => r.accessCodeId);
  assert(l1Codes.includes('ac-001'));
  assert(l1Codes.includes('ac-002'));

  const l2Codes = l2Redemptions.map(r => r.accessCodeId);
  assert(l2Codes.includes('ac-001'));
  assert(!l2Codes.includes('ac-002'));
});

test('v1 fixtures: corrupted contracts for quarantine tests', () => {
  assert.strictEqual(FIXTURE_CORRUPTED_CONTRACTS.length, 3, 'Three corrupted examples');
  assert(FIXTURE_CORRUPTED_CONTRACTS.every(c => c.reason), 'All have reason');
  assert(FIXTURE_CORRUPTED_CONTRACTS.every(c => c.data), 'All have data payload');
});

test('v1 fixtures: bundle export completeness', () => {
  assert(FIXTURE_BUNDLE.teachers);
  assert(FIXTURE_BUNDLE.localIdentities);
  assert(FIXTURE_BUNDLE.course);
  assert(FIXTURE_BUNDLE.releases);
  assert(FIXTURE_BUNDLE.accessCodes);
  assert(FIXTURE_BUNDLE.redemptions);
  assert(FIXTURE_BUNDLE.corrupted);
});
