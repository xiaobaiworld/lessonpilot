from fastapi.testclient import TestClient

from app.infrastructure.database import models  # noqa: F401
from app.infrastructure.database.base import Base
from app.main import create_app
from app.modules.identity.application_service import IdentityApplicationService
from tests.conftest import make_settings


def make_client() -> TestClient:
    settings = make_settings()
    app = create_app(settings)
    Base.metadata.create_all(app.state.engine)
    with app.state.session_factory() as session:
        IdentityApplicationService(session, settings.session_secret).seed_admin(
            "admin", "KnownMap 管理员", "admin-password"
        )
    return TestClient(app)


def create_teacher(client: TestClient, login_name: str) -> str:
    client.post(
        "/api/v1/admin/auth/login",
        json={"login_name": "admin", "password": "admin-password"},
    )
    response = client.post(
        "/api/v1/admin/teachers",
        json={"login_name": login_name, "display_name": login_name},
    )
    assert response.status_code == 201
    return response.json()["temporary_password"]


def login_teacher(client: TestClient, login_name: str, password: str) -> None:
    response = client.post(
        "/api/v1/teacher/auth/login",
        json={"login_name": login_name, "password": password},
    )
    assert response.status_code == 200


def test_course_lesson_revision_order_and_workspace_isolation() -> None:
    client = make_client()
    first_password = create_teacher(client, "teacher-one")
    second_password = create_teacher(client, "teacher-two")
    login_teacher(client, "teacher-one", first_password)

    course = client.post(
        "/api/v1/teacher/courses",
        json={"title": "课程一", "description": "课程说明"},
    )
    assert course.status_code == 201
    course_id = course.json()["id"]
    assert course.json()["revision"] == 1

    first_lesson = client.post(
        f"/api/v1/teacher/courses/{course_id}/lessons",
        json={
            "title": "第一课",
            "video_ref": {"platform": "bilibili", "video_id": "BV1Ac41187Lm"},
        },
    ).json()
    second_lesson = client.post(
        f"/api/v1/teacher/courses/{course_id}/lessons",
        json={
            "title": "第二课",
            "video_ref": {"platform": "bilibili", "video_id": "BV1Bc41187Lm"},
        },
    ).json()
    detail = client.get(f"/api/v1/teacher/courses/{course_id}").json()
    assert [item["sort_order"] for item in detail["lessons"]] == [1, 2]
    assert detail["revision"] == 3

    stale = client.patch(
        f"/api/v1/teacher/courses/{course_id}",
        json={"revision": 1, "title": "过期修改"},
    )
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "COURSE_REVISION_CONFLICT"

    reordered = client.put(
        f"/api/v1/teacher/courses/{course_id}/lesson-order",
        json={
            "course_revision": 3,
            "lesson_ids": [second_lesson["id"], first_lesson["id"]],
        },
    )
    assert reordered.status_code == 200
    assert [item["id"] for item in reordered.json()["lessons"]] == [
        second_lesson["id"],
        first_lesson["id"],
    ]

    login_teacher(client, "teacher-two", second_password)
    assert client.get(f"/api/v1/teacher/courses/{course_id}").status_code == 404
    assert (
        client.patch(
            f"/api/v1/teacher/lessons/{first_lesson['id']}",
            json={"revision": first_lesson["revision"], "title": "越权修改"},
        ).status_code
        == 404
    )

    login_teacher(client, "teacher-one", first_password)
    unchanged = client.get(f"/api/v1/teacher/courses/{course_id}").json()
    assert unchanged["title"] == "课程一"
    assert {item["title"] for item in unchanged["lessons"]} == {"第一课", "第二课"}
