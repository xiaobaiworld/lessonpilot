import os

from app.config import Settings
from app.db import create_database_engine, create_session_factory
from app.models.teacher import Teacher
from app.repositories.teacher_repository import add_teacher, get_teacher_by_login_name
from app.services.auth_service import hash_password, normalize_login_name
from app.services.course_service import ensure_teacher_workspace


def seed_teacher_account(
    session,
    *,
    login_name: str,
    password: str,
    display_name: str,
) -> Teacher:
    normalized_login_name = normalize_login_name(login_name)
    teacher = get_teacher_by_login_name(session, normalized_login_name)
    if teacher is None:
        teacher = add_teacher(
            session,
            Teacher(
                login_name=normalized_login_name,
                password_hash=hash_password(password),
                display_name=display_name.strip(),
                status="active",
            ),
        )
    else:
        teacher.password_hash = hash_password(password)
        teacher.display_name = display_name.strip()
        teacher.status = "active"
    session.flush()
    ensure_teacher_workspace(session, teacher)
    return teacher


def main() -> None:
    settings = Settings()
    engine = create_database_engine(settings)
    session_factory = create_session_factory(engine)
    login_name = os.environ["SEED_TEACHER_LOGIN_NAME"]
    password = os.environ["SEED_TEACHER_PASSWORD"]
    display_name = os.environ["SEED_TEACHER_DISPLAY_NAME"]
    with session_factory() as session:
        seed_teacher_account(
            session,
            login_name=login_name,
            password=password,
            display_name=display_name,
        )
        session.commit()


if __name__ == "__main__":
    main()
