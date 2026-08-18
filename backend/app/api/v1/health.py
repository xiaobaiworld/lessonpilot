from time import perf_counter

import structlog
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import get_db
from app.services.operation_log_service import record_operation

router = APIRouter()


@router.get("/health")
def health(request: Request, db: Session = Depends(get_db)) -> dict[str, str]:
    started_at = perf_counter()
    settings: Settings = request.app.state.settings
    logger = structlog.get_logger("api.health")
    logger.debug("health.check.start")
    duration_ms = round((perf_counter() - started_at) * 1000)
    record_operation(
        db,
        request_id=request.state.request_id,
        actor_type="system",
        actor_id=None,
        module="health",
        action="health.check",
        target_type="service",
        target_id=settings.app_name,
        result="success",
        error_code=None,
        duration_ms=duration_ms,
    )
    db.commit()
    logger.info("health.check.success", duration_ms=duration_ms)
    return {
        "service": settings.app_name,
        "status": "ok",
        "api_version": settings.api_version,
    }
