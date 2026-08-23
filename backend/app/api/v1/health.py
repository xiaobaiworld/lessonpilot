from time import perf_counter

import structlog
from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import get_db
from app.services.operation_log_service import record_operation

router = APIRouter()


@router.get("/api/v1/meta/version")
def version(request: Request, db: Session = Depends(get_db)) -> dict[str, str | bool]:
    """版本与就绪探针。

    `/health` 只说进程活着，切换后无法据此确认部署的是哪一版，也不知道
    数据库是否真的能用。发布探针需要这两个事实：迁移版本对不上就说明部署
    了错的组合，而这必须在切换前发现（6B 的版本闸门用它比对）。
    """
    settings: Settings = request.app.state.settings
    logger = structlog.get_logger("api.version")

    # 就绪与迁移版本是两件事，分开查。
    # 测试库能查询但没有 alembic 表；把两者混为一谈会让"数据库不可用"
    # 这个信号在真出问题时不可信。
    database_ready = False
    try:
        db.execute(text("SELECT 1"))
        database_ready = True
    except Exception:  # noqa: BLE001 - 探针不能因为查询失败而 500
        logger.warning("version.database_unavailable")

    migration = "unknown"
    if database_ready:
        try:
            row = db.execute(text("SELECT version_num FROM alembic_version")).fetchone()
            migration = row[0] if row else "none"
        except Exception:  # noqa: BLE001
            # 没有 alembic 表：可能是测试库，也可能是漏跑迁移。
            # 如实报告为 none，由发布探针据此判断
            migration = "none"

    return {
        "service": settings.app_name,
        "app_version": settings.app_version,
        "api_version": settings.api_version,
        "app_env": settings.app_env,
        "migration": migration,
        "database_ready": database_ready,
    }


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
