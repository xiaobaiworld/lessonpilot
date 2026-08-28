"""v1 Course domain models - Stage 1C

Course, Lesson, VideoReference with:
- Explicit sequence ordering
- Revision tracking for optimistic concurrency
- Archive and delivery pause states
- Support for repeated content and same-video lessons
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    ForeignKey,
    Enum,
    Text,
    Index,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
import enum

from app.infrastructure.database.base import Base


class CourseStatus(str, enum.Enum):
    """Course lifecycle status."""

    draft = "draft"
    active = "active"
    archived = "archived"
    delivery_paused = "delivery_paused"  # Legal/content dispute hold


class Workspace(Base):
    __tablename__ = "v1_workspaces"

    id = Column(String(36), primary_key=True)
    owner_teacher_id = Column(
        String(36), ForeignKey("v1_teacher_accounts.id"), unique=True, nullable=False
    )
    name = Column(String(255), nullable=False)
    status = Column(String(50), default="active", nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    owner = relationship("TeacherAccount", back_populates="workspace")
    courses = relationship("Course", back_populates="workspace", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_workspaces_owner_teacher_id", "owner_teacher_id"),)


class Course(Base):
    """v1 Course - root object for a set of lessons.

    - workspace_id + title defines scope (not uniqueness; duplicates allowed)
    - revision enables optimistic concurrency on title/description changes
    - status tracks lifecycle: draft -> active -> archived or delivery_paused
    - display_order influences UI sorting within workspace
    """

    __tablename__ = "v1_courses"

    id = Column(String(36), primary_key=True)  # UUID
    workspace_id = Column(String(36), ForeignKey("v1_workspaces.id"), nullable=False)
    version_family_id = Column(String(36), nullable=False)
    source_course_id = Column(String(36), nullable=True)
    source_release_id = Column(String(36), nullable=True)
    version_number = Column(Integer, default=1, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    revision = Column(Integer, default=1, nullable=False)  # Optimistic concurrency
    status = Column(Enum(CourseStatus), default=CourseStatus.draft, nullable=False)
    display_order = Column(Integer, nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    archived_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    workspace = relationship("Workspace", back_populates="courses")
    lessons = relationship("Lesson", back_populates="course", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_courses_workspace_id", "workspace_id"),
        Index("ix_courses_version_family_id", "version_family_id"),
        Index("ix_courses_status", "status"),
    )


class Lesson(Base):
    """v1 Lesson - one installment within a course.

    Key design:
    - lesson_id is stable across all versions (not sequence-based)
    - (course_id, sequence) is unique; explicit ordering, not creation time
    - Same BVID can appear in multiple lessons (same course or different courses)
    - Same content/title in multiple lessons is allowed (no deduplication)
    - revision enables optimistic concurrency on edits
    """

    __tablename__ = "v1_lessons"

    id = Column(String(36), primary_key=True)  # UUID
    course_id = Column(String(36), ForeignKey("v1_courses.id"), nullable=False)
    sequence = Column(Integer, nullable=False)  # Display/play order within course
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    revision = Column(Integer, default=1, nullable=False)  # Optimistic concurrency
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    course = relationship("Course", back_populates="lessons")
    video_reference = relationship(
        "VideoReference", back_populates="lesson", uselist=False, cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_lessons_course_id", "course_id"),
        UniqueConstraint("course_id", "sequence", name="uq_lessons_course_sequence"),
    )


class VideoReference(Base):
    """v1 VideoReference - value object owned by lesson.

    - Immutable after lesson creation (edit by creating new lesson)
    - Platform + platform_video_id + page/cid identify the source
    - Optional segment/start_time for partial video support
    """

    __tablename__ = "v1_video_references"

    id = Column(String(36), primary_key=True)  # UUID
    lesson_id = Column(String(36), ForeignKey("v1_lessons.id"), unique=True, nullable=False)
    platform = Column(String(50), nullable=False)  # bilibili, youtube, local_file
    platform_video_id = Column(String(255), nullable=False)  # BVID, video ID, or SHA256
    page = Column(Integer, nullable=False, default=1, server_default="1")  # B 站分 P，从 1 开始
    cid = Column(String(64), nullable=True)  # B 站 UGC 内容 ID
    start_time_seconds = Column(Integer, nullable=True)  # Optional: start offset
    end_time_seconds = Column(Integer, nullable=True)  # Optional: end offset
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    lesson = relationship("Lesson", back_populates="video_reference")

    __table_args__ = (
        Index("ix_video_references_lesson_id", "lesson_id"),
        Index("ix_video_references_platform_id", "platform", "platform_video_id"),
        Index(
            "ix_video_references_platform_page_cid",
            "platform",
            "platform_video_id",
            "page",
            "cid",
        ),
    )
