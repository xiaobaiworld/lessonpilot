from fastapi.testclient import TestClient
from sqlalchemy import select

from app.infrastructure.database import models  # noqa: F401
from app.infrastructure.database.base import Base
from app.main import create_app
from app.modules.entitlement_delivery.models import AccessCode
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


def test_empty_database_full_delivery_flow() -> None:
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
    course = client.post("/api/v1/teacher/courses", json={"title": "课程"}).json()
    lesson = client.post(
        f"/api/v1/teacher/courses/{course['id']}/lessons",
        json={"title": "第一课", "video_ref": {"platform": "bilibili", "video_id": "BV1Ac41187Lm"}},
    ).json()
    client.put(
        f"/api/v1/teacher/lessons/{lesson['id']}/draft",
        json={"config": {"nodes": [NODE]}},
    )
    preview = client.post(
        f"/api/v1/teacher/lessons/{lesson['id']}/preview-sessions", json={}
    ).json()
    client.post(
        f"/api/v1/teacher/preview-sessions/{preview['id']}/end",
        json={"succeeded": True},
    )
    client.post(
        f"/api/v1/teacher/courses/{course['id']}/rights-attestation",
        json={"statement_version": "1", "accepted": True},
    )
    release = client.post(
        f"/api/v1/teacher/courses/{course['id']}/releases",
        json={"idempotency_key": "publish-0001"},
    ).json()

    created = client.post(
        "/api/v1/teacher/access-codes",
        json={
            "idempotency_key": "code-0001",
            "grants": [{"course_id": course["id"], "scope": "course"}],
        },
    )
    assert created.status_code == 201
    code = created.json()["access_code"]
    code_id = created.json()["id"]
    replay = client.post(
        "/api/v1/teacher/access-codes",
        json={
            "idempotency_key": "code-0001",
            "grants": [{"course_id": course["id"], "scope": "course"}],
        },
    ).json()
    assert replay["access_code"] == code
    assert replay["replayed"] is True
    assert "access_code" not in str(client.get("/api/v1/teacher/access-codes").json())
    with app.state.session_factory() as session:
        stored = session.scalar(select(AccessCode).where(AccessCode.id == code_id))
        assert stored.code_digest != code
        assert code not in str(stored.__dict__)

    request = {
        "schemaVersion": 1,
        "idempotencyKey": "redeem-0001",
        "accessCode": code,
        "localIdentityId": "local-identity-0001",
        "localProof": "a-high-entropy-local-proof",
        "client": {"extensionVersion": "1.0.0", "browserFamily": "chrome"},
    }
    redeemed = client.post("/api/v1/student/redemptions", json=request)
    assert redeemed.status_code == 200
    delivered = redeemed.json()["data"]["courses"][0]
    assert delivered["releaseId"] == release["id"]
    assert delivered["package"]["lessons"][0]["nodes"] == [NODE]
    assert code not in str(delivered["package"])
    source_ref = redeemed.json()["data"]["redemption"]["sourceRef"]
    assert (
        client.post("/api/v1/student/redemptions", json=request).json()["data"]["redemption"][
            "sourceRef"
        ]
        == source_ref
    )
    assert (
        client.post(
            "/api/v1/student/course-updates",
            json={
                "schemaVersion": 1,
                "idempotencyKey": "update-0001",
                "localIdentityId": "local-identity-0001",
                "localProof": "wrong-high-entropy-proof",
                "courseIds": [course["id"]],
                "knownReleases": [],
            },
        ).json()["error"]["code"]
        == "LOCAL_PROOF_INVALID"
    )

    client.post(f"/api/v1/teacher/access-codes/{code_id}/terminate")
    updates = client.post(
        "/api/v1/student/course-updates",
        json={
            "schemaVersion": 1,
            "idempotencyKey": "update-0002",
            "localIdentityId": "local-identity-0001",
            "localProof": "a-high-entropy-local-proof",
            "courseIds": [course["id"]],
            "knownReleases": [{"courseId": course["id"], "releaseId": release["id"]}],
        },
    )
    assert updates.json()["data"]["courses"] == []
