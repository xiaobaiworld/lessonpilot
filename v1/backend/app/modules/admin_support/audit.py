"""v1 Operation Audit - Stage 1E

Unified audit trail for all identity operations.
- Records action, actor, result, reason codes
- Never stores passwords, tokens, or raw authorization codes
- Enables compliance and troubleshooting
"""

from sqlalchemy import Column, String, DateTime, Text, Enum, Integer
from sqlalchemy.orm import declarative_base
from datetime import datetime, timezone
import enum
import json

Base = declarative_base()


class OperationAction(str, enum.Enum):
    """Audit-relevant operations."""
    admin_login = "admin_login"
    admin_logout = "admin_logout"
    admin_password_reset = "admin_password_reset"
    admin_account_suspend = "admin_account_suspend"
    admin_account_resume = "admin_account_resume"

    teacher_login = "teacher_login"
    teacher_logout = "teacher_logout"
    teacher_password_reset = "teacher_password_reset"
    teacher_account_suspend = "teacher_account_suspend"
    teacher_account_resume = "teacher_account_resume"

    workspace_create = "workspace_create"


class OperationResult(str, enum.Enum):
    """Result of operation."""
    success = "success"
    failure = "failure"


class OperationAudit(Base):
    """Append-only audit record.

    Never contains:
    - Passwords or password hashes
    - Session tokens or token digests
    - Authorization codes
    - Student learning data
    - Sensitive personal information
    """
    __tablename__ = 'v1_operation_audit'

    id = Column(String(36), primary_key=True)  # UUID
    action = Column(Enum(OperationAction), nullable=False)
    actor_type = Column(String(50), nullable=False)  # admin, teacher, system
    actor_id = Column(String(36), nullable=True)  # None for system actions
    target_type = Column(String(50), nullable=True)  # admin, teacher, workspace, course, lesson, draft
    target_id = Column(String(36), nullable=True)
    result = Column(Enum(OperationResult), nullable=False)
    reason_code = Column(String(100), nullable=True)  # e.g., "invalid_credentials", "account_suspended"
    metadata = Column(String(500), nullable=True)  # JSON; safe summary only
    request_id = Column(String(36), nullable=True)  # For request tracing
    occurred_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    @staticmethod
    def create_audit_entry(
        id: str,
        action: OperationAction,
        actor_type: str,
        actor_id: str | None,
        target_type: str | None,
        target_id: str | None,
        result: OperationResult,
        reason_code: str | None = None,
        metadata: dict | None = None,
        request_id: str | None = None,
    ) -> "OperationAudit":
        """Factory method to create audit entry with safety checks."""
        # Never audit sensitive data
        if metadata:
            forbidden_keys = {'password', 'token', 'hash', 'secret', 'credential'}
            for key in forbidden_keys:
                if key in metadata:
                    raise ValueError(f"Cannot audit sensitive field: {key}")

        return OperationAudit(
            id=id,
            action=action,
            actor_type=actor_type,
            actor_id=actor_id,
            target_type=target_type,
            target_id=target_id,
            result=result,
            reason_code=reason_code,
            metadata=json.dumps(metadata) if metadata else None,
            request_id=request_id,
        )
