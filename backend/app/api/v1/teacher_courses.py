from time import perf_counter

import structlog
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import require_teacher
from app.api.errors import ApiError
from app.db import get_db
from app.models.teacher import Teacher
from app.schemas.course import CourseCreate, CourseDetail, CourseListResponse, CourseSummary
from app.schemas.lesson import LessonCreate, LessonPublic
from app.schemas.publish import PublishResponse
from app.services.course_service import (
    LessonLimitReached,
    ResourceNotFound,
    create_course,
    create_lesson,
    get_teacher_course,
    list_teacher_courses,
)
from app.services.operation_log_service import record_operation
from app.services.publish_service import DraftNotReady, publish_teacher_course

router = APIRouter(prefix="/api/v1/teacher/courses", tags=["teacher-courses"])


def write_operation(
    db: Session,
    request: Request,
    teacher: Teacher,
    *,
    module: str,
    action: str,
    result: str,
    duration_ms: int,
    target_type: str,
    target_id: str | None,
    error_code: str | None = None,
) -> None:
    record_operation(
        db,
        request_id=request.state.request_id,
        actor_type="teacher",
        actor_id=teacher.id,
        module=module,
        action=action,
        target_type=target_type,
        target_id=target_id,
        result=result,
        error_code=error_code,
        duration_ms=duration_ms,
    )


@router.get("", response_model=CourseListResponse)
def list_courses(
    request: Request,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> CourseListResponse:
    started_at = perf_counter()
    courses = list_teacher_courses(db, teacher)
    duration_ms = round((perf_counter() - started_at) * 1000)
    write_operation(
        db,
        request,
        teacher,
        module="course",
        action="course.list.success",
        result="success",
        duration_ms=duration_ms,
        target_type="course_collection",
        target_id=None,
    )
    db.commit()
    return CourseListResponse(items=[CourseSummary.model_validate(course) for course in courses])


@router.post("", response_model=CourseSummary, status_code=status.HTTP_201_CREATED)
def create_teacher_course(
    payload: CourseCreate,
    request: Request,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> CourseSummary:
    started_at = perf_counter()
    course = create_course(
        db,
        teacher,
        title=payload.title,
        description=payload.description,
    )
    db.flush()
    duration_ms = round((perf_counter() - started_at) * 1000)
    write_operation(
        db,
        request,
        teacher,
        module="course",
        action="course.create.success",
        result="success",
        duration_ms=duration_ms,
        target_type="course",
        target_id=course.id,
    )
    db.commit()
    structlog.get_logger("api.course").info(
        "course.create.success",
        teacher_id=teacher.id,
        course_id=course.id,
        duration_ms=duration_ms,
    )
    return CourseSummary.model_validate(course)


@router.get("/{course_id}", response_model=CourseDetail)
def get_course(
    course_id: str,
    request: Request,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> CourseDetail:
    started_at = perf_counter()
    try:
        course = get_teacher_course(db, teacher, course_id)
    except ResourceNotFound:
        duration_ms = round((perf_counter() - started_at) * 1000)
        write_operation(
            db,
            request,
            teacher,
            module="course",
            action="course.read.failure",
            result="failure",
            duration_ms=duration_ms,
            target_type="course",
            target_id=course_id,
            error_code="RESOURCE_NOT_FOUND",
        )
        db.commit()
        raise ApiError(404, "RESOURCE_NOT_FOUND", "课程不存在或不可访问。") from None

    duration_ms = round((perf_counter() - started_at) * 1000)
    write_operation(
        db,
        request,
        teacher,
        module="course",
        action="course.read.success",
        result="success",
        duration_ms=duration_ms,
        target_type="course",
        target_id=course.id,
    )
    db.commit()
    return CourseDetail.model_validate(course)


@router.post(
    "/{course_id}/lessons",
    response_model=LessonPublic,
    status_code=status.HTTP_201_CREATED,
)
def create_course_lesson(
    course_id: str,
    payload: LessonCreate,
    request: Request,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> LessonPublic:
    started_at = perf_counter()
    try:
        lesson = create_lesson(
            db,
            teacher,
            course_id=course_id,
            title=payload.title,
            platform=payload.video_ref.platform,
            video_id=payload.video_ref.video_id,
        )
        db.flush()
    except ResourceNotFound:
        duration_ms = round((perf_counter() - started_at) * 1000)
        write_operation(
            db,
            request,
            teacher,
            module="lesson",
            action="lesson.create.failure",
            result="failure",
            duration_ms=duration_ms,
            target_type="course",
            target_id=course_id,
            error_code="RESOURCE_NOT_FOUND",
        )
        db.commit()
        raise ApiError(404, "RESOURCE_NOT_FOUND", "课程不存在或不可访问。") from None
    except LessonLimitReached:
        duration_ms = round((perf_counter() - started_at) * 1000)
        write_operation(
            db,
            request,
            teacher,
            module="lesson",
            action="lesson.create.failure",
            result="failure",
            duration_ms=duration_ms,
            target_type="course",
            target_id=course_id,
            error_code="LESSON_LIMIT_REACHED",
        )
        db.commit()
        raise ApiError(409, "LESSON_LIMIT_REACHED", "当前每门课程只能创建一个课节。") from None

    duration_ms = round((perf_counter() - started_at) * 1000)
    write_operation(
        db,
        request,
        teacher,
        module="lesson",
        action="lesson.create.success",
        result="success",
        duration_ms=duration_ms,
        target_type="lesson",
        target_id=lesson.id,
    )
    db.commit()
    structlog.get_logger("api.lesson").info(
        "lesson.create.success",
        teacher_id=teacher.id,
        course_id=course_id,
        lesson_id=lesson.id,
        duration_ms=duration_ms,
    )
    return LessonPublic.model_validate(lesson)


@router.post("/{course_id}/publish", response_model=PublishResponse, status_code=status.HTTP_201_CREATED)
def publish_course(
    course_id: str,
    request: Request,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> PublishResponse:
    started_at = perf_counter()
    try:
        published = publish_teacher_course(db, teacher, course_id=course_id)
    except ResourceNotFound:
        duration_ms = round((perf_counter() - started_at) * 1000)
        write_operation(
            db,
            request,
            teacher,
            module="publish",
            action="publish.course.failure",
            result="failure",
            duration_ms=duration_ms,
            target_type="course",
            target_id=course_id,
            error_code="RESOURCE_NOT_FOUND",
        )
        db.commit()
        raise ApiError(404, "RESOURCE_NOT_FOUND", "课程不存在或不可访问。") from None
    except DraftNotReady:
        duration_ms = round((perf_counter() - started_at) * 1000)
        write_operation(
            db,
            request,
            teacher,
            module="publish",
            action="publish.course.failure",
            result="failure",
            duration_ms=duration_ms,
            target_type="course",
            target_id=course_id,
            error_code="DRAFT_NOT_READY",
        )
        db.commit()
        raise ApiError(409, "DRAFT_NOT_READY", "课程还没有可发布的非空脚本草稿。") from None

    duration_ms = round((perf_counter() - started_at) * 1000)
    write_operation(
        db,
        request,
        teacher,
        module="publish",
        action="publish.course.success",
        result="success",
        duration_ms=duration_ms,
        target_type="course",
        target_id=course_id,
    )
    db.commit()
    return PublishResponse(
        course_id=course_id,
        lesson_id=published.lesson_id,
        version=published.version,
        published_at=published.published_at,
        course=published.config_json,
    )
