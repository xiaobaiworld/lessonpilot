from datetime import datetime, timezone

from app.models.lesson import Lesson
from app.models.script_draft import ScriptDraft
from app.schemas.script import ScriptDraftRequest, dump_script_config


def _utc_iso_milliseconds(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace(
        "+00:00",
        "Z",
    )


def build_plugin_course_config(
    lesson: Lesson,
    draft: ScriptDraft,
    *,
    now: datetime | None = None,
) -> dict:
    request = ScriptDraftRequest.model_validate(
        {
            "schema_version": draft.schema_version,
            "config": draft.config_json,
        }
    )
    config = dump_script_config(request.config)
    return {
        "schemaVersion": request.schema_version,
        "courseId": f"{lesson.platform}:{lesson.video_id}",
        "videoRef": {
            "platform": lesson.platform,
            "videoId": lesson.video_id,
        },
        "nodes": config["nodes"],
        "updatedAt": _utc_iso_milliseconds(now or datetime.now(timezone.utc)),
    }
