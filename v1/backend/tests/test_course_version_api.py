from fastapi.testclient import TestClient

from app.infrastructure.database import models  # noqa: F401
from app.infrastructure.database.base import Base
from app.main import create_app
from app.modules.identity.application_service import IdentityApplicationService
from tests.conftest import make_settings


NODE = {
    "id": "node-version-1",
    "enabled": True,
    "family": "attention",
    "interaction": "notice",
    "anchor": {"kind": "time_cross", "timeSeconds": 12},
    "title": "发布内容",
    "content": {
        "schemaVersion": 1,
        "blocks": [{"type": "paragraph", "children": [{"text": "发布快照正文"}]}],
    },
    "interactionData": None,
    "presentationHints": {"windowSize": "m", "windowStyle": "card"},
    "effects": {"pause": True},
}


def make_client() -> TestClient:
    settings = make_settings()
    app = create_app(settings)
    Base.metadata.create_all(app.state.engine)
    with app.state.session_factory() as session:
        IdentityApplicationService(session, settings.session_secret).seed_admin(
            "admin", "管理员", "admin-password"
        )
    client = TestClient(app)
    client.post(
        "/api/v1/admin/auth/login",
        json={"login_name": "admin", "password": "admin-password"},
    )
    teacher = client.post(
        "/api/v1/admin/teachers",
        json={"login_name": "teacher", "display_name": "教师"},
    ).json()
    client.post(
        "/api/v1/teacher/auth/login",
        json={"login_name": "teacher", "password": teacher["temporary_password"]},
    )
    return client


def published_course(client: TestClient) -> tuple[dict, dict, dict]:
    course = client.post("/api/v1/teacher/courses", json={"title": "版本课程"}).json()
    lesson = client.post(
        f"/api/v1/teacher/courses/{course['id']}/lessons",
        json={
            "title": "第一课",
            "video_ref": {"platform": "bilibili", "video_id": "BV1Ac41187Lm"},
        },
    ).json()
    client.put(
        f"/api/v1/teacher/lessons/{lesson['id']}/draft",
        json={"config": {"nodes": [NODE]}},
    )
    release = client.post(
        f"/api/v1/teacher/courses/{course['id']}/releases",
        json={"idempotency_key": "publish-version-1"},
    ).json()
    return course, lesson, release


def test_modify_version_restores_snapshot_and_removes_published_state() -> None:
    client = make_client()
    course, lesson, release = published_course(client)
    changed = {**NODE, "id": "node-later-change", "title": "发布后的修改"}
    client.put(
        f"/api/v1/teacher/lessons/{lesson['id']}/draft",
        json={"revision": 1, "config": {"nodes": [changed]}},
    )

    response = client.post(
        f"/api/v1/teacher/courses/{course['id']}/version-drafts",
        json={"mode": "modify", "idempotency_key": "modify-version-1"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["source_release_id"] == release["id"]
    assert body["source_retained"] is False
    assert body["course"]["id"] == course["id"]
    assert body["course"]["version_number"] == 1
    assert client.get(f"/api/v1/teacher/courses/{course['id']}/releases").json()["items"] == []
    restored = client.get(f"/api/v1/teacher/lessons/{lesson['id']}/draft").json()
    assert restored["config"]["nodes"] == [NODE]
    dashboard = client.get("/api/v1/teacher/courses").json()["items"]
    assert dashboard[0]["status"] == "draft"
    assert dashboard[0]["metrics"]["release_number"] is None

    replay = client.post(
        f"/api/v1/teacher/courses/{course['id']}/version-drafts",
        json={"mode": "modify", "idempotency_key": "modify-version-1"},
    ).json()
    assert replay["replayed"] is True
    assert replay["course"]["id"] == course["id"]


def test_add_version_retains_source_and_creates_one_independent_draft() -> None:
    client = make_client()
    course, _, release = published_course(client)

    first = client.post(
        f"/api/v1/teacher/courses/{course['id']}/version-drafts",
        json={"mode": "add", "idempotency_key": "add-version-2"},
    )

    assert first.status_code == 201
    body = first.json()
    draft = body["course"]
    assert body["source_retained"] is True
    assert draft["id"] != course["id"]
    assert draft["source_course_id"] == course["id"]
    assert draft["source_release_id"] == release["id"]
    assert draft["version_family_id"] == course["version_family_id"]
    assert draft["version_number"] == 2
    assert len(client.get(f"/api/v1/teacher/courses/{course['id']}/releases").json()["items"]) == 1

    detail = client.get(f"/api/v1/teacher/courses/{draft['id']}").json()
    copied_draft = client.get(f"/api/v1/teacher/lessons/{detail['lessons'][0]['id']}/draft").json()
    assert copied_draft["config"]["nodes"] == [NODE]

    replay = client.post(
        f"/api/v1/teacher/courses/{course['id']}/version-drafts",
        json={"mode": "add", "idempotency_key": "add-version-2"},
    ).json()
    assert replay["replayed"] is True
    assert replay["course"]["id"] == draft["id"]
    assert len(client.get("/api/v1/teacher/courses").json()["items"]) == 2
