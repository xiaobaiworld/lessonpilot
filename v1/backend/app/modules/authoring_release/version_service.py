from copy import deepcopy
from uuid import uuid4

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.modules.authoring_release.application_service import _digest
from app.modules.authoring_release.models import PreviewSession, ScriptDraft
from app.modules.authoring_release.release_models import (
    CourseRelease,
    CourseVersionOperation,
)
from app.modules.workspace_course.application_service import WorkspaceCourseApplicationService
from app.modules.workspace_course.models import Course, CourseStatus, Lesson, VideoReference


class CourseVersionError(Exception):
    def __init__(self, code: str):
        self.code = code


class CourseVersionApplicationService:
    """Own the transaction that turns a published course into a version draft."""

    def __init__(self, session: Session):
        self.session = session
        self.courses = WorkspaceCourseApplicationService(session)

    def create_version_draft(
        self, teacher_id: str, course_id: str, mode: str, idempotency_key: str
    ) -> tuple[CourseVersionOperation, Course, bool]:
        existing = self.session.scalar(
            select(CourseVersionOperation).where(
                CourseVersionOperation.teacher_id == teacher_id,
                CourseVersionOperation.idempotency_key == idempotency_key,
            )
        )
        if existing:
            if existing.source_course_id != course_id or existing.mode != mode:
                raise CourseVersionError("VERSION_OPERATION_INTENT_CONFLICT")
            return existing, self.courses.get_course(teacher_id, existing.result_course_id), True

        source = self.courses.get_course(teacher_id, course_id)
        release = self._latest_release(source.id)
        if not release:
            raise CourseVersionError("PUBLISHED_VERSION_NOT_FOUND")

        try:
            if mode == "modify":
                result = self._modify(teacher_id, source, release)
                retained = False
            elif mode == "add":
                result = self._add(teacher_id, source, release)
                retained = True
            else:
                raise CourseVersionError("VERSION_OPERATION_MODE_INVALID")

            operation = CourseVersionOperation(
                id=str(uuid4()),
                teacher_id=teacher_id,
                source_course_id=source.id,
                source_release_id=release.id,
                mode=mode,
                idempotency_key=idempotency_key,
                result_course_id=result.id,
                source_retained=retained,
            )
            self.session.add(operation)
            self.session.commit()
            return operation, self.courses.get_course(teacher_id, result.id), False
        except Exception:
            self.session.rollback()
            raise

    def _latest_release(self, course_id: str) -> CourseRelease | None:
        return self.session.scalar(
            select(CourseRelease)
            .options(
                selectinload(CourseRelease.lessons),
                selectinload(CourseRelease.availability),
            )
            .where(CourseRelease.course_id == course_id)
            .order_by(CourseRelease.release_number.desc())
        )

    @staticmethod
    def _snapshot_record(snapshot: object) -> dict:
        return {
            "lesson_id": snapshot.lesson_id,
            "lesson_sequence": snapshot.lesson_sequence,
            "lesson_title": snapshot.lesson_title,
            "lesson_description": snapshot.lesson_description,
            "lesson_revision": snapshot.lesson_revision,
            "video_platform": snapshot.video_platform,
            "video_platform_id": snapshot.video_platform_id,
            "video_page": snapshot.video_page,
            "video_cid": snapshot.video_cid,
            "nodes": deepcopy(snapshot.nodes),
            "assets": deepcopy(snapshot.assets or []),
            "subtitle": deepcopy(snapshot.subtitle),
            "draft_revision": snapshot.draft_revision,
        }

    @staticmethod
    def _snapshot_content(snapshot: dict) -> dict:
        content = {
            "nodes": deepcopy(snapshot["nodes"]),
            "assets": deepcopy(snapshot["assets"]),
        }
        if snapshot["subtitle"] is not None:
            content["subtitle"] = deepcopy(snapshot["subtitle"])
        return content

    def _draft(self, teacher_id: str, lesson_id: str, snapshot: dict) -> ScriptDraft:
        content = self._snapshot_content(snapshot)
        return ScriptDraft(
            id=str(uuid4()),
            lesson_id=lesson_id,
            schema_version="1",
            revision=max(snapshot["draft_revision"], 1),
            content=content,
            content_digest=_digest(content),
            saved_by_teacher_id=teacher_id,
        )

    def _modify(self, teacher_id: str, course: Course, release: CourseRelease) -> Course:
        snapshots = [
            self._snapshot_record(item)
            for item in sorted(release.lessons, key=lambda row: row.lesson_sequence)
        ]
        lesson_ids = [lesson.id for lesson in course.lessons]
        self.session.execute(delete(PreviewSession).where(PreviewSession.course_id == course.id))
        if lesson_ids:
            self.session.execute(delete(ScriptDraft).where(ScriptDraft.lesson_id.in_(lesson_ids)))

        releases = list(
            self.session.scalars(
                select(CourseRelease)
                .options(
                    selectinload(CourseRelease.lessons),
                    selectinload(CourseRelease.availability),
                )
                .where(CourseRelease.course_id == course.id)
            )
        )
        for item in releases:
            self.session.delete(item)
        self.session.flush()

        current = {lesson.id: lesson for lesson in course.lessons}
        snapshot_ids = {item["lesson_id"] for item in snapshots}
        for lesson_id, lesson in current.items():
            if lesson_id not in snapshot_ids:
                self.session.delete(lesson)

        for index, snapshot in enumerate(snapshots, start=1):
            lesson = current.get(snapshot["lesson_id"])
            if lesson is None:
                lesson = Lesson(id=snapshot["lesson_id"], course_id=course.id, sequence=-index)
                lesson.video_reference = VideoReference(id=str(uuid4()), lesson_id=lesson.id)
                self.session.add(lesson)
            lesson.sequence = -index
            lesson.title = snapshot["lesson_title"]
            lesson.description = snapshot["lesson_description"]
            lesson.revision = max(snapshot["lesson_revision"], 1)
            lesson.video_reference.platform = snapshot["video_platform"]
            lesson.video_reference.platform_video_id = snapshot["video_platform_id"]
            lesson.video_reference.page = snapshot["video_page"]
            lesson.video_reference.cid = snapshot["video_cid"]
            lesson.video_reference.start_time_seconds = None
            lesson.video_reference.end_time_seconds = None
            self.session.add(self._draft(teacher_id, lesson.id, snapshot))
        self.session.flush()
        for index, snapshot in enumerate(snapshots, start=1):
            current_lesson = current.get(snapshot["lesson_id"]) or self.session.get(
                Lesson, snapshot["lesson_id"]
            )
            current_lesson.sequence = index

        course.title = release.course_title
        course.description = release.course_description
        course.status = CourseStatus.draft
        course.revision += 1
        course.archived_at = None
        return course

    def _add(self, teacher_id: str, source: Course, release: CourseRelease) -> Course:
        next_version = (
            self.session.scalar(
                select(func.max(Course.version_number)).where(
                    Course.workspace_id == source.workspace_id,
                    Course.version_family_id == source.version_family_id,
                )
            )
            or source.version_number
        ) + 1
        course = Course(
            id=str(uuid4()),
            workspace_id=source.workspace_id,
            version_family_id=source.version_family_id,
            source_course_id=source.id,
            source_release_id=release.id,
            version_number=next_version,
            title=release.course_title,
            description=release.course_description,
            status=CourseStatus.draft,
        )
        self.session.add(course)
        self.session.flush()
        drafts: list[ScriptDraft] = []
        for release_snapshot in sorted(release.lessons, key=lambda row: row.lesson_sequence):
            snapshot = self._snapshot_record(release_snapshot)
            lesson = Lesson(
                id=str(uuid4()),
                course_id=course.id,
                sequence=snapshot["lesson_sequence"],
                title=snapshot["lesson_title"],
                description=snapshot["lesson_description"],
                revision=1,
            )
            lesson.video_reference = VideoReference(
                id=str(uuid4()),
                lesson_id=lesson.id,
                platform=snapshot["video_platform"],
                platform_video_id=snapshot["video_platform_id"],
                page=snapshot["video_page"],
                cid=snapshot["video_cid"],
            )
            self.session.add(lesson)
            drafts.append(self._draft(teacher_id, lesson.id, snapshot))
        self.session.flush()
        for draft in drafts:
            self.session.add(draft)
        self.session.flush()
        return course
