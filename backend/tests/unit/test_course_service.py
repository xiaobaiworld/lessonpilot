from sqlalchemy import select

from app.models.lesson import Lesson
from app.models.workspace import Workspace
from app.seed import seed_teacher_account
from app.services.course_service import (
    create_course,
    create_lesson,
    ensure_teacher_workspace,
)


def test_seeded_teacher_gets_one_idempotent_workspace(database_session) -> None:
    teacher = seed_teacher_account(
        database_session,
        login_name="teacher-course-01",
        password="correct-password",
        display_name="课程教师",
    )
    first = database_session.scalar(
        select(Workspace).where(Workspace.owner_teacher_id == teacher.id)
    )
    second = ensure_teacher_workspace(database_session, teacher)
    database_session.commit()

    workspaces = database_session.scalars(select(Workspace)).all()
    assert first is not None
    assert first.id == second.id
    assert len(workspaces) == 1
    assert workspaces[0].owner_teacher_id == teacher.id


def test_course_accepts_multiple_ordered_lessons(database_session) -> None:
    teacher = seed_teacher_account(
        database_session,
        login_name="teacher-course-02",
        password="correct-password",
        display_name="第二位课程教师",
    )
    course = create_course(
        database_session,
        teacher,
        title="面试英语第一课",
        description="本地测试课程",
    )
    first_lesson = create_lesson(
        database_session,
        teacher,
        course_id=course.id,
        title="第一课",
        platform="bilibili",
        video_id="BV1WW4y1e7GL",
    )
    second_lesson = create_lesson(
        database_session,
        teacher,
        course_id=course.id,
        title="第二课",
        platform="bilibili",
        video_id="BV2XX4y1e7GM",
    )
    database_session.commit()

    stored_lessons = database_session.scalars(
        select(Lesson).order_by(Lesson.sort_order, Lesson.created_at)
    ).all()
    assert course.workspace.owner_teacher_id == teacher.id
    assert [lesson.id for lesson in stored_lessons] == [first_lesson.id, second_lesson.id]
    assert first_lesson.id != second_lesson.id
    assert [lesson.course_id for lesson in stored_lessons] == [course.id, course.id]
    assert [lesson.sort_order for lesson in stored_lessons] == [0, 1]
    assert [lesson.id for lesson in course.lessons] == [first_lesson.id, second_lesson.id]
