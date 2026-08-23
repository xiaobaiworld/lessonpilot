import logging
import json

import structlog
from fastapi.testclient import TestClient

from app.config import Settings
from app.logging import configure_logging
from app.main import create_app


def make_settings(**overrides: object) -> Settings:
    values = {
        "app_env": "test",
        "database_url": "sqlite+pysqlite:///:memory:",
        "session_secret": "test-session-secret",
        "access_code_secret": "test-access-code-secret",
    }
    values.update(overrides)
    return Settings(**values)


def test_health_returns_service_metadata_and_request_id() -> None:
    client = TestClient(create_app(make_settings()))

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "service": "knownmap-teacher-platform",
        "status": "ok",
        "api_version": "v1",
    }
    assert response.headers["x-request-id"]


def test_development_and_production_use_different_default_log_levels() -> None:
    development = make_settings(app_env="development", log_level=None)
    production = make_settings(app_env="production", log_level=None)

    configure_logging(development)
    assert logging.getLogger().level == logging.DEBUG

    configure_logging(production)
    assert logging.getLogger().level == logging.INFO


def test_production_logging_uses_json_renderer(capsys) -> None:
    configure_logging(make_settings(app_env="production", log_level="INFO"))

    structlog.get_logger("test").info("test.event", outcome="success")

    output = capsys.readouterr().out.strip()
    parsed = json.loads(output)
    assert parsed["event"] == "test.event"
    assert parsed["outcome"] == "success"


def test_cors_allows_local_teacher_workspace_with_credentials() -> None:
    client = TestClient(create_app(make_settings()))

    response = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://127.0.0.1:4173",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:4173"
    assert response.headers["access-control-allow-credentials"] == "true"


class TestVersionProbe:
    """版本探针（6C）。发布切换靠它确认部署的是哪一版。"""

    def make_client(self) -> TestClient:
        return TestClient(create_app(make_settings()))

    def test_reports_readiness_separately_from_migration(self) -> None:
        # 测试库能查询但没有 alembic 表：两个事实必须分开报，
        # 否则"数据库不可用"这个信号在真出问题时不可信
        body = self.make_client().get("/version").json()
        assert body["database_ready"] is True
        assert body["migration"] == "none"

    def test_reports_versions_used_by_the_release_gate(self) -> None:
        body = self.make_client().get("/version").json()
        assert body["api_version"] == "v1"
        assert body["app_version"]
        assert body["app_env"] in {"development", "test", "production"}

    def test_carries_no_secret(self) -> None:
        # 探针是公开端点，不能泄露配置
        text = self.make_client().get("/version").text.lower()
        for marker in ("secret", "password", "cookie", "database_url"):
            assert marker not in text

    def test_reports_database_unavailable_instead_of_500(self, monkeypatch) -> None:
        # 数据库挂了时探针必须能应答并说明情况，否则运维只看到 500，
        # 分不清是进程死了还是数据库连不上
        from sqlalchemy.orm import Session

        client = self.make_client()

        def broken_execute(self, *args, **kwargs):
            raise RuntimeError("database is gone")

        monkeypatch.setattr(Session, "execute", broken_execute)
        response = client.get("/version")
        assert response.status_code == 200
        assert response.json()["database_ready"] is False
