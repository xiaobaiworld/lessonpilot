"""TeacherCourseFile serialization and validation.

TeacherCourseFile is a teacher-only JSON output. It deliberately has no
relationship to the student CoursePackage contract.
"""

from copy import deepcopy
import json
import re
from typing import Any
from uuid import uuid4

from app.modules.authoring_release.application_service import (
    AuthoringReleaseError,
    validate_config,
)


FILE_FIELDS = {"schemaVersion", "fileType", "source", "course"}
SOURCE_FIELDS = {"type", "courseId", "releaseId", "releaseNumber"}
COURSE_FIELDS = {"title", "description", "lessons"}
LESSON_FIELDS = {
    "lessonId",
    "sequence",
    "title",
    "videoRef",
    "nodes",
    "assets",
    "subtitle",
}
NODE_FIELDS = {
    "id",
    "enabled",
    "family",
    "interaction",
    "anchor",
    "title",
    "content",
    "interactionData",
    "presentationHints",
    "effects",
}
PORTABLE_MAX_BYTES = 10 * 1024 * 1024


def _invalid() -> None:
    raise AuthoringReleaseError("PORTABLE_FILE_INVALID")


def validate_teacher_course_file(value: object) -> dict[str, Any]:
    try:
        if len(json.dumps(value, ensure_ascii=False).encode("utf-8")) > PORTABLE_MAX_BYTES:
            _invalid()
    except (TypeError, UnicodeEncodeError) as error:
        raise AuthoringReleaseError("PORTABLE_FILE_INVALID") from error
    if not isinstance(value, dict) or set(value) != FILE_FIELDS:
        _invalid()
    if value.get("schemaVersion") != 1 or value.get("fileType") != "teacher-course":
        _invalid()
    source = value.get("source")
    if not isinstance(source, dict) or set(source) != SOURCE_FIELDS:
        _invalid()
    if source.get("type") not in {"draft", "release"}:
        _invalid()
    course = value.get("course")
    if not isinstance(course, dict) or set(course) != COURSE_FIELDS:
        _invalid()
    if not isinstance(course.get("title"), str) or not course["title"].strip():
        _invalid()
    if course.get("description") is not None and not isinstance(course["description"], str):
        _invalid()
    lessons = course.get("lessons")
    if not isinstance(lessons, list) or not lessons:
        _invalid()
    sequences: set[int] = set()
    for lesson in lessons:
        if not isinstance(lesson, dict) or set(lesson) != LESSON_FIELDS:
            _invalid()
        if (
            not isinstance(lesson.get("lessonId"), str)
            or not lesson["lessonId"].strip()
            or not isinstance(lesson.get("sequence"), int)
            or lesson["sequence"] < 1
            or lesson["sequence"] in sequences
            or not isinstance(lesson.get("title"), str)
            or not lesson["title"].strip()
        ):
            _invalid()
        sequences.add(lesson["sequence"])
        video = lesson.get("videoRef")
        if (
            not isinstance(video, dict)
            or set(video) != {"platform", "videoId"}
            or video.get("platform") != "bilibili"
            or not isinstance(video.get("videoId"), str)
            or not video["videoId"].strip()
            or not re.fullmatch(r"BV[a-zA-Z0-9]{10}", video["videoId"])
        ):
            _invalid()
        if not isinstance(lesson["nodes"], list) or not isinstance(lesson["assets"], list):
            _invalid()
        if any(not isinstance(node, dict) or set(node) != NODE_FIELDS for node in lesson["nodes"]):
            _invalid()
        try:
            validate_config(
                {
                    "nodes": lesson["nodes"],
                    "assets": lesson["assets"],
                    "subtitle": lesson["subtitle"],
                }
            )
        except (AuthoringReleaseError, KeyError, TypeError) as error:
            if isinstance(error, AuthoringReleaseError):
                raise
            raise AuthoringReleaseError("PORTABLE_FILE_INVALID") from error
    return value


def from_drafts(course: Any, lessons: list[Any], drafts: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "fileType": "teacher-course",
        "source": {
            "type": "draft",
            "courseId": course.id,
            "releaseId": None,
            "releaseNumber": None,
        },
        "course": {
            "title": course.title,
            "description": course.description,
            "lessons": [
                {
                    "lessonId": lesson.id,
                    "sequence": lesson.sequence,
                    "title": lesson.title,
                    "videoRef": {
                        "platform": lesson.video_reference.platform,
                        "videoId": lesson.video_reference.platform_video_id,
                    },
                    "nodes": drafts[lesson.id].content["nodes"],
                    "assets": drafts[lesson.id].content.get("assets", []),
                    "subtitle": drafts[lesson.id].content.get("subtitle"),
                }
                for lesson in sorted(lessons, key=lambda item: item.sequence)
            ],
        },
    }


def from_release(release: Any) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "fileType": "teacher-course",
        "source": {
            "type": "release",
            "courseId": release.course_id,
            "releaseId": release.id,
            "releaseNumber": release.release_number,
        },
        "course": {
            "title": release.course_title,
            "description": release.course_description,
            "lessons": [
                {
                    "lessonId": snapshot.lesson_id,
                    "sequence": snapshot.lesson_sequence,
                    "title": snapshot.lesson_title,
                    "videoRef": {
                        "platform": snapshot.video_platform,
                        "videoId": snapshot.video_platform_id,
                    },
                    "nodes": snapshot.nodes,
                    "assets": snapshot.assets,
                    "subtitle": snapshot.subtitle,
                }
                for snapshot in sorted(release.lessons, key=lambda item: item.lesson_sequence)
            ],
        },
    }


def summary(value: dict[str, Any]) -> dict[str, Any]:
    course = value["course"]
    return {
        "title": course["title"],
        "lesson_count": len(course["lessons"]),
        "node_count": sum(len(lesson["nodes"]) for lesson in course["lessons"]),
        "source_type": value["source"]["type"],
        "source_release_number": value["source"]["releaseNumber"],
        "has_subtitles": any(lesson["subtitle"] is not None for lesson in course["lessons"]),
    }


def clone_nodes(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cloned = deepcopy(nodes)
    for node in cloned:
        node["id"] = str(uuid4())
    return cloned
