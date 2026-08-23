from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db_base import Base

if TYPE_CHECKING:
    # 关系类型的前向引用。放在 TYPE_CHECKING 下：SQLAlchemy 运行时按字符串解析，
    # 真实导入会形成循环依赖；但静态检查需要这些名字存在，否则 Ruff 报 F821。
    from app.models.access_code import AccessCode


class AccessGrant(Base):
    __tablename__ = "access_grants"
    __table_args__ = (
        CheckConstraint(
            "node_id IS NULL OR lesson_id IS NOT NULL",
            name="ck_access_grants_node_requires_lesson",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    access_code_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("access_codes.id"),
        index=True,
        nullable=False,
    )
    course_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("courses.id"),
        index=True,
        nullable=False,
    )
    lesson_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("lessons.id"),
        nullable=True,
    )
    node_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    access_code: Mapped[AccessCode] = relationship(back_populates="grants")
