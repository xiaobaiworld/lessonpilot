from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.adapters.plugin_course_config import build_plugin_course_config
from app.models.published_script import PublishedScript
from app.models.teacher import Teacher
from app.repositories.published_script_repository import (
    add_published_script,
    get_latest_published_script,
)
from app.repositories.script_repository import get_script_draft
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
    lesson = course.lesson
    if lesson is None:
        raise DraftNotReady

    draft = get_script_draft(session, lesson.id)
    if draft is None or not draft.config_json.get("nodes"):
        raise DraftNotReady

    config = build_plugin_course_config(lesson, draft)
    latest = get_latest_published_script(session, lesson.id)
    script = add_published_script(
        session,
        PublishedScript(
            lesson_id=lesson.id,
            version=(latest.version + 1) if latest else 1,
            config_json=config,
            published_by=teacher.id,
            published_at=datetime.now(timezone.utc),
        ),
    )
    course.status = "published"
    lesson.status = "published"
    session.flush()
    return script
