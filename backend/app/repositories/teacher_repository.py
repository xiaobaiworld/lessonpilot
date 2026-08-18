from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.teacher import Teacher


def get_teacher_by_login_name(session: Session, login_name: str) -> Teacher | None:
    return session.scalar(select(Teacher).where(Teacher.login_name == login_name))


def get_teacher_by_id(session: Session, teacher_id: str) -> Teacher | None:
    return session.get(Teacher, teacher_id)


def add_teacher(session: Session, teacher: Teacher) -> Teacher:
    session.add(teacher)
    return teacher
