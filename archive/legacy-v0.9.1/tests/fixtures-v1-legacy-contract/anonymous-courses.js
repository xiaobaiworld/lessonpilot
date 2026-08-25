/**
 * v1 Anonymous Course Fixtures for Testing
 *
 * Stage 0D: Covers
 * - Two teachers (T1, T2)
 * - Two local identities (L1, L2)
 * - Repeated content lessons
 * - Same video multiple lessons
 * - Two releases of same course
 * - Multi-source authorizations
 * - Corrupted/legacy contracts
 */

export const FIXTURE_TEACHERS = [
  {
    id: 'teacher-001',
    name: 'Teacher One',
    email: 'teacher1@example.com'
  },
  {
    id: 'teacher-002',
    name: 'Teacher Two',
    email: 'teacher2@example.com'
  }
];

export const FIXTURE_LOCAL_IDENTITIES = [
  {
    clientId: 'client-identity-001',
    installationId: 'device-001',
    proof: 'hmac_proof_001_stub'
  },
  {
    clientId: 'client-identity-002',
    installationId: 'device-002',
    proof: 'hmac_proof_002_stub'
  }
];

/**
 * Single course with three versions of lessons:
 * - L1, L2: First release (two lessons covering same video)
 * - L3, L4: Second release (lesson L1 reappears with new content)
 */
export const FIXTURE_COURSE = {
  courseId: 'course-fixture-001',
  title: 'Anonymous Test Course',
  workspaceId: 'workspace-teacher-001',
  lessons: [
    {
      lessonId: 'lesson-001',
      sequence: 1,
      title: 'Introduction to Topic A',
      videoPlatform: 'bilibili',
      videoPlatformId: 'BV1Ac41187Lm',
      status: 'published'
    },
    {
      lessonId: 'lesson-002',
      sequence: 2,
      title: 'Deep Dive into Topic A',
      videoPlatform: 'bilibili',
      videoPlatformId: 'BV1Ac41187Lm',
      status: 'published'
    },
    {
      lessonId: 'lesson-003',
      sequence: 3,
      title: 'Topic B Overview',
      videoPlatform: 'youtube',
      videoPlatformId: 'dQw4w9WgXcQ',
      status: 'published'
    }
  ]
};

/**
 * Release 1.0: Lessons 001, 002
 * Release 1.1: All three lessons (demonstrating update)
 */
export const FIXTURE_RELEASES = [
  {
    releaseId: 'release-001-v1',
    courseId: 'course-fixture-001',
    releaseNumber: 1,
    lessons: ['lesson-001', 'lesson-002'],
    publishedAt: '2026-08-20T10:00:00Z',
    status: 'available'
  },
  {
    releaseId: 'release-001-v2',
    courseId: 'course-fixture-001',
    releaseNumber: 2,
    lessons: ['lesson-001', 'lesson-002', 'lesson-003'],
    publishedAt: '2026-08-22T14:30:00Z',
    status: 'available'
  }
];

/**
 * Authorization sources:
 * - AC1: Full course access, short-lived (expires 2026-08-25)
 * - AC2: Lesson-level grant (only lessons 001, 003)
 * - AC3: Expired authorization
 */
export const FIXTURE_ACCESS_CODES = [
  {
    accessCodeId: 'ac-001',
    displayTail: '3e2k',
    createdAt: '2026-08-20T10:00:00Z',
    expiresAt: '2026-08-25T23:59:59Z',
    status: 'active',
    grants: [
      {
        grantItemId: 'grant-001',
        type: 'course',
        courseId: 'course-fixture-001',
        scope: 'full'
      }
    ]
  },
  {
    accessCodeId: 'ac-002',
    displayTail: '7x9m',
    createdAt: '2026-08-21T09:00:00Z',
    expiresAt: '2026-09-30T23:59:59Z',
    status: 'active',
    grants: [
      {
        grantItemId: 'grant-002',
        type: 'lesson',
        courseId: 'course-fixture-001',
        lessonIds: ['lesson-001', 'lesson-003']
      }
    ]
  },
  {
    accessCodeId: 'ac-003-expired',
    displayTail: '5a1b',
    createdAt: '2026-08-10T00:00:00Z',
    expiresAt: '2026-08-19T23:59:59Z',
    status: 'expired',
    grants: [
      {
        grantItemId: 'grant-003',
        type: 'course',
        courseId: 'course-fixture-001'
      }
    ]
  }
];

/**
 * Redemptions: Device L1 redeemed AC1 and AC2; device L2 only AC1
 */
export const FIXTURE_REDEMPTIONS = [
  {
    redemptionId: 'redemption-001',
    accessCodeId: 'ac-001',
    clientProofHash: 'proof_hash_001',
    redeemedAt: '2026-08-20T11:15:00Z'
  },
  {
    redemptionId: 'redemption-002',
    accessCodeId: 'ac-002',
    clientProofHash: 'proof_hash_001',
    redeemedAt: '2026-08-21T10:30:00Z'
  },
  {
    redemptionId: 'redemption-003',
    accessCodeId: 'ac-001',
    clientProofHash: 'proof_hash_002',
    redeemedAt: '2026-08-20T16:45:00Z'
  }
];

/**
 * Corrupted/legacy contract examples
 */
export const FIXTURE_CORRUPTED_CONTRACTS = [
  {
    name: 'legacy-storage-v1',
    reason: 'old storage schema format',
    data: {
      installedCourse: {
        courseId: 'old-format',
        course: { /* invalid structure */ }
      }
    }
  },
  {
    name: 'unknown-message-version',
    reason: 'future extension message version',
    data: {
      type: 'unknown-node-type',
      schemaVersion: '3.0.0'
    }
  },
  {
    name: 'malformed-course-package',
    reason: 'missing required fields',
    data: {
      schemaVersion: '2.0.0',
      courseId: 'test'
      // Missing: releaseId, lessons, metadata
    }
  }
];

/**
 * Export combined fixture set for integration tests
 */
export const FIXTURE_BUNDLE = {
  teachers: FIXTURE_TEACHERS,
  localIdentities: FIXTURE_LOCAL_IDENTITIES,
  course: FIXTURE_COURSE,
  releases: FIXTURE_RELEASES,
  accessCodes: FIXTURE_ACCESS_CODES,
  redemptions: FIXTURE_REDEMPTIONS,
  corrupted: FIXTURE_CORRUPTED_CONTRACTS
};
