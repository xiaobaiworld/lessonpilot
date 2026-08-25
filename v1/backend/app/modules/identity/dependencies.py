from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.api.errors import ApiError
from app.config import Settings
from app.infrastructure.database.session import get_db
from app.modules.identity.application_service import IdentityApplicationService
from app.modules.identity.models import AdminAccount, TeacherAccount


def get_identity_service(
    request: Request, db: Session = Depends(get_db)
) -> IdentityApplicationService:
    settings: Settings = request.app.state.settings
    if not settings.session_secret:
        raise ApiError(503, "SESSION_SECRET_UNAVAILABLE", "会话服务未配置")
    return IdentityApplicationService(db, settings.session_secret, settings.session_ttl_seconds)


def require_admin(
    request: Request,
    service: IdentityApplicationService = Depends(get_identity_service),
) -> AdminAccount:
    settings: Settings = request.app.state.settings
    admin = service.resolve_admin(request.cookies.get(settings.admin_session_cookie_name))
    if not admin:
        raise ApiError(401, "ADMIN_AUTH_REQUIRED", "请先登录管理员账号")
    return admin


def require_teacher(
    request: Request,
    service: IdentityApplicationService = Depends(get_identity_service),
) -> TeacherAccount:
    settings: Settings = request.app.state.settings
    teacher = service.resolve_teacher(request.cookies.get(settings.session_cookie_name))
    if not teacher:
        raise ApiError(401, "TEACHER_AUTH_REQUIRED", "请先登录教师账号")
    return teacher
