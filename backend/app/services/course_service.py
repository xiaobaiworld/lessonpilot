from sqlalchemy.orm import Session

from app.models.course import Course
from app.models.lesson import Lesson
from app.models.teacher import Teacher
from app.models.workspace import Workspace
from app.repositories.course_repository import (
    add_course,
    get_course_by_teacher,
    list_courses_by_teacher,
)
from app.repositories.lesson_repository import (
    add_lesson,
    get_lesson_by_course,
    get_lesson_by_teacher,
)
from app.repositories.workspace_repository import add_workspace, get_workspace_by_owner


class ResourceNotFound(Exception):
    pass


class LessonLimitReached(Exception):
    pass


def ensure_teacher_workspace(session: Session, teacher: Teacher) -> Workspace:
    workspace = get_workspace_by_owner(session, teacher.id)
    if workspace is not None:
        return workspace
    workspace = add_workspace(
        session,
        Workspace(
            owner_teacher_id=teacher.id,
            name=f"{teacher.display_name}的工作空间",
        ),
    )
    session.flush()
    return workspace


def create_course(
    session: Session,
    teacher: Teacher,
    *,
    title: str,
    description: str | None,
) -> Course:
    workspace = ensure_teacher_workspace(session, teacher)
    course = Course(
        workspace=workspace,
        title=title.strip(),
        description=description.strip() if description else None,
        status="draft",
    )
    add_course(session, course)
    session.flush()
    return course


def list_teacher_courses(session: Session, teacher: Teacher) -> list[Course]:
    return list_courses_by_teacher(session, teacher.id)


def get_teacher_course(session: Session, teacher: Teacher, course_id: str) -> Course:
    course = get_course_by_teacher(session, teacher.id, course_id)
    if course is None:
        raise ResourceNotFound
    return course


def create_lesson(
    session: Session,
    teacher: Teacher,
    *,
    course_id: str,
    title: str,
    platform: str,
    video_id: str,
) -> Lesson:
    course = get_teacher_course(session, teacher, course_id)
    if get_lesson_by_course(session, course.id) is not None:
        raise LessonLimitReached
    lesson = Lesson(
        course=course,
        title=title.strip(),
        sort_order=0,
        platform=platform,
        video_id=video_id,
        status="draft",
    )
    add_lesson(session, lesson)
    session.flush()
    return lesson


def get_teacher_lesson(session: Session, teacher: Teacher, lesson_id: str) -> Lesson:
    lesson = get_lesson_by_teacher(session, teacher.id, lesson_id)
    if lesson is None:
        raise ResourceNotFound
    return lesson
