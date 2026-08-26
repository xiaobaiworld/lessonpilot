from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.errors import ApiError
from app.infrastructure.database.session import get_db
from app.modules.admin_support.application_service import AdminSupportApplicationService
from app.modules.authoring_release.application_service import (
    AuthoringReleaseApplicationService,
    AuthoringReleaseError,
)
from app.modules.authoring_release.models import PreviewSession, ScriptDraft
from app.modules.authoring_release.release_models import CourseRelease
from app.modules.authoring_release.schemas import (
    AvailabilityWrite,
    DraftPublic,
    DraftWrite,
    PreviewEnd,
    PreviewPublic,
    PreviewStart,
    ReleaseWrite,
    RightsWrite,
)
from app.modules.identity.dependencies import require_teacher
from app.modules.identity.models import TeacherAccount
from app.modules.workspace_course.application_service import (
    WorkspaceCourseApplicationService,
    WorkspaceCourseError,
)

router = APIRouter(prefix="/api/v1/teacher", tags=["teacher-authoring-release"])


def _draft(draft: ScriptDraft) -> DraftPublic:
    return DraftPublic(
        schema_version=int(draft.schema_version),
        revision=draft.revision,
        config={"nodes": draft.content.get("nodes", []), "assets": draft.content.get("assets", [])},
        lesson_id=draft.lesson_id,
        node_count=len(draft.content["nodes"]),
        updated_at=draft.updated_at,
    )


def _preview(preview: PreviewSession) -> PreviewPublic:
    return PreviewPublic(
        id=preview.id,
        lesson_id=preview.lesson_id,
        draft_revision=preview.draft_revision,
        locked_content=preview.locked_content,
        expires_at=preview.expires_at,
        ended_at=preview.ended_at,
        succeeded=preview.succeeded,
    )


def _release(release: CourseRelease) -> dict:
    return {
        "id": release.id,
        "course_id": release.course_id,
        "release_number": release.release_number,
        "lesson_count": release.lesson_count,
        "published_at": release.published_at,
        "deliverable": not release.availability.invalidated,
        "reason": release.availability.invalidation_reason,
        "lessons": [
            {
                "lesson_id": item.lesson_id,
                "title": item.lesson_title,
                "sequence": item.lesson_sequence,
                "draft_revision": item.draft_revision,
            }
            for item in sorted(release.lessons, key=lambda row: row.lesson_sequence)
        ],
    }


def _error(error: Exception) -> ApiError:
    code = getattr(error, "code", "INTERNAL_ERROR")
    if code == "REVISION_CONFLICT":
        return ApiError(409, code, "草稿已被修改，请重新读取")
    if code.endswith("NOT_FOUND") or code in {"COURSE_NOT_FOUND", "LESSON_NOT_FOUND"}:
        return ApiError(404, code, "对象不存在或无权访问")
    return ApiError(422, code, "请求不满足制作或发布条件")


def _services(
    db: Session,
) -> tuple[WorkspaceCourseApplicationService, AuthoringReleaseApplicationService]:
    return WorkspaceCourseApplicationService(db), AuthoringReleaseApplicationService(db)


@router.get("/lessons/{lesson_id}/draft", response_model=DraftPublic)
def get_draft(
    lesson_id: str,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> DraftPublic:
    courses, authoring = _services(db)
    try:
        courses.get_lesson(teacher.id, lesson_id)
        return _draft(authoring.get_draft(lesson_id))
    except (WorkspaceCourseError, AuthoringReleaseError) as error:
        raise _error(error) from error


@router.put("/lessons/{lesson_id}/draft", response_model=DraftPublic)
def save_draft(
    lesson_id: str,
    payload: DraftWrite,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> DraftPublic:
    courses, authoring = _services(db)
    try:
        courses.get_lesson(teacher.id, lesson_id)
        return _draft(
            authoring.save_draft(
                teacher.id, lesson_id, payload.schema_version, payload.config, payload.revision
            )
        )
    except (WorkspaceCourseError, AuthoringReleaseError) as error:
        raise _error(error) from error


@router.post("/lessons/{lesson_id}/preview-sessions", response_model=PreviewPublic, status_code=201)
def start_preview(
    lesson_id: str,
    payload: PreviewStart,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> PreviewPublic:
    courses, authoring = _services(db)
    try:
        lesson = courses.get_lesson(teacher.id, lesson_id)
        return _preview(
            authoring.start_preview(teacher.id, lesson.course_id, lesson.id, payload.plugin_version)
        )
    except (WorkspaceCourseError, AuthoringReleaseError) as error:
        raise _error(error) from error


@router.post("/preview-sessions/{preview_session_id}/end", response_model=PreviewPublic)
def end_preview(
    preview_session_id: str,
    payload: PreviewEnd,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> PreviewPublic:
    try:
        return _preview(
            AuthoringReleaseApplicationService(db).end_preview(
                teacher.id, preview_session_id, payload.succeeded, payload.error_category
            )
        )
    except AuthoringReleaseError as error:
        raise _error(error) from error


@router.post("/courses/{course_id}/rights-attestation", status_code=201)
def attest_rights(
    course_id: str,
    payload: RightsWrite,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> dict:
    try:
        WorkspaceCourseApplicationService(db).get_course(teacher.id, course_id)
        attestation = AdminSupportApplicationService(db).attest_rights(
            teacher.id, course_id, payload.statement_version, payload.accepted
        )
        return {"id": attestation.id, "statement_version": attestation.statement_version}
    except (WorkspaceCourseError, ValueError) as error:
        raise _error(error) from error


@router.post("/courses/{course_id}/releases", status_code=201)
def publish_course(
    course_id: str,
    payload: ReleaseWrite,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> dict:
    courses, authoring = _services(db)
    try:
        course = courses.get_course(teacher.id, course_id)
        rights = AdminSupportApplicationService(db).latest_rights(teacher.id, course_id)
        if not rights:
            raise AuthoringReleaseError("RELEASE_RIGHTS_REQUIRED")
        return _release(
            authoring.publish(
                teacher.id, course, list(course.lessons), payload.idempotency_key, rights
            )
        )
    except (WorkspaceCourseError, AuthoringReleaseError) as error:
        raise _error(error) from error


@router.get("/courses/{course_id}/releases")
def list_releases(
    course_id: str,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> dict:
    courses, authoring = _services(db)
    try:
        courses.get_course(teacher.id, course_id)
        return {"items": [_release(item) for item in authoring.list_releases(course_id)]}
    except WorkspaceCourseError as error:
        raise _error(error) from error


@router.get("/releases/{release_id}")
def get_release(
    release_id: str,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> dict:
    courses, authoring = _services(db)
    try:
        release = authoring.get_release(release_id)
        courses.get_course(teacher.id, release.course_id)
        return _release(release)
    except (WorkspaceCourseError, AuthoringReleaseError) as error:
        raise _error(error) from error


@router.post("/releases/{release_id}/availability")
def set_release_availability(
    release_id: str,
    payload: AvailabilityWrite,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> dict:
    courses, authoring = _services(db)
    try:
        release = authoring.get_release(release_id)
        courses.get_course(teacher.id, release.course_id)
        availability = authoring.set_availability(release_id, payload.deliverable, payload.reason)
        return {
            "deliverable": not availability.invalidated,
            "reason": availability.invalidation_reason,
        }
    except (WorkspaceCourseError, AuthoringReleaseError) as error:
        raise _error(error) from error
