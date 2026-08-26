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
    "anchor": {"kind": "time_cross", "timeSeconds": 12},
    "title": "重点",
    "content": {
        "schemaVersion": 1,
        "blocks": [{"type": "paragraph", "children": [{"text": "记住这一点"}]}],
    },
    "interactionData": None,
    "presentationHints": {"windowSize": "m", "windowStyle": "document"},
    "effects": {"pause": True},
}

SUBTITLE = {
    "schemaVersion": 1,
    "filename": "第一课.srt",
    "format": "srt",
    "content": "1\n00:00:01,000 --> 00:00:03,000\n欢迎学习\n",
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

    changed = {
        **NODE,
        "title": "新重点",
        "content": {
            "schemaVersion": 1,
            "blocks": [{"type": "paragraph", "children": [{"text": "新内容"}]}],
        },
    }
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


def test_subtitle_is_saved_restored_and_frozen_in_release_but_not_package() -> None:
    client = make_client()
    course = client.post("/api/v1/teacher/courses", json={"title": "字幕课程"}).json()
    lesson = client.post(
        f"/api/v1/teacher/courses/{course['id']}/lessons",
        json={
            "title": "第一课",
            "video_ref": {"platform": "bilibili", "video_id": "BV1Ac41187Lm"},
        },
    ).json()

    saved = client.put(
        f"/api/v1/teacher/lessons/{lesson['id']}/draft",
        json={"schema_version": 1, "config": {"nodes": [NODE], "subtitle": SUBTITLE}},
    )
    assert saved.status_code == 200
    assert saved.json()["config"]["subtitle"] == SUBTITLE
    assert (
        client.get(f"/api/v1/teacher/lessons/{lesson['id']}/draft").json()["config"]["subtitle"]
        == SUBTITLE
    )
    detail = client.get(f"/api/v1/teacher/courses/{course['id']}")
    assert detail.status_code == 200
    saved_lesson = next(item for item in detail.json()["lessons"] if item["id"] == lesson["id"])
    assert saved_lesson["has_draft"] is True

    exported = client.get(f"/api/v1/teacher/courses/{course['id']}/course-file")
    assert exported.status_code == 200
    exported_file = exported.json()
    assert exported_file["course"]["lessons"][0]["subtitle"] == SUBTITLE
    preview_import = client.post(
        "/api/v1/teacher/course-files/import/preview", json={"file": exported_file}
    )
    assert preview_import.status_code == 200
    assert preview_import.json()["summary"]["has_subtitles"] is True
    imported = client.post(
        "/api/v1/teacher/course-files/import",
        json={"file": exported_file, "confirm": True},
    )
    assert imported.status_code == 201
    imported_course_id = imported.json()["course"]["id"]
    imported_course = client.get(f"/api/v1/teacher/courses/{imported_course_id}").json()
    imported_draft = client.get(
        f"/api/v1/teacher/lessons/{imported_course['lessons'][0]['id']}/draft"
    ).json()
    assert imported_draft["config"]["subtitle"] == SUBTITLE
    assert imported_draft["config"]["nodes"][0]["id"] != NODE["id"]

    client.post(
        f"/api/v1/teacher/courses/{course['id']}/rights-attestation",
        json={"statement_version": "1", "accepted": True},
    )
    preview = client.post(
        f"/api/v1/teacher/lessons/{lesson['id']}/preview-sessions", json={}
    ).json()
    client.post(
        f"/api/v1/teacher/preview-sessions/{preview['id']}/end",
        json={"succeeded": True},
    )
    release = client.post(
        f"/api/v1/teacher/courses/{course['id']}/releases",
        json={"idempotency_key": "subtitle-publish-1"},
    )
    assert release.status_code == 201
    release_file = client.get(
        f"/api/v1/teacher/courses/{course['id']}/course-file",
        params={"source": "release", "release_id": release.json()["id"]},
    )
    assert release_file.status_code == 200
    assert release_file.json()["source"]["type"] == "release"
    assert release_file.json()["course"]["lessons"][0]["subtitle"] == SUBTITLE

    from app.infrastructure.database.models import ReleaseLessonSnapshot, ScriptDraft
    from app.modules.authoring_release.application_service import AuthoringReleaseApplicationService

    with client.app.state.session_factory() as session:
        snapshot = session.query(ReleaseLessonSnapshot).one()
        assert snapshot.subtitle == SUBTITLE
        draft = session.query(ScriptDraft).filter_by(lesson_id=lesson["id"]).one()
        assert draft.content["subtitle"] == SUBTITLE
        package = AuthoringReleaseApplicationService(session).package(snapshot.release)
        assert all("subtitle" not in lesson_item for lesson_item in package["lessons"])

    changed = {
        **SUBTITLE,
        "filename": "第二课.vtt",
        "format": "vtt",
        "content": "WEBVTT\n\n00:00.000 --> 00:01.000\n新字幕\n",
    }
    changed_response = client.put(
        f"/api/v1/teacher/lessons/{lesson['id']}/draft",
        json={
            "schema_version": 1,
            "revision": saved.json()["revision"],
            "config": {"nodes": [NODE], "subtitle": changed},
        },
    )
    assert changed_response.status_code == 200
    with client.app.state.session_factory() as session:
        snapshot = session.query(ReleaseLessonSnapshot).one()
        assert snapshot.subtitle == SUBTITLE


def test_invalid_subtitle_does_not_create_or_replace_draft() -> None:
    client = make_client()
    course = client.post("/api/v1/teacher/courses", json={"title": "校验课程"}).json()
    lesson = client.post(
        f"/api/v1/teacher/courses/{course['id']}/lessons",
        json={
            "title": "第一课",
            "video_ref": {"platform": "bilibili", "video_id": "BV1Ac41187Lm"},
        },
    ).json()
    invalid = {**SUBTITLE, "filename": "wrong.vtt"}
    response = client.put(
        f"/api/v1/teacher/lessons/{lesson['id']}/draft",
        json={"schema_version": 1, "config": {"nodes": [NODE], "subtitle": invalid}},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "DRAFT_SUBTITLE_INVALID"
    assert client.get(f"/api/v1/teacher/lessons/{lesson['id']}/draft").status_code == 404

    valid = client.put(
        f"/api/v1/teacher/lessons/{lesson['id']}/draft",
        json={"schema_version": 1, "config": {"nodes": [NODE], "subtitle": SUBTITLE}},
    )
    assert valid.status_code == 200
    invalid_replacement = {**SUBTITLE, "content": "not a subtitle"}
    replacement = client.put(
        f"/api/v1/teacher/lessons/{lesson['id']}/draft",
        json={
            "schema_version": 1,
            "revision": valid.json()["revision"],
            "config": {"nodes": [NODE], "subtitle": invalid_replacement},
        },
    )
    assert replacement.status_code == 422
    assert replacement.json()["error"]["code"] == "DRAFT_SUBTITLE_INVALID"
    assert (
        client.get(f"/api/v1/teacher/lessons/{lesson['id']}/draft").json()["config"]["subtitle"]
        == SUBTITLE
    )
