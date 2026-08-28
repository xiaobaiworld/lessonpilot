from pathlib import Path

from fastapi.testclient import TestClient

from app.infrastructure.database import models  # noqa: F401
from app.infrastructure.database.base import Base
from app.main import create_app
from app.modules.identity.application_service import IdentityApplicationService
from tests.conftest import make_settings


def make_client(tmp_path: Path) -> TestClient:
    settings = make_settings(asset_storage_dir=tmp_path / "assets")
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


def test_upload_asset_can_be_referenced_by_draft_and_read_by_asset_id(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    uploaded = client.post(
        "/api/v1/teacher/assets/upload",
        files={"file": ("lesson.png", b"png-bytes", "image/png")},
    )
    assert uploaded.status_code == 201
    asset = uploaded.json()
    assert asset["kind"] == "image"
    assert asset["sourceType"] == "uploaded"
    assert asset["byteSize"] == 9

    course = client.post("/api/v1/teacher/courses", json={"title": "课程"}).json()
    lesson = client.post(
        f"/api/v1/teacher/courses/{course['id']}/lessons",
        json={
            "title": "第一课",
            "video_ref": {"platform": "bilibili", "video_id": "BV1Ac41187Lm"},
        },
    ).json()
    node = {
        "id": "node-1",
        "enabled": True,
        "family": "attention",
        "interaction": "notice",
        "anchor": {"kind": "time_cross", "timeSeconds": 12},
        "title": "重点",
        "content": {
            "schemaVersion": 1,
            "blocks": [
                {
                    "type": "image",
                    "assetId": asset["assetId"],
                    "alt": "课程图片",
                }
            ],
        },
        "interactionData": None,
        "presentationHints": {"windowSize": "m", "windowStyle": "document"},
        "effects": {"pause": True},
    }
    saved = client.put(
        f"/api/v1/teacher/lessons/{lesson['id']}/draft",
        json={
            "schema_version": 1,
            "config": {"nodes": [node], "assets": [asset]},
        },
    )
    assert saved.status_code == 200
    assert saved.json()["config"]["nodes"][0]["content"]["blocks"][0]["assetId"] == asset["assetId"]

    served = client.get(f"/api/v1/teacher/assets/{asset['assetId']}")
    assert served.status_code == 200
    assert served.headers["content-type"] == "image/png"
    assert served.content == b"png-bytes"


def test_upload_rejects_unsupported_mime_and_url_rejects_private_address(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    unsupported = client.post(
        "/api/v1/teacher/assets/upload",
        files={"file": ("lesson.pdf", b"pdf-bytes", "application/pdf")},
    )
    assert unsupported.status_code == 422
    assert unsupported.json()["error"]["code"] == "ASSET_FILE_TYPE_INVALID"

    private = client.post(
        "/api/v1/teacher/assets/import-url", json={"url": "http://127.0.0.1/file.png"}
    )
    assert private.status_code == 422
    assert private.json()["error"]["code"] == "ASSET_SOURCE_INVALID"


def test_student_asset_delivery_is_authorized_scoped_and_range_capable(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    uploaded = client.post(
        "/api/v1/teacher/assets/upload",
        files={"file": ("lesson.png", b"student-image", "image/png")},
    )
    assert uploaded.status_code == 201
    asset = uploaded.json()

    course = client.post("/api/v1/teacher/courses", json={"title": "资源课程"}).json()
    lesson = client.post(
        f"/api/v1/teacher/courses/{course['id']}/lessons",
        json={
            "title": "第一课",
            "video_ref": {"platform": "bilibili", "video_id": "BV1Ac41187Lm"},
        },
    ).json()
    node = {
        "id": "node-1",
        "enabled": True,
        "family": "attention",
        "interaction": "notice",
        "anchor": {"kind": "time_cross", "timeSeconds": 12},
        "title": "重点",
        "content": {
            "schemaVersion": 1,
            "blocks": [{"type": "image", "assetId": asset["assetId"], "alt": "图片"}],
        },
        "interactionData": None,
        "effects": {"pause": True},
    }
    saved = client.put(
        f"/api/v1/teacher/lessons/{lesson['id']}/draft",
        json={"schema_version": 1, "config": {"nodes": [node], "assets": [asset]}},
    )
    assert saved.status_code == 200
    release = client.post(
        f"/api/v1/teacher/courses/{course['id']}/releases",
        json={"idempotency_key": "publish-student-asset"},
    ).json()
    code = client.post(
        "/api/v1/teacher/access-codes",
        json={
            "idempotency_key": "student-asset-code",
            "grants": [{"course_id": course["id"], "scope": "course"}],
        },
    ).json()["access_code"]
    redeemed = client.post(
        "/api/v1/student/redemptions",
        json={
            "schemaVersion": 1,
            "idempotencyKey": "student-asset-redeem",
            "accessCode": code,
            "localIdentityId": "student-asset-identity",
            "localProof": "student-asset-proof-high-entropy",
        },
    )
    assert redeemed.status_code == 200

    authorize = client.post(
        "/api/v1/student/course-assets/authorize",
        json={
            "schemaVersion": 1,
            "courseId": course["id"],
            "releaseId": release["id"],
            "assets": [{"assetId": asset["assetId"], "sha256": asset["sha256"]}],
            "localIdentityId": "student-asset-identity",
            "localProof": "student-asset-proof-high-entropy",
        },
    )
    assert authorize.status_code == 200
    grant = authorize.json()["data"]
    assert grant["assetIds"] == [asset["assetId"]]
    assert grant["token"]
    assert "/api/v1/teacher/assets/" not in grant["assetUrl"]

    served = client.get(
        f"/api/v1/student/course-assets/{asset['assetId']}",
        params={"token": grant["token"]},
    )
    assert served.status_code == 200
    assert served.headers["content-type"] == "image/png"
    assert served.headers["etag"] == f'"{asset["sha256"]}"'
    assert served.content == b"student-image"

    ranged = client.get(
        f"/api/v1/student/course-assets/{asset['assetId']}",
        params={"token": grant["token"]},
        headers={"Range": "bytes=0-6"},
    )
    assert ranged.status_code == 206
    assert ranged.headers["content-range"] == "bytes 0-6/13"
    assert ranged.content == b"student"

    malformed = client.get(
        f"/api/v1/student/course-assets/{asset['assetId']}",
        params={"token": "not-a-token"},
    )
    assert malformed.status_code == 401
    assert malformed.json()["error"]["code"] == "ASSET_ACCESS_INVALID"

    invalid_range = client.get(
        f"/api/v1/student/course-assets/{asset['assetId']}",
        params={"token": grant["token"]},
        headers={"Range": "bytes=invalid"},
    )
    assert invalid_range.status_code == 416
    assert invalid_range.json()["error"]["code"] == "ASSET_RANGE_INVALID"

    bad_hash = client.post(
        "/api/v1/student/course-assets/authorize",
        json={
            "schemaVersion": 1,
            "courseId": course["id"],
            "releaseId": release["id"],
            "assets": [{"assetId": asset["assetId"], "sha256": "0" * 64}],
            "localIdentityId": "student-asset-identity",
            "localProof": "student-asset-proof-high-entropy",
        },
    )
    assert bad_hash.status_code == 422
    assert bad_hash.json()["error"]["code"] == "ASSET_HASH_MISMATCH"
