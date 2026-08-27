from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.errors import ApiError
from app.infrastructure.database.session import get_db
from app.modules.admin_support.application_service import AdminSupportApplicationService
from app.modules.authoring_release.application_service import (
    AuthoringReleaseApplicationService,
    AuthoringReleaseError,
)
from app.modules.authoring_release.asset_storage import AssetStorage, AssetStorageError
from app.modules.authoring_release.models import PreviewSession, ScriptDraft
from app.modules.authoring_release.release_models import CourseRelease
from app.modules.authoring_release.schemas import (
    AvailabilityWrite,
    AssetLinkWrite,
    AssetPublic,
    CourseFileWrite,
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


AUTHORING_ERROR_MESSAGES = {
    "DRAFT_SUBTITLE_INVALID": "字幕内容无效，请检查时间戳、顺序和字幕文字",
    "DRAFT_SUBTITLE_TOO_LARGE": "字幕文件不能超过 5 MB",
    "DRAFT_NODES_INVALID": "节点数据无效，请重新添加节点",
    "DRAFT_NODE_ID_INVALID": "节点标识无效，请重新添加节点",
    "DRAFT_NODE_TYPE_INVALID": "节点类型或启用状态无效，请重新编辑节点",
    "DRAFT_LEGACY_NODE_UNSUPPORTED": "节点使用了旧版字段，请重新编辑该节点",
    "DRAFT_NODE_CONTENT_INVALID": "节点标题、正文或窗口设置无效，请检查节点内容",
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
    "RELEASE_DRAFT_MISSING": "有课节还没有保存草稿，请先保存每一节课",
    "RELEASE_DRAFT_EMPTY": "有课节没有互动节点，请先添加并保存节点",
    "RELEASE_PREVIEW_REQUIRED": "请先对所有课节的最终草稿完成测试预览",
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
    if code == "REVISION_CONFLICT":
        return ApiError(409, code, "草稿已被修改，请重新读取")
    if code.endswith("NOT_FOUND") or code in {"COURSE_NOT_FOUND", "LESSON_NOT_FOUND"}:
        return ApiError(404, code, "对象不存在或无权访问")
    return ApiError(
        422,
        code,
        AUTHORING_ERROR_MESSAGES.get(code, f"制作或发布校验失败（错误码：{code}）"),
    )


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
