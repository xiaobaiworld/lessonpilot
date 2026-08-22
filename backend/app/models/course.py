from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db_base import Base
from app.identifiers import generate_uuid

if TYPE_CHECKING:
    # 关系类型的前向引用。放在 TYPE_CHECKING 下：SQLAlchemy 运行时按字符串解析，
    # 真实导入会形成循环依赖；但静态检查需要这些名字存在，否则 Ruff 报 F821。
    from app.models.lesson import Lesson
    from app.models.workspace import Workspace


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workspace_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("workspaces.id"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    workspace: Mapped["Workspace"] = relationship(back_populates="courses")
    lessons: Mapped[list["Lesson"]] = relationship(
        back_populates="course",
        order_by="Lesson.sort_order, Lesson.created_at",
    )
