import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, select, text

from app.config import Settings
from app.main import create_app
from app.models.access_code import AccessCode
from app.models.access_grant import AccessGrant
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


def login(
    client: TestClient, login_name: str = "code-owner", password: str = "owner-password"
) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"login_name": login_name, "password": password},
    )
    assert response.status_code == 200


def create_course_and_lesson(
    client: TestClient,
    *,
    course_title: str = "授权课程",
    lesson_title: str = "第一课",
    video_id: str = "BV1WW4y1e7GL",
) -> tuple[str, str]:
    course = client.post(
        "/api/v1/teacher/courses",
        json={"title": course_title, "description": None},
    ).json()
    lesson = client.post(
        f"/api/v1/teacher/courses/{course['id']}/lessons",
        json={
            "title": lesson_title,
            "video_ref": {"platform": "bilibili", "video_id": video_id},
        },
    ).json()
    return course["id"], lesson["id"]


def create_lesson(
    client: TestClient,
    course_id: str,
    *,
    title: str,
    video_id: str,
) -> str:
    response = client.post(
        f"/api/v1/teacher/courses/{course_id}/lessons",
        json={
            "title": title,
            "video_ref": {"platform": "bilibili", "video_id": video_id},
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def save_and_publish(
    client: TestClient,
    course_id: str,
    lesson_id: str,
    *,
    node_count: int = 4,
) -> None:
    payload = four_node_request()
    payload["config"]["nodes"] = payload["config"]["nodes"][:node_count]
    assert (
        client.put(
            f"/api/v1/teacher/lessons/{lesson_id}/draft",
            json=payload,
        ).status_code
        == 200
    )
    assert client.post(f"/api/v1/teacher/courses/{course_id}/publish").status_code == 201


def save_lessons_and_publish(
    client: TestClient,
    course_id: str,
    lesson_ids: list[str],
) -> None:
    for index, lesson_id in enumerate(lesson_ids):
        payload = four_node_request()
        for node in payload["config"]["nodes"]:
            node["id"] = f"{node['id']}-lesson-{index + 1}"
        assert (
            client.put(
                f"/api/v1/teacher/lessons/{lesson_id}/draft",
                json=payload,
            ).status_code
            == 200
        )
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
        grants = session.scalars(select(AccessGrant)).all()
    assert stored is not None
    assert stored.code_digest != raw_code
    assert raw_code not in stored.code_digest
    assert stored.code_hint == raw_code[-5:]
    assert stored.code_type == "long_term"
    assert stored.expires_at is None
    assert len(grants) == 1
    assert grants[0].course_id == course_id
    assert grants[0].lesson_id is None
    assert grants[0].node_id is None


def test_access_grant_migration_backfills_existing_course_codes(tmp_path, monkeypatch) -> None:
    backend_dir = Path(__file__).resolve().parents[2]
    database_path = tmp_path / "access-grant-migration.db"
    database_url = f"sqlite+pysqlite:///{database_path}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    alembic_config = Config(str(backend_dir / "alembic.ini"))

    command.upgrade(alembic_config, "0008_multi_lesson_courses")

    now = datetime.now(timezone.utc)
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO teachers (
                    id, login_name, password_hash, display_name, status, created_at, updated_at
                ) VALUES (
                    'teacher-1', 'grant-owner', 'hash', '迁移教师', 'active', :now, :now
                )
                """
            ),
            {"now": now},
        )
        connection.execute(
            text(
                """
                INSERT INTO workspaces (id, owner_teacher_id, name, created_at)
                VALUES ('workspace-1', 'teacher-1', '迁移工作空间', :now)
                """
            ),
            {"now": now},
        )
        connection.execute(
            text(
                """
                INSERT INTO courses (
                    id, workspace_id, title, description, status, created_at, updated_at
                ) VALUES (
                    'course-1', 'workspace-1', '迁移课程', NULL, 'published', :now, :now
                )
                """
            ),
            {"now": now},
        )
        connection.execute(
            text(
                """
                INSERT INTO access_codes (
                    id, course_id, code_digest, code_hint, code_type, expires_at, created_at
                ) VALUES (
                    'code-1', 'course-1', 'digest', 'ABCDE', 'long_term', NULL, :now
                )
                """
            ),
            {"now": now},
        )

    command.upgrade(alembic_config, "head")

    engine.dispose()
    engine = create_engine(database_url)
    inspector = inspect(engine)
    assert {"ix_access_grants_access_code_id", "ix_access_grants_course_id"} <= {
        index["name"] for index in inspector.get_indexes("access_grants")
    }
    with engine.begin() as connection:
        grants = connection.execute(
            text(
                """
                SELECT access_code_id, course_id, lesson_id, node_id
                FROM access_grants
                """
            )
        ).all()
    assert grants == [("code-1", "course-1", None, None)]


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


def test_plugin_downloads_latest_published_course_as_v2_only_envelope() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client)
        course_id, lesson_id = create_course_and_lesson(client)
        save_and_publish(client, course_id, lesson_id)
        raw_code = client.post(f"/api/v1/teacher/courses/{course_id}/access-codes").json()[
            "access_code"
        ]

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
    assert set(first.json()) == {"courses"}
    assert first.json()["courses"][0]["schemaVersion"] == 2
    assert first.json()["courses"][0]["courseId"] == course_id
    assert len(first.json()["courses"][0]["lessons"][0]["nodes"]) == 4
    assert latest.status_code == 200
    assert set(latest.json()) == {"courses"}
    assert len(latest.json()["courses"][0]["lessons"][0]["nodes"]) == 1


def test_one_access_code_grants_multiple_courses_and_lesson_scopes_without_duplicates() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client)
        course_a, lesson_a1 = create_course_and_lesson(
            client,
            course_title="课程 A",
            lesson_title="A1",
        )
        lesson_a2 = create_lesson(
            client,
            course_a,
            title="A2",
            video_id="BV1Q541167Qg",
        )
        save_lessons_and_publish(client, course_a, [lesson_a1, lesson_a2])

        course_b, lesson_b1 = create_course_and_lesson(
            client,
            course_title="课程 B",
            lesson_title="B1",
            video_id="BV1mK4y1C7Bz",
        )
        lesson_b2 = create_lesson(
            client,
            course_b,
            title="B2",
            video_id="BV1xx411c7mD",
        )
        save_lessons_and_publish(client, course_b, [lesson_b1, lesson_b2])

        created = client.post(
            f"/api/v1/teacher/courses/{course_a}/access-codes",
            json={
                "scopes": [
                    {"course_id": course_a},
                    {"course_id": course_b, "lesson_id": lesson_b2},
                    {"course_id": course_b, "lesson_id": lesson_b2},
                ]
            },
        )
        downloaded = client.post(
            "/api/v1/public/course-download",
            json={"access_code": created.json()["access_code"]},
        )

    assert created.status_code == 201
    assert len(created.json()["scopes"]) == 2
    assert downloaded.status_code == 200
    assert set(downloaded.json()) == {"courses"}
    courses = downloaded.json()["courses"]
    assert [course["courseId"] for course in courses] == sorted([course_a, course_b])
    by_id = {course["courseId"]: course for course in courses}
    assert [lesson["lessonId"] for lesson in by_id[course_a]["lessons"]] == [
        lesson_a1,
        lesson_a2,
    ]
    assert [lesson["lessonId"] for lesson in by_id[course_b]["lessons"]] == [lesson_b2]


def test_node_scope_filters_by_node_id_not_video_time() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client)
        course_id, lesson_id = create_course_and_lesson(client)
        save_and_publish(client, course_id, lesson_id)
        created = client.post(
            f"/api/v1/teacher/courses/{course_id}/access-codes",
            json={
                "scopes": [
                    {
                        "course_id": course_id,
                        "lesson_id": lesson_id,
                        "node_id": "node-2",
                    }
                ]
            },
        )
        downloaded = client.post(
            "/api/v1/public/course-download",
            json={"access_code": created.json()["access_code"]},
        )

    assert created.status_code == 201
    assert downloaded.status_code == 200
    nodes = downloaded.json()["courses"][0]["lessons"][0]["nodes"]
    assert [node["id"] for node in nodes] == ["node-2"]
    assert nodes[0]["trigger"]["timeSeconds"] == 20


def test_download_only_includes_grants_in_the_current_wall_clock_window() -> None:
    app = make_app()
    now = datetime.now(timezone.utc)
    with TestClient(app) as client:
        login(client)
        course_id, lesson_id = create_course_and_lesson(client)
        save_and_publish(client, course_id, lesson_id)
        created = client.post(
            f"/api/v1/teacher/courses/{course_id}/access-codes",
            json={
                "scopes": [
                    {
                        "course_id": course_id,
                        "lesson_id": lesson_id,
                        "node_id": "node-1",
                        "valid_until": (now - timedelta(minutes=1)).isoformat(),
                    },
                    {
                        "course_id": course_id,
                        "lesson_id": lesson_id,
                        "node_id": "node-2",
                        "valid_from": (now - timedelta(minutes=1)).isoformat(),
                        "valid_until": (now + timedelta(minutes=1)).isoformat(),
                    },
                    {
                        "course_id": course_id,
                        "lesson_id": lesson_id,
                        "node_id": "node-3",
                        "valid_from": (now + timedelta(minutes=1)).isoformat(),
                    },
                ]
            },
        )
        downloaded = client.post(
            "/api/v1/public/course-download",
            json={"access_code": created.json()["access_code"]},
        )

    assert created.status_code == 201
    assert downloaded.status_code == 200
    nodes = downloaded.json()["courses"][0]["lessons"][0]["nodes"]
    assert [node["id"] for node in nodes] == ["node-2"]
    assert nodes[0]["trigger"]["timeSeconds"] == 20


def test_grant_rejects_lesson_from_another_course() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client)
        course_a, lesson_a = create_course_and_lesson(
            client,
            course_title="课程 A",
        )
        course_b, lesson_b = create_course_and_lesson(
            client,
            course_title="课程 B",
            video_id="BV1Q541167Qg",
        )
        save_and_publish(client, course_a, lesson_a)
        save_and_publish(client, course_b, lesson_b)
        response = client.post(
            f"/api/v1/teacher/courses/{course_a}/access-codes",
            json={
                "scopes": [
                    {"course_id": course_a, "lesson_id": lesson_b},
                ]
            },
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_ACCESS_SCOPE"


def test_grant_rejects_course_owned_by_another_teacher() -> None:
    app = make_app()
    with TestClient(app) as owner:
        login(owner)
        course_id, lesson_id = create_course_and_lesson(owner)
        save_and_publish(owner, course_id, lesson_id)

    with TestClient(app) as other:
        login(other, "code-other", "other-password")
        own_course_id, own_lesson_id = create_course_and_lesson(other)
        save_and_publish(other, own_course_id, own_lesson_id)
        response = other.post(
            f"/api/v1/teacher/courses/{own_course_id}/access-codes",
            json={"scopes": [{"course_id": course_id}]},
        )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_node_scope_requires_lesson_id() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client)
        course_id, lesson_id = create_course_and_lesson(client)
        save_and_publish(client, course_id, lesson_id)
        response = client.post(
            f"/api/v1/teacher/courses/{course_id}/access-codes",
            json={"scopes": [{"course_id": course_id, "node_id": "node-1"}]},
        )

    assert response.status_code == 422


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
        raw_code = client.post(f"/api/v1/teacher/courses/{course_id}/access-codes").json()[
            "access_code"
        ]
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
