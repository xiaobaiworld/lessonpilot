from fastapi import APIRouter, Depends, Request, Response

from app.api.errors import ApiError
from app.config import Settings
from app.modules.admin_support.application_service import AdminSupportApplicationService
from app.modules.identity import repository
from app.modules.identity.application_service import IdentityApplicationService
from app.modules.identity.dependencies import get_identity_service, require_admin, require_teacher
from app.modules.identity.models import AdminAccount, TeacherAccount, TeacherStatus
from app.modules.identity.schemas import (
    AdminAuthResponse,
    AdminPublic,
    ChangePasswordRequest,
    ChangePasswordResponse,
    CreateTeacherRequest,
    LoginRequest,
    LogoutResponse,
    TeacherAuthResponse,
    TeacherMutationResponse,
    TeacherPublic,
    TeacherSummary,
)

admin_auth_router = APIRouter(prefix="/api/v1/admin/auth", tags=["admin-auth"])
teacher_auth_router = APIRouter(prefix="/api/v1/teacher/auth", tags=["teacher-auth"])
admin_teacher_router = APIRouter(prefix="/api/v1/admin/teachers", tags=["admin-teachers"])


def _set_session_cookie(response: Response, settings: Settings, name: str, token: str) -> None:
    response.set_cookie(
        key=name,
        value=token,
        max_age=settings.session_ttl_seconds,
        httponly=True,
        samesite="lax",
        secure=settings.app_env == "production",
    )


@admin_auth_router.post("/login", response_model=AdminAuthResponse)
def admin_login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    service: IdentityApplicationService = Depends(get_identity_service),
) -> AdminAuthResponse:
    result = service.admin_login(payload.login_name, payload.password)
    if not result:
        raise ApiError(401, "AUTH_INVALID_CREDENTIALS", "用户名或密码错误")
    admin, token = result
    settings: Settings = request.app.state.settings
    _set_session_cookie(response, settings, settings.admin_session_cookie_name, token)
    return AdminAuthResponse(admin=AdminPublic.model_validate(admin))


@admin_auth_router.get("/me", response_model=AdminAuthResponse)
def admin_me(admin: AdminAccount = Depends(require_admin)) -> AdminAuthResponse:
    return AdminAuthResponse(admin=AdminPublic.model_validate(admin))


@admin_auth_router.post("/change-password", response_model=ChangePasswordResponse)
def admin_change_password(
    payload: ChangePasswordRequest,
    admin: AdminAccount = Depends(require_admin),
    service: IdentityApplicationService = Depends(get_identity_service),
) -> ChangePasswordResponse:
    try:
        changed = service.change_admin_password(
            admin,
            payload.current_password,
            payload.new_password,
            payload.confirm_password,
        )
    except ValueError as error:
        raise ApiError(422, str(error), "两次输入的新密码不一致") from error
    if not changed:
        raise ApiError(401, "ADMIN_PASSWORD_INVALID", "当前密码错误")
    return ChangePasswordResponse(changed=True)


@admin_auth_router.post("/logout", response_model=LogoutResponse)
def admin_logout(
    request: Request,
    response: Response,
    service: IdentityApplicationService = Depends(get_identity_service),
) -> LogoutResponse:
    settings: Settings = request.app.state.settings
    service.revoke_admin_session(request.cookies.get(settings.admin_session_cookie_name))
    response.delete_cookie(settings.admin_session_cookie_name)
    return LogoutResponse(logged_out=True)


@teacher_auth_router.post("/login", response_model=TeacherAuthResponse)
def teacher_login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    service: IdentityApplicationService = Depends(get_identity_service),
) -> TeacherAuthResponse:
    result = service.teacher_login(payload.login_name, payload.password)
    if not result:
        raise ApiError(401, "AUTH_INVALID_CREDENTIALS", "用户名或密码错误")
    teacher, token = result
    settings: Settings = request.app.state.settings
    _set_session_cookie(response, settings, settings.session_cookie_name, token)
    return TeacherAuthResponse(teacher=TeacherPublic.model_validate(teacher))


@teacher_auth_router.get("/me", response_model=TeacherAuthResponse)
def teacher_me(teacher: TeacherAccount = Depends(require_teacher)) -> TeacherAuthResponse:
    return TeacherAuthResponse(teacher=TeacherPublic.model_validate(teacher))


@teacher_auth_router.post("/logout", response_model=LogoutResponse)
def teacher_logout(
    request: Request,
    response: Response,
    service: IdentityApplicationService = Depends(get_identity_service),
) -> LogoutResponse:
    settings: Settings = request.app.state.settings
    service.revoke_teacher_session(request.cookies.get(settings.session_cookie_name))
    response.delete_cookie(settings.session_cookie_name)
    return LogoutResponse(logged_out=True)


def _teacher_summary(teacher: TeacherAccount) -> TeacherSummary:
    return TeacherSummary(
        id=teacher.id,
        login_name=teacher.login_name,
        display_name=teacher.display_name,
        status=teacher.status,
        created_at=teacher.created_at,
        updated_at=teacher.updated_at,
        published_course_count=0,
    )


@admin_teacher_router.get("", response_model=list[TeacherSummary])
def list_teacher_accounts(
    _admin: AdminAccount = Depends(require_admin),
    service: IdentityApplicationService = Depends(get_identity_service),
) -> list[TeacherSummary]:
    return [_teacher_summary(item) for item in repository.list_teachers(service.session)]


@admin_teacher_router.post("", response_model=TeacherMutationResponse, status_code=201)
def create_teacher_account(
    payload: CreateTeacherRequest,
    _admin: AdminAccount = Depends(require_admin),
    service: IdentityApplicationService = Depends(get_identity_service),
) -> TeacherMutationResponse:
    try:
        teacher, password = AdminSupportApplicationService(
            service.session, service.session_secret
        ).create_teacher(payload.login_name, payload.display_name)
    except ValueError as error:
        raise ApiError(409, str(error), "教师登录名已存在") from error
    return TeacherMutationResponse(teacher=_teacher_summary(teacher), temporary_password=password)


@admin_teacher_router.post("/{teacher_id}/reset-password", response_model=TeacherMutationResponse)
def reset_teacher_password(
    teacher_id: str,
    _admin: AdminAccount = Depends(require_admin),
    service: IdentityApplicationService = Depends(get_identity_service),
) -> TeacherMutationResponse:
    result = service.reset_teacher_password(teacher_id)
    if not result:
        raise ApiError(404, "TEACHER_NOT_FOUND", "教师不存在")
    teacher, password = result
    return TeacherMutationResponse(teacher=_teacher_summary(teacher), temporary_password=password)


def _set_status(
    teacher_id: str, status: TeacherStatus, service: IdentityApplicationService
) -> TeacherSummary:
    teacher = service.set_teacher_status(teacher_id, status)
    if not teacher:
        raise ApiError(404, "TEACHER_NOT_FOUND", "教师不存在")
    return _teacher_summary(teacher)


@admin_teacher_router.post("/{teacher_id}/deactivate", response_model=TeacherSummary)
def deactivate_teacher(
    teacher_id: str,
    _admin: AdminAccount = Depends(require_admin),
    service: IdentityApplicationService = Depends(get_identity_service),
) -> TeacherSummary:
    return _set_status(teacher_id, TeacherStatus.suspended, service)


@admin_teacher_router.post("/{teacher_id}/reactivate", response_model=TeacherSummary)
def reactivate_teacher(
    teacher_id: str,
    _admin: AdminAccount = Depends(require_admin),
    service: IdentityApplicationService = Depends(get_identity_service),
) -> TeacherSummary:
    return _set_status(teacher_id, TeacherStatus.active, service)
