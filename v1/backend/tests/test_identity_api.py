from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.infrastructure.database.base import Base
from app.infrastructure.database import models  # noqa: F401
from app.main import create_app
from app.modules.identity.application_service import IdentityApplicationService
from app.modules.workspace_course.models import Workspace
from tests.conftest import make_settings


def make_identity_client() -> tuple[TestClient, object]:
    settings = make_settings()
    app = create_app(settings)
    Base.metadata.create_all(app.state.engine)
    with app.state.session_factory() as session:
        IdentityApplicationService(session, settings.session_secret).seed_admin(
            "admin", "KnownMap 管理员", "admin-password"
        )
    return TestClient(app), app


def admin_login(client: TestClient) -> None:
    response = client.post(
        "/api/v1/admin/auth/login",
        json={"login_name": "admin", "password": "admin-password"},
    )
    assert response.status_code == 200
    assert response.json()["admin"]["login_name"] == "admin"
    assert "httponly" in response.headers["set-cookie"].lower()


def test_admin_creates_teacher_and_teacher_uses_isolated_session() -> None:
    client, app = make_identity_client()
    assert (
        client.post(
            "/api/v1/admin/auth/login",
            json={"login_name": "admin", "password": "wrong"},
        ).status_code
        == 401
    )
    admin_login(client)

    created = client.post(
        "/api/v1/admin/teachers",
        json={"login_name": "teacher-01", "display_name": "测试教师"},
    )
    assert created.status_code == 201
    body = created.json()
    temporary_password = body["temporary_password"]
    assert temporary_password
    assert "temporary_password" not in str(client.get("/api/v1/admin/teachers").json())

    with app.state.session_factory() as session:
        assert session.scalar(select(func.count()).select_from(Workspace)) == 1

    # 管理员 Cookie 不能冒充教师。
    assert client.get("/api/v1/teacher/auth/me").status_code == 401
    teacher_login = client.post(
        "/api/v1/teacher/auth/login",
        json={"login_name": "teacher-01", "password": temporary_password},
    )
    assert teacher_login.status_code == 200
    assert teacher_login.json()["teacher"]["display_name"] == "测试教师"
    assert client.get("/api/v1/teacher/auth/me").status_code == 200


def test_deactivate_and_password_reset_invalidate_existing_teacher_sessions() -> None:
    client, _app = make_identity_client()
    admin_login(client)
    created = client.post(
        "/api/v1/admin/teachers",
        json={"login_name": "teacher-02", "display_name": "第二位教师"},
    ).json()
    teacher_id = created["teacher"]["id"]
    first_password = created["temporary_password"]
    assert (
        client.post(
            "/api/v1/teacher/auth/login",
            json={"login_name": "teacher-02", "password": first_password},
        ).status_code
        == 200
    )

    assert client.post(f"/api/v1/admin/teachers/{teacher_id}/deactivate").status_code == 200
    assert client.get("/api/v1/teacher/auth/me").status_code == 401
    assert (
        client.post(
            "/api/v1/teacher/auth/login",
            json={"login_name": "teacher-02", "password": first_password},
        ).status_code
        == 401
    )

    assert client.post(f"/api/v1/admin/teachers/{teacher_id}/reactivate").status_code == 200
    assert (
        client.post(
            "/api/v1/teacher/auth/login",
            json={"login_name": "teacher-02", "password": first_password},
        ).status_code
        == 200
    )

    reset = client.post(f"/api/v1/admin/teachers/{teacher_id}/reset-password")
    assert reset.status_code == 200
    second_password = reset.json()["temporary_password"]
    assert client.get("/api/v1/teacher/auth/me").status_code == 401
    assert (
        client.post(
            "/api/v1/teacher/auth/login",
            json={"login_name": "teacher-02", "password": first_password},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/teacher/auth/login",
            json={"login_name": "teacher-02", "password": second_password},
        ).status_code
        == 200
    )


def test_admin_password_change_requires_an_authenticated_admin() -> None:
    client, _app = make_identity_client()

    response = client.post(
        "/api/v1/admin/auth/change-password",
        json={
            "current_password": "admin-password",
            "new_password": "new-admin-password",
            "confirm_password": "new-admin-password",
        },
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "ADMIN_AUTH_REQUIRED"


def test_admin_password_change_rejects_wrong_current_password_and_mismatch() -> None:
    client, _app = make_identity_client()
    admin_login(client)

    wrong_current = client.post(
        "/api/v1/admin/auth/change-password",
        json={
            "current_password": "wrong-current-password",
            "new_password": "new-admin-password",
            "confirm_password": "new-admin-password",
        },
    )
    assert wrong_current.status_code == 401
    assert wrong_current.json()["error"]["code"] == "ADMIN_PASSWORD_INVALID"

    mismatch = client.post(
        "/api/v1/admin/auth/change-password",
        json={
            "current_password": "admin-password",
            "new_password": "new-admin-password",
            "confirm_password": "different-password",
        },
    )
    assert mismatch.status_code == 422
    assert mismatch.json()["error"]["code"] == "ADMIN_PASSWORD_CONFIRMATION_MISMATCH"


def test_admin_password_change_invalidates_all_sessions_and_allows_new_login() -> None:
    client, _app = make_identity_client()
    admin_login(client)

    second_client = TestClient(client.app)
    admin_login(second_client)

    response = client.post(
        "/api/v1/admin/auth/change-password",
        json={
            "current_password": "admin-password",
            "new_password": "new-admin-password",
            "confirm_password": "new-admin-password",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"changed": True}
    assert client.get("/api/v1/admin/auth/me").status_code == 401
    assert second_client.get("/api/v1/admin/auth/me").status_code == 401
    assert (
        client.post(
            "/api/v1/admin/auth/login",
            json={"login_name": "admin", "password": "admin-password"},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/admin/auth/login",
            json={"login_name": "admin", "password": "new-admin-password"},
        ).status_code
        == 200
    )
