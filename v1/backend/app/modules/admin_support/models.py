from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import relationship

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


class TrialApplication(Base):
    __tablename__ = "v1_trial_applications"

    id = Column(String(36), primary_key=True)
    name = Column(String(120), nullable=False)
    contact = Column(String(255), nullable=False)
    course_category = Column(String(120), nullable=False)
    video_status = Column(String(120), nullable=False)
    bilibili_url = Column(String(500), nullable=True)
    teaching_problem = Column(Text, nullable=False)
    subtitle_status = Column(String(120), nullable=False)
    validation_question = Column(Text, nullable=True)
    source = Column(String(50), nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=False)

    followup = relationship(
        "TrialFollowup",
        back_populates="application",
        uselist=False,
        cascade="all, delete-orphan",
    )

    __table_args__ = (Index("ix_trial_applications_submitted_at", "submitted_at"),)


class TrialFollowup(Base):
    __tablename__ = "v1_trial_followups"

    id = Column(String(36), primary_key=True)
    trial_application_id = Column(
        String(36), ForeignKey("v1_trial_applications.id"), unique=True, nullable=False
    )
    status = Column(String(30), nullable=False)
    teacher_id = Column(String(36), nullable=True)
    updated_by_admin_id = Column(String(36), ForeignKey("v1_admin_accounts.id"), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    application = relationship("TrialApplication", back_populates="followup")
