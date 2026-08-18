from time import perf_counter

import structlog
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.api.deps import require_teacher
from app.api.errors import ApiError
from app.config import Settings
from app.db import get_db
from app.models.teacher import Teacher
from app.repositories.teacher_session_repository import get_active_session
from app.schemas.auth import AuthResponse, LoginRequest, LogoutResponse, TeacherPublic
from app.services.auth_service import (
    authenticate_teacher,
    create_teacher_session,
    digest_session_token,
    revoke_teacher_session,
)
from app.services.operation_log_service import record_operation

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def log_auth_operation(
    db: Session,
    request: Request,
    *,
    action: str,
    result: str,
    duration_ms: int,
    teacher_id: str | None = None,
    error_code: str | None = None,
) -> None:
    record_operation(
        db,
        request_id=request.state.request_id,
        actor_type="teacher" if teacher_id else "anonymous",
        actor_id=teacher_id,
        module="auth",
        action=action,
        target_type="teacher",
        target_id=teacher_id,
        result=result,
        error_code=error_code,
        duration_ms=duration_ms,
    )


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    started_at = perf_counter()
    settings: Settings = request.app.state.settings
    logger = structlog.get_logger("api.auth")
    teacher = authenticate_teacher(db, payload.login_name, payload.password)
    if teacher is None or not settings.session_secret:
        duration_ms = round((perf_counter() - started_at) * 1000)
        log_auth_operation(
            db,
            request,
            action="auth.login.failure",
            result="failure",
            duration_ms=duration_ms,
            error_code="AUTH_INVALID_CREDENTIALS",
        )
        db.commit()
        logger.warning("auth.login.failure", duration_ms=duration_ms)
        raise ApiError(401, "AUTH_INVALID_CREDENTIALS", "用户名或密码错误")

    raw_token, _ = create_teacher_session(
        db,
        teacher,
        session_secret=settings.session_secret,
        ttl_seconds=settings.session_ttl_seconds,
    )
    duration_ms = round((perf_counter() - started_at) * 1000)
    log_auth_operation(
        db,
        request,
        action="auth.login.success",
        result="success",
        duration_ms=duration_ms,
        teacher_id=teacher.id,
    )
    db.commit()
    response.set_cookie(
        key=settings.session_cookie_name,
        value=raw_token,
        max_age=settings.session_ttl_seconds,
        httponly=True,
        samesite="lax",
        secure=settings.app_env == "production",
    )
    logger.info("auth.login.success", teacher_id=teacher.id, duration_ms=duration_ms)
    return AuthResponse(teacher=TeacherPublic.model_validate(teacher))


@router.post("/logout", response_model=LogoutResponse)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> LogoutResponse:
    started_at = perf_counter()
    settings: Settings = request.app.state.settings
    raw_token = request.cookies.get(settings.session_cookie_name)
    teacher_id = None
    if raw_token and settings.session_secret:
        token_digest = digest_session_token(raw_token, settings.session_secret)
        teacher_session = get_active_session(db, token_digest)
        if teacher_session is not None:
            teacher_id = teacher_session.teacher_id
            revoke_teacher_session(teacher_session)

    duration_ms = round((perf_counter() - started_at) * 1000)
    log_auth_operation(
        db,
        request,
        action="auth.logout",
        result="success",
        duration_ms=duration_ms,
        teacher_id=teacher_id,
    )
    db.commit()
    response.delete_cookie(settings.session_cookie_name)
    structlog.get_logger("api.auth").info(
        "auth.logout.success",
        teacher_id=teacher_id,
        duration_ms=duration_ms,
    )
    return LogoutResponse(logged_out=True)


@router.get("/me", response_model=AuthResponse)
def me(
    request: Request,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> AuthResponse:
    started_at = perf_counter()
    duration_ms = round((perf_counter() - started_at) * 1000)
    log_auth_operation(
        db,
        request,
        action="auth.session.restore",
        result="success",
        duration_ms=duration_ms,
        teacher_id=teacher.id,
    )
    db.commit()
    return AuthResponse(teacher=TeacherPublic.model_validate(teacher))
