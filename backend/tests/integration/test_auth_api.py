from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import Settings
from app.main import create_app
from app.models.operation_log import OperationLog
from app.models.teacher import Teacher
from app.seed import seed_teacher_account


def make_app():
    settings = Settings(
        app_env="test",
        database_url="sqlite+pysqlite:///:memory:",
        session_secret="test-session-secret",
        access_code_secret="test-access-code-secret",
        session_ttl_seconds=3600,
    )
    app = create_app(settings)
    with app.state.session_factory() as session:
        seed_teacher_account(
            session,
            login_name="teacher-test-01",
            password="correct-password",
            display_name="测试教师",
        )
        session.commit()
    return app


def test_teacher_can_login_restore_session_and_logout() -> None:
    app = make_app()
    with TestClient(app) as client:
        login = client.post(
            "/api/v1/auth/login",
            json={"login_name": "teacher-test-01", "password": "correct-password"},
        )

        assert login.status_code == 200
        assert login.json()["teacher"]["login_name"] == "teacher-test-01"
        assert "knownmap_session=" in login.headers["set-cookie"]

        current = client.get("/api/v1/auth/me")
        assert current.status_code == 200
        assert current.json()["teacher"]["display_name"] == "测试教师"

        logout = client.post("/api/v1/auth/logout")
        assert logout.status_code == 200
        assert logout.json() == {"logged_out": True}

        after_logout = client.get("/api/v1/auth/me")
        assert after_logout.status_code == 401
        assert after_logout.json()["error"]["code"] == "AUTH_REQUIRED"


def test_invalid_login_is_rejected_without_revealing_account_existence() -> None:
    app = make_app()
    with TestClient(app) as client:
        wrong_password = client.post(
            "/api/v1/auth/login",
            json={"login_name": "teacher-test-01", "password": "wrong-password"},
        )
        missing_account = client.post(
            "/api/v1/auth/login",
            json={"login_name": "missing", "password": "wrong-password"},
        )

    assert wrong_password.status_code == 401
    assert missing_account.status_code == 401
    assert wrong_password.json()["error"]["code"] == "AUTH_INVALID_CREDENTIALS"
    assert missing_account.json()["error"]["code"] == wrong_password.json()["error"]["code"]
    assert missing_account.json()["error"]["message"] == wrong_password.json()["error"]["message"]


def test_disabled_teacher_cannot_login_and_attempt_is_logged() -> None:
    app = make_app()
    with app.state.session_factory() as session:
        teacher = session.scalar(select(Teacher).where(Teacher.login_name == "teacher-test-01"))
        teacher.status = "disabled"
        session.commit()

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/login",
            json={"login_name": "teacher-test-01", "password": "correct-password"},
        )

    assert response.status_code == 401
    with app.state.session_factory() as session:
        actions = session.scalars(
            select(OperationLog.action).where(OperationLog.module == "auth")
        ).all()
    assert "auth.login.failure" in actions
