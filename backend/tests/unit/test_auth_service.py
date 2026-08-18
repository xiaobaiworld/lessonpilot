from sqlalchemy import select

from app.models.teacher import Teacher
from app.models.teacher_session import TeacherSession
from app.seed import seed_teacher_account
from app.services.auth_service import authenticate_teacher, create_teacher_session


def test_seed_teacher_is_idempotent_and_never_stores_plain_password(database_session) -> None:
    first = seed_teacher_account(
        database_session,
        login_name="teacher-test-01",
        password="correct horse battery staple",
        display_name="测试教师",
    )
    database_session.commit()

    second = seed_teacher_account(
        database_session,
        login_name="teacher-test-01",
        password="correct horse battery staple",
        display_name="测试教师",
    )
    database_session.commit()

    teachers = database_session.scalars(select(Teacher)).all()
    assert first.id == second.id
    assert len(teachers) == 1
    assert teachers[0].password_hash != "correct horse battery staple"
    assert "correct horse battery staple" not in teachers[0].password_hash


def test_authenticate_teacher_accepts_correct_password_and_rejects_wrong_password(
    database_session,
) -> None:
    teacher = seed_teacher_account(
        database_session,
        login_name="teacher-test-02",
        password="correct-password",
        display_name="第二位测试教师",
    )
    database_session.commit()

    assert authenticate_teacher(database_session, "teacher-test-02", "correct-password") == teacher
    assert authenticate_teacher(database_session, "teacher-test-02", "wrong-password") is None
    assert authenticate_teacher(database_session, "missing", "wrong-password") is None


def test_create_teacher_session_stores_only_a_digest(database_session) -> None:
    teacher = seed_teacher_account(
        database_session,
        login_name="teacher-test-03",
        password="correct-password",
        display_name="第三位测试教师",
    )
    database_session.commit()

    token, session = create_teacher_session(
        database_session,
        teacher,
        session_secret="test-session-secret",
    )
    database_session.commit()

    stored = database_session.scalar(select(TeacherSession))
    assert stored is session
    assert token
    assert stored.token_digest != token
    assert len(stored.token_digest) == 64
