from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.identity.models import (
    AdminAccount,
    AdminSession,
    TeacherAccount,
    TeacherSession,
)


def get_admin_by_login_name(session: Session, login_name: str) -> AdminAccount | None:
    return session.scalar(select(AdminAccount).where(AdminAccount.login_name == login_name))


def get_admin_session_by_digest(session: Session, digest: str) -> AdminSession | None:
    return session.scalar(select(AdminSession).where(AdminSession.token_digest == digest))


def get_teacher_by_login_name(session: Session, login_name: str) -> TeacherAccount | None:
    return session.scalar(select(TeacherAccount).where(TeacherAccount.login_name == login_name))


def get_teacher_by_id(session: Session, teacher_id: str) -> TeacherAccount | None:
    return session.get(TeacherAccount, teacher_id)


def get_teacher_session_by_digest(session: Session, digest: str) -> TeacherSession | None:
    return session.scalar(select(TeacherSession).where(TeacherSession.token_digest == digest))


def list_teachers(session: Session) -> list[TeacherAccount]:
    return list(session.scalars(select(TeacherAccount).order_by(TeacherAccount.created_at)))
