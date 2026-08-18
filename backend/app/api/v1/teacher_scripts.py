from time import perf_counter

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.deps import require_teacher
from app.api.errors import ApiError
from app.api.v1.teacher_courses import write_operation
from app.db import get_db
from app.models.script_draft import ScriptDraft
from app.models.teacher import Teacher
from app.schemas.script import ScriptDraftRequest, ScriptDraftResponse
from app.services.course_service import ResourceNotFound
from app.services.script_service import (
    DraftNotFound,
    get_script_draft_for_teacher,
    save_script_draft,
)

router = APIRouter(prefix="/api/v1/teacher/lessons", tags=["teacher-scripts"])


def _response(draft: ScriptDraft) -> ScriptDraftResponse:
    return ScriptDraftResponse(
        schema_version=draft.schema_version,
        config=draft.config_json,
        lesson_id=draft.lesson_id,
        node_count=len(draft.config_json.get("nodes", [])),
        updated_at=draft.updated_at.isoformat(),
    )


@router.put("/{lesson_id}/draft", response_model=ScriptDraftResponse)
def put_draft(
    lesson_id: str,
    payload: ScriptDraftRequest,
    request: Request,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> ScriptDraftResponse:
    started_at = perf_counter()
    try:
        draft = save_script_draft(db, teacher, lesson_id=lesson_id, request=payload)
    except ResourceNotFound:
        duration_ms = round((perf_counter() - started_at) * 1000)
        write_operation(
            db,
            request,
            teacher,
            module="script",
            action="script.draft.save.failure",
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
        module="script",
        action="script.draft.save.success",
        result="success",
        duration_ms=duration_ms,
        target_type="lesson",
        target_id=lesson_id,
    )
    db.commit()
    return _response(draft)


@router.get("/{lesson_id}/draft", response_model=ScriptDraftResponse)
def get_draft(
    lesson_id: str,
    request: Request,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> ScriptDraftResponse:
    started_at = perf_counter()
    try:
        draft = get_script_draft_for_teacher(db, teacher, lesson_id=lesson_id)
    except ResourceNotFound:
        error_code = "RESOURCE_NOT_FOUND"
        message = "课节不存在或不可访问。"
    except DraftNotFound:
        error_code = "DRAFT_NOT_FOUND"
        message = "课节还没有保存脚本草稿。"
    else:
        duration_ms = round((perf_counter() - started_at) * 1000)
        write_operation(
            db,
            request,
            teacher,
            module="script",
            action="script.draft.read.success",
            result="success",
            duration_ms=duration_ms,
            target_type="lesson",
            target_id=lesson_id,
        )
        db.commit()
        return _response(draft)

    duration_ms = round((perf_counter() - started_at) * 1000)
    write_operation(
        db,
        request,
        teacher,
        module="script",
        action="script.draft.read.failure",
        result="failure",
        duration_ms=duration_ms,
        target_type="lesson",
        target_id=lesson_id,
        error_code=error_code,
    )
    db.commit()
    status_code = 404
    raise ApiError(status_code, error_code, message) from None
