import os
import sys

from app.config import Settings
from app.infrastructure.database.session import create_database_engine, create_session_factory
from app.modules.admin_support.application_service import AdminSupportApplicationService
from app.modules.identity import repository
from app.modules.identity.application_service import IdentityApplicationService


def required(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise SystemExit(f"{name} 未设置")
    return value


def main() -> None:
    settings = Settings()
    if not settings.session_secret:
        raise SystemExit("SESSION_SECRET 未设置")
    session_factory = create_session_factory(create_database_engine(settings))
    with session_factory() as session:
        identity = IdentityApplicationService(session, settings.session_secret)
        if sys.argv[1:] == ["admin"]:
            identity.seed_admin(
                required("SEED_ADMIN_LOGIN_NAME"),
                required("SEED_ADMIN_DISPLAY_NAME"),
                required("SEED_ADMIN_PASSWORD"),
            )
            return

        login_name = required("SEED_TEACHER_LOGIN_NAME")
        password = required("SEED_TEACHER_PASSWORD")
        teacher = repository.get_teacher_by_login_name(session, login_name)
        if teacher:
            teacher.password_hash = identity.passwords.hash_password(password)
            teacher.credential_version += 1
            session.commit()
            return
        teacher, _temporary_password = AdminSupportApplicationService(
            session, settings.session_secret
        ).create_teacher(login_name, required("SEED_TEACHER_DISPLAY_NAME"))
        teacher.password_hash = identity.passwords.hash_password(password)
        session.commit()


if __name__ == "__main__":
    main()
