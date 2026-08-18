from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db_base import Base


class ScriptDraft(Base):
    __tablename__ = "script_drafts"
    __table_args__ = (UniqueConstraint("lesson_id", name="uq_script_drafts_lesson_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    lesson_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("lessons.id"),
        index=True,
        nullable=False,
    )
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False)
    config_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    lesson: Mapped["Lesson"] = relationship(back_populates="script_draft")
