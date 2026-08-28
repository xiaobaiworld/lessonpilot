import json
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.runtime_audit.models import OperationAudit


class RuntimeAuditApplicationService:
    def __init__(self, session: Session):
        self.session = session

    def record(
        self,
        *,
        action: str,
        actor_type: str,
        actor_id: str | None,
        target_type: str | None,
        target_id: str | None,
        result: str = "success",
        reason_code: str | None = None,
        idempotency_key: str | None = None,
        metadata: dict | None = None,
        request_id: str | None = None,
    ) -> OperationAudit:
        event = OperationAudit(
            id=str(uuid4()),
            action=action,
            actor_type=actor_type,
            actor_id=actor_id,
            target_type=target_type,
            target_id=target_id,
            result=result,
            reason_code=reason_code,
            idempotency_key=idempotency_key,
            metadata_json=(
                json.dumps(metadata, ensure_ascii=False, separators=(",", ":"))
                if metadata
                else None
            ),
            request_id=request_id,
        )
        self.session.add(event)
        return event

    def find_operation(
        self, actor_id: str, action: str, idempotency_key: str
    ) -> OperationAudit | None:
        return self.session.scalar(
            select(OperationAudit)
            .where(
                OperationAudit.actor_id == actor_id,
                OperationAudit.action == action,
                OperationAudit.idempotency_key == idempotency_key,
            )
            .order_by(OperationAudit.occurred_at.asc())
        )

    def list_target_events(self, target_type: str, target_id: str) -> list[OperationAudit]:
        return list(
            self.session.scalars(
                select(OperationAudit)
                .where(
                    OperationAudit.target_type == target_type,
                    OperationAudit.target_id == target_id,
                )
                .order_by(OperationAudit.occurred_at.asc(), OperationAudit.id.asc())
            )
        )
