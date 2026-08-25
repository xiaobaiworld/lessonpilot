import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import Settings
from app.infrastructure.database.session import get_db

router = APIRouter()


@router.get("/health")
def health(request: Request, db: Session = Depends(get_db)) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    settings: Settings = request.app.state.settings
    return {
        "service": settings.app_name,
        "status": "ok",
        "api_version": settings.api_version,
    }


@router.get("/api/v1/meta/version")
def version(request: Request, db: Session = Depends(get_db)) -> dict[str, str | bool]:
    settings: Settings = request.app.state.settings
    database_ready = False
    migration = "unknown"
    try:
        db.execute(text("SELECT 1"))
        database_ready = True
        try:
            row = db.execute(text("SELECT version_num FROM alembic_version")).fetchone()
            migration = row[0] if row else "none"
        except Exception:  # noqa: BLE001 - 探针需区分可连接与未迁移
            migration = "none"
    except Exception:  # noqa: BLE001 - 数据库故障时探针仍需返回版本
        pass
    return {
        "service": settings.app_name,
        "app_version": settings.app_version,
        "api_version": settings.api_version,
        "app_env": settings.app_env,
        "migration": migration,
        "database_ready": database_ready,
    }


@router.get("/api/v1/meta/contracts")
def contracts(request: Request) -> dict[str, object]:
    settings: Settings = request.app.state.settings
    try:
        manifest = json.loads(settings.contracts_manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=503, detail="CONTRACT_MANIFEST_UNAVAILABLE") from error
    return {
        "schemaVersion": manifest["schemaVersion"],
        "contracts": {name: details["version"] for name, details in manifest["contracts"].items()},
    }
