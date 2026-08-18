from time import perf_counter

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import require_teacher
from app.api.errors import ApiError
from app.api.v1.teacher_courses import write_operation
from app.db import get_db
from app.models.teacher import Teacher
from app.schemas.access_code import AccessCodeCreated
from app.services.access_code_service import (
    CourseNotPublished,
    create_course_access_code,
)
from app.services.course_service import ResourceNotFound, get_teacher_course

router = APIRouter(prefix="/api/v1/teacher/courses", tags=["access-codes"])


@router.post(
    "/{course_id}/access-codes",
    response_model=AccessCodeCreated,
    status_code=status.HTTP_201_CREATED,
)
def create_access_code(
    course_id: str,
    request: Request,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> AccessCodeCreated:
    started_at = perf_counter()
    secret = request.app.state.settings.access_code_secret
    if not secret:
        raise ApiError(500, "SERVER_MISCONFIGURED", "服务端授权码配置缺失。")
    try:
        course = get_teacher_course(db, teacher, course_id)
        _, raw_code = create_course_access_code(
            db,
            teacher,
            course_id=course_id,
            secret=secret,
        )
    except ResourceNotFound:
        error_code = "RESOURCE_NOT_FOUND"
        status_code = 404
        message = "课程不存在或不可访问。"
    except CourseNotPublished:
        error_code = "COURSE_NOT_PUBLISHED"
        status_code = 409
        message = "课程发布后才能创建授权码。"
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
