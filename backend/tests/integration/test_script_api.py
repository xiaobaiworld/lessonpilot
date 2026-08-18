from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import Settings
from app.main import create_app
from app.models.operation_log import OperationLog
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
            login_name="script-owner",
            password="owner-password",
            display_name="脚本教师",
        )
        seed_teacher_account(
            session,
            login_name="script-other",
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
        json={"title": "脚本课程", "description": None},
    ).json()
    lesson = client.post(
        f"/api/v1/teacher/courses/{course['id']}/lessons",
        json={
            "title": "第一课",
            "video_ref": {"platform": "bilibili", "video_id": "BV1WW4y1e7GL"},
        },
    ).json()
    return course["id"], lesson["id"]


def test_teacher_can_save_replace_and_read_script_draft() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client, "script-owner", "owner-password")
        _, lesson_id = create_lesson(client)

        saved = client.put(
            f"/api/v1/teacher/lessons/{lesson_id}/draft",
            json=four_node_request(),
        )
        assert saved.status_code == 200
        assert saved.json()["node_count"] == 4

        replacement = four_node_request()
        replacement["config"]["nodes"] = replacement["config"]["nodes"][:1]
        replaced = client.put(
            f"/api/v1/teacher/lessons/{lesson_id}/draft",
            json=replacement,
        )
        loaded = client.get(f"/api/v1/teacher/lessons/{lesson_id}/draft")

    assert replaced.status_code == 200
    assert loaded.status_code == 200
    assert loaded.json()["config"]["nodes"][0]["interaction"] == "notice"
    assert len(loaded.json()["config"]["nodes"]) == 1


def test_other_teacher_cannot_read_or_write_script_draft() -> None:
    app = make_app()
    with TestClient(app) as owner:
        login(owner, "script-owner", "owner-password")
        _, lesson_id = create_lesson(owner)

    with TestClient(app) as other:
        login(other, "script-other", "other-password")
        write = other.put(
            f"/api/v1/teacher/lessons/{lesson_id}/draft",
            json=four_node_request(),
        )
        read = other.get(f"/api/v1/teacher/lessons/{lesson_id}/draft")

    assert write.status_code == 404
    assert read.status_code == 404
    assert write.json()["error"]["code"] == "RESOURCE_NOT_FOUND"
    assert read.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_draft_actions_are_logged() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client, "script-owner", "owner-password")
        _, lesson_id = create_lesson(client)
        client.put(f"/api/v1/teacher/lessons/{lesson_id}/draft", json=four_node_request())
        client.get(f"/api/v1/teacher/lessons/{lesson_id}/draft")

    with app.state.session_factory() as session:
        actions = session.scalars(
            select(OperationLog.action).where(OperationLog.module == "script")
        ).all()
    assert "script.draft.save.success" in actions
    assert "script.draft.read.success" in actions
