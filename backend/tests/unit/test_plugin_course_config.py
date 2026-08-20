from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.adapters.plugin_course_config import build_plugin_course_config
from app.models.course import Course
from app.models.lesson import Lesson
from app.models.script_draft import ScriptDraft
from app.schemas.publish import PublishedCoursePackage
from tests.unit.test_script_schema import four_node_request


def make_draft(lesson_id: str, *, node_count: int = 4) -> ScriptDraft:
    request = four_node_request()
    request["config"]["nodes"] = request["config"]["nodes"][:node_count]
    return ScriptDraft(
        lesson_id=lesson_id,
        schema_version=request["schema_version"],
        config_json=request["config"],
    )


def test_adapter_builds_v2_course_package_with_uuid_identity_and_ordered_lessons() -> None:
    course = Course(
        id="d2045bc7-4ba2-4aff-8f27-3bc336be4f55",
        title="英语面试表达：把答案说得具体",
    )
    second = Lesson(
        id="b75456bb-870c-49cd-94dd-0fe09bc725af",
        title="第二课",
        sort_order=1,
        platform="bilibili",
        video_id="BV1mK4y1C7Bz",
    )
    first = Lesson(
        id="a1cc724e-19f4-4f12-9377-8ff71753e8c4",
        title="第一课",
        sort_order=0,
        platform="bilibili",
        video_id="BV1WW4y1e7GL",
    )

    result = build_plugin_course_config(
        course,
        [(second, make_draft(second.id, node_count=1)), (first, make_draft(first.id))],
        now=datetime(2026, 8, 18, tzinfo=timezone.utc),
    )

    assert result == {
        "schemaVersion": 2,
        "courseId": course.id,
        "title": course.title,
        "lessons": [
            {
                "lessonId": first.id,
                "title": first.title,
                "videoRef": {
                    "platform": "bilibili",
                    "videoId": "BV1WW4y1e7GL",
                },
                "nodes": result["lessons"][0]["nodes"],
                "updatedAt": "2026-08-18T00:00:00.000Z",
            },
            {
                "lessonId": second.id,
                "title": second.title,
                "videoRef": {
                    "platform": "bilibili",
                    "videoId": "BV1mK4y1C7Bz",
                },
                "nodes": result["lessons"][1]["nodes"],
                "updatedAt": "2026-08-18T00:00:00.000Z",
            },
        ],
        "updatedAt": "2026-08-18T00:00:00.000Z",
    }
    assert len(result["lessons"][0]["nodes"]) == 4
    assert len(result["lessons"][1]["nodes"]) == 1
    assert result["courseId"] != "bilibili:BV1WW4y1e7GL"


def test_v2_course_package_rejects_nonexistent_utc_date() -> None:
    package = {
        "schemaVersion": 2,
        "courseId": "d2045bc7-4ba2-4aff-8f27-3bc336be4f55",
        "title": "英语面试表达",
        "lessons": [
            {
                "lessonId": "a1cc724e-19f4-4f12-9377-8ff71753e8c4",
                "title": "第一课",
                "videoRef": {
                    "platform": "bilibili",
                    "videoId": "BV1WW4y1e7GL",
                },
                "nodes": four_node_request()["config"]["nodes"],
                "updatedAt": "2026-08-18T00:00:00.000Z",
            }
        ],
        "updatedAt": "2026-99-99T00:00:00.000Z",
    }

    with pytest.raises(ValidationError):
        PublishedCoursePackage.model_validate(package)
