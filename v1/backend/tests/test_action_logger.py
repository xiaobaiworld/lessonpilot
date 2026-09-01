from __future__ import annotations

from typing import Any

from app.infrastructure.logging.action_logger import ActionLogger
from app.infrastructure.logging.config import sanitize_error_message


class RecordingLogger:
    def __init__(self) -> None:
        self.records: list[tuple[str, dict[str, Any]]] = []

    def info(self, message: str, **fields: Any) -> None:
        self.records.append((message, fields))


def test_action_logger_emits_canonical_lifecycle_fields() -> None:
    logger = RecordingLogger()
    actions = ActionLogger("authoring", logger)

    actions.start("draft_save", request_id="request-1", course_id="course-1")
    actions.success("draft_save", 42, request_id="request-1", course_id="course-1")
    actions.retry("draft_save", 1, request_id="request-1", course_id="course-1")

    assert [record[0] for record in logger.records] == [
        "authoring.draft_save",
        "authoring.draft_save",
        "authoring.draft_save",
    ]
    assert [record[1]["event"] for record in logger.records] == ["start", "success", "retry"]
    assert all(record[1]["request_id"] == "request-1" for record in logger.records)
    assert logger.records[1][1]["duration_ms"] == 42
    assert logger.records[2][1]["retry_count"] == 1


def test_action_logger_redacts_failure_message_and_fields() -> None:
    logger = RecordingLogger()
    actions = ActionLogger("entitlement", logger)

    actions.failure(
        "access_code_create",
        ValueError("access_code=KM-SECRET password=hunter2"),
        13,
        request_id="request-2",
        access_code="KM-SECRET",
    )

    fields = logger.records[0][1]
    assert fields["error_type"] == "ValueError"
    assert fields["error_message"] == "access_code=[已脱敏] password=[已脱敏]"
    assert fields["access_code"] == "[已脱敏]"
    assert fields["duration_ms"] == 13


def test_error_message_is_bounded() -> None:
    assert len(sanitize_error_message("x" * 500)) == 200
