import secrets

from sqlalchemy.orm import Session

from app.models.teacher import Teacher
from app.repositories.admin_teacher_repository import (
    AdminTeacherSummaryRow,
    get_admin_teacher_summary,
    list_admin_teacher_summaries,
)
from app.repositories.teacher_repository import (
    add_teacher,
    get_teacher_by_id,
    get_teacher_by_login_name,
)
from app.services.auth_service import hash_password, normalize_login_name
from app.services.course_service import ensure_teacher_workspace


class TeacherLoginConflict(Exception):
    pass


class TeacherNotFound(Exception):
    pass


def generate_temporary_password() -> str:
    return secrets.token_urlsafe(18)


def create_teacher_for_admin(
    session: Session,
    *,
    login_name: str,
    display_name: str,
) -> tuple[Teacher, str]:
    normalized_login_name = normalize_login_name(login_name)
    normalized_display_name = display_name.strip()
    if not normalized_login_name:
        raise ValueError("Teacher login name must not be blank")
    if not normalized_display_name:
        raise ValueError("Teacher display name must not be blank")
    if get_teacher_by_login_name(session, normalized_login_name) is not None:
        raise TeacherLoginConflict(normalized_login_name)

    temporary_password = generate_temporary_password()
    teacher = add_teacher(
        session,
        Teacher(
            login_name=normalized_login_name,
            password_hash=hash_password(temporary_password),
            display_name=normalized_display_name,
            status="active",
        ),
    )
    session.flush()
    ensure_teacher_workspace(session, teacher)
    return teacher, temporary_password


def reset_teacher_password_for_admin(
    session: Session,
    teacher_id: str,
) -> tuple[Teacher, str]:
    teacher = get_teacher_by_id(session, teacher_id)
    if teacher is None:
        raise TeacherNotFound(teacher_id)

    temporary_password = generate_temporary_password()
    teacher.password_hash = hash_password(temporary_password)
    session.flush()
    return teacher, temporary_password


def list_teachers_for_admin(session: Session) -> list[AdminTeacherSummaryRow]:
    return list_admin_teacher_summaries(session)


def get_teacher_summary_for_admin(
    session: Session,
    teacher_id: str,
) -> AdminTeacherSummaryRow:
    summary = get_admin_teacher_summary(session, teacher_id)
    if summary is None:
        raise TeacherNotFound(teacher_id)
    return summary
