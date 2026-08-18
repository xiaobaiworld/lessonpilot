from datetime import datetime, timezone

from app.adapters.plugin_course_config import build_plugin_course_config
from app.models.lesson import Lesson
from app.models.script_draft import ScriptDraft
from tests.unit.test_script_schema import four_node_request


def test_adapter_builds_contract_with_utc_millisecond_timestamp() -> None:
    request = four_node_request()
    lesson = Lesson(platform="bilibili", video_id="BV1WW4y1e7GL")
    draft = ScriptDraft(
        lesson_id="lesson-1",
        schema_version=request["schema_version"],
        config_json=request["config"],
    )

    result = build_plugin_course_config(lesson, draft, now=datetime(2026, 8, 18, tzinfo=timezone.utc))

    assert result["schemaVersion"] == 1
    assert result["courseId"] == "bilibili:BV1WW4y1e7GL"
    assert result["videoRef"] == {"platform": "bilibili", "videoId": "BV1WW4y1e7GL"}
    assert result["updatedAt"] == "2026-08-18T00:00:00.000Z"
    assert len(result["nodes"]) == 4
