from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.script_draft import ScriptDraft
from app.models.teacher import Teacher
from app.repositories.script_repository import add_script_draft, get_script_draft
from app.schemas.script import ScriptDraftRequest, dump_script_config
from app.services.course_service import ResourceNotFound, get_teacher_lesson


class DraftNotFound(Exception):
    pass


def save_script_draft(
    session: Session,
    teacher: Teacher,
    *,
    lesson_id: str,
    request: ScriptDraftRequest,
) -> ScriptDraft:
    lesson = get_teacher_lesson(session, teacher, lesson_id)
    draft = get_script_draft(session, lesson.id)
    if draft is None:
        draft = add_script_draft(
            session,
            ScriptDraft(
                lesson_id=lesson.id,
                schema_version=request.schema_version,
                config_json=dump_script_config(request.config),
            ),
        )
    else:
        draft.schema_version = request.schema_version
        draft.config_json = dump_script_config(request.config)
        draft.updated_at = datetime.now(timezone.utc)
    session.flush()
    return draft


def get_script_draft_for_teacher(
    session: Session,
    teacher: Teacher,
    *,
    lesson_id: str,
) -> ScriptDraft:
    lesson = get_teacher_lesson(session, teacher, lesson_id)
    draft = get_script_draft(session, lesson.id)
    if draft is None:
        raise DraftNotFound
    return draft
