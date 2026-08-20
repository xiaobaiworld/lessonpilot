from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.course import Course
from app.models.lesson import Lesson
from app.models.workspace import Workspace


def get_lesson_by_course(session: Session, course_id: str) -> Lesson | None:
    return session.scalar(
        select(Lesson)
        .where(Lesson.course_id == course_id)
        .order_by(Lesson.sort_order, Lesson.created_at)
        .limit(1)
    )


def get_next_lesson_sort_order(session: Session, course_id: str) -> int:
    highest_sort_order = session.scalar(
        select(func.max(Lesson.sort_order)).where(Lesson.course_id == course_id)
    )
    return 0 if highest_sort_order is None else highest_sort_order + 1


def get_lesson_by_teacher(session: Session, teacher_id: str, lesson_id: str) -> Lesson | None:
    return session.scalar(
        select(Lesson)
        .join(Course)
        .join(Workspace)
        .where(Lesson.id == lesson_id, Workspace.owner_teacher_id == teacher_id)
    )


def add_lesson(session: Session, lesson: Lesson) -> Lesson:
    session.add(lesson)
    return lesson
