from __future__ import annotations

import io
import json
from pathlib import Path
import zipfile

from fastapi.testclient import TestClient

from app.infrastructure.database import models  # noqa: F401
from app.infrastructure.database.base import Base
from app.main import create_app
from app.modules.identity.application_service import IdentityApplicationService
from app.modules.runtime_audit.models import OperationAudit
from tests.conftest import make_settings


NODE_TEMPLATE = {
    "id": "node-1",
    "enabled": True,
    "family": "attention",
    "interaction": "notice",
    "anchor": {"kind": "time_cross", "timeSeconds": 12},
    "title": "重点",
    "content": {
        "schemaVersion": 1,
        "blocks": [{"type": "image", "assetId": "replace-me", "alt": "辅助图片"}],
    },
    "interactionData": None,
    "presentationHints": {"windowSize": "m", "windowStyle": "document"},
    "effects": {"pause": True},
}


def make_client(tmp_path: Path) -> tuple[TestClient, str]:
    settings = make_settings(asset_storage_dir=tmp_path / "assets")
    app = create_app(settings)
    Base.metadata.create_all(app.state.engine)
    with app.state.session_factory() as session:
        IdentityApplicationService(session, settings.session_secret).seed_admin(
            "admin", "管理员", "admin-password"
        )
    client = TestClient(app)
    assert (
        client.post(
            "/api/v1/admin/auth/login",
            json={"login_name": "admin", "password": "admin-password"},
        ).status_code
        == 200
    )
    teacher = client.post(
        "/api/v1/admin/teachers",
        json={"login_name": "teacher", "display_name": "教师"},
    ).json()
    teacher_id = teacher["teacher"]["id"]
    assert (
        client.post(
            "/api/v1/teacher/auth/login",
            json={"login_name": "teacher", "password": teacher["temporary_password"]},
        ).status_code
        == 200
    )
    return client, teacher_id


def create_course_with_asset(client: TestClient) -> tuple[dict, dict]:
    asset = client.post(
        "/api/v1/teacher/assets/upload",
        files={"file": ("explanation.png", b"node-image-bytes", "image/png")},
    ).json()
    course = client.post(
        "/api/v1/teacher/courses", json={"title": "课程包测试", "description": "辅助资料"}
    ).json()
    lesson = client.post(
        f"/api/v1/teacher/courses/{course['id']}/lessons",
        json={
            "title": "第一课",
            "video_ref": {
                "platform": "bilibili",
                "video_id": "BV1Ac41187Lm",
                "page": 2,
                "cid": "123456",
            },
        },
    ).json()
    node = {**NODE_TEMPLATE, "content": {**NODE_TEMPLATE["content"]}}
    node["content"]["blocks"] = [{"type": "image", "assetId": asset["assetId"], "alt": "辅助图片"}]
    saved = client.put(
        f"/api/v1/teacher/lessons/{lesson['id']}/draft",
        json={"schema_version": 1, "config": {"nodes": [node], "assets": [asset]}},
    )
    assert saved.status_code == 200
    return course, asset


def unpack(response) -> tuple[dict, dict[str, bytes]]:
    assert response.status_code == 200
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        manifest = json.loads(archive.read("manifest.json"))
        binaries = {asset["assetId"]: archive.read(asset["path"]) for asset in manifest["assets"]}
    return manifest, binaries


def test_admin_course_package_preserves_node_assets_but_not_bilibili_video(tmp_path: Path) -> None:
    client, teacher_id = make_client(tmp_path)
    course, source_asset = create_course_with_asset(client)

    listed = client.get(f"/api/v1/admin/teachers/{teacher_id}/courses")
    assert listed.status_code == 200
    assert listed.json()["items"][0]["lesson_count"] == 1
    assert "nodes" not in listed.text

    exported = client.get(
        f"/api/v1/admin/teachers/{teacher_id}/courses/{course['id']}/course-package",
        params={"source": "draft"},
    )
    manifest, binaries = unpack(exported)
    assert manifest["schemaVersion"] == 2
    assert manifest["fileType"] == "knownmap-course-package"
    lesson = manifest["course"]["lessons"][0]
    assert lesson["videoRef"]["videoId"] == "BV1Ac41187Lm"
    assert source_asset["assetId"] in binaries
    assert binaries[source_asset["assetId"]] == b"node-image-bytes"
    assert b"BV1Ac41187Lm" not in b"".join(binaries.values())


def test_admin_import_creates_new_course_and_new_asset_identity(tmp_path: Path) -> None:
    client, teacher_id = make_client(tmp_path)
    course, source_asset = create_course_with_asset(client)
    exported = client.get(
        f"/api/v1/admin/teachers/{teacher_id}/courses/{course['id']}/course-package"
    )

    preview = client.post(
        f"/api/v1/admin/teachers/{teacher_id}/course-packages/import/preview",
        files={"file": ("course.kmcourse", exported.content, "application/zip")},
    )
    assert preview.status_code == 200
    assert preview.json()["summary"]["asset_count"] == 1

    imported = client.post(
        f"/api/v1/admin/teachers/{teacher_id}/course-packages/import",
        files={"file": ("course.kmcourse", exported.content, "application/zip")},
        data={"confirm": "true"},
    )
    assert imported.status_code == 201
    assert imported.json()["course"]["id"] != course["id"]

    courses = client.get("/api/v1/teacher/courses").json()["items"]
    assert len(courses) == 2
    imported_course_id = imported.json()["course"]["id"]
    imported_detail = client.get(f"/api/v1/teacher/courses/{imported_course_id}").json()
    imported_lesson_id = imported_detail["lessons"][0]["id"]
    draft = client.get(f"/api/v1/teacher/lessons/{imported_lesson_id}/draft").json()
    imported_asset = draft["config"]["assets"][0]
    assert imported_asset["assetId"] != source_asset["assetId"]
    served = client.get(f"/api/v1/teacher/assets/{imported_asset['assetId']}")
    assert served.status_code == 200
    assert served.content == b"node-image-bytes"

    with client.app.state.session_factory() as session:
        actions = session.query(OperationAudit).all()
        assert {action.action for action in actions} >= {
            "course.package.export",
            "course.package.import.preview",
            "course.package.import",
        }


def test_invalid_course_package_does_not_create_course(tmp_path: Path) -> None:
    client, teacher_id = make_client(tmp_path)
    course, _ = create_course_with_asset(client)
    exported = client.get(
        f"/api/v1/admin/teachers/{teacher_id}/courses/{course['id']}/course-package"
    )
    with zipfile.ZipFile(io.BytesIO(exported.content)) as source:
        broken = io.BytesIO()
        with zipfile.ZipFile(broken, "w") as target:
            for item in source.infolist():
                content = source.read(item.filename)
                if item.filename.startswith("assets/"):
                    content = b"tampered"
                target.writestr(item, content)

    preview = client.post(
        f"/api/v1/admin/teachers/{teacher_id}/course-packages/import/preview",
        files={"file": ("broken.kmcourse", broken.getvalue(), "application/zip")},
    )
    assert preview.status_code == 422
    assert preview.json()["error"]["code"] == "COURSE_PACKAGE_ASSET_INTEGRITY_FAILED"
    assert len(client.get("/api/v1/teacher/courses").json()["items"]) == 1
