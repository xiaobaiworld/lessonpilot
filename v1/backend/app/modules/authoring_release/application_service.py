import hashlib
import json
import math
import re
from collections.abc import Iterable
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin, urlparse
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
WINDOW_POSITIONS = {"bottom-left", "bottom-right", "center"}
ASSET_KINDS = {"image", "audio", "video"}
SOURCE_TYPES = {"uploaded", "licensed"}
CONTENT_BLOCKS = {"paragraph", "heading", "quote", "list", "image", "audio", "video"}
MARKS = {"strong", "em", "underline"}
COLOR = re.compile(r"^#[0-9a-fA-F]{3,8}$")
ASSET_MIME_PREFIX = {"image": "image/", "audio": "audio/", "video": "video/"}
SUBTITLE_MAX_BYTES = 5 * 1024 * 1024
SUBTITLE_FIELDS = {"schemaVersion", "filename", "format", "content"}
SUBTITLE_TIMESTAMP = re.compile(
    r"^(?:(?P<hours>\d+):)?(?P<minutes>\d{1,2}):(?P<seconds>\d{1,2})[,.](?P<milliseconds>\d{1,3})$"
)


def _invalid(code: str) -> None:
    raise AuthoringReleaseError(code)


def _subtitle_seconds(value: str) -> float | None:
    match = SUBTITLE_TIMESTAMP.fullmatch(value.strip())
    if not match:
        return None
    minutes = int(match.group("minutes"))
    seconds = int(match.group("seconds"))
    if minutes > 59 or seconds > 59:
        return None
    return (
        int(match.group("hours") or 0) * 3600
        + minutes * 60
        + seconds
        + int(match.group("milliseconds")) / 1000
    )


def validate_subtitle(value: object) -> dict | None:
    """Validate the persisted subtitle document without storing parsed cues."""
    if value is None:
        return None
    if not isinstance(value, dict) or set(value) != SUBTITLE_FIELDS:
        _invalid("DRAFT_SUBTITLE_INVALID")
    if value.get("schemaVersion") != 1:
        _invalid("DRAFT_SUBTITLE_INVALID")
    filename = value.get("filename")
    subtitle_format = value.get("format")
    content = value.get("content")
    if (
        not isinstance(filename, str)
        or not _text(filename)
        or len(filename) > 255
        or any(char in filename for char in ("/", "\\", "\x00"))
        or not isinstance(subtitle_format, str)
        or subtitle_format not in {"srt", "vtt"}
        or not isinstance(content, str)
        or not _text(content)
    ):
        _invalid("DRAFT_SUBTITLE_INVALID")
    if not filename.lower().endswith(f".{subtitle_format}"):
        _invalid("DRAFT_SUBTITLE_INVALID")
    try:
        if len(content.encode("utf-8")) > SUBTITLE_MAX_BYTES:
            _invalid("DRAFT_SUBTITLE_TOO_LARGE")
    except UnicodeEncodeError as error:
        raise AuthoringReleaseError("DRAFT_SUBTITLE_INVALID") from error

    normalized = content.removeprefix("\ufeff").replace("\r\n", "\n").replace("\r", "\n")
    if subtitle_format == "vtt" and not normalized.lstrip().startswith("WEBVTT"):
        _invalid("DRAFT_SUBTITLE_INVALID")
    if subtitle_format == "srt" and normalized.lstrip().startswith("WEBVTT"):
        _invalid("DRAFT_SUBTITLE_INVALID")

    cues = []
    for block in re.split(r"\n{2,}", normalized.strip()):
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        time_index = next((index for index, line in enumerate(lines) if "-->" in line), None)
        if time_index is None:
            continue
        if time_index + 1 >= len(lines):
            _invalid("DRAFT_SUBTITLE_INVALID")
        start_raw, end_raw = lines[time_index].split("-->", 1)
        start = _subtitle_seconds(start_raw)
        end = _subtitle_seconds(end_raw.split()[0])
        text = " ".join(lines[time_index + 1 :])
        text = re.sub(r"<[^>]+>", "", text).strip()
        if start is None or end is None or end <= start or not text:
            _invalid("DRAFT_SUBTITLE_INVALID")
        cues.append((start, end))

    if not cues or any(
        start < previous_end for (start, _), (_, previous_end) in zip(cues[1:], cues)
    ):
        _invalid("DRAFT_SUBTITLE_INVALID")
    return dict(value)


def _validate_inline(value: object) -> bool:
    if (
        not isinstance(value, dict)
        or set(value) - {"text", "marks", "color", "link"}
        or not _text(value.get("text"))
    ):
        return False
    marks = value.get("marks", [])
    if not isinstance(marks, list) or any(mark not in MARKS for mark in marks):
        return False
    color = value.get("color")
    if color is not None and (not isinstance(color, str) or not COLOR.fullmatch(color)):
        return False
    link = value.get("link")
    if link is not None and (
        not isinstance(link, dict)
        or set(link) != {"href"}
        or not _text(link.get("href"))
        or urlparse(urljoin("https://knownmap.invalid/", link["href"])).scheme
        not in {"http", "https", "mailto"}
    ):
        return False
    return True


def _validate_rich_document(document: object, asset_records: dict[str, dict]) -> set[str]:
    if (
        not isinstance(document, dict)
        or set(document) != {"schemaVersion", "blocks"}
        or document.get("schemaVersion") != 1
    ):
        _invalid("DRAFT_DOCUMENT_VERSION_UNSUPPORTED")
    blocks = document.get("blocks")
    if not isinstance(blocks, list) or not blocks:
        _invalid("DRAFT_NODE_CONTENT_INVALID")
    assets: set[str] = set()
    for block in blocks:
        if not isinstance(block, dict) or block.get("type") not in CONTENT_BLOCKS:
            _invalid("DRAFT_CONTENT_BLOCK_UNSUPPORTED")
        kind = block["type"]
        if kind in {"paragraph", "heading", "quote"}:
            allowed = {"type", "children"} if kind != "heading" else {"type", "level", "children"}
            if set(block) != allowed:
                _invalid("DRAFT_NODE_CONTENT_INVALID")
            children = block.get("children")
            if (
                not isinstance(children, list)
                or not children
                or any(not _validate_inline(child) for child in children)
            ):
                _invalid("DRAFT_NODE_CONTENT_INVALID")
            if kind == "heading" and block.get("level") not in {2, 3}:
                _invalid("DRAFT_NODE_CONTENT_INVALID")
        elif kind == "list":
            if set(block) != {"type", "ordered", "items"}:
                _invalid("DRAFT_NODE_CONTENT_INVALID")
            items = block.get("items")
            if (
                not isinstance(items, list)
                or not items
                or not isinstance(block.get("ordered"), bool)
            ):
                _invalid("DRAFT_NODE_CONTENT_INVALID")
            for item in items:
                if (
                    not isinstance(item, dict)
                    or not isinstance(item.get("children"), list)
                    or not item["children"]
                ):
                    _invalid("DRAFT_NODE_CONTENT_INVALID")
                if any(not _validate_inline(child) for child in item["children"]):
                    _invalid("DRAFT_NODE_CONTENT_INVALID")
        else:
            allowed = (
                {"type", "assetId", "alt"} if kind == "image" else {"type", "assetId", "title"}
            )
            if kind == "video":
                allowed.add("posterAssetId")
            if set(block) - allowed or not {"type", "assetId"}.issubset(block):
                _invalid("DRAFT_NODE_CONTENT_INVALID")
            asset_id = block.get("assetId")
            if not _text(asset_id):
                _invalid("DRAFT_ASSET_REFERENCE_INVALID")
            asset = asset_records.get(asset_id)
            if asset is not None and asset.get("kind") != kind:
                _invalid("DRAFT_ASSET_REFERENCE_INVALID")
            assets.add(asset_id)
            if kind == "image" and not isinstance(block.get("alt"), str):
                _invalid("DRAFT_NODE_CONTENT_INVALID")
            if (
                kind in {"audio", "video"}
                and block.get("title") is not None
                and not isinstance(block["title"], str)
            ):
                _invalid("DRAFT_NODE_CONTENT_INVALID")
            if kind == "video" and block.get("posterAssetId") is not None:
                if not _text(block["posterAssetId"]):
                    _invalid("DRAFT_ASSET_REFERENCE_INVALID")
                poster = asset_records.get(block["posterAssetId"])
                if poster is not None and poster.get("kind") != "image":
                    _invalid("DRAFT_ASSET_REFERENCE_INVALID")
                assets.add(block["posterAssetId"])
    return assets


def _validate_assets(value: object) -> dict[str, dict]:
    if not isinstance(value, list):
        _invalid("DRAFT_ASSETS_INVALID")
    assets: dict[str, dict] = {}
    for asset in value:
        if (
            not isinstance(asset, dict)
            or set(asset)
            - {
                "assetId",
                "kind",
                "mimeType",
                "byteSize",
                "sha256",
                "width",
                "height",
                "durationSeconds",
                "alt",
                "sourceType",
            }
            or not _text(asset.get("assetId"))
        ):
            _invalid("DRAFT_ASSETS_INVALID")
        if asset["assetId"] in assets:
            _invalid("DRAFT_ASSETS_INVALID")
        if (
            asset.get("kind") not in ASSET_KINDS
            or not _text(asset.get("mimeType"))
            or not asset["mimeType"].startswith(ASSET_MIME_PREFIX[asset["kind"]])
        ):
            _invalid("DRAFT_ASSETS_INVALID")
        if not isinstance(asset.get("byteSize"), int) or asset["byteSize"] < 0:
            _invalid("DRAFT_ASSETS_INVALID")
        if (
            not isinstance(asset.get("sha256"), str)
            or len(asset["sha256"]) != 64
            or any(c not in "0123456789abcdefABCDEF" for c in asset["sha256"])
        ):
            _invalid("DRAFT_ASSETS_INVALID")
        if asset.get("sourceType") not in SOURCE_TYPES:
            _invalid("DRAFT_ASSETS_INVALID")
        if (
            (
                asset.get("width") is not None
                and (not isinstance(asset["width"], int) or asset["width"] < 1)
            )
            or (
                asset.get("height") is not None
                and (not isinstance(asset["height"], int) or asset["height"] < 1)
            )
            or (
                asset.get("durationSeconds") is not None
                and (
                    not isinstance(asset["durationSeconds"], (int, float))
                    or isinstance(asset["durationSeconds"], bool)
                    or not math.isfinite(asset["durationSeconds"])
                    or asset["durationSeconds"] <= 0
                )
            )
            or (asset.get("alt") is not None and not isinstance(asset["alt"], str))
        ):
            _invalid("DRAFT_ASSETS_INVALID")
        assets[asset["assetId"]] = asset
    return assets


def validate_config(config: object) -> tuple[list[dict], list[dict]]:
    if not isinstance(config, dict):
        _invalid("DRAFT_NODES_INVALID")
    nodes = config.get("nodes")
    asset_records = config["assets"] if "assets" in config else []
    validate_subtitle(config.get("subtitle"))
    assets = _validate_assets(asset_records)
    if not isinstance(nodes, list):
        _invalid("DRAFT_NODES_INVALID")
    seen: set[str] = set()
    for node in nodes:
        if not isinstance(node, dict) or not _text(node.get("id")) or node["id"] in seen:
            _invalid("DRAFT_NODE_ID_INVALID")
        seen.add(node["id"])
        interaction = node.get("interaction")
        expected_family = "attention" if interaction == "notice" else "practice"
        if interaction not in {"notice", "choice", "blank", "free_text"}:
            _invalid("DRAFT_NODE_TYPE_INVALID")
        if node.get("family") != expected_family or node.get("enabled") is not True:
            _invalid("DRAFT_NODE_TYPE_INVALID")
        if "display" in node or "evaluation" in node or "trigger" in node:
            _invalid("DRAFT_LEGACY_NODE_UNSUPPORTED")
        if set(node) - {
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
        }:
            _invalid("DRAFT_NODE_CONTENT_INVALID")
        anchor = node.get("anchor")
        seconds = anchor.get("timeSeconds") if isinstance(anchor, dict) else None
        if (
            not isinstance(seconds, (int, float))
            or isinstance(seconds, bool)
            or not math.isfinite(seconds)
            or seconds < 0
        ):
            _invalid("DRAFT_NODE_TRIGGER_INVALID")
        if (
            not isinstance(anchor, dict)
            or set(anchor) - {"kind", "timeSeconds", "captionId"}
            or anchor.get("kind") != "time_cross"
            or (
                anchor.get("captionId") is not None and not isinstance(anchor.get("captionId"), str)
            )
            or node.get("effects") != {"pause": True}
        ):
            _invalid("DRAFT_NODE_BEHAVIOR_INVALID")
        if not _text(node.get("title")):
            _invalid("DRAFT_NODE_CONTENT_INVALID")
        referenced = _validate_rich_document(node.get("content"), assets)
        hints = node.get("presentationHints", {})
        if (
            not isinstance(hints, dict)
            or set(hints) - {"windowSize", "windowStyle", "windowPosition"}
            or hints.get("windowSize") not in {None, *WINDOW_SIZES}
            or hints.get("windowStyle") not in {None, *WINDOW_STYLES}
            or hints.get("windowPosition") not in {None, *WINDOW_POSITIONS}
        ):
            _invalid("DRAFT_NODE_CONTENT_INVALID")
        data = node.get("interactionData")
        if interaction == "notice":
            if data is not None:
                _invalid("DRAFT_NOTICE_INVALID")
        elif not isinstance(data, dict):
            _invalid("DRAFT_QUESTION_INVALID")
        elif interaction == "choice":
            options = data.get("options")
            if (
                set(data) != {"options", "answer", "explanation"}
                or any(
                    not isinstance(item, dict) or set(item) != {"id", "label"}
                    for item in (options if isinstance(options, list) else [])
                )
                or not isinstance(options, list)
                or len(options) < 2
                or any(
                    not isinstance(item, dict)
                    or not _text(item.get("id"))
                    or not _text(item.get("label"))
                    for item in options
                )
                or data.get("answer") not in {item["id"] for item in options}
                or not _text(data.get("explanation"))
            ):
                _invalid("DRAFT_CHOICE_INVALID")
        elif interaction == "blank":
            answers = data.get("acceptedAnswers")
            if (
                set(data) != {"acceptedAnswers", "normalize", "explanation"}
                or not isinstance(answers, list)
                or not answers
                or any(not _text(answer) for answer in answers)
                or not _text(data.get("explanation"))
                or not isinstance(data.get("normalize"), list)
                or any(rule not in {"trim", "casefold"} for rule in data["normalize"])
            ):
                _invalid("DRAFT_BLANK_INVALID")
        elif set(data) != {"referenceFeedback"} or not _text(data.get("referenceFeedback")):
            _invalid("DRAFT_FREE_TEXT_INVALID")
        if not referenced.issubset(assets):
            _invalid("DRAFT_ASSET_REFERENCE_MISSING")
    return nodes, list(assets.values())


def validate_nodes(nodes: object) -> list[dict]:
    """Validate the node aggregate for callers that do not carry an asset manifest."""
    validated, _ = validate_config({"nodes": nodes, "assets": []})
    return validated


class AuthoringReleaseApplicationService:
    def __init__(self, session: Session):
        self.session = session

    def get_draft(self, lesson_id: str) -> ScriptDraft:
        draft = self.session.scalar(select(ScriptDraft).where(ScriptDraft.lesson_id == lesson_id))
        if not draft:
            raise AuthoringReleaseError("DRAFT_NOT_FOUND")
        return draft

    def draft_lesson_ids(self, lesson_ids: Iterable[str]) -> set[str]:
        """返回当前已有草稿的课节 ID，供课程详情组装状态投影。"""
        ids = list(lesson_ids)
        if not ids:
            return set()
        return set(
            self.session.scalars(
                select(ScriptDraft.lesson_id).where(ScriptDraft.lesson_id.in_(ids))
            )
        )

    def save_draft(
        self,
        teacher_id: str,
        lesson_id: str,
        schema_version: int,
        config: dict,
        revision: int | None,
        commit: bool = True,
    ) -> ScriptDraft:
        nodes, assets = validate_config(config)
        subtitle = validate_subtitle(config.get("subtitle"))
        content = {"nodes": nodes, "assets": assets}
        if subtitle is not None:
            content["subtitle"] = subtitle
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
        if commit:
            self.session.commit()
        return draft

    def export_draft_file(self, course: Course, lessons: list[Lesson]) -> dict:
        from app.modules.authoring_release.portable import from_drafts

        drafts: dict[str, ScriptDraft] = {}
        for lesson in lessons:
            drafts[lesson.id] = self.get_draft(lesson.id)
        return from_drafts(course, lessons, drafts)

    def export_release_file(self, release: CourseRelease) -> dict:
        from app.modules.authoring_release.portable import from_release

        return from_release(release)

    def import_teacher_course_file(self, teacher_id: str, value: object, courses: object) -> Course:
        from app.modules.authoring_release.portable import (
            clone_nodes,
            validate_teacher_course_file,
        )

        data = validate_teacher_course_file(value)
        course_data = data["course"]
        try:
            course, lessons = courses.create_import_shell(
                teacher_id,
                course_data["title"],
                course_data["description"],
                course_data["lessons"],
            )
            for lesson, lesson_data in zip(
                lessons,
                sorted(course_data["lessons"], key=lambda item: item["sequence"]),
                strict=True,
            ):
                self.save_draft(
                    teacher_id,
                    lesson.id,
                    1,
                    {
                        "nodes": clone_nodes(lesson_data["nodes"]),
                        "assets": lesson_data["assets"],
                        "subtitle": lesson_data["subtitle"],
                    },
                    None,
                    commit=False,
                )
            self.session.commit()
            return course
        except Exception:
            self.session.rollback()
            raise

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
            contract_version="3.1.0",
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
                    assets=draft.content.get("assets", []),
                    subtitle=draft.content.get("subtitle"),
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
            "schemaVersion": 3,
            "courseId": release.course_id,
            "releaseId": release.id,
            "releaseNumber": release.release_number,
            "title": release.course_title,
            "assets": list(
                {
                    asset["assetId"]: asset
                    for snapshot in sorted(release.lessons, key=lambda item: item.lesson_sequence)
                    for asset in snapshot.assets
                }.values()
            ),
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
