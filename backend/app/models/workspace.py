from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db_base import Base

if TYPE_CHECKING:
    # 关系类型的前向引用。放在 TYPE_CHECKING 下：SQLAlchemy 运行时按字符串解析，
    # 真实导入会形成循环依赖；但静态检查需要这些名字存在，否则 Ruff 报 F821。
    from app.models.course import Course


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    owner_teacher_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("teachers.id"),
        unique=True,
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    courses: Mapped[list["Course"]] = relationship(back_populates="workspace")
