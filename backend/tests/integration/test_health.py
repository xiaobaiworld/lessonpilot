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
