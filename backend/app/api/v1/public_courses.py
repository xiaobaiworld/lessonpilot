from time import perf_counter

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.errors import ApiError
from app.db import get_db
from app.schemas.access_code import CourseDownloadRequest, CourseDownloadResponse
from app.services.access_code_service import (
    CourseNotAvailable,
    InvalidAccessCode,
    download_course_by_access_code,
)
from app.services.operation_log_service import record_operation

router = APIRouter(prefix="/api/v1/public", tags=["public-courses"])


@router.post("/course-download", response_model=CourseDownloadResponse)
def download_course(
    payload: CourseDownloadRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> CourseDownloadResponse:
    started_at = perf_counter()
    secret = request.app.state.settings.access_code_secret
    if not secret:
        raise ApiError(500, "SERVER_MISCONFIGURED", "服务端授权码配置缺失。")
    try:
        code, course = download_course_by_access_code(
            db,
            raw_code=payload.access_code,
            secret=secret,
        )
    except InvalidAccessCode:
        error_code = "INVALID_ACCESS_CODE"
        status_code = 401
        message = "授权码无效。"
        target_id = None
    except CourseNotAvailable:
        error_code = "COURSE_NOT_AVAILABLE"
        status_code = 404
        message = "课程当前不可下载。"
        target_id = None
    else:
        duration_ms = round((perf_counter() - started_at) * 1000)
        record_operation(
            db,
            request_id=request.state.request_id,
            actor_type="plugin",
            actor_id=None,
            module="download",
            action="course.download.success",
            target_type="course",
            target_id=code.course_id,
            result="success",
            error_code=None,
            duration_ms=duration_ms,
        )
        db.commit()
        return CourseDownloadResponse(course=course)

    duration_ms = round((perf_counter() - started_at) * 1000)
    record_operation(
        db,
        request_id=request.state.request_id,
        actor_type="anonymous",
        actor_id=None,
        module="download",
        action="course.download.failure",
        target_type="course",
        target_id=target_id,
        result="failure",
        error_code=error_code,
        duration_ms=duration_ms,
    )
    db.commit()
    raise ApiError(status_code, error_code, message) from None
