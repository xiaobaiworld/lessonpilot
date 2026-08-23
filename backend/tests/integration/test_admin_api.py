from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import Settings
from app.main import create_app
from app.models.course import Course
from app.models.operation_log import OperationLog
from app.models.teacher import Teacher
from app.models.workspace import Workspace
from app.seed import seed_admin_account, seed_teacher_account
from app.services.auth_service import verify_password


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


def login_admin(client: TestClient) -> None:
    response = client.post(
        "/api/v1/admin/auth/login",
        json={"login_name": "admin", "password": "admin-password"},
    )
    assert response.status_code == 200


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


def test_admin_teacher_endpoints_require_admin_session() -> None:
    app = make_app()
    with app.state.session_factory() as session:
        teacher = session.scalar(select(Teacher).where(Teacher.login_name == "teacher-test-01"))
        teacher_id = teacher.id

    with TestClient(app) as client:
        assert client.get("/api/v1/admin/teachers").status_code == 401
        assert (
            client.post(
                "/api/v1/admin/teachers",
                json={"login_name": "teacher-02", "display_name": "Teacher 02"},
            ).status_code
            == 401
        )
        assert client.post(f"/api/v1/admin/teachers/{teacher_id}/reset-password").status_code == 401

        teacher_login = client.post(
            "/api/v1/auth/login",
            json={"login_name": "teacher-test-01", "password": "teacher-password"},
        )
        assert teacher_login.status_code == 200
        assert client.get("/api/v1/admin/teachers").status_code == 401


def test_admin_lists_teachers_with_published_course_counts() -> None:
    app = make_app()
    with app.state.session_factory() as session:
        teacher = session.scalar(select(Teacher).where(Teacher.login_name == "teacher-test-01"))
        workspace = session.scalar(
            select(Workspace).where(Workspace.owner_teacher_id == teacher.id)
        )
        session.add_all(
            [
                Course(
                    workspace_id=workspace.id,
                    title="Published Course",
                    status="published",
                ),
                Course(
                    workspace_id=workspace.id,
                    title="Draft Course",
                    status="draft",
                ),
            ]
        )
        session.commit()

    with TestClient(app) as client:
        login_admin(client)
        response = client.get("/api/v1/admin/teachers")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": response.json()[0]["id"],
            "login_name": "teacher-test-01",
            "display_name": "测试教师",
            "status": "active",
            "published_course_count": 1,
            "created_at": response.json()[0]["created_at"],
            "updated_at": response.json()[0]["updated_at"],
        }
    ]
    assert "password_hash" not in response.text


def test_admin_creates_teacher_once_and_returns_temporary_password_only_in_response() -> None:
    app = make_app()
    with TestClient(app) as client:
        login_admin(client)
        created = client.post(
            "/api/v1/admin/teachers",
            json={"login_name": "teacher-02", "display_name": "新教师"},
        )

        assert created.status_code == 201
        payload = created.json()
        temporary_password = payload["temporary_password"]
        assert temporary_password
        assert payload["teacher"]["login_name"] == "teacher-02"
        assert payload["teacher"]["published_course_count"] == 0
        assert "password_hash" not in created.text

        with app.state.session_factory() as session:
            original_hash = session.scalar(
                select(Teacher.password_hash).where(Teacher.login_name == "teacher-02")
            )

        duplicate = client.post(
            "/api/v1/admin/teachers",
            json={"login_name": "teacher-02", "display_name": "Replacement"},
        )
        assert duplicate.status_code == 409
        assert duplicate.json()["error"]["code"] == "TEACHER_LOGIN_CONFLICT"

    with app.state.session_factory() as session:
        teacher = session.scalar(select(Teacher).where(Teacher.login_name == "teacher-02"))
        workspace = session.scalar(
            select(Workspace).where(Workspace.owner_teacher_id == teacher.id)
        )
        assert teacher.display_name == "新教师"
        assert verify_password(temporary_password, teacher.password_hash) is True
        assert workspace is not None
        rows = session.scalars(
            select(OperationLog).where(OperationLog.action == "admin.teachers.create")
        ).all()

    assert teacher.password_hash == original_hash
    assert [row.result for row in rows] == ["success", "failure"]
    assert temporary_password not in " ".join(
        str(value)
        for row in rows
        for value in (
            row.actor_id,
            row.module,
            row.action,
            row.target_id,
            row.result,
            row.error_code,
        )
    )


def test_admin_resets_teacher_password_without_reactivating_teacher() -> None:
    app = make_app()
    with app.state.session_factory() as session:
        teacher = session.scalar(select(Teacher).where(Teacher.login_name == "teacher-test-01"))
        teacher.status = "disabled"
        teacher_id = teacher.id
        session.commit()

    with TestClient(app) as client:
        login_admin(client)
        response = client.post(f"/api/v1/admin/teachers/{teacher_id}/reset-password")

        assert response.status_code == 200
        payload = response.json()
        temporary_password = payload["temporary_password"]
        assert payload["teacher"]["status"] == "disabled"
        assert "password_hash" not in response.text

        missing = client.post("/api/v1/admin/teachers/missing-teacher/reset-password")
        assert missing.status_code == 404
        assert missing.json()["error"]["code"] == "RESOURCE_NOT_FOUND"

    with app.state.session_factory() as session:
        teacher = session.get(Teacher, teacher_id)
        assert teacher.status == "disabled"
        assert verify_password("teacher-password", teacher.password_hash) is False
        assert verify_password(temporary_password, teacher.password_hash) is True
