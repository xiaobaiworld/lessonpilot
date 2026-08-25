import pytest
from fastapi.testclient import TestClient

from app.api.errors import ApiError
from app.config import Settings
from app.infrastructure.logging.config import redact_sensitive
from app.main import create_app
from tests.conftest import make_settings


def test_health_and_metadata_are_available() -> None:
    client = TestClient(create_app(make_settings()))

    health = client.get("/health")
    version = client.get("/api/v1/meta/version")
    contracts = client.get("/api/v1/meta/contracts")

    assert health.status_code == 200
    assert health.json() == {
        "service": "knownmap-v1-backend",
        "status": "ok",
        "api_version": "v1",
    }
    assert health.headers["x-request-id"]
    assert version.json()["database_ready"] is True
    assert version.json()["migration"] == "none"
    assert contracts.status_code == 200
    assert contracts.json()["contracts"]["course_package"] == "2.0.0"


def test_production_rejects_weak_runtime_configuration() -> None:
    settings = Settings(
        app_env="production",
        session_secret="change-me",
        access_code_secret="short",
        cors_origins="http://localhost:5173",
        log_level="DEBUG",
    )

    with pytest.raises(ValueError) as caught:
        settings.validate_runtime()

    message = str(caught.value)
    assert "公开占位符" in message
    assert "太短" in message
    assert "本机来源" in message
    assert "DEBUG" in message


def test_logging_redacts_nested_secrets() -> None:
    result = redact_sensitive(
        None,
        "info",
        {
            "event": "test",
            "payload": {"password": "x", "access_code": "KM-X", "course_id": "c1"},
        },
    )

    assert result["payload"] == {
        "password": "[已脱敏]",
        "access_code": "[已脱敏]",
        "course_id": "c1",
    }


def test_api_errors_include_stable_code_and_request_id() -> None:
    app = create_app(make_settings())

    @app.get("/test-error")
    def test_error() -> None:
        raise ApiError(409, "TEST_CONFLICT", "测试冲突")

    response = TestClient(app).get("/test-error")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "TEST_CONFLICT"
    assert response.json()["error"]["request_id"] == response.headers["x-request-id"]
