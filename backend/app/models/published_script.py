from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db_base import Base


class PublishedScript(Base):
    __tablename__ = "published_scripts"
    __table_args__ = (
        UniqueConstraint("lesson_id", "version", name="uq_published_scripts_lesson_version"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    lesson_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("lessons.id"),
        index=True,
        nullable=False,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    config_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    published_by: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("teachers.id"),
        nullable=False,
    )
