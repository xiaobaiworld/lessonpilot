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
    listed_after_create = client.get("/api/v1/teacher/access-codes").json()["items"]
    assert listed_after_create[0]["access_code"] == code
    assert listed_after_create[0]["redemption_count"] == 0
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
    usage = client.get("/api/v1/teacher/access-codes", params={"course_id": course["id"]}).json()[
        "items"
    ][0]
    assert usage["access_code"] == code
    assert usage["redemption_count"] == 1
    assert usage["first_redeemed_at"] is not None
    assert usage["last_redeemed_at"] is not None
    dashboard = client.get("/api/v1/teacher/courses")
    assert dashboard.status_code == 200
    dashboard_item = dashboard.json()["items"][0]
    assert dashboard_item["status"] == "active"
    assert dashboard_item["metrics"] == {
        "lesson_count": 1,
        "draft_lesson_count": 1,
        "draft_node_count": 1,
        "published_node_count": 1,
        "access_code_count": 1,
        "redeemed_count": 1,
        "student_submission_count": None,
        "release_number": 1,
        "published_at": dashboard_item["metrics"]["published_at"],
    }
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

    check_payload = {
        "schemaVersion": 1,
        "installedCourses": [
            {
                "courseId": course["id"],
                "releaseId": release["id"],
                "releaseNumber": release["release_number"],
            }
        ],
        "localIdentityId": "local-identity-0001",
        "localProof": "a-high-entropy-local-proof",
    }
    checked = client.post("/api/v1/student/course-updates/check", json=check_payload)
    assert checked.status_code == 200
    assert checked.json()["data"]["courses"] == [
        {
            "courseId": course["id"],
            "title": "课程",
            "releaseId": release["id"],
            "releaseNumber": release["release_number"],
            "status": "unchanged",
        }
    ]
    assert "package" not in str(checked.json())
    no_installed_courses = client.post(
        "/api/v1/student/course-updates/check",
        json={
            **check_payload,
            "installedCourses": [],
        },
    )
    assert no_installed_courses.status_code == 200
    assert no_installed_courses.json()["data"]["courses"] == []

    unauthorized = client.post(
        "/api/v1/student/course-updates/check",
        json={
            **check_payload,
            "installedCourses": [
                {
                    "courseId": "00000000-0000-4000-8000-000000000001",
                    "releaseId": None,
                    "releaseNumber": None,
                }
            ],
        },
    )
    assert unauthorized.status_code == 200
    assert unauthorized.json()["data"]["courses"] == [
        {
            "courseId": "00000000-0000-4000-8000-000000000001",
            "title": None,
            "releaseId": None,
            "releaseNumber": None,
            "status": "unauthorized",
        }
    ]
    assert "课程" not in str(unauthorized.json())

    unknown_field = client.post(
        "/api/v1/student/course-updates/check",
        json={**check_payload, "unexpected": True},
    )
    assert unknown_field.status_code == 422

    second_node = {**NODE, "id": "node-2", "title": "新版重点"}
    saved = client.put(
        f"/api/v1/teacher/lessons/{lesson['id']}/draft",
        json={"revision": 1, "config": {"nodes": [second_node]}},
    )
    assert saved.status_code == 200
    preview = client.post(
        f"/api/v1/teacher/lessons/{lesson['id']}/preview-sessions", json={}
    ).json()
    client.post(
        f"/api/v1/teacher/preview-sessions/{preview['id']}/end",
        json={"succeeded": True},
    )
    second_release = client.post(
        f"/api/v1/teacher/courses/{course['id']}/releases",
        json={"idempotency_key": "publish-0002"},
    ).json()
    latest = client.post(
        "/api/v1/student/course-updates",
        json={
            "schemaVersion": 1,
            "idempotencyKey": "update-0001",
            "localIdentityId": "local-identity-0001",
            "localProof": "a-high-entropy-local-proof",
            "courseIds": [course["id"]],
            "knownReleases": [{"courseId": course["id"], "releaseId": release["id"]}],
        },
    )
    assert latest.status_code == 200
    assert latest.json()["data"]["courses"][0]["releaseId"] == second_release["id"]
    assert latest.json()["data"]["courses"][0]["package"]["lessons"][0]["nodes"] == [second_node]

    changed_check = client.post(
        "/api/v1/student/course-updates/check",
        json=check_payload,
    )
    assert changed_check.status_code == 200
    assert changed_check.json()["data"]["courses"][0]["status"] == "update"
    assert changed_check.json()["data"]["courses"][0]["releaseId"] == second_release["id"]

    stale_apply = client.post(
        "/api/v1/student/course-updates/apply",
        json={
            "schemaVersion": 1,
            "courseId": course["id"],
            "expectedReleaseId": release["id"],
            "localIdentityId": "local-identity-0001",
            "localProof": "a-high-entropy-local-proof",
        },
    )
    assert stale_apply.status_code == 409
    assert stale_apply.json()["error"]["code"] == "RELEASE_STALE"

    applied = client.post(
        "/api/v1/student/course-updates/apply",
        json={
            "schemaVersion": 1,
            "courseId": course["id"],
            "expectedReleaseId": second_release["id"],
            "localIdentityId": "local-identity-0001",
            "localProof": "a-high-entropy-local-proof",
        },
    )
    assert applied.status_code == 200
    assert applied.json()["data"]["package"]["releaseId"] == second_release["id"]
    assert applied.json()["data"]["package"]["lessons"][0]["nodes"] == [second_node]
    assert "courses" not in applied.json()["data"]

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


def test_batch_access_codes_are_atomic_recoverable_and_idempotent() -> None:
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
        json={"login_name": "batch-teacher", "display_name": "批量教师"},
    ).json()
    client.post(
        "/api/v1/teacher/auth/login",
        json={"login_name": "batch-teacher", "password": teacher["temporary_password"]},
    )
    course = client.post("/api/v1/teacher/courses", json={"title": "批量课程"}).json()
    client.post(
        f"/api/v1/teacher/courses/{course['id']}/lessons",
        json={
            "title": "第一课",
            "video_ref": {"platform": "bilibili", "video_id": "BV1Ac41187Lm"},
        },
    )
    client.post(
        f"/api/v1/teacher/courses/{course['id']}/releases",
        json={"idempotency_key": "publish-batch-course"},
    )
    payload = {
        "idempotency_key": "batch-code-intent-1",
        "count": 3,
        "grants": [{"course_id": course["id"], "scope": "course"}],
    }

    created = client.post("/api/v1/teacher/access-codes/batch", json=payload)
    assert created.status_code == 201
    codes = [item["access_code"] for item in created.json()["items"]]
    assert len(codes) == len(set(codes)) == 3
    assert all(code.startswith("KM-") for code in codes)

    replay = client.post("/api/v1/teacher/access-codes/batch", json=payload).json()
    assert replay["replayed"] is True
    assert [item["access_code"] for item in replay["items"]] == codes
    listed = client.get("/api/v1/teacher/access-codes", params={"course_id": course["id"]}).json()[
        "items"
    ]
    assert len(listed) == 3
    assert {item["access_code"] for item in listed} == set(codes)


def _managed_access_code_client() -> tuple[TestClient, dict]:
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
        json={"login_name": "manage-teacher", "display_name": "管理教师"},
    ).json()
    client.post(
        "/api/v1/teacher/auth/login",
        json={
            "login_name": "manage-teacher",
            "password": teacher["temporary_password"],
        },
    )
    course = client.post("/api/v1/teacher/courses", json={"title": "授权码管理课程"}).json()
    client.post(
        f"/api/v1/teacher/courses/{course['id']}/lessons",
        json={
            "title": "第一课",
            "video_ref": {"platform": "bilibili", "video_id": "BV1Ac41187Lm"},
        },
    )
    client.post(
        f"/api/v1/teacher/courses/{course['id']}/releases",
        json={"idempotency_key": "publish-managed-course"},
    )
    return client, course


def test_access_code_management_supports_recipient_and_lifecycle() -> None:
    client, course = _managed_access_code_client()
    created = client.post(
        "/api/v1/teacher/access-codes/batch",
        json={
            "idempotency_key": "managed-code-batch-1",
            "count": 2,
            "recipient_label": "线下学员 A",
            "recipient_note": "周三交付",
            "grants": [{"course_id": course["id"], "scope": "course"}],
        },
    )
    assert created.status_code == 201
    items = created.json()["items"]
    assert len(items) == 2
    assert all(item["recipient_label"] == "线下学员 A" for item in items)
    assert all(item["recipient_note"] == "周三交付" for item in items)

    access_code_id = items[0]["id"]
    updated = client.put(
        f"/api/v1/teacher/access-codes/{access_code_id}/recipient",
        json={"recipient_label": "线下学员 A（已确认）", "recipient_note": None},
    )
    assert updated.status_code == 200
    assert updated.json()["recipient_label"] == "线下学员 A（已确认）"
    assert updated.json()["recipient_note"] is None

    frozen = client.post(f"/api/v1/teacher/access-codes/{access_code_id}/freeze")
    assert frozen.status_code == 200
    assert frozen.json()["status"] == "frozen"

    restored = client.post(f"/api/v1/teacher/access-codes/{access_code_id}/restore")
    assert restored.status_code == 200
    assert restored.json()["status"] == "active"

    terminated = client.post(f"/api/v1/teacher/access-codes/{access_code_id}/terminate")
    assert terminated.status_code == 200
    assert terminated.json()["status"] == "terminated"

    detail = client.get(f"/api/v1/teacher/access-codes/{access_code_id}")
    assert detail.status_code == 200
    assert detail.json()["status"] == "terminated"
    assert [event["action"] for event in detail.json()["status_events"]] == [
        "access_code_created",
        "access_code_recipient_updated",
        "access_code_frozen",
        "access_code_restored",
        "access_code_terminated",
    ]


def test_access_code_batch_actions_apply_to_selected_codes_and_replay() -> None:
    client, course = _managed_access_code_client()
    created = client.post(
        "/api/v1/teacher/access-codes/batch",
        json={
            "idempotency_key": "managed-code-batch-2",
            "count": 3,
            "grants": [{"course_id": course["id"], "scope": "course"}],
        },
    )
    ids = [item["id"] for item in created.json()["items"]]
    payload = {
        "access_code_ids": ids[:2],
        "action": "freeze",
        "idempotency_key": "managed-action-1",
    }

    result = client.post("/api/v1/teacher/access-codes/batch-actions", json=payload)
    assert result.status_code == 200
    assert {item["status"] for item in result.json()["items"]} == {"frozen"}

    replay = client.post("/api/v1/teacher/access-codes/batch-actions", json=payload)
    assert replay.status_code == 200
    assert replay.json()["replayed"] is True
    assert [item["id"] for item in replay.json()["items"]] == ids[:2]

    restored = client.post(
        "/api/v1/teacher/access-codes/batch-actions",
        json={
            "access_code_ids": ids[:2],
            "action": "restore",
            "idempotency_key": "managed-action-2",
        },
    )
    assert {item["status"] for item in restored.json()["items"]} == {"active"}
