from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, String

from app.infrastructure.database.base import Base


class OperationAudit(Base):
    __tablename__ = "v1_operation_audit"

    id = Column(String(36), primary_key=True)
    action = Column(String(60), nullable=False)
    actor_type = Column(String(30), nullable=False)
    actor_id = Column(String(36), nullable=True)
    target_type = Column(String(30), nullable=True)
    target_id = Column(String(36), nullable=True)
    result = Column(String(30), nullable=False)
    reason_code = Column(String(100), nullable=True)
    metadata_json = Column("metadata", String(500), nullable=True)
    request_id = Column(String(36), nullable=True)
    occurred_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
