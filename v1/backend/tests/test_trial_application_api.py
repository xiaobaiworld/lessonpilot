from sqlalchemy import func, select
from fastapi.testclient import TestClient

from app.infrastructure.database.base import Base
from app.infrastructure.database import models  # noqa: F401
from app.main import create_app
from app.modules.admin_support.models import TrialApplication, TrialFollowup
from app.modules.identity.application_service import IdentityApplicationService
from tests.conftest import make_settings


def make_client(**settings_overrides: object) -> tuple[TestClient, object]:
    settings = make_settings(**settings_overrides)
    app = create_app(settings)
    Base.metadata.create_all(app.state.engine)
    with app.state.session_factory() as session:
        IdentityApplicationService(session, settings.session_secret).seed_admin(
            "admin", "KnownMap 管理员", "admin-password"
        )
    return TestClient(app), app


def application_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "name": "测试老师",
        "contact": "contact-example",
        "courseCategory": "英语口语",
        "videoStatus": "已有课程",
        "teachingProblem": "希望增加口语练习",
        "subtitleStatus": "已有字幕",
    }
    payload.update(overrides)
    return payload


def login_admin(client: TestClient) -> None:
    response = client.post(
        "/api/v1/admin/auth/login",
        json={"login_name": "admin", "password": "admin-password"},
    )
    assert response.status_code == 200


def test_public_application_does_not_require_login_and_creates_pending_followup() -> None:
    client, app = make_client()

    response = client.post("/api/v1/public/trial-applications", json=application_payload())

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "accepted"
    assert body["applicationId"]
    assert body["requestId"]

    with app.state.session_factory() as session:
        application = session.scalar(select(TrialApplication))
        assert application is not None
        assert application.bilibili_url is None
        assert application.followup is not None
        assert application.followup.status == "pending"
        assert application.followup.updated_by_admin_id is None


def test_bilibili_url_is_optional_but_only_accepts_bilibili_hosts() -> None:
    client, _app = make_client()

    valid = client.post(
        "/api/v1/public/trial-applications",
        json=application_payload(bilibiliUrl="https://www.bilibili.com/video/BV1example"),
    )
    assert valid.status_code == 201

    short = client.post(
        "/api/v1/public/trial-applications",
        json=application_payload(bilibiliUrl="https://b23.tv/example"),
    )
    assert short.status_code == 201

    invalid = client.post(
        "/api/v1/public/trial-applications",
        json=application_payload(bilibiliUrl="https://example.com/course"),
    )
    assert invalid.status_code == 422


def test_course_category_is_required() -> None:
    client, _app = make_client()

    response = client.post(
        "/api/v1/public/trial-applications",
        json=application_payload(courseCategory="   "),
    )

    assert response.status_code == 422


def test_public_application_rejects_honeypot_and_rate_limited_requests() -> None:
    client, app = make_client(
        trial_submission_rate_limit_count=2,
        trial_submission_rate_limit_window_seconds=60,
    )

    rejected_bot = client.post(
        "/api/v1/public/trial-applications",
        json=application_payload(website="https://bot.example"),
    )
    assert rejected_bot.status_code == 400
    assert rejected_bot.json()["error"]["code"] == "ANTI_SPAM_REJECTED"

    assert (
        client.post("/api/v1/public/trial-applications", json=application_payload()).status_code
        == 201
    )
    assert (
        client.post(
            "/api/v1/public/trial-applications",
            json=application_payload(name="第二位老师"),
        ).status_code
        == 201
    )
    limited = client.post(
        "/api/v1/public/trial-applications", json=application_payload(name="第三位老师")
    )
    assert limited.status_code == 429
    assert limited.json()["error"]["code"] == "TRIAL_RATE_LIMITED"

    with app.state.session_factory() as session:
        assert session.scalar(select(func.count()).select_from(TrialApplication)) == 2


def test_admin_can_read_and_update_followup_but_public_cannot() -> None:
    client, _app = make_client()
    created = client.post(
        "/api/v1/public/trial-applications",
        json=application_payload(
            bilibiliUrl="https://www.bilibili.com/video/BV1example",
            validationQuestion="是否需要协助准备字幕？",
        ),
    )
    application_id = created.json()["applicationId"]

    assert client.get("/api/v1/admin/trial-applications").status_code == 401
    assert client.get("/api/v1/admin/trial-followups").status_code == 401

    login_admin(client)
    applications = client.get("/api/v1/admin/trial-applications")
    assert applications.status_code == 200
    item = applications.json()[0]
    assert item["id"] == application_id
    assert item["courseCategory"] == "英语口语"
    assert item["bilibiliUrl"].startswith("https://www.bilibili.com/")
    assert item["status"] == "pending"

    updated = client.patch(
        f"/api/v1/admin/trial-followups/{item['followupId']}",
        json={"status": "contacted"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "contacted"
    assert updated.json()["trial_application_id"] == application_id

    invalid = client.patch(
        f"/api/v1/admin/trial-followups/{item['followupId']}",
        json={"status": "archived"},
    )
    assert invalid.status_code == 422


def test_duplicate_submissions_are_independent_and_do_not_create_teacher() -> None:
    client, app = make_client()
    first = client.post("/api/v1/public/trial-applications", json=application_payload())
    second = client.post("/api/v1/public/trial-applications", json=application_payload())

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["applicationId"] != second.json()["applicationId"]

    with app.state.session_factory() as session:
        assert session.scalar(select(func.count()).select_from(TrialApplication)) == 2
        assert session.scalar(select(func.count()).select_from(TrialFollowup)) == 2
