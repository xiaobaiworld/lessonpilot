from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.modules.workspace_course.models import Course, Lesson, Workspace


def get_workspace_by_teacher(session: Session, teacher_id: str) -> Workspace | None:
    return session.scalar(select(Workspace).where(Workspace.owner_teacher_id == teacher_id))


def list_courses(session: Session, workspace_id: str) -> list[Course]:
    return list(
        session.scalars(
            select(Course)
            .options(selectinload(Course.lessons))
            .where(Course.workspace_id == workspace_id)
            .order_by(Course.created_at)
        )
    )


def get_course(session: Session, workspace_id: str, course_id: str) -> Course | None:
    return session.scalar(
        select(Course)
        .options(selectinload(Course.lessons).selectinload(Lesson.video_reference))
        .where(Course.id == course_id, Course.workspace_id == workspace_id)
    )


def next_lesson_sequence(session: Session, course_id: str) -> int:
    current = session.scalar(select(func.max(Lesson.sequence)).where(Lesson.course_id == course_id))
    return (current or 0) + 1


def get_lesson(session: Session, workspace_id: str, lesson_id: str) -> Lesson | None:
    return session.scalar(
        select(Lesson)
        .join(Course)
        .options(selectinload(Lesson.video_reference))
        .where(Lesson.id == lesson_id, Course.workspace_id == workspace_id)
    )
