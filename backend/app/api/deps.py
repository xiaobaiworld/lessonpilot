from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.api.errors import ApiError
from app.config import Settings
from app.db import get_db
from app.models.admin import Admin
from app.models.teacher import Teacher
from app.repositories.admin_repository import get_admin_by_id
from app.repositories.admin_session_repository import get_active_admin_session
from app.repositories.teacher_repository import get_teacher_by_id
from app.repositories.teacher_session_repository import get_active_session
from app.services.admin_auth_service import digest_admin_session_token
from app.services.auth_service import digest_session_token


def require_teacher(
    request: Request,
    db: Session = Depends(get_db),
) -> Teacher:
    settings: Settings = request.app.state.settings
    raw_token = request.cookies.get(settings.session_cookie_name)
    if not raw_token or not settings.session_secret:
        raise ApiError(401, "AUTH_REQUIRED", "需要教师登录。")

    token_digest = digest_session_token(raw_token, settings.session_secret)
    teacher_session = get_active_session(db, token_digest)
    if teacher_session is None:
        raise ApiError(401, "AUTH_REQUIRED", "需要教师登录。")

    teacher = get_teacher_by_id(db, teacher_session.teacher_id)
    if teacher is None or teacher.status != "active":
        raise ApiError(401, "AUTH_REQUIRED", "需要教师登录。")
    request.state.teacher_session = teacher_session
    return teacher


def require_admin(
    request: Request,
    db: Session = Depends(get_db),
) -> Admin:
    settings: Settings = request.app.state.settings
    raw_token = request.cookies.get(settings.admin_session_cookie_name)
    if not raw_token or not settings.session_secret:
        raise ApiError(401, "AUTH_REQUIRED", "需要管理员登录。")

    token_digest = digest_admin_session_token(raw_token, settings.session_secret)
    admin_session = get_active_admin_session(db, token_digest)
    if admin_session is None:
        raise ApiError(401, "AUTH_REQUIRED", "需要管理员登录。")

    admin = get_admin_by_id(db, admin_session.admin_id)
    if admin is None or admin.status != "active":
        raise ApiError(401, "AUTH_REQUIRED", "需要管理员登录。")
    request.state.admin_session = admin_session
    return admin
