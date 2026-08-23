"""Alembic migration: v1 release and entitlement models

Creates CourseRelease, ReleaseLessonSnapshot, ReleaseAvailability (stage 2A)
and AccessCode, GrantItem, Redemption (stage 2C).
"""

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    """Create v1 release and entitlement schema."""

    # CourseRelease
    op.create_table(
        'v1_course_releases',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('course_id', sa.String(36), sa.ForeignKey('v1_courses.id'), nullable=False),
        sa.Column('release_number', sa.Integer(), nullable=False),
        sa.Column('source_course_revision', sa.Integer(), nullable=False),
        sa.Column('publish_intent_id', sa.String(36), nullable=True),
        sa.Column('idempotency_key', sa.String(255), nullable=True),
        sa.Column('lesson_count', sa.Integer(), nullable=False),
        sa.Column('status', sa.Enum('draft', 'available', 'superseded', 'archived', name='release_status'), default='available', nullable=False),
        sa.Column('preview_available', sa.Boolean(), default=False, nullable=False),
        sa.Column('rights_confirmed', sa.Boolean(), default=False, nullable=False),
        sa.Column('rights_confirmation_source', sa.String(100), nullable=True),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('published_by_teacher_id', sa.String(36), sa.ForeignKey('v1_teacher_accounts.id'), nullable=False),
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_unique_constraint('uq_releases_course_number', 'v1_course_releases', ['course_id', 'release_number'])
    op.create_index('ix_releases_course_id', 'v1_course_releases', ['course_id'])
    op.create_index('ix_releases_status', 'v1_course_releases', ['status'])

    # ReleaseLessonSnapshot
    op.create_table(
        'v1_release_lesson_snapshots',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('release_id', sa.String(36), sa.ForeignKey('v1_course_releases.id'), nullable=False),
        sa.Column('lesson_id', sa.String(36), sa.ForeignKey('v1_lessons.id'), nullable=False),
        sa.Column('lesson_sequence', sa.Integer(), nullable=False),
        sa.Column('source_lesson_revision', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('video_platform', sa.String(50), nullable=False),
        sa.Column('video_platform_id', sa.String(255), nullable=False),
        sa.Column('video_start_time_seconds', sa.Integer(), nullable=True),
        sa.Column('video_end_time_seconds', sa.Integer(), nullable=True),
        sa.Column('nodes_json', sa.JSON(), nullable=False),
        sa.Column('node_count', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_unique_constraint('uq_snapshots_release_sequence', 'v1_release_lesson_snapshots', ['release_id', 'lesson_sequence'])
    op.create_index('ix_snapshots_release_id', 'v1_release_lesson_snapshots', ['release_id'])
    op.create_index('ix_snapshots_lesson_id', 'v1_release_lesson_snapshots', ['lesson_id'])

    # ReleaseAvailability
    op.create_table(
        'v1_release_availability',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('release_id', sa.String(36), sa.ForeignKey('v1_course_releases.id'), unique=True, nullable=False),
        sa.Column('availability', sa.String(50), default='published', nullable=False),  # published, draft, paused, recalled
        sa.Column('last_changed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('changed_by_teacher_id', sa.String(36), nullable=True),
    )
    op.create_index('ix_availability_release_id', 'v1_release_availability', ['release_id'])

    # AccessCode
    op.create_table(
        'v1_access_codes',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('code_digest', sa.String(64), unique=True, nullable=False),
        sa.Column('display_tail', sa.String(4), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by_teacher_id', sa.String(36), sa.ForeignKey('v1_teacher_accounts.id'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(20), default='active', nullable=False),
    )
    op.create_index('ix_access_codes_code_digest', 'v1_access_codes', ['code_digest'])
    op.create_index('ix_access_codes_expires_at', 'v1_access_codes', ['expires_at'])

    # GrantItem
    op.create_table(
        'v1_grant_items',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('access_code_id', sa.String(36), sa.ForeignKey('v1_access_codes.id'), nullable=False),
        sa.Column('scope', sa.Enum('course', 'lesson_range', 'node_range', name='grant_scope'), nullable=False),
        sa.Column('course_id', sa.String(36), sa.ForeignKey('v1_courses.id'), nullable=True),
        sa.Column('lesson_id_start', sa.String(36), nullable=True),
        sa.Column('lesson_id_end', sa.String(36), nullable=True),
        sa.Column('node_id_start', sa.String(36), nullable=True),
        sa.Column('node_id_end', sa.String(36), nullable=True),
        sa.Column('within_lesson_id', sa.String(36), nullable=True),
    )
    op.create_index('ix_grant_items_access_code_id', 'v1_grant_items', ['access_code_id'])
    op.create_index('ix_grant_items_course_id', 'v1_grant_items', ['course_id'])

    # Redemption
    op.create_table(
        'v1_redemptions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('access_code_id', sa.String(36), sa.ForeignKey('v1_access_codes.id'), nullable=False),
        sa.Column('redeemed_by_client_proof_hash', sa.String(64), nullable=False),
        sa.Column('redeemed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('rights_attestation_id', sa.String(36), nullable=False),
    )
    op.create_index('ix_redemptions_access_code_id', 'v1_redemptions', ['access_code_id'])
    op.create_index('ix_redemptions_proof_hash', 'v1_redemptions', ['redeemed_by_client_proof_hash'])


def downgrade() -> None:
    """Drop v1 release and entitlement schema."""
    raise NotImplementedError("v1 migrations do not support downgrade; restore from backup")
