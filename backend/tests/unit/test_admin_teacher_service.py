import pytest
from sqlalchemy import select

from app.models.course import Course
from app.models.teacher import Teacher
from app.models.workspace import Workspace
from app.seed import seed_teacher_account
from app.services.auth_service import verify_password


def test_create_teacher_for_admin_creates_active_teacher_workspace_and_hash(
    database_session,
) -> None:
    from app.services.admin_teacher_service import create_teacher_for_admin

    teacher, temporary_password = create_teacher_for_admin(
        database_session,
        login_name="  teacher-02  ",
        display_name="  新教师  ",
    )
    database_session.flush()

    assert teacher.login_name == "teacher-02"
    assert teacher.display_name == "新教师"
    assert teacher.status == "active"
    assert temporary_password
    assert teacher.password_hash != temporary_password
    assert temporary_password not in teacher.password_hash
    assert verify_password(temporary_password, teacher.password_hash) is True
    workspace = database_session.scalar(
        select(Workspace).where(Workspace.owner_teacher_id == teacher.id)
    )
    assert workspace is not None


@pytest.mark.parametrize(
    ("login_name", "display_name"),
    [
        ("", "Teacher"),
        ("   ", "Teacher"),
        ("teacher-02", ""),
        ("teacher-02", "   "),
    ],
)
def test_create_teacher_for_admin_rejects_blank_values(
    database_session,
    login_name,
    display_name,
) -> None:
    from app.services.admin_teacher_service import create_teacher_for_admin

    with pytest.raises(ValueError):
        create_teacher_for_admin(
            database_session,
            login_name=login_name,
            display_name=display_name,
        )


def test_create_teacher_for_admin_rejects_duplicate_without_changing_existing_hash(
    database_session,
) -> None:
    from app.services.admin_teacher_service import (
        TeacherLoginConflict,
        create_teacher_for_admin,
    )

    existing = seed_teacher_account(
        database_session,
        login_name="teacher-01",
        password="original-password",
        display_name="Existing Teacher",
    )
    database_session.flush()
    original_hash = existing.password_hash

    with pytest.raises(TeacherLoginConflict):
        create_teacher_for_admin(
            database_session,
            login_name="  teacher-01  ",
            display_name="Replacement Teacher",
        )

    database_session.flush()
    assert existing.password_hash == original_hash
    assert verify_password("original-password", existing.password_hash) is True


def test_reset_teacher_password_replaces_only_hash_and_preserves_status(
    database_session,
) -> None:
    from app.services.admin_teacher_service import reset_teacher_password_for_admin

    teacher = seed_teacher_account(
        database_session,
        login_name="teacher-01",
        password="old-password",
        display_name="Existing Teacher",
    )
    teacher.status = "disabled"
    database_session.flush()
    original_display_name = teacher.display_name
    original_login_name = teacher.login_name

    reset_teacher, temporary_password = reset_teacher_password_for_admin(
        database_session,
        teacher.id,
    )
    database_session.flush()

    assert reset_teacher is teacher
    assert teacher.login_name == original_login_name
    assert teacher.display_name == original_display_name
    assert teacher.status == "disabled"
    assert verify_password("old-password", teacher.password_hash) is False
    assert verify_password(temporary_password, teacher.password_hash) is True


def test_reset_teacher_password_rejects_missing_teacher(database_session) -> None:
    from app.services.admin_teacher_service import (
        TeacherNotFound,
        reset_teacher_password_for_admin,
    )

    with pytest.raises(TeacherNotFound):
        reset_teacher_password_for_admin(database_session, "missing-teacher")


def test_temporary_passwords_are_unique_across_create_and_reset(database_session) -> None:
    from app.services.admin_teacher_service import (
        create_teacher_for_admin,
        reset_teacher_password_for_admin,
    )

    teacher, created_password = create_teacher_for_admin(
        database_session,
        login_name="teacher-02",
        display_name="Teacher 02",
    )
    database_session.flush()
    _, reset_password = reset_teacher_password_for_admin(database_session, teacher.id)

    assert created_password != reset_password


def test_list_teachers_counts_only_published_courses(database_session) -> None:
    from app.services.admin_teacher_service import list_teachers_for_admin

    first = seed_teacher_account(
        database_session,
        login_name="teacher-01",
        password="password-01",
        display_name="Teacher 01",
    )
    second = seed_teacher_account(
        database_session,
        login_name="teacher-02",
        password="password-02",
        display_name="Teacher 02",
    )
    database_session.flush()
    workspaces = {
        workspace.owner_teacher_id: workspace
        for workspace in database_session.scalars(select(Workspace)).all()
    }
    database_session.add_all(
        [
            Course(
                workspace_id=workspaces[first.id].id,
                title="Published 1",
                status="published",
            ),
            Course(
                workspace_id=workspaces[first.id].id,
                title="Published 2",
                status="published",
            ),
            Course(
                workspace_id=workspaces[first.id].id,
                title="Draft",
                status="draft",
            ),
            Course(
                workspace_id=workspaces[second.id].id,
                title="Other Draft",
                status="draft",
            ),
        ]
    )
    database_session.flush()

    summaries = list_teachers_for_admin(database_session)

    assert [(summary.login_name, summary.published_course_count) for summary in summaries] == [
        ("teacher-01", 2),
        ("teacher-02", 0),
    ]
    assert not hasattr(summaries[0], "password_hash")
    assert database_session.scalars(select(Teacher)).all()
