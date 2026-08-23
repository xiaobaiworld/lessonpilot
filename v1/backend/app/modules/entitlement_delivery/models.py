"""v1 Access Code and Entitlement models - Stage 2C

AccessCode: one-time-use authorization for multi-course access
GrantItem: scope specification (course/lesson/node range)
Redemption: proof of redemption and entitlement grant
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, JSON, Boolean, Index, UniqueConstraint, Enum, DECIMAL
from sqlalchemy.orm import declarative_base, relationship
import enum

Base = declarative_base()


class GrantScope(str, enum.Enum):
    """Scope of a grant item."""
    course = "course"  # Entire course
    lesson_range = "lesson_range"  # Specific lessons
    node_range = "node_range"  # Specific nodes within lesson


class AccessCode(Base):
    """v1 AccessCode - single-use authorization for multi-course access.

    - display_tail: last 4 characters shown to user/admin
    - Full code never stored (only digest); only returned once at creation
    - expires_at: after expiry, cannot be redeemed
    - status: active, redeemed, or expired
    - One redemption per code per local identity (student device)
    """
    __tablename__ = 'v1_access_codes'

    id = Column(String(36), primary_key=True)  # UUID
    code_digest = Column(String(64), nullable=False, unique=True)  # HMAC digest of full code
    display_tail = Column(String(4), nullable=False)  # Last 4 chars for display
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    created_by_teacher_id = Column(String(36), ForeignKey('v1_teacher_accounts.id'), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), default='active', nullable=False)  # active, redeemed, expired

    # Relationships
    grants = relationship('GrantItem', back_populates='access_code', cascade='all, delete-orphan')
    redemptions = relationship('Redemption', back_populates='access_code', cascade='all, delete-orphan')

    __table_args__ = (
        Index('ix_access_codes_code_digest', 'code_digest'),
        Index('ix_access_codes_expires_at', 'expires_at'),
    )


class GrantItem(Base):
    """v1 GrantItem - specific scope within an access code.

    - One code can grant access to multiple courses/lessons
    - scope: course (entire course) or lesson_range (specific lessons) or node_range (specific nodes)
    """
    __tablename__ = 'v1_grant_items'

    id = Column(String(36), primary_key=True)  # UUID
    access_code_id = Column(String(36), ForeignKey('v1_access_codes.id'), nullable=False)
    scope = Column(Enum(GrantScope), nullable=False)

    # Scope targets
    course_id = Column(String(36), ForeignKey('v1_courses.id'), nullable=True)  # For scope=course
    lesson_id_start = Column(String(36), nullable=True)  # For scope=lesson_range
    lesson_id_end = Column(String(36), nullable=True)
    node_id_start = Column(String(36), nullable=True)  # For scope=node_range
    node_id_end = Column(String(36), nullable=True)
    within_lesson_id = Column(String(36), nullable=True)  # For scope=node_range

    # Relationships
    access_code = relationship('AccessCode', back_populates='grants')

    __table_args__ = (
        Index('ix_grant_items_access_code_id', 'access_code_id'),
        Index('ix_grant_items_course_id', 'course_id'),
    )


class Redemption(Base):
    """v1 Redemption - proof that an access code was redeemed on a device.

    - access_code_id + client_proof_hash is unique (one redemption per code per device)
    - Client proof: HMAC of device-specific proof + code
    - Never stores plaintext proof or code
    - Entitlement facts recorded for audit and student session binding
    """
    __tablename__ = 'v1_redemptions'

    id = Column(String(36), primary_key=True)  # UUID
    access_code_id = Column(String(36), ForeignKey('v1_access_codes.id'), nullable=False)
    client_proof_hash = Column(String(64), nullable=False)  # HMAC of client proof

    # Student entitlement recording
    granted_courses = Column(JSON(), nullable=False)  # { [course_id]: { release_id, nodes_until } }
    entitlement_facts = Column(JSON(), nullable=False)  # { course_id: { expires_at, source_code_tail, ... } }

    # Lifecycle
    redeemed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    access_code = relationship('AccessCode', back_populates='redemptions')

    __table_args__ = (
        UniqueConstraint('access_code_id', 'client_proof_hash', name='uq_redemptions_code_proof'),
        Index('ix_redemptions_access_code_id', 'access_code_id'),
    )
