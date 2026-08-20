from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db_base import Base
from app.models.access_grant import AccessGrant


class AccessCode(Base):
    __tablename__ = "access_codes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    course_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("courses.id"),
        index=True,
        nullable=False,
    )
    code_digest: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    code_hint: Mapped[str] = mapped_column(String(5), nullable=False)
    code_type: Mapped[str] = mapped_column(String(20), default="long_term", nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    grants: Mapped[list[AccessGrant]] = relationship(
        back_populates="access_code",
        cascade="all, delete-orphan",
        order_by="AccessGrant.course_id, AccessGrant.lesson_id, AccessGrant.node_id, AccessGrant.id",
    )
