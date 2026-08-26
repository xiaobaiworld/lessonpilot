import hashlib
import json
import math
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.admin_support.models import RightsAttestation
from app.modules.authoring_release.models import PreviewSession, ScriptDraft
from app.modules.authoring_release.release_models import (
    CourseRelease,
    ReleaseAvailability,
    ReleaseLessonSnapshot,
    ReleaseStatus,
)
from app.modules.workspace_course.models import Course, CourseStatus, Lesson


class AuthoringReleaseError(Exception):
    def __init__(self, code: str):
        self.code = code


def _digest(content: dict) -> str:
    encoded = json.dumps(content, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode()).hexdigest()


def _text(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


WINDOW_SIZES = {"s", "m", "l", "overlay"}
WINDOW_STYLES = {"card", "document"}
RICH_BODY_MAX = 4000


def _check_window_display(display: dict) -> None:
    size = display.get("windowSize")
    style = display.get("windowStyle")
    if size is not None and size not in WINDOW_SIZES:
        raise AuthoringReleaseError("DRAFT_NODE_CONTENT_INVALID")
    if style is not None and style not in WINDOW_STYLES:
        raise AuthoringReleaseError("DRAFT_NODE_CONTENT_INVALID")
    rich_body = display.get("richBody")
    if rich_body is not None and (not isinstance(rich_body, str) or len(rich_body) > RICH_BODY_MAX):
        raise AuthoringReleaseError("DRAFT_NODE_CONTENT_INVALID")


def validate_nodes(nodes: object) -> list[dict]:
    if not isinstance(nodes, list):
        raise AuthoringReleaseError("DRAFT_NODES_INVALID")
    seen: set[str] = set()
    for node in nodes:
        if not isinstance(node, dict) or not _text(node.get("id")) or node["id"] in seen:
            raise AuthoringReleaseError("DRAFT_NODE_ID_INVALID")
        seen.add(node["id"])
        interaction = node.get("interaction")
        expected_family = "attention" if interaction == "notice" else "practice"
        if interaction not in {"notice", "choice", "blank", "free_text"}:
            raise AuthoringReleaseError("DRAFT_NODE_TYPE_INVALID")
        if node.get("family") != expected_family or node.get("enabled") is not True:
            raise AuthoringReleaseError("DRAFT_NODE_TYPE_INVALID")
        trigger = node.get("trigger")
        seconds = trigger.get("timeSeconds") if isinstance(trigger, dict) else None
        if (
            not isinstance(seconds, (int, float))
            or isinstance(seconds, bool)
            or not math.isfinite(seconds)
            or seconds < 0
        ):
            raise AuthoringReleaseError("DRAFT_NODE_TRIGGER_INVALID")
        if trigger.get("kind") != "time_cross" or node.get("effects") != {"pause": True}:
            raise AuthoringReleaseError("DRAFT_NODE_BEHAVIOR_INVALID")
        display = node.get("display")
        evaluation = node.get("evaluation")
        if not isinstance(display, dict) or not _text(display.get("title")):
            raise AuthoringReleaseError("DRAFT_NODE_CONTENT_INVALID")
        _check_window_display(display)
        if interaction == "notice":
            if not _text(display.get("richBody")) or "body" in display or evaluation is not None:
                raise AuthoringReleaseError("DRAFT_NOTICE_INVALID")
        elif not _text(display.get("prompt")) or not isinstance(evaluation, dict):
            raise AuthoringReleaseError("DRAFT_QUESTION_INVALID")
        elif interaction == "choice":
            options = display.get("options")
            if (
                not isinstance(options, list)
                or len(options) < 2
                or any(
                    not isinstance(item, dict)
                    or not _text(item.get("id"))
                    or not _text(item.get("label"))
                    for item in options
                )
                or evaluation.get("answer") not in {item["id"] for item in options}
                or not _text(evaluation.get("explanation"))
            ):
                raise AuthoringReleaseError("DRAFT_CHOICE_INVALID")
        elif interaction == "blank":
            answers = evaluation.get("acceptedAnswers")
            if (
                not isinstance(answers, list)
                or not answers
                or any(not _text(answer) for answer in answers)
                or not _text(evaluation.get("explanation"))
            ):
                raise AuthoringReleaseError("DRAFT_BLANK_INVALID")
        elif not _text(evaluation.get("referenceFeedback")):
            raise AuthoringReleaseError("DRAFT_FREE_TEXT_INVALID")
    return nodes


class AuthoringReleaseApplicationService:
    def __init__(self, session: Session):
        self.session = session

    def get_draft(self, lesson_id: str) -> ScriptDraft:
        draft = self.session.scalar(select(ScriptDraft).where(ScriptDraft.lesson_id == lesson_id))
        if not draft:
            raise AuthoringReleaseError("DRAFT_NOT_FOUND")
        return draft

    def save_draft(
        self,
        teacher_id: str,
        lesson_id: str,
        schema_version: int,
        config: dict,
        revision: int | None,
    ) -> ScriptDraft:
        nodes = validate_nodes(config.get("nodes"))
        content = {"nodes": nodes}
        draft = self.session.scalar(select(ScriptDraft).where(ScriptDraft.lesson_id == lesson_id))
        if draft:
            if revision != draft.revision:
                raise AuthoringReleaseError("REVISION_CONFLICT")
            draft.revision += 1
            draft.content = content
            draft.content_digest = _digest(content)
            draft.saved_by_teacher_id = teacher_id
        else:
            if revision not in {None, 0}:
                raise AuthoringReleaseError("REVISION_CONFLICT")
            draft = ScriptDraft(
                id=str(uuid4()),
                lesson_id=lesson_id,
                schema_version=str(schema_version),
                revision=1,
                content=content,
                content_digest=_digest(content),
                saved_by_teacher_id=teacher_id,
            )
            self.session.add(draft)
        self.session.commit()
        return draft

    def start_preview(
        self, teacher_id: str, course_id: str, lesson_id: str, plugin_version: str | None
    ) -> PreviewSession:
        draft = self.get_draft(lesson_id)
        preview = PreviewSession(
            id=str(uuid4()),
            teacher_id=teacher_id,
            course_id=course_id,
            lesson_id=lesson_id,
            draft_id=draft.id,
            draft_revision=draft.revision,
            content_digest=draft.content_digest,
            locked_content=draft.content,
            contract_version="2.0.0",
            plugin_version=plugin_version,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        self.session.add(preview)
        self.session.commit()
        return preview

    def end_preview(
        self, teacher_id: str, preview_id: str, succeeded: bool, error_category: str | None
    ) -> PreviewSession:
        preview = self.session.scalar(
            select(PreviewSession).where(
                PreviewSession.id == preview_id, PreviewSession.teacher_id == teacher_id
            )
        )
        if not preview:
            raise AuthoringReleaseError("PREVIEW_NOT_FOUND")
        if preview.ended_at:
            return preview
        now = datetime.now(timezone.utc)
        expires_at = preview.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        preview.ended_at = now
        preview.succeeded = succeeded and now <= expires_at
        preview.error_category = error_category if preview.succeeded is False else None
        self.session.commit()
        return preview

    def publish(
        self,
        teacher_id: str,
        course: Course,
        lessons: list[Lesson],
        intent_id: str,
        rights: RightsAttestation,
    ) -> CourseRelease:
        existing = self.session.scalar(
            select(CourseRelease).where(
                CourseRelease.course_id == course.id,
                CourseRelease.publish_intent_id == intent_id,
            )
        )
        if existing:
            return existing
        if course.status in {CourseStatus.archived, CourseStatus.delivery_paused} or not lessons:
            raise AuthoringReleaseError("RELEASE_NOT_DELIVERABLE")

        drafts: list[ScriptDraft] = []
        for lesson in sorted(lessons, key=lambda item: item.sequence):
            try:
                draft = self.get_draft(lesson.id)
            except AuthoringReleaseError as error:
                raise AuthoringReleaseError("RELEASE_DRAFT_MISSING") from error
            if not draft.content.get("nodes"):
                raise AuthoringReleaseError("RELEASE_DRAFT_EMPTY")
            preview = self.session.scalar(
                select(PreviewSession).where(
                    PreviewSession.teacher_id == teacher_id,
                    PreviewSession.lesson_id == lesson.id,
                    PreviewSession.draft_revision == draft.revision,
                    PreviewSession.content_digest == draft.content_digest,
                    PreviewSession.succeeded.is_(True),
                )
            )
            if not preview:
                raise AuthoringReleaseError("RELEASE_PREVIEW_REQUIRED")
            drafts.append(draft)

        release_number = (
            self.session.scalar(
                select(func.max(CourseRelease.release_number)).where(
                    CourseRelease.course_id == course.id
                )
            )
            or 0
        ) + 1
        release = CourseRelease(
            id=str(uuid4()),
            course_id=course.id,
            release_number=release_number,
            source_course_revision=course.revision,
            publish_intent_id=intent_id,
            course_title=course.title,
            course_description=course.description,
            lesson_count=len(lessons),
            status=ReleaseStatus.available,
            rights_attestation_id=rights.id,
            published_by_teacher_id=teacher_id,
        )
        self.session.add(release)
        for lesson, draft in zip(
            sorted(lessons, key=lambda item: item.sequence), drafts, strict=True
        ):
            video = lesson.video_reference
            self.session.add(
                ReleaseLessonSnapshot(
                    id=str(uuid4()),
                    release_id=release.id,
                    lesson_sequence=lesson.sequence,
                    lesson_id=lesson.id,
                    lesson_title=lesson.title,
                    lesson_revision=lesson.revision,
                    lesson_description=lesson.description,
                    video_platform=video.platform,
                    video_platform_id=video.platform_video_id,
                    nodes=draft.content["nodes"],
                    draft_revision=draft.revision,
                    content_digest=draft.content_digest,
                )
            )
        self.session.add(
            ReleaseAvailability(id=str(uuid4()), release_id=release.id, scope="full_course")
        )
        self.session.commit()
        return release

    def list_releases(self, course_id: str) -> list[CourseRelease]:
        return list(
            self.session.scalars(
                select(CourseRelease)
                .where(CourseRelease.course_id == course_id)
                .order_by(CourseRelease.release_number.desc())
            )
        )

    def get_release(self, release_id: str) -> CourseRelease:
        release = self.session.get(CourseRelease, release_id)
        if not release:
            raise AuthoringReleaseError("RELEASE_NOT_FOUND")
        return release

    def latest_deliverable_release(self, course_id: str) -> CourseRelease | None:
        releases = self.list_releases(course_id)
        return next((item for item in releases if not item.availability.invalidated), None)

    def set_availability(
        self, release_id: str, deliverable: bool, reason: str | None
    ) -> ReleaseAvailability:
        release = self.get_release(release_id)
        availability = release.availability
        availability.invalidated = not deliverable
        availability.invalidated_at = None if deliverable else datetime.now(timezone.utc)
        availability.invalidation_reason = None if deliverable else reason
        self.session.commit()
        return availability

    def package(self, release: CourseRelease) -> dict:
        if release.availability.invalidated:
            raise AuthoringReleaseError("RELEASE_NOT_DELIVERABLE")
        return {
            "schemaVersion": 2,
            "courseId": release.course_id,
            "releaseId": release.id,
            "releaseNumber": release.release_number,
            "title": release.course_title,
            "lessons": [
                {
                    "lessonId": snapshot.lesson_id,
                    "title": snapshot.lesson_title,
                    "videoRef": {
                        "platform": snapshot.video_platform,
                        "videoId": snapshot.video_platform_id,
                    },
                    "nodes": snapshot.nodes,
                }
                for snapshot in sorted(release.lessons, key=lambda item: item.lesson_sequence)
            ],
            "updatedAt": release.published_at.isoformat(),
        }
