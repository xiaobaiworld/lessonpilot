from time import perf_counter

import structlog
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.api.errors import ApiError
from app.db import get_db
from app.models.admin import Admin
from app.schemas.admin import (
    AdminTeacherMutationResponse,
    AdminTeacherSummary,
    CreateTeacherRequest,
)
from app.services.admin_teacher_service import (
    TeacherLoginConflict,
    TeacherNotFound,
    create_teacher_for_admin,
    get_teacher_summary_for_admin,
    list_teachers_for_admin,
    reset_teacher_password_for_admin,
)
from app.services.operation_log_service import record_operation

router = APIRouter(prefix="/api/v1/admin/teachers", tags=["admin-teachers"])


def log_admin_teacher_operation(
    db: Session,
    request: Request,
    admin: Admin,
    *,
    action: str,
    result: str,
    duration_ms: int,
    target_id: str | None = None,
    error_code: str | None = None,
) -> None:
    record_operation(
        db,
        request_id=request.state.request_id,
        actor_type="admin",
        actor_id=admin.id,
        module="admin-teachers",
        action=action,
        target_type="teacher",
        target_id=target_id,
        result=result,
        error_code=error_code,
        duration_ms=duration_ms,
    )


@router.get("", response_model=list[AdminTeacherSummary])
def list_teachers(
    request: Request,
    admin: Admin = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AdminTeacherSummary]:
    started_at = perf_counter()
    summaries = list_teachers_for_admin(db)
    duration_ms = round((perf_counter() - started_at) * 1000)
    log_admin_teacher_operation(
        db,
        request,
        admin,
        action="admin.teachers.list",
        result="success",
        duration_ms=duration_ms,
    )
    db.commit()
    structlog.get_logger("api.admin_teachers").info(
        "admin.teachers.list",
        admin_id=admin.id,
        teacher_count=len(summaries),
        duration_ms=duration_ms,
    )
    return [AdminTeacherSummary.model_validate(summary) for summary in summaries]


@router.post(
    "",
    response_model=AdminTeacherMutationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_teacher(
    payload: CreateTeacherRequest,
    request: Request,
    admin: Admin = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminTeacherMutationResponse:
    started_at = perf_counter()
    try:
        teacher, temporary_password = create_teacher_for_admin(
            db,
            login_name=payload.login_name,
            display_name=payload.display_name,
        )
    except TeacherLoginConflict:
        duration_ms = round((perf_counter() - started_at) * 1000)
        log_admin_teacher_operation(
            db,
            request,
            admin,
            action="admin.teachers.create",
            result="failure",
            duration_ms=duration_ms,
            error_code="TEACHER_LOGIN_CONFLICT",
        )
        db.commit()
        raise ApiError(409, "TEACHER_LOGIN_CONFLICT", "教师登录名已存在。") from None
    except ValueError:
        duration_ms = round((perf_counter() - started_at) * 1000)
        log_admin_teacher_operation(
            db,
            request,
            admin,
            action="admin.teachers.create",
            result="failure",
            duration_ms=duration_ms,
            error_code="VALIDATION_ERROR",
        )
        db.commit()
        raise ApiError(422, "VALIDATION_ERROR", "教师登录名和昵称不能为空。") from None

    summary = get_teacher_summary_for_admin(db, teacher.id)
    duration_ms = round((perf_counter() - started_at) * 1000)
    log_admin_teacher_operation(
        db,
        request,
        admin,
        action="admin.teachers.create",
        result="success",
        duration_ms=duration_ms,
        target_id=teacher.id,
    )
    db.commit()
    structlog.get_logger("api.admin_teachers").info(
        "admin.teachers.create",
        admin_id=admin.id,
        teacher_id=teacher.id,
        duration_ms=duration_ms,
    )
    return AdminTeacherMutationResponse(
        teacher=AdminTeacherSummary.model_validate(summary),
        temporary_password=temporary_password,
    )


@router.post(
    "/{teacher_id}/reset-password",
    response_model=AdminTeacherMutationResponse,
)
def reset_teacher_password(
    teacher_id: str,
    request: Request,
    admin: Admin = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminTeacherMutationResponse:
    started_at = perf_counter()
    try:
        teacher, temporary_password = reset_teacher_password_for_admin(db, teacher_id)
    except TeacherNotFound:
        duration_ms = round((perf_counter() - started_at) * 1000)
        log_admin_teacher_operation(
            db,
            request,
            admin,
            action="admin.teachers.password_reset",
            result="failure",
            duration_ms=duration_ms,
            target_id=teacher_id,
            error_code="RESOURCE_NOT_FOUND",
        )
        db.commit()
        raise ApiError(404, "RESOURCE_NOT_FOUND", "教师不存在。") from None

    summary = get_teacher_summary_for_admin(db, teacher.id)
    duration_ms = round((perf_counter() - started_at) * 1000)
    log_admin_teacher_operation(
        db,
        request,
        admin,
        action="admin.teachers.password_reset",
        result="success",
        duration_ms=duration_ms,
        target_id=teacher.id,
    )
    db.commit()
    structlog.get_logger("api.admin_teachers").info(
        "admin.teachers.password_reset",
        admin_id=admin.id,
        teacher_id=teacher.id,
        duration_ms=duration_ms,
    )
    return AdminTeacherMutationResponse(
        teacher=AdminTeacherSummary.model_validate(summary),
        temporary_password=temporary_password,
    )
