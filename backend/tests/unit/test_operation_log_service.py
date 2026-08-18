from sqlalchemy import select

from app.models.operation_log import OperationLog
from app.services.operation_log_service import record_operation


def test_record_operation_persists_a_safe_action_record(database_session) -> None:
    record_operation(
        database_session,
        request_id="request-123",
        actor_type="system",
        actor_id=None,
        module="health",
        action="health.check",
        target_type="service",
        target_id="api",
        result="success",
        error_code=None,
        duration_ms=3,
    )
    database_session.commit()

    row = database_session.scalar(select(OperationLog))

    assert row is not None
    assert row.request_id == "request-123"
    assert row.module == "health"
    assert row.action == "health.check"
    assert row.result == "success"
    assert row.duration_ms == 3
    assert not hasattr(row, "password")
    assert not hasattr(row, "access_code")
