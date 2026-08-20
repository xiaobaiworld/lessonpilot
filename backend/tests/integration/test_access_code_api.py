import re
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import Settings
from app.main import create_app
from app.models.access_code import AccessCode
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
            login_name="code-owner",
            password="owner-password",
            display_name="授权教师",
        )
        seed_teacher_account(
            session,
            login_name="code-other",
            password="other-password",
            display_name="其他教师",
        )
        session.commit()
    return app


def login(client: TestClient, login_name: str = "code-owner", password: str = "owner-password") -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"login_name": login_name, "password": password},
    )
    assert response.status_code == 200


def create_course_and_lesson(client: TestClient) -> tuple[str, str]:
    course = client.post(
        "/api/v1/teacher/courses",
        json={"title": "授权课程", "description": None},
    ).json()
    lesson = client.post(
        f"/api/v1/teacher/courses/{course['id']}/lessons",
        json={
            "title": "第一课",
            "video_ref": {"platform": "bilibili", "video_id": "BV1WW4y1e7GL"},
        },
    ).json()
    return course["id"], lesson["id"]


def save_and_publish(
    client: TestClient,
    course_id: str,
    lesson_id: str,
    *,
    node_count: int = 4,
) -> None:
    payload = four_node_request()
    payload["config"]["nodes"] = payload["config"]["nodes"][:node_count]
    assert client.put(
        f"/api/v1/teacher/lessons/{lesson_id}/draft",
        json=payload,
    ).status_code == 200
    assert client.post(f"/api/v1/teacher/courses/{course_id}/publish").status_code == 201


def test_teacher_creates_code_and_database_stores_only_digest() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client)
        course_id, lesson_id = create_course_and_lesson(client)
        save_and_publish(client, course_id, lesson_id)

        response = client.post(f"/api/v1/teacher/courses/{course_id}/access-codes")

    assert response.status_code == 201
    raw_code = response.json()["access_code"]
    assert re.fullmatch(r"KM-[A-Z2-7]{5}(?:-[A-Z2-7]{5}){3}", raw_code)

    with app.state.session_factory() as session:
        stored = session.scalar(select(AccessCode))
    assert stored is not None
    assert stored.code_digest != raw_code
    assert raw_code not in stored.code_digest
    assert stored.code_hint == raw_code[-5:]
    assert stored.code_type == "long_term"
    assert stored.expires_at is None


def test_teacher_lists_access_codes_by_type_without_secrets() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client)
        course_id, lesson_id = create_course_and_lesson(client)
        save_and_publish(client, course_id, lesson_id)

        short = client.post(
            f"/api/v1/teacher/courses/{course_id}/access-codes",
            json={"code_type": "short_term"},
        )
        long = client.post(
            f"/api/v1/teacher/courses/{course_id}/access-codes",
            json={"code_type": "long_term"},
        )
        listing = client.get(f"/api/v1/teacher/courses/{course_id}/access-codes")

    assert short.status_code == 201
    assert short.json()["code_type"] == "short_term"
    assert short.json()["expires_at"] is not None
    assert long.status_code == 201
    assert long.json()["code_type"] == "long_term"
    assert long.json()["expires_at"] is None
    assert listing.status_code == 200
    payload = listing.json()
    assert payload["total"] == 2
    assert payload["counts"] == {"short_term": 1, "long_term": 1}
    assert {item["code_type"] for item in payload["items"]} == {"short_term", "long_term"}
    assert all(item["status"] == "active" for item in payload["items"])
    serialized = listing.text
    assert short.json()["access_code"] not in serialized
    assert long.json()["access_code"] not in serialized
    assert "code_digest" not in serialized


def test_expired_short_code_is_rejected_without_status_disclosure() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client)
        course_id, lesson_id = create_course_and_lesson(client)
        save_and_publish(client, course_id, lesson_id)
        raw_code = client.post(
            f"/api/v1/teacher/courses/{course_id}/access-codes",
            json={"code_type": "short_term"},
        ).json()["access_code"]

        with app.state.session_factory() as session:
            row = session.scalar(select(AccessCode))
            row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
            session.commit()

        download = client.post(
            "/api/v1/public/course-download",
            json={"access_code": raw_code},
        )
        listing = client.get(f"/api/v1/teacher/courses/{course_id}/access-codes")

    assert download.status_code == 401
    assert download.json()["error"]["code"] == "INVALID_ACCESS_CODE"
    assert listing.json()["items"][0]["status"] == "expired"


def test_other_teacher_cannot_list_course_access_codes() -> None:
    app = make_app()
    with TestClient(app) as owner:
        login(owner)
        course_id, lesson_id = create_course_and_lesson(owner)
        save_and_publish(owner, course_id, lesson_id)

    with TestClient(app) as other:
        login(other, "code-other", "other-password")
        response = other.get(f"/api/v1/teacher/courses/{course_id}/access-codes")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_plugin_downloads_latest_published_course_with_existing_code() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client)
        course_id, lesson_id = create_course_and_lesson(client)
        save_and_publish(client, course_id, lesson_id)
        raw_code = client.post(
            f"/api/v1/teacher/courses/{course_id}/access-codes"
        ).json()["access_code"]

        first = client.post(
            "/api/v1/public/course-download",
            json={"access_code": raw_code},
        )
        save_and_publish(client, course_id, lesson_id, node_count=1)
        latest = client.post(
            "/api/v1/public/course-download",
            json={"access_code": raw_code},
        )

    assert first.status_code == 200
    assert len(first.json()["course"]["nodes"]) == 4
    assert latest.status_code == 200
    assert len(latest.json()["course"]["nodes"]) == 1


def test_invalid_codes_share_one_public_failure() -> None:
    app = make_app()
    with TestClient(app) as client:
        malformed = client.post(
            "/api/v1/public/course-download",
            json={"access_code": "not-a-code"},
        )
        unknown = client.post(
            "/api/v1/public/course-download",
            json={"access_code": "KM-AAAAA-AAAAA-AAAAA-AAAAA"},
        )

    assert malformed.status_code == 401
    assert unknown.status_code == 401
    assert malformed.json()["error"]["code"] == "INVALID_ACCESS_CODE"
    assert unknown.json()["error"]["code"] == "INVALID_ACCESS_CODE"


def test_code_requires_published_owned_course() -> None:
    app = make_app()
    with TestClient(app) as owner:
        login(owner)
        course_id, _ = create_course_and_lesson(owner)
        unpublished = owner.post(f"/api/v1/teacher/courses/{course_id}/access-codes")

    with TestClient(app) as other:
        login(other, "code-other", "other-password")
        forbidden = other.post(f"/api/v1/teacher/courses/{course_id}/access-codes")

    assert unpublished.status_code == 409
    assert unpublished.json()["error"]["code"] == "COURSE_NOT_PUBLISHED"
    assert forbidden.status_code == 404
    assert forbidden.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_access_code_and_download_actions_are_logged_without_raw_code() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client)
        course_id, lesson_id = create_course_and_lesson(client)
        save_and_publish(client, course_id, lesson_id)
        raw_code = client.post(
            f"/api/v1/teacher/courses/{course_id}/access-codes"
        ).json()["access_code"]
        client.post("/api/v1/public/course-download", json={"access_code": raw_code})

    with app.state.session_factory() as session:
        logs = session.scalars(
            select(OperationLog).where(OperationLog.module.in_(["access_code", "download"]))
        ).all()
    assert {log.action for log in logs} >= {
        "access_code.create.success",
        "course.download.success",
    }
    assert all(raw_code not in (log.target_id or "") for log in logs)
