from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Index, JSON, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.infrastructure.database.base import Base


class AccessCode(Base):
    __tablename__ = "v1_access_codes"

    id = Column(String(36), primary_key=True)
    code_digest = Column(String(64), unique=True, nullable=False)
    display_tail = Column(String(5), nullable=False)
    created_by_teacher_id = Column(String(36), ForeignKey("v1_teacher_accounts.id"), nullable=False)
    idempotency_key = Column(String(64), nullable=False)
    redeem_from = Column(DateTime(timezone=True), nullable=True)
    redeem_until = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), default="active", nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    terminated_at = Column(DateTime(timezone=True), nullable=True)

    grants = relationship("GrantItem", back_populates="access_code", cascade="all, delete-orphan")
    redemptions = relationship(
        "Redemption", back_populates="access_code", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint(
            "created_by_teacher_id", "idempotency_key", name="uq_access_codes_teacher_intent"
        ),
        Index("ix_access_codes_code_digest", "code_digest"),
    )


class GrantItem(Base):
    __tablename__ = "v1_grant_items"

    id = Column(String(36), primary_key=True)
    access_code_id = Column(String(36), ForeignKey("v1_access_codes.id"), nullable=False)
    course_id = Column(String(36), ForeignKey("v1_courses.id"), nullable=False)
    scope = Column(String(20), nullable=False)
    scope_data = Column(JSON(), nullable=False)
    valid_from = Column(DateTime(timezone=True), nullable=True)
    valid_until = Column(DateTime(timezone=True), nullable=True)

    access_code = relationship("AccessCode", back_populates="grants")

    __table_args__ = (
        UniqueConstraint(
            "access_code_id", "course_id", "scope", name="uq_grants_code_course_scope"
        ),
        Index("ix_grant_items_access_code_id", "access_code_id"),
        Index("ix_grant_items_course_id", "course_id"),
    )


class Redemption(Base):
    __tablename__ = "v1_redemptions"

    id = Column(String(36), primary_key=True)
    access_code_id = Column(String(36), ForeignKey("v1_access_codes.id"), nullable=False)
    local_identity_digest = Column(String(64), nullable=False)
    local_proof_digest = Column(String(64), nullable=False)
    first_redeemed_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    last_redeemed_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    scope_summary = Column(JSON(), nullable=False)

    access_code = relationship("AccessCode", back_populates="redemptions")

    __table_args__ = (
        UniqueConstraint(
            "access_code_id", "local_identity_digest", name="uq_redemptions_code_identity"
        ),
        Index("ix_redemptions_local_identity", "local_identity_digest"),
    )
