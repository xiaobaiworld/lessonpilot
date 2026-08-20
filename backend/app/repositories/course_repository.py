from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.course import Course
from app.models.workspace import Workspace


def list_courses_by_teacher(session: Session, teacher_id: str) -> list[Course]:
    return list(
        session.scalars(
            select(Course)
            .join(Workspace)
            .where(Workspace.owner_teacher_id == teacher_id)
            .options(selectinload(Course.lessons))
            .order_by(Course.created_at.asc())
        ).all()
    )


def get_course_by_teacher(session: Session, teacher_id: str, course_id: str) -> Course | None:
    return session.scalar(
        select(Course)
        .join(Workspace)
        .where(Course.id == course_id, Workspace.owner_teacher_id == teacher_id)
        .options(joinedload(Course.workspace), selectinload(Course.lessons))
    )


def add_course(session: Session, course: Course) -> Course:
    session.add(course)
    return course
