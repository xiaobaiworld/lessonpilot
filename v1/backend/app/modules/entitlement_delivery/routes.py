from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api.errors import ApiError
from app.config import Settings
from app.infrastructure.database.session import get_db
from app.modules.authoring_release.application_service import (
    AuthoringReleaseApplicationService,
    AuthoringReleaseError,
)
from app.modules.entitlement_delivery.application_service import (
    EntitlementApplicationService,
    EntitlementError,
)
from app.modules.entitlement_delivery.models import AccessCode
from app.modules.entitlement_delivery.schemas import AccessCodeWrite, RedemptionWrite, UpdateWrite
from app.modules.identity.dependencies import require_teacher
from app.modules.identity.models import TeacherAccount
from app.modules.workspace_course.application_service import (
    WorkspaceCourseApplicationService,
    WorkspaceCourseError,
)

teacher_router = APIRouter(prefix="/api/v1/teacher/access-codes", tags=["teacher-entitlements"])
student_router = APIRouter(prefix="/api/v1/student", tags=["student-delivery"])


def _service(request: Request, db: Session) -> EntitlementApplicationService:
    settings: Settings = request.app.state.settings
    if not settings.access_code_secret:
        raise ApiError(503, "ACCESS_CODE_SECRET_UNAVAILABLE", "授权服务未配置")
    return EntitlementApplicationService(db, settings.access_code_secret)


def _public(code: AccessCode) -> dict:
    return {
        "id": code.id,
        "display_tail": code.display_tail,
        "status": code.status,
        "redeem_from": code.redeem_from,
        "redeem_until": code.redeem_until,
        "created_at": code.created_at,
        "grants": [
            {
                "course_id": grant.course_id,
                "scope": grant.scope,
                "lesson_ids": grant.scope_data.get("lessonIds", []),
                "node_ids": grant.scope_data.get("nodeIds", []),
            }
            for grant in code.grants
        ],
    }


def _error(error: Exception) -> ApiError:
    code = getattr(error, "code", "VALIDATION_FAILED")
    status = 404 if code.endswith("NOT_FOUND") else 422
    return ApiError(status, code, "授权请求无效或当前不可用")


@teacher_router.post("", status_code=201)
def create_access_code(
    payload: AccessCodeWrite,
    request: Request,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> dict:
    courses = WorkspaceCourseApplicationService(db)
    try:
        grants = []
        for item in payload.grants:
            course = courses.get_course(teacher.id, item.course_id)
            if item.scope != "course" and not item.lesson_ids and not item.node_ids:
                raise EntitlementError("GRANT_SCOPE_EMPTY")
            for lesson_id in item.lesson_ids:
                lesson = courses.get_lesson(teacher.id, lesson_id)
                if lesson.course_id != course.id:
                    raise EntitlementError("GRANT_SCOPE_INVALID")
            grants.append(
                {
                    "course_id": item.course_id,
                    "scope": item.scope,
                    "scope_data": {"lessonIds": item.lesson_ids, "nodeIds": item.node_ids},
                    "valid_from": item.valid_from,
                    "valid_until": item.valid_until,
                }
            )
        code, raw, replayed = _service(request, db).create_code(
            teacher.id,
            payload.idempotency_key,
            grants,
            payload.redeem_from,
            payload.redeem_until,
        )
        return {**_public(code), "access_code": raw, "replayed": replayed}
    except (WorkspaceCourseError, EntitlementError) as error:
        raise _error(error) from error


@teacher_router.get("")
def list_access_codes(
    request: Request,
    course_id: str | None = Query(default=None),
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> dict:
    return {
        "items": [_public(item) for item in _service(request, db).list_codes(teacher.id, course_id)]
    }


@teacher_router.get("/{access_code_id}")
def get_access_code(
    access_code_id: str,
    request: Request,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> dict:
    try:
        return _public(_service(request, db).get_code(teacher.id, access_code_id))
    except EntitlementError as error:
        raise _error(error) from error


@teacher_router.post("/{access_code_id}/terminate")
def terminate_access_code(
    access_code_id: str,
    request: Request,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> dict:
    try:
        return _public(_service(request, db).terminate(teacher.id, access_code_id))
    except EntitlementError as error:
        raise _error(error) from error


def _courses(
    entitlements: EntitlementApplicationService,
    authoring: AuthoringReleaseApplicationService,
    grants: dict[str, dict],
    requested: set[str] | None = None,
    known: dict[str, str] | None = None,
) -> list[dict]:
    result = []
    for course_id, scope in grants.items():
        if requested and course_id not in requested:
            continue
        release = authoring.latest_deliverable_release(course_id)
        if not release or (known and known.get(course_id) == release.id):
            continue
        package = entitlements.crop_package(authoring.package(release), scope)
        if package["lessons"]:
            result.append(
                {
                    "courseId": course_id,
                    "title": release.course_title,
                    "releaseId": release.id,
                    "releaseNumber": release.release_number,
                    "installKind": "update" if known and course_id in known else "new",
                    "authorizedScope": {
                        "type": scope["type"],
                        "lessonIds": sorted(scope["lessonIds"]),
                        "nodeIds": sorted(scope["nodeIds"]),
                    },
                    "package": package,
                }
            )
    return result


@student_router.post("/redemptions")
def redeem(
    payload: RedemptionWrite,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    entitlements = _service(request, db)
    try:
        redemption = entitlements.redeem(
            payload.access_code, payload.local_identity_id, payload.local_proof
        )
        grants = entitlements.effective_grants(payload.local_identity_id, payload.local_proof)
        courses = _courses(entitlements, AuthoringReleaseApplicationService(db), grants)
        if not courses:
            raise EntitlementError("RELEASE_NOT_DELIVERABLE")
        return {
            "schemaVersion": 1,
            "requestId": request.state.request_id,
            "data": {
                "redemption": {"sourceRef": redemption.id, "status": "accepted"},
                "courses": courses,
            },
        }
    except (EntitlementError, AuthoringReleaseError) as error:
        raise _error(error) from error


@student_router.post("/course-updates")
def course_updates(
    payload: UpdateWrite,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    entitlements = _service(request, db)
    try:
        grants = entitlements.effective_grants(payload.local_identity_id, payload.local_proof)
        known = {
            str(item.get("courseId")): str(item.get("releaseId"))
            for item in payload.known_releases
            if isinstance(item, dict) and item.get("courseId") and item.get("releaseId")
        }
        return {
            "schemaVersion": 1,
            "requestId": request.state.request_id,
            "data": {
                "courses": _courses(
                    entitlements,
                    AuthoringReleaseApplicationService(db),
                    grants,
                    set(payload.course_ids),
                    known,
                )
            },
        }
    except (EntitlementError, AuthoringReleaseError) as error:
        raise _error(error) from error
