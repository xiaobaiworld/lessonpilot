from datetime import timezone
from time import perf_counter

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import require_teacher
from app.api.errors import ApiError
from app.api.v1.teacher_courses import write_operation
from app.db import get_db
from app.models.teacher import Teacher
from app.schemas.access_code import (
    AccessCodeCounts,
    AccessCodeCreate,
    AccessCodeCreated,
    AccessGrantScope,
    AccessCodeListResponse,
    AccessCodeRecord,
)
from app.services.access_code_service import (
    CourseNotPublished,
    InvalidAccessScope,
    access_code_status,
    create_course_access_code,
    list_course_access_codes,
)
from app.services.course_service import ResourceNotFound, get_teacher_course

router = APIRouter(prefix="/api/v1/teacher/courses", tags=["access-codes"])


def _grant_scope(grant) -> AccessGrantScope:
    valid_from = grant.valid_from
    valid_until = grant.valid_until
    if valid_from is not None and valid_from.tzinfo is None:
        valid_from = valid_from.replace(tzinfo=timezone.utc)
    if valid_until is not None and valid_until.tzinfo is None:
        valid_until = valid_until.replace(tzinfo=timezone.utc)
    return AccessGrantScope.model_validate(
        {
            "course_id": grant.course_id,
            "lesson_id": grant.lesson_id,
            "node_id": grant.node_id,
            "valid_from": valid_from,
            "valid_until": valid_until,
        }
    )


@router.post(
    "/{course_id}/access-codes",
    response_model=AccessCodeCreated,
    status_code=status.HTTP_201_CREATED,
)
def create_access_code(
    course_id: str,
    request: Request,
    payload: AccessCodeCreate | None = None,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> AccessCodeCreated:
    started_at = perf_counter()
    secret = request.app.state.settings.access_code_secret
    if not secret:
        raise ApiError(500, "SERVER_MISCONFIGURED", "服务端授权码配置缺失。")
    try:
        course = get_teacher_course(db, teacher, course_id)
        row, raw_code = create_course_access_code(
            db,
            teacher,
            course_id=course_id,
            secret=secret,
            code_type=(payload or AccessCodeCreate()).code_type,
            scopes=[scope.model_dump() for scope in ((payload or AccessCodeCreate()).scopes or [])]
            or None,
        )
    except ResourceNotFound:
        error_code = "RESOURCE_NOT_FOUND"
        status_code = 404
        message = "课程不存在或不可访问。"
    except CourseNotPublished:
        error_code = "COURSE_NOT_PUBLISHED"
        status_code = 409
        message = "课程发布后才能创建授权码。"
    except InvalidAccessScope:
        error_code = "INVALID_ACCESS_SCOPE"
        status_code = 422
        message = "授权范围无效。"
    else:
        duration_ms = round((perf_counter() - started_at) * 1000)
        write_operation(
            db,
            request,
            teacher,
            module="access_code",
            action="access_code.create.success",
            result="success",
            duration_ms=duration_ms,
            target_type="course",
            target_id=course_id,
        )
        db.commit()
        return AccessCodeCreated(
            access_code=raw_code,
            course_id=course.id,
            course_title=course.title,
            code_type=row.code_type,
            created_at=row.created_at,
            expires_at=row.expires_at,
            scopes=[_grant_scope(grant) for grant in row.grants],
        )

    duration_ms = round((perf_counter() - started_at) * 1000)
    write_operation(
        db,
        request,
        teacher,
        module="access_code",
        action="access_code.create.failure",
        result="failure",
        duration_ms=duration_ms,
        target_type="course",
        target_id=course_id,
        error_code=error_code,
    )
    db.commit()
    raise ApiError(status_code, error_code, message) from None


@router.get(
    "/{course_id}/access-codes",
    response_model=AccessCodeListResponse,
)
def get_access_codes(
    course_id: str,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> AccessCodeListResponse:
    try:
        get_teacher_course(db, teacher, course_id)
    except ResourceNotFound:
        raise ApiError(404, "RESOURCE_NOT_FOUND", "课程不存在或不可访问。") from None

    rows = list_course_access_codes(db, course_id)
    counts = AccessCodeCounts(
        short_term=sum(row.code_type == "short_term" for row in rows),
        long_term=sum(row.code_type == "long_term" for row in rows),
    )
    return AccessCodeListResponse(
        total=len(rows),
        counts=counts,
        items=[
            AccessCodeRecord(
                id=row.id,
                code_hint=row.code_hint,
                code_type=row.code_type,
                created_at=row.created_at,
                expires_at=row.expires_at,
                status=access_code_status(row),
                scopes=[_grant_scope(grant) for grant in row.grants],
            )
            for row in rows
        ],
    )
