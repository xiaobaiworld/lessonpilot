from time import perf_counter

import structlog
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.api.errors import ApiError
from app.config import Settings
from app.db import get_db
from app.models.admin import Admin
from app.repositories.admin_session_repository import get_active_admin_session
from app.schemas.admin import (
    AdminAuthResponse,
    AdminLoginRequest,
    AdminLogoutResponse,
    AdminPublic,
)
from app.services.admin_auth_service import (
    authenticate_admin,
    create_admin_session,
    digest_admin_session_token,
    revoke_admin_session,
)
from app.services.operation_log_service import record_operation

router = APIRouter(prefix="/api/v1/admin/auth", tags=["admin-auth"])


def log_admin_auth_operation(
    db: Session,
    request: Request,
    *,
    action: str,
    result: str,
    duration_ms: int,
    admin_id: str | None = None,
    error_code: str | None = None,
) -> None:
    record_operation(
        db,
        request_id=request.state.request_id,
        actor_type="admin" if admin_id else "anonymous",
        actor_id=admin_id,
        module="admin-auth",
        action=action,
        target_type="admin",
        target_id=admin_id,
        result=result,
        error_code=error_code,
        duration_ms=duration_ms,
    )


@router.post("/login", response_model=AdminAuthResponse)
def login(
    payload: AdminLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AdminAuthResponse:
    started_at = perf_counter()
    settings: Settings = request.app.state.settings
    logger = structlog.get_logger("api.admin_auth")
    admin = authenticate_admin(db, payload.login_name, payload.password)
    if admin is None or not settings.session_secret:
        duration_ms = round((perf_counter() - started_at) * 1000)
        log_admin_auth_operation(
            db,
            request,
            action="admin-auth.login.failure",
            result="failure",
            duration_ms=duration_ms,
            error_code="AUTH_INVALID_CREDENTIALS",
        )
        db.commit()
        logger.warning("admin-auth.login.failure", duration_ms=duration_ms)
        raise ApiError(401, "AUTH_INVALID_CREDENTIALS", "用户名或密码错误")

    raw_token, _ = create_admin_session(
        db,
        admin,
        session_secret=settings.session_secret,
        ttl_seconds=settings.session_ttl_seconds,
    )
    duration_ms = round((perf_counter() - started_at) * 1000)
    log_admin_auth_operation(
        db,
        request,
        action="admin-auth.login.success",
        result="success",
        duration_ms=duration_ms,
        admin_id=admin.id,
    )
    db.commit()
    response.set_cookie(
        key=settings.admin_session_cookie_name,
        value=raw_token,
        max_age=settings.session_ttl_seconds,
        httponly=True,
        samesite="lax",
        secure=settings.app_env == "production",
    )
    logger.info(
        "admin-auth.login.success",
        admin_id=admin.id,
        duration_ms=duration_ms,
    )
    return AdminAuthResponse(admin=AdminPublic.model_validate(admin))


@router.post("/logout", response_model=AdminLogoutResponse)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AdminLogoutResponse:
    started_at = perf_counter()
    settings: Settings = request.app.state.settings
    raw_token = request.cookies.get(settings.admin_session_cookie_name)
    admin_id = None
    if raw_token and settings.session_secret:
        token_digest = digest_admin_session_token(raw_token, settings.session_secret)
        admin_session = get_active_admin_session(db, token_digest)
        if admin_session is not None:
            admin_id = admin_session.admin_id
            revoke_admin_session(admin_session)

    duration_ms = round((perf_counter() - started_at) * 1000)
    log_admin_auth_operation(
        db,
        request,
        action="admin-auth.logout",
        result="success",
        duration_ms=duration_ms,
        admin_id=admin_id,
    )
    db.commit()
    response.delete_cookie(
        settings.admin_session_cookie_name,
        httponly=True,
        samesite="lax",
        secure=settings.app_env == "production",
    )
    structlog.get_logger("api.admin_auth").info(
        "admin-auth.logout.success",
        admin_id=admin_id,
        duration_ms=duration_ms,
    )
    return AdminLogoutResponse(logged_out=True)


@router.get("/me", response_model=AdminAuthResponse)
def me(
    request: Request,
    admin: Admin = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminAuthResponse:
    started_at = perf_counter()
    duration_ms = round((perf_counter() - started_at) * 1000)
    log_admin_auth_operation(
        db,
        request,
        action="admin-auth.session.restore",
        result="success",
        duration_ms=duration_ms,
        admin_id=admin.id,
    )
    db.commit()
    return AdminAuthResponse(admin=AdminPublic.model_validate(admin))
