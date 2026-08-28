import hashlib
import json

from urllib.parse import quote

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.orm import Session

from app.api.errors import ApiError
from app.config import Settings
from app.infrastructure.database.session import get_db
from app.modules.authoring_release.application_service import (
    AuthoringReleaseApplicationService,
    AuthoringReleaseError,
)
from app.modules.authoring_release.asset_storage import AssetStorageError
from app.modules.entitlement_delivery.application_service import (
    EntitlementApplicationService,
    EntitlementError,
)
from app.modules.entitlement_delivery.asset_delivery import (
    AssetDeliveryError,
    issue_asset_token,
    verify_asset_token,
)
from app.modules.entitlement_delivery.models import AccessCode
from app.modules.entitlement_delivery.schemas import (
    AccessCodeBatchActionWrite,
    AccessCodeBatchWrite,
    AccessCodeRecipientWrite,
    AccessCodeWrite,
    CourseAssetAuthorizeWrite,
    CourseUpdateApplyWrite,
    CourseUpdateCheckWrite,
    InstalledCourseVersionWrite,
    RedemptionWrite,
    UpdateWrite,
)
from app.modules.identity.dependencies import require_teacher
from app.modules.identity.models import TeacherAccount
from app.modules.runtime_audit.application_service import RuntimeAuditApplicationService
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


def _public(
    service: EntitlementApplicationService,
    code: AccessCode,
    status_events: list[dict] | None = None,
) -> dict:
    redemptions = list(code.redemptions)
    return {
        "id": code.id,
        "access_code": service.reveal_code(code),
        "display_tail": code.display_tail,
        "status": code.status,
        "recipient_label": code.recipient_label,
        "recipient_note": code.recipient_note,
        "redeem_from": code.redeem_from,
        "redeem_until": code.redeem_until,
        "created_at": code.created_at,
        "redemption_count": len(redemptions),
        "first_redeemed_at": min((item.first_redeemed_at for item in redemptions), default=None),
        "last_redeemed_at": max((item.last_redeemed_at for item in redemptions), default=None),
        "grants": [
            {
                "course_id": grant.course_id,
                "scope": grant.scope,
                "lesson_ids": grant.scope_data.get("lessonIds", []),
                "node_ids": grant.scope_data.get("nodeIds", []),
            }
            for grant in code.grants
        ],
        **({"status_events": status_events} if status_events is not None else {}),
    }


def _audit(
    db: Session,
    request: Request,
    *,
    action: str,
    teacher_id: str,
    code_id: str,
    target_type: str = "access_code",
    target_id: str | None = None,
    idempotency_key: str | None = None,
    metadata: dict | None = None,
) -> None:
    RuntimeAuditApplicationService(db).record(
        action=action,
        actor_type="teacher",
        actor_id=teacher_id,
        target_type=target_type,
        target_id=target_id or code_id,
        idempotency_key=idempotency_key,
        metadata=metadata,
        request_id=request.state.request_id,
    )


def _status_events(db: Session, code_id: str) -> list[dict]:
    events = RuntimeAuditApplicationService(db).list_target_events("access_code", code_id)
    return [
        {
            "action": event.action,
            "result": event.result,
            "reason_code": event.reason_code,
            "occurred_at": event.occurred_at,
        }
        for event in events
    ]


def _validated_grants(
    payload: AccessCodeWrite,
    teacher: TeacherAccount,
    db: Session,
) -> list[dict]:
    courses = WorkspaceCourseApplicationService(db)
    authoring = AuthoringReleaseApplicationService(db)
    grants = []
    for item in payload.grants:
        course = courses.get_course(teacher.id, item.course_id)
        if not authoring.latest_deliverable_release(course.id):
            raise EntitlementError("RELEASE_NOT_DELIVERABLE")
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
    return grants


def _error(error: Exception) -> ApiError:
    code = getattr(error, "code", "VALIDATION_FAILED")
    status = 409 if code == "RELEASE_STALE" else 404 if code.endswith("NOT_FOUND") else 422
    return ApiError(status, code, "授权请求无效或当前不可用")


@teacher_router.post("", status_code=201)
def create_access_code(
    payload: AccessCodeWrite,
    request: Request,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> dict:
    try:
        service = _service(request, db)
        code, raw, replayed = service.create_code(
            teacher.id,
            payload.idempotency_key,
            _validated_grants(payload, teacher, db),
            payload.redeem_from,
            payload.redeem_until,
            payload.recipient_label,
            payload.recipient_note,
            commit=False,
        )
        if not replayed:
            _audit(
                db,
                request,
                action="access_code_created",
                teacher_id=teacher.id,
                code_id=code.id,
                idempotency_key=payload.idempotency_key,
                metadata={"idempotency_key": payload.idempotency_key},
            )
        db.commit()
        return {**_public(service, code), "access_code": raw, "replayed": replayed}
    except (WorkspaceCourseError, EntitlementError) as error:
        raise _error(error) from error


@teacher_router.post("/batch", status_code=201)
def create_access_code_batch(
    payload: AccessCodeBatchWrite,
    request: Request,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> dict:
    try:
        service = _service(request, db)
        items, replayed = service.create_code_batch(
            teacher.id,
            payload.idempotency_key,
            payload.count,
            _validated_grants(payload, teacher, db),
            payload.redeem_from,
            payload.redeem_until,
            payload.recipient_label,
            payload.recipient_note,
            commit=False,
        )
        if not replayed:
            for code, _ in items:
                _audit(
                    db,
                    request,
                    action="access_code_created",
                    teacher_id=teacher.id,
                    code_id=code.id,
                    idempotency_key=payload.idempotency_key,
                    metadata={
                        "idempotency_key": payload.idempotency_key,
                        "batch_count": payload.count,
                    },
                )
        db.commit()
        return {
            "items": [{**_public(service, code), "access_code": raw} for code, raw in items],
            "replayed": replayed,
        }
    except (WorkspaceCourseError, EntitlementError) as error:
        raise _error(error) from error


@teacher_router.get("")
def list_access_codes(
    request: Request,
    course_id: str | None = Query(default=None),
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> dict:
    service = _service(request, db)
    return {"items": [_public(service, item) for item in service.list_codes(teacher.id, course_id)]}


@teacher_router.get("/{access_code_id}")
def get_access_code(
    access_code_id: str,
    request: Request,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> dict:
    try:
        service = _service(request, db)
        code = service.get_code(teacher.id, access_code_id)
        return _public(service, code, _status_events(db, code.id))
    except EntitlementError as error:
        raise _error(error) from error


@teacher_router.put("/{access_code_id}/recipient")
def update_access_code_recipient(
    access_code_id: str,
    payload: AccessCodeRecipientWrite,
    request: Request,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> dict:
    try:
        service = _service(request, db)
        code = service.set_recipient(
            teacher.id,
            access_code_id,
            payload.recipient_label,
            payload.recipient_note,
            commit=False,
        )
        _audit(
            db,
            request,
            action="access_code_recipient_updated",
            teacher_id=teacher.id,
            code_id=code.id,
        )
        db.commit()
        return _public(service, code)
    except EntitlementError as error:
        raise _error(error) from error


def _change_access_code_status(
    access_code_id: str,
    action: str,
    request: Request,
    teacher: TeacherAccount,
    db: Session,
) -> dict:
    service = _service(request, db)
    code, changed = service.set_status(teacher.id, access_code_id, action, commit=False)
    if changed:
        event_actions = {
            "freeze": "access_code_frozen",
            "restore": "access_code_restored",
            "terminate": "access_code_terminated",
        }
        _audit(
            db,
            request,
            action=event_actions[action],
            teacher_id=teacher.id,
            code_id=code.id,
        )
    db.commit()
    return _public(service, code)


@teacher_router.post("/batch-actions")
def batch_change_access_code_status(
    payload: AccessCodeBatchActionWrite,
    request: Request,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> dict:
    try:
        service = _service(request, db)
        fingerprint = hashlib.sha256("\0".join(payload.access_code_ids).encode()).hexdigest()
        audit = RuntimeAuditApplicationService(db)
        prior = audit.find_operation(
            teacher.id, "access_code_batch_action", payload.idempotency_key
        )
        if prior:
            metadata = json.loads(prior.metadata_json or "{}")
            if metadata.get("fingerprint") != fingerprint:
                raise EntitlementError("ACCESS_CODE_IDEMPOTENCY_CONFLICT")
            codes = [service.get_code(teacher.id, code_id) for code_id in payload.access_code_ids]
            return {
                "items": [_public(service, code) for code in codes],
                "replayed": True,
            }
        codes, replayed = service.batch_set_status(
            teacher.id, payload.access_code_ids, payload.action, commit=False
        )
        if not replayed:
            _audit(
                db,
                request,
                action="access_code_batch_action",
                teacher_id=teacher.id,
                code_id=payload.idempotency_key,
                target_type="access_code_batch",
                target_id=payload.idempotency_key,
                idempotency_key=payload.idempotency_key,
                metadata={
                    "action": payload.action,
                    "fingerprint": fingerprint,
                },
            )
            event_action = {
                "freeze": "access_code_frozen",
                "restore": "access_code_restored",
                "terminate": "access_code_terminated",
            }[payload.action]
            for code in codes:
                _audit(
                    db,
                    request,
                    action=event_action,
                    teacher_id=teacher.id,
                    code_id=code.id,
                    idempotency_key=payload.idempotency_key,
                    metadata={"idempotency_key": payload.idempotency_key},
                )
        db.commit()
        return {
            "items": [_public(service, code) for code in codes],
            "replayed": replayed,
        }
    except EntitlementError as error:
        raise _error(error) from error


@teacher_router.post("/{access_code_id}/freeze")
def freeze_access_code(
    access_code_id: str,
    request: Request,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> dict:
    try:
        return _change_access_code_status(access_code_id, "freeze", request, teacher, db)
    except EntitlementError as error:
        raise _error(error) from error


@teacher_router.post("/{access_code_id}/restore")
def restore_access_code(
    access_code_id: str,
    request: Request,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> dict:
    try:
        return _change_access_code_status(access_code_id, "restore", request, teacher, db)
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
        return _change_access_code_status(access_code_id, "terminate", request, teacher, db)
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
            item.course_id: item.release_id
            for item in payload.known_releases
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


def _student_update_summary(
    item: InstalledCourseVersionWrite,
    grants: dict[str, dict],
    authoring: AuthoringReleaseApplicationService,
) -> dict:
    course_id = item.course_id
    scope = grants.get(course_id)
    # 没有在线资格时不读取课程标题或版本，避免把未授权课程元数据泄露给客户端。
    if not scope:
        return {
            "courseId": course_id,
            "title": None,
            "releaseId": None,
            "releaseNumber": None,
            "status": "unauthorized",
        }
    release = authoring.latest_deliverable_release(course_id)
    if not release:
        return {
            "courseId": course_id,
            "title": None,
            "releaseId": None,
            "releaseNumber": None,
            "status": "unauthorized",
        }
    return {
        "courseId": course_id,
        "title": release.course_title,
        "releaseId": release.id,
        "releaseNumber": release.release_number,
        "status": "unchanged"
        if item.release_id is not None and item.release_id == release.id
        else "update",
    }


def _student_asset_error(error: Exception) -> ApiError:
    code = getattr(error, "code", "ASSET_ACCESS_INVALID")
    statuses = {
        "ASSET_ACCESS_INVALID": 401,
        "ASSET_NOT_AUTHORIZED": 403,
        "ASSET_HASH_MISMATCH": 422,
        "ASSET_RELEASE_INVALID": 422,
        "ASSET_NOT_FOUND": 404,
        "ASSET_RANGE_INVALID": 416,
    }
    messages = {
        "ASSET_ACCESS_INVALID": "资源访问凭证无效或已过期",
        "ASSET_NOT_AUTHORIZED": "当前课程无权访问该资源",
        "ASSET_HASH_MISMATCH": "资源校验信息不匹配",
        "ASSET_RELEASE_INVALID": "课程发布版本无效",
        "ASSET_NOT_FOUND": "资源不存在或已不可用",
        "ASSET_RANGE_INVALID": "资源范围请求无效",
    }
    return ApiError(statuses.get(code, 422), code, messages.get(code, "资源访问失败"))


@student_router.post("/course-assets/authorize")
def authorize_course_assets(
    payload: CourseAssetAuthorizeWrite,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    entitlements = _service(request, db)
    try:
        grants = entitlements.effective_grants(
            payload.local_identity_id, payload.local_proof
        )
        scope = grants.get(payload.course_id)
        if not scope:
            raise AssetDeliveryError("ASSET_NOT_AUTHORIZED")

        authoring = AuthoringReleaseApplicationService(db)
        release = authoring.get_release(payload.release_id)
        if release.course_id != payload.course_id:
            raise AssetDeliveryError("ASSET_RELEASE_INVALID")
        package = entitlements.crop_package(authoring.package(release), scope)
        package_assets = {
            asset["assetId"]: asset
            for asset in package.get("assets", [])
            if isinstance(asset, dict) and isinstance(asset.get("assetId"), str)
        }
        requested = (
            [(item.asset_id, item.sha256) for item in payload.assets]
            if payload.assets
            else [(asset_id, asset["sha256"]) for asset_id, asset in package_assets.items()]
        )
        asset_hashes: dict[str, str] = {}
        for asset_id, sha256 in requested:
            if asset_id in asset_hashes:
                raise AssetDeliveryError("ASSET_NOT_AUTHORIZED")
            package_asset = package_assets.get(asset_id)
            if not package_asset:
                raise AssetDeliveryError("ASSET_NOT_AUTHORIZED")
            if sha256 != package_asset.get("sha256"):
                raise AssetDeliveryError("ASSET_HASH_MISMATCH")
            record, _ = request.app.state.asset_storage.get_by_id(asset_id)
            if (
                record.get("sha256") != package_asset.get("sha256")
                or record.get("mimeType") != package_asset.get("mimeType")
                or record.get("byteSize") != package_asset.get("byteSize")
            ):
                raise AssetDeliveryError("ASSET_HASH_MISMATCH")
            asset_hashes[asset_id] = sha256

        secret = request.app.state.settings.access_code_secret
        if not secret:
            raise ApiError(503, "ACCESS_CODE_SECRET_UNAVAILABLE", "授权服务未配置")
        token, expires_at = issue_asset_token(
            secret, payload.course_id, payload.release_id, asset_hashes
        )
        first_asset_id = next(iter(asset_hashes), None)
        asset_url = None
        if first_asset_id:
            asset_url = (
                f"{request.url_for('get_student_course_asset', asset_id=first_asset_id)}"
                f"?token={quote(token, safe='')}"
            )
        return {
            "schemaVersion": 1,
            "requestId": request.state.request_id,
            "data": {
                "courseId": payload.course_id,
                "releaseId": payload.release_id,
                "assetIds": list(asset_hashes),
                "token": token,
                "expiresAt": expires_at,
                "assetUrl": asset_url,
            },
        }
    except AssetDeliveryError as error:
        raise _student_asset_error(error) from error
    except (AssetStorageError, EntitlementError, AuthoringReleaseError) as error:
        raise _student_asset_error(error) from error


def _range_bounds(value: str, size: int) -> tuple[int, int]:
    if not value.startswith("bytes=") or "," in value:
        raise AssetDeliveryError("ASSET_RANGE_INVALID")
    try:
        start_text, end_text = value[6:].split("-", 1)
        if not start_text:
            suffix = int(end_text)
            if suffix <= 0:
                raise ValueError
            start, end = max(size - suffix, 0), size - 1
        else:
            start = int(start_text)
            end = int(end_text) if end_text else size - 1
            if start < 0 or start >= size or end < start:
                raise ValueError
            end = min(end, size - 1)
    except (ValueError, TypeError):
        raise AssetDeliveryError("ASSET_RANGE_INVALID") from None
    return start, end


@student_router.get("/course-assets/{asset_id}", name="get_student_course_asset")
def get_student_course_asset(
    asset_id: str,
    request: Request,
) -> Response:
    token = request.query_params.get("token")
    if not token:
        authorization = request.headers.get("Authorization", "")
        token = authorization.removeprefix("Bearer ").strip() or None
    if not token:
        raise _student_asset_error(AssetDeliveryError("ASSET_ACCESS_INVALID"))

    try:
        secret = request.app.state.settings.access_code_secret
        if not secret:
            raise ApiError(503, "ACCESS_CODE_SECRET_UNAVAILABLE", "授权服务未配置")
        expected_sha = verify_asset_token(secret, token, asset_id)
        record, path = request.app.state.asset_storage.get_by_id(asset_id)
        if record.get("sha256") != expected_sha:
            raise AssetDeliveryError("ASSET_ACCESS_INVALID")
        content = path.read_bytes()
        etag = f'"{record["sha256"]}"'
        headers = {
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, max-age=300",
            "ETag": etag,
        }
        if request.headers.get("If-None-Match") == etag:
            return Response(status_code=304, headers=headers)
        range_header = request.headers.get("Range")
        if range_header:
            start, end = _range_bounds(range_header, len(content))
            headers.update(
                {
                    "Content-Range": f"bytes {start}-{end}/{len(content)}",
                    "Content-Length": str(end - start + 1),
                }
            )
            return Response(
                content=content[start : end + 1],
                status_code=206,
                media_type=record["mimeType"],
                headers=headers,
            )
        headers["Content-Length"] = str(len(content))
        return Response(content=content, media_type=record["mimeType"], headers=headers)
    except (AssetDeliveryError, AssetStorageError, AuthoringReleaseError) as error:
        raise _student_asset_error(error) from error
    except OSError as error:
        raise _student_asset_error(AssetDeliveryError("ASSET_NOT_FOUND")) from error


@student_router.post("/course-updates/check")
def check_course_updates(
    payload: CourseUpdateCheckWrite,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    entitlements = _service(request, db)
    course_ids = {item.course_id for item in payload.installed_courses}
    if len(course_ids) != len(payload.installed_courses):
        raise ApiError(422, "DUPLICATE_COURSE", "课程检查列表包含重复课程")
    if payload.course_ids:
        requested = set(payload.course_ids)
        items = [item for item in payload.installed_courses if item.course_id in requested]
    else:
        items = payload.installed_courses
    try:
        grants = entitlements.effective_grants(
            payload.local_identity_id, payload.local_proof
        )
        authoring = AuthoringReleaseApplicationService(db)
        courses = [_student_update_summary(item, grants, authoring) for item in items]
        return {
            "schemaVersion": 1,
            "requestId": request.state.request_id,
            "data": {"courses": courses},
        }
    except (EntitlementError, AuthoringReleaseError) as error:
        raise _error(error) from error


@student_router.post("/course-updates/apply")
def apply_course_update(
    payload: CourseUpdateApplyWrite,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    entitlements = _service(request, db)
    try:
        grants = entitlements.effective_grants(
            payload.local_identity_id, payload.local_proof
        )
        scope = grants.get(payload.course_id)
        if not scope:
            raise EntitlementError("GRANT_NOT_FOUND")
        authoring = AuthoringReleaseApplicationService(db)
        release = authoring.latest_deliverable_release(payload.course_id)
        if not release:
            raise EntitlementError("RELEASE_NOT_DELIVERABLE")
        if release.id != payload.expected_release_id:
            raise EntitlementError("RELEASE_STALE")
        package = entitlements.crop_package(authoring.package(release), scope)
        if not package.get("lessons"):
            raise EntitlementError("RELEASE_NOT_DELIVERABLE")
        return {
            "schemaVersion": 1,
            "requestId": request.state.request_id,
            "data": {
                "courseId": payload.course_id,
                "releaseId": release.id,
                "releaseNumber": release.release_number,
                "package": package,
            },
        }
    except (EntitlementError, AuthoringReleaseError) as error:
        raise _error(error) from error
