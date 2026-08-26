from fastapi.testclient import TestClient

from app.infrastructure.database import models  # noqa: F401
from app.infrastructure.database.base import Base
from app.main import create_app
from app.modules.identity.application_service import IdentityApplicationService
from tests.conftest import make_settings


NODE = {
    "id": "node-1",
    "enabled": True,
    "family": "attention",
    "interaction": "notice",
    "trigger": {"kind": "time_cross", "timeSeconds": 12},
    "display": {"title": "重点", "richBody": "<p>记住这一点</p>"},
    "evaluation": None,
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


def test_draft_preview_atomic_release_and_immutable_snapshot() -> None:
    client = make_client()
    course = client.post("/api/v1/teacher/courses", json={"title": "课程"}).json()
    lesson = client.post(
        f"/api/v1/teacher/courses/{course['id']}/lessons",
        json={
            "title": "第一课",
            "video_ref": {"platform": "bilibili", "video_id": "BV1Ac41187Lm"},
        },
    ).json()

    invalid = client.put(
        f"/api/v1/teacher/lessons/{lesson['id']}/draft",
        json={"schema_version": 1, "config": {"nodes": [{**NODE, "display": {}}]}},
    )
    assert invalid.status_code == 422
    assert client.get(f"/api/v1/teacher/lessons/{lesson['id']}/draft").status_code == 404

    legacy_body = {**NODE, "display": {"title": "重点", "body": "旧正文"}}
    legacy = client.put(
        f"/api/v1/teacher/lessons/{lesson['id']}/draft",
        json={"schema_version": 1, "config": {"nodes": [legacy_body]}},
    )
    assert legacy.status_code == 422

    saved = client.put(
        f"/api/v1/teacher/lessons/{lesson['id']}/draft",
        json={"schema_version": 1, "config": {"nodes": [NODE]}},
    )
    assert saved.status_code == 200
    assert saved.json()["revision"] == 1
    assert (
        client.put(
            f"/api/v1/teacher/lessons/{lesson['id']}/draft",
            json={"schema_version": 1, "revision": 0, "config": {"nodes": [NODE]}},
        ).status_code
        == 409
    )

    assert (
        client.post(
            f"/api/v1/teacher/courses/{course['id']}/releases",
            json={"idempotency_key": "publish-0001"},
        ).json()["error"]["code"]
        == "RELEASE_RIGHTS_REQUIRED"
    )
    client.post(
        f"/api/v1/teacher/courses/{course['id']}/rights-attestation",
        json={"statement_version": "1", "accepted": True},
    )
    preview = client.post(
        f"/api/v1/teacher/lessons/{lesson['id']}/preview-sessions",
        json={"plugin_version": "1.0.0"},
    ).json()
    client.post(
        f"/api/v1/teacher/preview-sessions/{preview['id']}/end",
        json={"succeeded": True},
    )
    release = client.post(
        f"/api/v1/teacher/courses/{course['id']}/releases",
        json={"idempotency_key": "publish-0001"},
    )
    assert release.status_code == 201
    release_id = release.json()["id"]
    replay = client.post(
        f"/api/v1/teacher/courses/{course['id']}/releases",
        json={"idempotency_key": "publish-0001"},
    )
    assert replay.json()["id"] == release_id
    assert len(client.get(f"/api/v1/teacher/courses/{course['id']}/releases").json()["items"]) == 1

    changed = {**NODE, "display": {"title": "新重点", "richBody": "<p>新内容</p>"}}
    client.put(
        f"/api/v1/teacher/lessons/{lesson['id']}/draft",
        json={"schema_version": 1, "revision": 1, "config": {"nodes": [changed]}},
    )
    snapshot = client.get(f"/api/v1/teacher/releases/{release_id}").json()
    assert snapshot["lessons"][0]["draft_revision"] == 1

    paused = client.post(
        f"/api/v1/teacher/releases/{release_id}/availability",
        json={"deliverable": False, "reason": "rights_dispute"},
    )
    assert paused.json() == {"deliverable": False, "reason": "rights_dispute"}
