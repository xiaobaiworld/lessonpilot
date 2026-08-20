from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import Settings
from app.main import create_app
from app.models.operation_log import OperationLog
from app.seed import seed_admin_account, seed_teacher_account


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
        seed_admin_account(
            session,
            login_name="admin",
            password="admin-password",
            display_name="KnownMap 管理员",
        )
        seed_teacher_account(
            session,
            login_name="teacher-test-01",
            password="teacher-password",
            display_name="测试教师",
        )
        session.commit()
    return app


def test_admin_can_login_restore_session_and_logout() -> None:
    app = make_app()
    with TestClient(app) as client:
        login = client.post(
            "/api/v1/admin/auth/login",
            json={"login_name": "admin", "password": "admin-password"},
        )

        assert login.status_code == 200
        assert login.json() == {
            "admin": {
                "id": login.json()["admin"]["id"],
                "login_name": "admin",
                "display_name": "KnownMap 管理员",
                "status": "active",
            }
        }
        cookie_header = login.headers["set-cookie"]
        assert "knownmap_admin_session=" in cookie_header
        assert "HttpOnly" in cookie_header
        assert "SameSite=lax" in cookie_header

        current = client.get("/api/v1/admin/auth/me")
        assert current.status_code == 200
        assert current.json()["admin"]["login_name"] == "admin"

        logout = client.post("/api/v1/admin/auth/logout")
        assert logout.status_code == 200
        assert logout.json() == {"logged_out": True}

        after_logout = client.get("/api/v1/admin/auth/me")
        assert after_logout.status_code == 401
        assert after_logout.json()["error"]["code"] == "AUTH_REQUIRED"


def test_invalid_admin_login_does_not_reveal_account_existence() -> None:
    app = make_app()
    with TestClient(app) as client:
        wrong_password = client.post(
            "/api/v1/admin/auth/login",
            json={"login_name": "admin", "password": "wrong-password"},
        )
        missing_account = client.post(
            "/api/v1/admin/auth/login",
            json={"login_name": "missing", "password": "wrong-password"},
        )

    assert wrong_password.status_code == 401
    assert missing_account.status_code == 401
    assert wrong_password.json()["error"]["code"] == "AUTH_INVALID_CREDENTIALS"
    assert missing_account.json()["error"]["code"] == wrong_password.json()["error"]["code"]
    assert missing_account.json()["error"]["message"] == wrong_password.json()["error"]["message"]
    assert wrong_password.json()["error"]["message"] == "用户名或密码错误"


def test_admin_me_rejects_missing_and_teacher_sessions() -> None:
    app = make_app()
    with TestClient(app) as client:
        missing = client.get("/api/v1/admin/auth/me")
        assert missing.status_code == 401
        assert missing.json()["error"]["code"] == "AUTH_REQUIRED"

        teacher_login = client.post(
            "/api/v1/auth/login",
            json={"login_name": "teacher-test-01", "password": "teacher-password"},
        )
        assert teacher_login.status_code == 200

        teacher_session = client.get("/api/v1/admin/auth/me")
        assert teacher_session.status_code == 401
        assert teacher_session.json()["error"]["code"] == "AUTH_REQUIRED"


def test_admin_auth_operation_logs_do_not_contain_passwords() -> None:
    app = make_app()
    with TestClient(app) as client:
        login = client.post(
            "/api/v1/admin/auth/login",
            json={"login_name": "admin", "password": "admin-password"},
        )
        assert login.status_code == 200
        assert client.get("/api/v1/admin/auth/me").status_code == 200
        assert client.post("/api/v1/admin/auth/logout").status_code == 200

    with app.state.session_factory() as session:
        rows = session.scalars(
            select(OperationLog).where(OperationLog.module == "admin-auth")
        ).all()

    assert [row.action for row in rows] == [
        "admin-auth.login.success",
        "admin-auth.session.restore",
        "admin-auth.logout",
    ]
    serialized_rows = " ".join(
        str(value)
        for row in rows
        for value in (
            row.actor_type,
            row.actor_id,
            row.module,
            row.action,
            row.target_type,
            row.target_id,
            row.result,
            row.error_code,
        )
    )
    assert "admin-password" not in serialized_rows
