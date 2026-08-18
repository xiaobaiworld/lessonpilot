from time import perf_counter

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import require_teacher
from app.api.errors import ApiError
from app.api.v1.teacher_courses import write_operation
from app.db import get_db
from app.models.teacher import Teacher
from app.schemas.lesson import LessonPublic
from app.services.course_service import ResourceNotFound, get_teacher_lesson

router = APIRouter(prefix="/api/v1/teacher/lessons", tags=["teacher-lessons"])


@router.get("/{lesson_id}", response_model=LessonPublic)
def get_lesson(
    lesson_id: str,
    request: Request,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> LessonPublic:
    started_at = perf_counter()
    try:
        lesson = get_teacher_lesson(db, teacher, lesson_id)
    except ResourceNotFound:
        duration_ms = round((perf_counter() - started_at) * 1000)
        write_operation(
            db,
            request,
            teacher,
            module="lesson",
            action="lesson.read.failure",
            result="failure",
            duration_ms=duration_ms,
            target_type="lesson",
            target_id=lesson_id,
            error_code="RESOURCE_NOT_FOUND",
        )
        db.commit()
        raise ApiError(404, "RESOURCE_NOT_FOUND", "课节不存在或不可访问。") from None

    duration_ms = round((perf_counter() - started_at) * 1000)
    write_operation(
        db,
        request,
        teacher,
        module="lesson",
        action="lesson.read.success",
        result="success",
        duration_ms=duration_ms,
        target_type="lesson",
        target_id=lesson.id,
    )
    db.commit()
    return LessonPublic.model_validate(lesson)
