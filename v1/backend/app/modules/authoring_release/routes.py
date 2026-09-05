from fastapi import APIRouter, Depends, File, Form, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse
import re
from urllib.parse import quote
from sqlalchemy.orm import Session

from app.api.errors import ApiError
from app.infrastructure.database.session import get_db
from app.modules.admin_support.application_service import AdminSupportApplicationService
from app.modules.authoring_release.application_service import (
    AuthoringReleaseApplicationService,
    AuthoringReleaseError,
    SUBTITLE_MAX_BYTES,
    repair_subtitle_document,
)
from app.modules.authoring_release.asset_storage import AssetStorage, AssetStorageError
from app.modules.authoring_release.course_package import (
    COURSE_PACKAGE_MAX_BYTES,
    CoursePackageError,
    build_course_package,
    parse_course_package,
    summary as course_package_summary,
)
from app.modules.authoring_release.models import PreviewSession, ScriptDraft
from app.modules.authoring_release.release_models import CourseRelease
from app.modules.authoring_release.schemas import (
    AvailabilityWrite,
    AssetLinkWrite,
    AssetPublic,
    CourseFileWrite,
    DraftPublic,
    DraftWrite,
    NodePresentationPublic,
    NodePresentationWrite,
    PreviewEnd,
    PreviewPublic,
    PreviewStart,
    ReleaseWrite,
    RightsWrite,
    SubtitleRepairPublic,
    VersionDraftWrite,
)
from app.modules.authoring_release.version_service import (
    CourseVersionApplicationService,
    CourseVersionError,
)
from app.modules.identity.dependencies import require_admin, require_teacher
from app.modules.identity.models import AdminAccount, TeacherAccount
from app.modules.runtime_audit.application_service import RuntimeAuditApplicationService
from app.modules.workspace_course.application_service import (
    WorkspaceCourseApplicationService,
    WorkspaceCourseError,
)
from app.modules.workspace_course.routes import _course

router = APIRouter(prefix="/api/v1/teacher", tags=["teacher-authoring-release"])
admin_router = APIRouter(prefix="/api/v1/admin/teachers", tags=["admin-course-packages"])


AUTHORING_ERROR_MESSAGES = {
    "DRAFT_SUBTITLE_INVALID": "字幕内容无效，请检查时间戳、顺序和字幕文字",
    "DRAFT_SUBTITLE_TOO_LARGE": "字幕文件不能超过 5 MB",
    "SUBTITLE_REPAIR_INVALID": "字幕无法自动修复，请检查时间戳、顺序和字幕文字",
    "SUBTITLE_REPAIR_TOO_LARGE": "字幕文件不能超过 5 MB",
    "DRAFT_NODES_INVALID": "节点数据无效，请重新添加节点",
    "DRAFT_NODE_ID_INVALID": "节点标识无效，请重新添加节点",
    "DRAFT_NODE_TYPE_INVALID": "节点类型或启用状态无效，请重新编辑节点",
    "DRAFT_LEGACY_NODE_UNSUPPORTED": "节点使用了旧版字段，请重新编辑该节点",
    "DRAFT_NODE_CONTENT_INVALID": "节点标题、正文或窗口设置无效，请检查节点内容",
    "DRAFT_NODE_PRESENTATION_INVALID": "窗口展示配置无效，请检查尺寸、位置和样式",
    "DRAFT_NODE_TRIGGER_INVALID": "节点触发时间无效，请重新设置触发时间",
    "DRAFT_NODE_BEHAVIOR_INVALID": "节点触发行为无效，请重新编辑该节点",
    "DRAFT_NOTICE_INVALID": "重点标注不能包含题型数据，请重新编辑该节点",
    "DRAFT_QUESTION_INVALID": "题型数据无效，请重新编辑该节点",
    "DRAFT_CHOICE_INVALID": "选择题需填写至少两个选项、正确答案和解析",
    "DRAFT_BLANK_INVALID": "填空题需填写可接受答案、解析和标准化规则",
    "DRAFT_FREE_TEXT_INVALID": "问答题需填写参考答案",
    "DRAFT_ASSETS_INVALID": "节点媒体资源清单无效，请检查资源信息",
    "DRAFT_ASSET_REFERENCE_INVALID": "节点引用的媒体资源类型不匹配",
    "DRAFT_ASSET_REFERENCE_MISSING": "节点引用了不存在的媒体资源",
    "DRAFT_ASSET_NOT_FOUND": "节点引用的媒体资源不存在或无权访问",
    "DRAFT_ASSET_METADATA_MISMATCH": "节点媒体资源信息已变化，请重新插入该资源",
    "DRAFT_DOCUMENT_VERSION_UNSUPPORTED": "节点正文版本不受支持，请重新编辑正文",
    "DRAFT_CONTENT_BLOCK_UNSUPPORTED": "节点正文包含不受支持的内容块",
    "RELEASE_NOT_DELIVERABLE": "当前课程暂时不能发布，请检查课程状态和课节",
}

COURSE_PACKAGE_ERROR_MESSAGES = {
    "COURSE_PACKAGE_INVALID": "课程包格式无效，请选择 KnownMap .kmcourse 文件",
    "COURSE_PACKAGE_UNSUPPORTED": "课程包版本暂不支持",
    "COURSE_PACKAGE_TOO_LARGE": "课程包或节点资源超过允许大小",
    "COURSE_PACKAGE_ASSET_METADATA_MISMATCH": "课程包中的节点资源清单不一致",
    "COURSE_PACKAGE_ASSET_INTEGRITY_FAILED": "课程包中的节点资源完整性校验失败",
    "COURSE_PACKAGE_ASSET_NOT_FOUND": "课程中的节点资源不存在或已损坏",
    "COURSE_PACKAGE_SOURCE_INVALID": "导出来源必须是已保存草稿或指定发布版本",
    "PORTABLE_IMPORT_CONFIRMATION_REQUIRED": "请先确认导入影响",
}


def _draft(draft: ScriptDraft) -> DraftPublic:
    return DraftPublic(
        schema_version=int(draft.schema_version),
        revision=draft.revision,
        config={
            "nodes": draft.content.get("nodes", []),
            "assets": draft.content.get("assets", []),
            "subtitle": draft.content.get("subtitle"),
        },
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
    if code in {"REVISION_CONFLICT", "VERSION_OPERATION_INTENT_CONFLICT"}:
        return ApiError(409, code, "草稿已被修改，请重新读取")
    if code.endswith("NOT_FOUND") or code in {"COURSE_NOT_FOUND", "LESSON_NOT_FOUND"}:
        return ApiError(404, code, "对象不存在或无权访问")
    return ApiError(
        422,
        code,
        AUTHORING_ERROR_MESSAGES.get(code, f"制作或发布校验失败（错误码：{code}）"),
    )


def _course_package_error(error: Exception) -> ApiError:
    if isinstance(error, AssetStorageError):
        return _asset_error(error)
    if isinstance(error, AuthoringReleaseError):
        return _error(error)
    code = getattr(error, "code", "COURSE_PACKAGE_INVALID")
    status = 413 if code == "COURSE_PACKAGE_TOO_LARGE" else 422
    return ApiError(status, code, COURSE_PACKAGE_ERROR_MESSAGES.get(code, "课程包校验失败"))


def _course_package_filename(title: str) -> str:
    safe = re.sub(r"[^\w\u4e00-\u9fff.-]+", "_", title, flags=re.UNICODE).strip("._")
    return f"{(safe or 'course')[:80]}.kmcourse"


def _record_package_audit(
    db: Session,
    request: Request,
    admin: AdminAccount,
    *,
    action: str,
    teacher_id: str,
    target_id: str | None,
    result: str,
    source: str | None = None,
    package_size: int | None = None,
) -> None:
    RuntimeAuditApplicationService(db).record(
        action=action,
        actor_type="admin",
        actor_id=admin.id,
        target_type="course_package",
        target_id=target_id or teacher_id,
        result=result,
        metadata={
            "teacherId": teacher_id,
            **({"source": source} if source else {}),
            **({"packageBytes": package_size} if package_size is not None else {}),
        },
        request_id=request.state.request_id,
    )
    db.commit()


def _admin_teacher(db: Session, teacher_id: str) -> TeacherAccount:
    teacher = db.get(TeacherAccount, teacher_id)
    if not teacher:
        raise ApiError(404, "TEACHER_NOT_FOUND", "教师不存在")
    return teacher


@admin_router.get("/{teacher_id}/courses")
def list_admin_teacher_courses(
    teacher_id: str,
    _admin: AdminAccount = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    _admin_teacher(db, teacher_id)
    courses = WorkspaceCourseApplicationService(db).list_courses(teacher_id)
    authoring = AuthoringReleaseApplicationService(db)
    return {
        "items": [
            {
                "id": course.id,
                "title": course.title,
                "description": course.description,
                "status": course.status,
                "lesson_count": len(course.lessons),
                "updated_at": course.updated_at,
                "releases": [
                    {
                        "id": release.id,
                        "release_number": release.release_number,
                        "lesson_count": release.lesson_count,
                        "status": release.status,
                        "published_at": release.published_at,
                    }
                    for release in authoring.list_releases(course.id)
                ],
            }
            for course in courses
        ]
    }


@admin_router.get("/{teacher_id}/courses/{course_id}/course-package")
def export_admin_course_package(
    teacher_id: str,
    course_id: str,
    request: Request,
    source: str = Query(default="draft"),
    release_id: str | None = Query(default=None),
    admin: AdminAccount = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Response:
    _admin_teacher(db, teacher_id)
    courses, authoring = _services(db, _asset_store(request))
    try:
        course = courses.get_course(teacher_id, course_id)
        if source == "draft":
            teacher_file = authoring.export_draft_file(course, list(course.lessons))
        elif source == "release" and release_id:
            release = authoring.get_release(release_id)
            if release.course_id != course.id or release.published_by_teacher_id != teacher_id:
                raise AuthoringReleaseError("RELEASE_NOT_FOUND")
            teacher_file = authoring.export_release_file(release)
        else:
            raise CoursePackageError("COURSE_PACKAGE_SOURCE_INVALID")
        package = build_course_package(teacher_file, teacher_id, _asset_store(request))
        _record_package_audit(
            db,
            request,
            admin,
            action="course.package.export",
            teacher_id=teacher_id,
            target_id=course_id,
            result="success",
            source=source,
            package_size=len(package),
        )
        filename = _course_package_filename(course.title)
        return Response(
            content=package,
            media_type="application/vnd.knownmap.course+zip",
            headers={
                "Content-Disposition": (
                    f'attachment; filename="course.kmcourse"; filename*=UTF-8\'\'{quote(filename)}'
                )
            },
        )
    except (WorkspaceCourseError, AuthoringReleaseError, CoursePackageError, AssetStorageError) as error:
        _record_package_audit(
            db,
            request,
            admin,
            action="course.package.export",
            teacher_id=teacher_id,
            target_id=course_id,
            result="failure",
            source=source,
        )
        if isinstance(error, WorkspaceCourseError):
            raise _error(error) from error
        raise _course_package_error(error) from error


async def _read_course_package(file: UploadFile) -> bytes:
    data = await file.read(COURSE_PACKAGE_MAX_BYTES + 1)
    if len(data) > COURSE_PACKAGE_MAX_BYTES:
        raise CoursePackageError("COURSE_PACKAGE_TOO_LARGE")
    return data


@admin_router.post("/{teacher_id}/course-packages/import/preview")
async def preview_admin_course_package(
    teacher_id: str,
    request: Request,
    file: UploadFile = File(...),
    admin: AdminAccount = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    _admin_teacher(db, teacher_id)
    store = _asset_store(request)
    try:
        data = await _read_course_package(file)
        parsed = parse_course_package(data, max_asset_bytes=store.max_bytes)
        result = {
            "valid": True,
            "summary": course_package_summary(parsed),
            "target_teacher_id": teacher_id,
            "will_create_new_course": True,
        }
        _record_package_audit(
            db,
            request,
            admin,
            action="course.package.import.preview",
            teacher_id=teacher_id,
            target_id=teacher_id,
            result="success",
            source=parsed.manifest["source"]["type"],
            package_size=len(data),
        )
        return result
    except (CoursePackageError, AssetStorageError, AuthoringReleaseError) as error:
        _record_package_audit(
            db,
            request,
            admin,
            action="course.package.import.preview",
            teacher_id=teacher_id,
            target_id=teacher_id,
            result="failure",
        )
        raise _course_package_error(error) from error


@admin_router.post("/{teacher_id}/course-packages/import", status_code=201)
async def import_admin_course_package(
    teacher_id: str,
    request: Request,
    file: UploadFile = File(...),
    confirm: bool = Form(default=False),
    admin: AdminAccount = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    _admin_teacher(db, teacher_id)
    if not confirm:
        error = CoursePackageError("PORTABLE_IMPORT_CONFIRMATION_REQUIRED")
        _record_package_audit(
            db,
            request,
            admin,
            action="course.package.import",
            teacher_id=teacher_id,
            target_id=teacher_id,
            result="failure",
        )
        raise _course_package_error(error)
    store = _asset_store(request)
    courses, authoring = _services(db, store)
    data = b""
    try:
        data = await _read_course_package(file)
        parsed = parse_course_package(data, max_asset_bytes=store.max_bytes)
        course = authoring.import_course_package(teacher_id, data, courses, store)
        _record_package_audit(
            db,
            request,
            admin,
            action="course.package.import",
            teacher_id=teacher_id,
            target_id=course.id,
            result="success",
            source=parsed.manifest["source"]["type"],
            package_size=len(data),
        )
        return {
            "course": {"id": course.id, "title": course.title},
            "lesson_count": len(course.lessons),
            "asset_count": len(parsed.manifest["assets"]),
        }
    except (WorkspaceCourseError, AuthoringReleaseError, CoursePackageError, AssetStorageError) as error:
        _record_package_audit(
            db,
            request,
            admin,
            action="course.package.import",
            teacher_id=teacher_id,
            target_id=teacher_id,
            result="failure",
            package_size=len(data) if data else None,
        )
        if isinstance(error, WorkspaceCourseError):
            raise _error(error) from error
        raise _course_package_error(error) from error


def _services(
    db: Session,
    asset_store: AssetStorage | None = None,
) -> tuple[WorkspaceCourseApplicationService, AuthoringReleaseApplicationService]:
    return WorkspaceCourseApplicationService(db), AuthoringReleaseApplicationService(
        db, asset_store
    )


def _asset_store(request: Request) -> AssetStorage:
    return request.app.state.asset_storage


def _asset_error(error: AssetStorageError) -> ApiError:
    status = 404 if error.code == "ASSET_NOT_FOUND" else 422
    messages = {
        "ASSET_FILE_TYPE_INVALID": "只支持 PNG、JPEG、GIF、WebP、MP3、WAV、OGG、MP4 或 WebM",
        "ASSET_TOO_LARGE": "媒体文件不能超过 50 MB",
        "ASSET_SOURCE_INVALID": "媒体链接不安全或不是 HTTP(S) 地址",
        "ASSET_SOURCE_UNAVAILABLE": "媒体链接无法访问",
        "ASSET_STORAGE_FAILED": "媒体保存失败，请稍后重试",
        "ASSET_NOT_FOUND": "资源不存在或无权访问",
    }
    return ApiError(status, error.code, messages.get(error.code, "媒体资源操作失败"))


@router.post("/assets/upload", response_model=AssetPublic, status_code=201)
async def upload_asset(
    file: UploadFile = File(...),
    teacher: TeacherAccount = Depends(require_teacher),
    store: AssetStorage = Depends(_asset_store),
) -> dict:
    try:
        data = await file.read(store.max_bytes + 1)
        return store.save_upload(teacher.id, data, file.content_type, file.filename)
    except AssetStorageError as error:
        raise _asset_error(error) from error


@router.post("/assets/import-url", response_model=AssetPublic, status_code=201)
def import_asset_url(
    payload: AssetLinkWrite,
    teacher: TeacherAccount = Depends(require_teacher),
    store: AssetStorage = Depends(_asset_store),
) -> dict:
    try:
        return store.import_url(teacher.id, payload.url)
    except AssetStorageError as error:
        raise _asset_error(error) from error


@router.get("/assets/{asset_id}")
def get_asset(
    asset_id: str,
    teacher: TeacherAccount = Depends(require_teacher),
    store: AssetStorage = Depends(_asset_store),
) -> FileResponse:
    try:
        record, path = store.get(teacher.id, asset_id)
        return FileResponse(path, media_type=record["mimeType"], filename=asset_id)
    except AssetStorageError as error:
        raise _asset_error(error) from error


@router.post("/subtitles/repair", response_model=SubtitleRepairPublic)
async def repair_subtitle(
    file: UploadFile = File(...),
    teacher: TeacherAccount = Depends(require_teacher),
) -> dict:
    del teacher
    filename = file.filename or ""
    subtitle_format = (
        "vtt"
        if filename.lower().endswith(".vtt")
        else "srt"
        if filename.lower().endswith(".srt")
        else None
    )
    if subtitle_format is None:
        raise _error(AuthoringReleaseError("SUBTITLE_REPAIR_INVALID"))
    data = await file.read(SUBTITLE_MAX_BYTES + 1)
    if len(data) > SUBTITLE_MAX_BYTES:
        raise _error(AuthoringReleaseError("SUBTITLE_REPAIR_TOO_LARGE"))
    try:
        content = data.decode("utf-8")
    except UnicodeDecodeError as error:
        raise _error(AuthoringReleaseError("SUBTITLE_REPAIR_INVALID")) from error
    try:
        subtitle, changes = repair_subtitle_document(
            {
                "schemaVersion": 1,
                "filename": filename,
                "format": subtitle_format,
                "content": content,
            }
        )
        return {"valid": True, "repaired": bool(changes), "changes": changes, "subtitle": subtitle}
    except AuthoringReleaseError as error:
        raise _error(error) from error


@router.get("/courses/{course_id}/course-file")
def export_course_file(
    course_id: str,
    source: str = Query(default="draft"),
    release_id: str | None = Query(default=None),
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> dict:
    courses, authoring = _services(db)
    try:
        course = courses.get_course(teacher.id, course_id)
        if source == "draft":
            return authoring.export_draft_file(course, list(course.lessons))
        if source != "release" or not release_id:
            raise AuthoringReleaseError("PORTABLE_SOURCE_INVALID")
        release = authoring.get_release(release_id)
        if release.course_id != course.id:
            raise AuthoringReleaseError("RELEASE_NOT_FOUND")
        return authoring.export_release_file(release)
    except (WorkspaceCourseError, AuthoringReleaseError) as error:
        raise _error(error) from error


@router.post("/course-files/import/preview")
def preview_course_file(
    payload: CourseFileWrite,
    teacher: TeacherAccount = Depends(require_teacher),
) -> dict:
    del teacher
    try:
        from app.modules.authoring_release.portable import summary, validate_teacher_course_file

        value = validate_teacher_course_file(payload.file)
        return {"valid": True, "summary": summary(value)}
    except AuthoringReleaseError as error:
        raise _error(error) from error


@router.post("/course-files/import", status_code=201)
def import_course_file(
    payload: CourseFileWrite,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> dict:
    if not payload.confirm:
        raise _error(AuthoringReleaseError("PORTABLE_IMPORT_CONFIRMATION_REQUIRED"))
    courses, authoring = _services(db)
    try:
        course = authoring.import_teacher_course_file(teacher.id, payload.file, courses)
        return {
            "course": {"id": course.id, "title": course.title},
            "lesson_count": len(course.lessons),
        }
    except (WorkspaceCourseError, AuthoringReleaseError) as error:
        raise _error(error) from error


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
    request: Request,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> DraftPublic:
    courses, authoring = _services(db, _asset_store(request))
    try:
        courses.get_lesson(teacher.id, lesson_id)
        return _draft(
            authoring.save_draft(
                teacher.id,
                lesson_id,
                payload.schema_version,
                payload.config.model_dump(by_alias=True, exclude_none=True),
                payload.revision,
            )
        )
    except (WorkspaceCourseError, AuthoringReleaseError) as error:
        raise _error(error) from error


@router.put(
    "/lessons/{lesson_id}/draft/nodes/{node_id}/presentation",
    response_model=NodePresentationPublic,
)
def update_node_presentation(
    lesson_id: str,
    node_id: str,
    payload: NodePresentationWrite,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> NodePresentationPublic:
    courses, authoring = _services(db)
    try:
        courses.get_lesson(teacher.id, lesson_id)
        revision, hints = authoring.update_node_presentation(
            teacher.id,
            lesson_id,
            node_id,
            payload.revision,
            payload.presentation_hints.model_dump(by_alias=True),
        )
        return NodePresentationPublic(
            lesson_id=lesson_id,
            node_id=node_id,
            revision=revision,
            presentation_hints=hints,
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


@router.post("/courses/{course_id}/version-drafts", status_code=201)
def create_version_draft(
    course_id: str,
    payload: VersionDraftWrite,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> dict:
    try:
        operation, course, replayed = CourseVersionApplicationService(db).create_version_draft(
            teacher.id, course_id, payload.mode, payload.idempotency_key
        )
        return {
            "source_course_id": operation.source_course_id,
            "source_release_id": operation.source_release_id,
            "mode": operation.mode,
            "source_retained": operation.source_retained,
            "replayed": replayed,
            "course": _course(course).model_dump(mode="json"),
        }
    except (WorkspaceCourseError, CourseVersionError) as error:
        raise _error(error) from error


@router.post("/courses/{course_id}/releases", status_code=201)
def publish_course(
    course_id: str,
    payload: ReleaseWrite,
    request: Request,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> dict:
    courses, authoring = _services(db, _asset_store(request))
    try:
        course = courses.get_course(teacher.id, course_id)
        # 权属确认改由合约完成，发布不再依赖 rights-attestation。
        rights = AdminSupportApplicationService(db).latest_rights(teacher.id, course_id)
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
