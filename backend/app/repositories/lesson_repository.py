from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.course import Course
from app.models.lesson import Lesson
from app.models.workspace import Workspace


def get_lesson_by_course(session: Session, course_id: str) -> Lesson | None:
    return session.scalar(select(Lesson).where(Lesson.course_id == course_id))


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
