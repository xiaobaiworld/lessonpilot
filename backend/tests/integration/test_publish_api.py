from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import Settings
from app.main import create_app
from app.models.operation_log import OperationLog
from app.models.published_script import PublishedScript
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
            login_name="publish-owner",
            password="owner-password",
            display_name="发布教师",
        )
        seed_teacher_account(
            session,
            login_name="publish-other",
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


def create_course(client: TestClient, *, title: str = "发布课程") -> str:
    response = client.post(
        "/api/v1/teacher/courses",
        json={"title": title, "description": None},
    )
    assert response.status_code == 201
    return response.json()["id"]


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


def save_draft(client: TestClient, lesson_id: str, *, node_count: int = 4) -> None:
    payload = four_node_request()
    payload["config"]["nodes"] = payload["config"]["nodes"][:node_count]
    response = client.put(
        f"/api/v1/teacher/lessons/{lesson_id}/draft",
        json=payload,
    )
    assert response.status_code == 200


def test_teacher_can_publish_v2_course_package_and_increment_each_lesson_version() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client, "publish-owner", "owner-password")
        course_id = create_course(client, title="英语面试表达")
        first_id = create_lesson(
            client,
            course_id,
            title="第一课",
            video_id="BV1WW4y1e7GL",
        )
        second_id = create_lesson(
            client,
            course_id,
            title="第二课",
            video_id="BV1mK4y1C7Bz",
        )
        save_draft(client, first_id)
        save_draft(client, second_id, node_count=1)

        first = client.post(f"/api/v1/teacher/courses/{course_id}/publish")
        assert first.status_code == 201
        first_body = first.json()
        assert first_body["schemaVersion"] == 2
        assert first_body["courseId"] == course_id
        assert first_body["title"] == "英语面试表达"
        assert [
            (lesson["lessonId"], lesson["title"], len(lesson["nodes"]))
            for lesson in first_body["lessons"]
        ] == [
            (first_id, "第一课", 4),
            (second_id, "第二课", 1),
        ]
        assert first_body["courseId"] != "bilibili:BV1WW4y1e7GL"

        save_draft(client, first_id, node_count=1)
        second = client.post(f"/api/v1/teacher/courses/{course_id}/publish")

    assert second.status_code == 201
    assert second.json()["schemaVersion"] == 2
    with app.state.session_factory() as session:
        rows = session.scalars(
            select(PublishedScript).order_by(
                PublishedScript.lesson_id,
                PublishedScript.version,
            )
        ).all()

    assert len(rows) == 4
    versions_by_lesson = {
        lesson_id: [row.version for row in rows if row.lesson_id == lesson_id]
        for lesson_id in (first_id, second_id)
    }
    assert versions_by_lesson == {
        first_id: [1, 2],
        second_id: [1, 2],
    }
    assert all(row.config_json["schemaVersion"] == 2 for row in rows)
    assert all(len(row.config_json["lessons"]) == 2 for row in rows)
    node_counts_by_version = {
        (row.lesson_id, row.version): [
            len(lesson["nodes"]) for lesson in row.config_json["lessons"]
        ]
        for row in rows
    }
    assert node_counts_by_version == {
        (first_id, 1): [4, 1],
        (first_id, 2): [1, 1],
        (second_id, 1): [4, 1],
        (second_id, 2): [1, 1],
    }


def test_publish_rejects_invalid_v2_metadata_before_creating_scripts() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client, "publish-owner", "owner-password")
        course_id = create_course(client, title="   ")
        lesson_id = create_lesson(
            client,
            course_id,
            title="第一课",
            video_id="BV1WW4y1e7GL",
        )
        save_draft(client, lesson_id)

        response = client.post(f"/api/v1/teacher/courses/{course_id}/publish")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "DRAFT_NOT_READY"
    with app.state.session_factory() as session:
        assert session.scalars(select(PublishedScript)).all() == []


def test_publish_rejects_empty_course_without_creating_scripts() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client, "publish-owner", "owner-password")
        course_id = create_course(client)

        response = client.post(f"/api/v1/teacher/courses/{course_id}/publish")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "DRAFT_NOT_READY"
    with app.state.session_factory() as session:
        assert session.scalars(select(PublishedScript)).all() == []


def test_publish_rejects_if_any_lesson_has_missing_or_empty_draft() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client, "publish-owner", "owner-password")
        course_id = create_course(client)
        first_id = create_lesson(
            client,
            course_id,
            title="第一课",
            video_id="BV1WW4y1e7GL",
        )
        second_id = create_lesson(
            client,
            course_id,
            title="第二课",
            video_id="BV1mK4y1C7Bz",
        )
        save_draft(client, first_id)

        missing = client.post(f"/api/v1/teacher/courses/{course_id}/publish")
        save_draft(client, second_id, node_count=0)
        empty = client.post(f"/api/v1/teacher/courses/{course_id}/publish")

    assert missing.status_code == 409
    assert missing.json()["error"]["code"] == "DRAFT_NOT_READY"
    assert empty.status_code == 409
    assert empty.json()["error"]["code"] == "DRAFT_NOT_READY"
    with app.state.session_factory() as session:
        assert session.scalars(select(PublishedScript)).all() == []


def test_other_teacher_cannot_publish_course() -> None:
    app = make_app()
    with TestClient(app) as owner:
        login(owner, "publish-owner", "owner-password")
        course_id = create_course(owner)
        lesson_id = create_lesson(
            owner,
            course_id,
            title="第一课",
            video_id="BV1WW4y1e7GL",
        )
        save_draft(owner, lesson_id)

    with TestClient(app) as other:
        login(other, "publish-other", "other-password")
        response = other.post(f"/api/v1/teacher/courses/{course_id}/publish")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_publish_action_is_logged() -> None:
    app = make_app()
    with TestClient(app) as client:
        login(client, "publish-owner", "owner-password")
        course_id = create_course(client)
        lesson_id = create_lesson(
            client,
            course_id,
            title="第一课",
            video_id="BV1WW4y1e7GL",
        )
        save_draft(client, lesson_id)
        response = client.post(f"/api/v1/teacher/courses/{course_id}/publish")
        assert response.status_code == 201

    with app.state.session_factory() as session:
        actions = session.scalars(
            select(OperationLog.action).where(OperationLog.module == "publish")
        ).all()
    assert "publish.course.success" in actions
