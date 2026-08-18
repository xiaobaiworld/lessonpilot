from sqlalchemy.orm import Session

from app.models.operation_log import OperationLog


def record_operation(
    session: Session,
    *,
    request_id: str,
    actor_type: str,
    actor_id: str | None,
    module: str,
    action: str,
    target_type: str | None,
    target_id: str | None,
    result: str,
    error_code: str | None,
    duration_ms: int | None,
) -> OperationLog:
    row = OperationLog(
        request_id=request_id,
        actor_type=actor_type,
        actor_id=actor_id,
        module=module,
        action=action,
        target_type=target_type,
        target_id=target_id,
        result=result,
        error_code=error_code,
        duration_ms=duration_ms,
    )
    session.add(row)
    return row
