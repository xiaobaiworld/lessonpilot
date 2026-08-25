from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String

from app.infrastructure.database.base import Base


class RightsAttestation(Base):
    __tablename__ = "v1_rights_attestations"

    id = Column(String(36), primary_key=True)
    statement_version = Column(String(30), nullable=False)
    teacher_id = Column(String(36), ForeignKey("v1_teacher_accounts.id"), nullable=False)
    scope_type = Column(String(30), nullable=False)
    scope_id = Column(String(36), nullable=True)
    result = Column(String(30), nullable=False)
    attested_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class TrialFollowup(Base):
    __tablename__ = "v1_trial_followups"

    id = Column(String(36), primary_key=True)
    feishu_record_ref = Column(String(255), unique=True, nullable=False)
    status = Column(String(30), nullable=False)
    teacher_id = Column(String(36), nullable=True)
    updated_by_admin_id = Column(String(36), ForeignKey("v1_admin_accounts.id"), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
