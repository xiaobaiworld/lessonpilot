from datetime import datetime, timezone
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, select, text

from app.config import Settings
from app.main import create_app
from app.models.operation_log import OperationLog
from app.seed import seed_teacher_account


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
            login_name="teacher-owner",
            password="owner-password",
            display_name="课程所有者",
        )
        seed_teacher_account(
            session,
            login_name="teacher-other",
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


def test_teacher_can_create_and_read_course_with_multiple_lessons() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client, "teacher-owner", "owner-password")

        course_response = client.post(
            "/api/v1/teacher/courses",
            json={"title": "面试英语第一课", "description": "本地测试课程"},
        )
        assert course_response.status_code == 201
        course_id = course_response.json()["id"]

        first_lesson_response = client.post(
            f"/api/v1/teacher/courses/{course_id}/lessons",
            json={
                "title": "第一课",
                "video_ref": {
                    "platform": "bilibili",
                    "video_id": "BV1WW4y1e7GL",
                },
            },
        )
        second_lesson_response = client.post(
            f"/api/v1/teacher/courses/{course_id}/lessons",
            json={
                "title": "第二课",
                "video_ref": {
                    "platform": "bilibili",
                    "video_id": "BV2XX4y1e7GM",
                },
            },
        )
        assert first_lesson_response.status_code == 201
        assert second_lesson_response.status_code == 201
        first_lesson = first_lesson_response.json()
        second_lesson = second_lesson_response.json()

        course_detail = client.get(f"/api/v1/teacher/courses/{course_id}")
        lesson_detail = client.get(f"/api/v1/teacher/lessons/{first_lesson['id']}")
        course_list = client.get("/api/v1/teacher/courses")

    assert course_detail.status_code == 200
    detail = course_detail.json()
    assert "lesson" not in detail
    assert [lesson["id"] for lesson in detail["lessons"]] == [
        first_lesson["id"],
        second_lesson["id"],
    ]
    assert [lesson["sort_order"] for lesson in detail["lessons"]] == [0, 1]
    assert lesson_detail.status_code == 200
    assert lesson_detail.json()["video_ref"]["video_id"] == "BV1WW4y1e7GL"
    assert course_list.status_code == 200
    assert [item["id"] for item in course_list.json()["items"]] == [course_id]


def test_course_rejects_invalid_bvid_without_blocking_additional_lessons() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client, "teacher-owner", "owner-password")
        course = client.post(
            "/api/v1/teacher/courses",
            json={"title": "单课节课程", "description": None},
        ).json()

        invalid = client.post(
            f"/api/v1/teacher/courses/{course['id']}/lessons",
            json={
                "title": "错误视频",
                "video_ref": {"platform": "bilibili", "video_id": "not-a-bvid"},
            },
        )
        first = client.post(
            f"/api/v1/teacher/courses/{course['id']}/lessons",
            json={
                "title": "第一课",
                "video_ref": {"platform": "bilibili", "video_id": "BV1WW4y1e7GL"},
            },
        )
        second = client.post(
            f"/api/v1/teacher/courses/{course['id']}/lessons",
            json={
                "title": "第二课",
                "video_ref": {"platform": "bilibili", "video_id": "BV1WW4y1e7GL"},
            },
        )

    assert invalid.status_code == 422
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] != second.json()["id"]
    assert [first.json()["sort_order"], second.json()["sort_order"]] == [0, 1]


def test_multi_lesson_migration_preserves_existing_rows(tmp_path, monkeypatch) -> None:
    backend_dir = Path(__file__).resolve().parents[2]
    database_path = tmp_path / "migration.db"
    database_url = f"sqlite+pysqlite:///{database_path}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    alembic_config = Config(str(backend_dir / "alembic.ini"))

    command.upgrade(alembic_config, "0007_access_code_types")

    now = datetime.now(timezone.utc)
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO teachers (
                    id, login_name, password_hash, display_name, status, created_at, updated_at
                ) VALUES (
                    'teacher-1', 'migration-owner', 'hash', '迁移教师', 'active', :now, :now
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
                    'course-1', 'workspace-1', '迁移课程', NULL, 'draft', :now, :now
                )
                """
            ),
            {"now": now},
        )
        connection.execute(
            text(
                """
                INSERT INTO lessons (
                    id, course_id, title, sort_order, platform, video_id, status,
                    created_at, updated_at
                ) VALUES (
                    'lesson-1', 'course-1', '原有课节', 0, 'bilibili', 'BV1WW4y1e7GL',
                    'draft', :now, :now
                )
                """
            ),
            {"now": now},
        )

    command.upgrade(alembic_config, "head")

    inspector = inspect(engine)
    unique_constraints = inspector.get_unique_constraints("lessons")
    assert all(constraint["column_names"] != ["course_id"] for constraint in unique_constraints)
    assert {
        (index["name"], tuple(index["column_names"]), index["unique"])
        for index in inspector.get_indexes("lessons")
    } >= {("ix_lessons_course_id", ("course_id",), 0)}
    assert any(
        foreign_key["constrained_columns"] == ["course_id"]
        and foreign_key["referred_table"] == "courses"
        for foreign_key in inspector.get_foreign_keys("lessons")
    )

    with engine.begin() as connection:
        existing_rows = connection.execute(
            text("SELECT id, course_id, title FROM lessons ORDER BY sort_order")
        ).all()
        connection.execute(
            text(
                """
                INSERT INTO lessons (
                    id, course_id, title, sort_order, platform, video_id, status,
                    created_at, updated_at
                ) VALUES (
                    'lesson-2', 'course-1', '新增课节', 1, 'bilibili', 'BV2XX4y1e7GM',
                    'draft', :now, :now
                )
                """
            ),
            {"now": now},
        )

    assert existing_rows == [("lesson-1", "course-1", "原有课节")]


def test_other_teacher_cannot_read_or_add_lesson_to_foreign_course() -> None:
    app = make_app()
    with TestClient(app) as owner_client:
        login(owner_client, "teacher-owner", "owner-password")
        course_id = owner_client.post(
            "/api/v1/teacher/courses",
            json={"title": "私有课程", "description": None},
        ).json()["id"]

    with TestClient(app) as other_client:
        login(other_client, "teacher-other", "other-password")
        read = other_client.get(f"/api/v1/teacher/courses/{course_id}")
        create_lesson_response = other_client.post(
            f"/api/v1/teacher/courses/{course_id}/lessons",
            json={
                "title": "越权课节",
                "video_ref": {"platform": "bilibili", "video_id": "BV1WW4y1e7GL"},
            },
        )

    assert read.status_code == 404
    assert create_lesson_response.status_code == 404
    assert read.json()["error"]["code"] == "RESOURCE_NOT_FOUND"
    assert create_lesson_response.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_course_and_lesson_actions_are_written_to_operation_log() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client, "teacher-owner", "owner-password")
        course_id = client.post(
            "/api/v1/teacher/courses",
            json={"title": "日志课程", "description": None},
        ).json()["id"]
        client.post(
            f"/api/v1/teacher/courses/{course_id}/lessons",
            json={
                "title": "日志课节",
                "video_ref": {"platform": "bilibili", "video_id": "BV1WW4y1e7GL"},
            },
        )

    with app.state.session_factory() as session:
        actions = session.scalars(
            select(OperationLog.action).where(OperationLog.module.in_(["course", "lesson"]))
        ).all()

    assert "course.create.success" in actions
    assert "lesson.create.success" in actions
