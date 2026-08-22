from datetime import datetime, timezone

from app.models.course import Course
from app.models.lesson import Lesson
from app.models.script_draft import ScriptDraft
from app.schemas.script import ScriptDraftRequest, dump_script_config


def _utc_iso_milliseconds(value: datetime) -> str:
    return (
        value.astimezone(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace(
            "+00:00",
            "Z",
        )
    )


def build_plugin_course_config(
    course: Course,
    lesson_drafts: list[tuple[Lesson, ScriptDraft]],
    *,
    now: datetime | None = None,
) -> dict:
    updated_at = _utc_iso_milliseconds(now or datetime.now(timezone.utc))
    lessons = []
    for lesson, draft in sorted(
        lesson_drafts,
        key=lambda item: (item[0].sort_order, item[0].id),
    ):
        request = ScriptDraftRequest.model_validate(
            {
                "schema_version": draft.schema_version,
                "config": draft.config_json,
            }
        )
        config = dump_script_config(request.config)
        lessons.append(
            {
                "lessonId": lesson.id,
                "title": lesson.title,
                "videoRef": {
                    "platform": lesson.platform,
                    "videoId": lesson.video_id,
                },
                "nodes": config["nodes"],
                "updatedAt": updated_at,
            }
        )

    return {
        "schemaVersion": 2,
        "courseId": course.id,
        "title": course.title,
        "lessons": lessons,
        "updatedAt": updated_at,
    }
