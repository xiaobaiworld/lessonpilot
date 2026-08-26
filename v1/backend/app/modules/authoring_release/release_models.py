"""v1 CourseRelease domain models - Stage 2A

Replaces v0.9.1 PublishedScript semantics:
- CourseRelease: immutable snapshot at course level
- ReleaseLessonSnapshot: atomic lesson capture within release
- ReleaseAvailability: who can access the release

Key design:
- Entire course publish is one transaction (all-or-nothing)
- Validate before writing: no partial saves
- Release immutable after creation
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    ForeignKey,
    Boolean,
    JSON,
    Index,
    UniqueConstraint,
    Enum,
)
from sqlalchemy.orm import relationship
import enum

from app.infrastructure.database.base import Base


class ReleaseStatus(str, enum.Enum):
    """Release lifecycle status."""

    draft = "draft"  # Not yet published
    available = "available"  # Published and in use
    superseded = "superseded"  # Newer release available
    archived = "archived"  # Explicitly archived


class CourseRelease(Base):
    """v1 CourseRelease - immutable snapshot of entire course at release time.

    - course_id + release_number is unique (each release numbered sequentially)
    - Entire release validated before writing
    - release_number is monotonically increasing
    - source_course_revision tracks the course revision at publication time
    - Intent and idempotency key enable safe retries
    """

    __tablename__ = "v1_course_releases"

    id = Column(String(36), primary_key=True)  # UUID
    course_id = Column(String(36), ForeignKey("v1_courses.id"), nullable=False)
    release_number = Column(Integer, nullable=False)  # Sequential per course
    source_course_revision = Column(Integer, nullable=False)  # Course revision at publish time

    publish_intent_id = Column(String(64), nullable=False)

    course_title = Column(String(255), nullable=False)
    course_description = Column(String(2000), nullable=True)
    lesson_count = Column(Integer, nullable=False)
    status = Column(Enum(ReleaseStatus), default=ReleaseStatus.available, nullable=False)

    rights_attestation_id = Column(
        String(36), ForeignKey("v1_rights_attestations.id"), nullable=False
    )

    # Lifecycle
    published_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    published_by_teacher_id = Column(
        String(36), ForeignKey("v1_teacher_accounts.id"), nullable=False
    )
    archived_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    lessons = relationship(
        "ReleaseLessonSnapshot", back_populates="release", cascade="all, delete-orphan"
    )
    availability = relationship(
        "ReleaseAvailability", back_populates="release", cascade="all, delete-orphan", uselist=False
    )

    __table_args__ = (
        UniqueConstraint("course_id", "release_number", name="uq_releases_course_number"),
        UniqueConstraint("course_id", "publish_intent_id", name="uq_releases_course_intent"),
        Index("ix_releases_course_id", "course_id"),
        Index("ix_releases_status", "status"),
    )


class ReleaseLessonSnapshot(Base):
    """v1 ReleaseLessonSnapshot - immutable snapshot of lesson within release.

    - release_id + lesson_sequence is unique (preserves lesson order)
    - Captures lesson_id, title, video_id at publish time
    - Never updated after creation
    """

    __tablename__ = "v1_release_lesson_snapshots"

    id = Column(String(36), primary_key=True)  # UUID
    release_id = Column(String(36), ForeignKey("v1_course_releases.id"), nullable=False)
    lesson_sequence = Column(Integer, nullable=False)  # Display order within release

    # Snapshot of lesson at publish time
    lesson_id = Column(String(36), ForeignKey("v1_lessons.id"), nullable=False)
    lesson_title = Column(String(255), nullable=False)  # Snapshot of title
    lesson_revision = Column(Integer, nullable=False)
    lesson_description = Column(String(2000), nullable=True)

    # Video reference snapshot
    video_platform = Column(String(50), nullable=False)  # bilibili, youtube, local_file
    video_platform_id = Column(String(255), nullable=False)  # BVID, video ID, SHA256
    nodes = Column(JSON(), nullable=False)
    assets = Column(JSON(), nullable=False, default=list)
    draft_revision = Column(Integer, nullable=False)
    content_digest = Column(String(64), nullable=False)

    # Relationship
    release = relationship("CourseRelease", back_populates="lessons")

    __table_args__ = (
        UniqueConstraint("release_id", "lesson_sequence", name="uq_snapshots_release_sequence"),
        Index("ix_snapshots_release_id", "release_id"),
    )


class ReleaseAvailability(Base):
    """v1 ReleaseAvailability - who can access this release.

    - One availability per release
    - Scope: full course, specific lessons, or node-level
    - Can be restricted by date range or invalidated
    """

    __tablename__ = "v1_release_availability"

    id = Column(String(36), primary_key=True)  # UUID
    release_id = Column(
        String(36), ForeignKey("v1_course_releases.id"), unique=True, nullable=False
    )

    # Scope: defines what is accessible
    scope = Column(
        String(50), default="full_course", nullable=False
    )  # full_course, specific_lessons, nodes
    scope_data = Column(JSON(), nullable=True)  # e.g., { "lesson_ids": [...] } for specific_lessons

    # Validity period (optional)
    valid_from = Column(DateTime(timezone=True), nullable=True)
    valid_until = Column(DateTime(timezone=True), nullable=True)

    # Invalidation
    invalidated = Column(Boolean, default=False, nullable=False)
    invalidated_at = Column(DateTime(timezone=True), nullable=True)
    invalidation_reason = Column(
        String(100), nullable=True
    )  # e.g., "rights_dispute", "admin_action"

    # Relationship
    release = relationship("CourseRelease", back_populates="availability")

    __table_args__ = (Index("ix_availability_release_id", "release_id"),)
