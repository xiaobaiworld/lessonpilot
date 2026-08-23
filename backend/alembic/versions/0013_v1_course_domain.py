"""Alembic migration: v1 course domain models (extends 0012)

Creates Course, Lesson, VideoReference tables.
"""

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    """Create v1 course domain schema."""

    # Course
    op.create_table(
        'v1_courses',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('workspace_id', sa.String(36), sa.ForeignKey('v1_workspaces.id'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('revision', sa.Integer(), default=1, nullable=False),
        sa.Column('status', sa.Enum('draft', 'active', 'archived', 'delivery_paused', name='course_status'), default='draft', nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_courses_workspace_id', 'v1_courses', ['workspace_id'])
    op.create_index('ix_courses_status', 'v1_courses', ['status'])

    # Lesson
    op.create_table(
        'v1_lessons',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('course_id', sa.String(36), sa.ForeignKey('v1_courses.id'), nullable=False),
        sa.Column('sequence', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('revision', sa.Integer(), default=1, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_lessons_course_id', 'v1_lessons', ['course_id'])
    op.create_unique_constraint('uq_lessons_course_sequence', 'v1_lessons', ['course_id', 'sequence'])

    # VideoReference
    op.create_table(
        'v1_video_references',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('lesson_id', sa.String(36), sa.ForeignKey('v1_lessons.id'), unique=True, nullable=False),
        sa.Column('platform', sa.String(50), nullable=False),
        sa.Column('platform_video_id', sa.String(255), nullable=False),
        sa.Column('start_time_seconds', sa.Integer(), nullable=True),
        sa.Column('end_time_seconds', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_video_references_lesson_id', 'v1_video_references', ['lesson_id'])
    op.create_index('ix_video_references_platform_id', 'v1_video_references', ['platform', 'platform_video_id'])


def downgrade() -> None:
    """Drop v1 course domain schema."""
    raise NotImplementedError("v1 migrations do not support downgrade; restore from backup")
