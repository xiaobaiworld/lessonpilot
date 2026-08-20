from datetime import datetime, timezone

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.adapters.plugin_course_config import build_plugin_course_config
from app.models.lesson import Lesson
from app.models.published_script import PublishedScript
from app.models.script_draft import ScriptDraft
from app.models.teacher import Teacher
from app.repositories.published_script_repository import (
    add_published_script,
    get_latest_published_script,
)
from app.repositories.script_repository import get_script_draft
from app.schemas.publish import PublishedCoursePackage
from app.services.course_service import ResourceNotFound, get_teacher_course


class DraftNotReady(Exception):
    pass


def publish_teacher_course(
    session: Session,
    teacher: Teacher,
    *,
    course_id: str,
) -> PublishedScript:
    course = get_teacher_course(session, teacher, course_id)
    if not course.lessons:
        raise DraftNotReady

    lesson_drafts: list[tuple[Lesson, ScriptDraft]] = []
    for lesson in course.lessons:
        draft = get_script_draft(session, lesson.id)
        if draft is None or not draft.config_json.get("nodes"):
            raise DraftNotReady
        lesson_drafts.append((lesson, draft))

    published_at = datetime.now(timezone.utc)
    try:
        config = PublishedCoursePackage.model_validate(
            build_plugin_course_config(
                course,
                lesson_drafts,
                now=published_at,
            )
        ).model_dump(
            by_alias=True,
            mode="json",
        )
    except ValidationError:
        raise DraftNotReady from None

    scripts = []
    for lesson, _draft in lesson_drafts:
        latest = get_latest_published_script(session, lesson.id)
        scripts.append(
            add_published_script(
                session,
                PublishedScript(
                    lesson_id=lesson.id,
                    version=(latest.version + 1) if latest else 1,
                    config_json=config,
                    published_by=teacher.id,
                    published_at=published_at,
                ),
            )
        )
        lesson.status = "published"

    course.status = "published"
    session.flush()
    return scripts[0]
