from sqlalchemy import select
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.models.operation_log import OperationLog
from app.models.published_script import PublishedScript
from app.seed import seed_teacher_account
from tests.unit.test_script_schema import four_node_request


def make_app():
    settings = Settings(
        app_env="test",
        database_url="sqlite+pysqlite:///:memory:",
        session_secret="test-session-secret",
        access_code_secret="test-access-code-secret",
    )
    app = create_app(settings)
    with app.state.session_factory() as session:
        seed_teacher_account(
            session,
            login_name="publish-owner",
            password="owner-password",
            display_name="发布教师",
        )
        seed_teacher_account(
            session,
            login_name="publish-other",
            password="other-password",
            display_name="其他教师",
        )
        session.commit()
    return app


def login(client: TestClient, login_name: str, password: str) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"login_name": login_name, "password": password},
    )
    assert response.status_code == 200


def create_lesson(client: TestClient) -> tuple[str, str]:
    course = client.post(
        "/api/v1/teacher/courses",
        json={"title": "发布课程", "description": None},
    ).json()
    lesson = client.post(
        f"/api/v1/teacher/courses/{course['id']}/lessons",
        json={
            "title": "第一课",
            "video_ref": {"platform": "bilibili", "video_id": "BV1WW4y1e7GL"},
        },
    ).json()
    return course["id"], lesson["id"]


def save_draft(client: TestClient, lesson_id: str, *, node_count: int = 4) -> None:
    payload = four_node_request()
    payload["config"]["nodes"] = payload["config"]["nodes"][:node_count]
    response = client.put(
        f"/api/v1/teacher/lessons/{lesson_id}/draft",
        json=payload,
    )
    assert response.status_code == 200


def test_teacher_can_publish_and_increment_immutable_versions() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client, "publish-owner", "owner-password")
        course_id, lesson_id = create_lesson(client)
        save_draft(client, lesson_id)

        first = client.post(f"/api/v1/teacher/courses/{course_id}/publish")
        assert first.status_code == 201
        assert first.json()["version"] == 1
        assert first.json()["course"]["courseId"] == "bilibili:BV1WW4y1e7GL"

        save_draft(client, lesson_id, node_count=1)
        second = client.post(f"/api/v1/teacher/courses/{course_id}/publish")

    assert second.status_code == 201
    assert second.json()["version"] == 2
    with app.state.session_factory() as session:
        rows = session.scalars(
            select(PublishedScript).order_by(PublishedScript.version)
        ).all()
    assert [len(row.config_json["nodes"]) for row in rows] == [4, 1]


def test_publish_rejects_missing_or_empty_draft() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client, "publish-owner", "owner-password")
        course_id, lesson_id = create_lesson(client)

        missing = client.post(f"/api/v1/teacher/courses/{course_id}/publish")
        save_draft(client, lesson_id, node_count=0)
        empty = client.post(f"/api/v1/teacher/courses/{course_id}/publish")

    assert missing.status_code == 409
    assert missing.json()["error"]["code"] == "DRAFT_NOT_READY"
    assert empty.status_code == 409
    assert empty.json()["error"]["code"] == "DRAFT_NOT_READY"


def test_other_teacher_cannot_publish_course() -> None:
    app = make_app()
    with TestClient(app) as owner:
        login(owner, "publish-owner", "owner-password")
        course_id, lesson_id = create_lesson(owner)
        save_draft(owner, lesson_id)

    with TestClient(app) as other:
        login(other, "publish-other", "other-password")
        response = other.post(f"/api/v1/teacher/courses/{course_id}/publish")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_publish_action_is_logged() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client, "publish-owner", "owner-password")
        course_id, lesson_id = create_lesson(client)
        save_draft(client, lesson_id)
        response = client.post(f"/api/v1/teacher/courses/{course_id}/publish")
        assert response.status_code == 201

    with app.state.session_factory() as session:
        actions = session.scalars(
            select(OperationLog.action).where(OperationLog.module == "publish")
        ).all()
    assert "publish.course.success" in actions
