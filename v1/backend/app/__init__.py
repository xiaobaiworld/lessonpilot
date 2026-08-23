"""
v1 Backend Application - Modular Monolith

Module structure (design 03 section 7):
- identity: Authentication, sessions, administrators, teachers
- workspace_course: Course, lesson, drafts, revisions
- authoring_release: CourseRelease, ReleaseLessonSnapshot, visibility
- entitlement_delivery: AccessCode, GrantItem, Redemption, capabilities
- admin_support: Audit logging, diagnostics, operations
- runtime_audit: Student session facts, learning outcomes (read-only)

Infrastructure:
- database: Alembic migrations, SQLAlchemy models, initialization
- security: Password hashing, session tokens, HMAC digests, secret management
- logging: Structured events, PII scrubbing, audit trail

This is a placeholder; implementation enters via stage 1 (1A-1G).
"""
