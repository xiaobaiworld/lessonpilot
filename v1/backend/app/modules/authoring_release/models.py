"""v1 Script domain models - Stage 1D

ScriptDraft: versioned aggregates containing InteractionNodes (four types)
- Optimistic concurrency via revision field
- Conflict detection and stable error responses
- Never overwrite on save failure
"""

from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, String, Integer, DateTime, ForeignKey, JSON, Index

from app.infrastructure.database.base import Base


class ScriptDraft(Base):
    """v1 ScriptDraft - versioned aggregation of nodes for a lesson.

    - One active draft per lesson_id
    - revision enables optimistic concurrency
    - content_digest enables idempotency and conflict detection
    - Entire save is atomic: validates all nodes before writing
    - Save failure leaves previous version intact
    """

    __tablename__ = "v1_script_drafts"

    id = Column(String(36), primary_key=True)  # UUID
    lesson_id = Column(String(36), ForeignKey("v1_lessons.id"), unique=True, nullable=False)
    schema_version = Column(String(10), default="1", nullable=False)
    revision = Column(Integer, default=1, nullable=False)  # Optimistic concurrency counter
    content = Column(JSON(), nullable=False)
    content_digest = Column(String(64), nullable=False)  # SHA256 hex of content
    saved_by_teacher_id = Column(String(36), ForeignKey("v1_teacher_accounts.id"), nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_script_drafts_lesson_id", "lesson_id"),
        Index("ix_script_drafts_teacher_id", "saved_by_teacher_id"),
    )


class PreviewSession(Base):
    """A locked, short-lived run of one exact draft revision."""

    __tablename__ = "v1_preview_sessions"

    id = Column(String(36), primary_key=True)
    teacher_id = Column(String(36), ForeignKey("v1_teacher_accounts.id"), nullable=False)
    course_id = Column(String(36), ForeignKey("v1_courses.id"), nullable=False)
    lesson_id = Column(String(36), ForeignKey("v1_lessons.id"), nullable=False)
    draft_id = Column(String(36), ForeignKey("v1_script_drafts.id"), nullable=False)
    draft_revision = Column(Integer, nullable=False)
    content_digest = Column(String(64), nullable=False)
    locked_content = Column(JSON(), nullable=True)
    contract_version = Column(String(30), nullable=False)
    plugin_version = Column(String(30), nullable=True)
    started_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    succeeded = Column(Boolean, nullable=True)
    error_category = Column(String(60), nullable=True)

    __table_args__ = (
        Index("ix_preview_sessions_lesson_id", "lesson_id"),
        Index("ix_preview_sessions_teacher_id", "teacher_id"),
    )
