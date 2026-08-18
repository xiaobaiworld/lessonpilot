from fastapi.testclient import TestClient
from sqlalchemy import select

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


def test_teacher_can_create_and_read_course_with_one_lesson() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client, "teacher-owner", "owner-password")

        course_response = client.post(
            "/api/v1/teacher/courses",
            json={"title": "面试英语第一课", "description": "本地测试课程"},
        )
        assert course_response.status_code == 201
        course_id = course_response.json()["id"]

        lesson_response = client.post(
            f"/api/v1/teacher/courses/{course_id}/lessons",
            json={
                "title": "第一课",
                "video_ref": {
                    "platform": "bilibili",
                    "video_id": "BV1WW4y1e7GL",
                },
            },
        )
        assert lesson_response.status_code == 201
        lesson_id = lesson_response.json()["id"]

        course_detail = client.get(f"/api/v1/teacher/courses/{course_id}")
        lesson_detail = client.get(f"/api/v1/teacher/lessons/{lesson_id}")
        course_list = client.get("/api/v1/teacher/courses")

    assert course_detail.status_code == 200
    assert course_detail.json()["lesson"]["id"] == lesson_id
    assert lesson_detail.status_code == 200
    assert lesson_detail.json()["video_ref"]["video_id"] == "BV1WW4y1e7GL"
    assert course_list.status_code == 200
    assert [item["id"] for item in course_list.json()["items"]] == [course_id]


def test_course_rejects_second_lesson_and_invalid_bvid() -> None:
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
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "LESSON_LIMIT_REACHED"


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
