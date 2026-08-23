"""阶段 6C：生产启动校验与日志脱敏。

两者都是"不依赖人每次都写对"的机制：启动校验拦住弱配置，脱敏处理器
拦住误写进日志的密钥。
"""

import pytest

from app.config import Settings
from app.logging import redact_sensitive


def production(**overrides) -> Settings:
    base = {
        "app_env": "production",
        "session_secret": "s" * 48,
        "access_code_secret": "a" * 48,
        "cors_origins": "https://knownmap.com",
        "log_level": "INFO",
        "database_url": "sqlite+pysqlite:////var/lib/knownmap/knownmap.db",
    }
    base.update(overrides)
    return Settings(**base)


class TestProductionStartup:
    def test_valid_production_config_starts(self) -> None:
        production().validate_runtime_secrets()

    def test_missing_secret_refuses_start(self) -> None:
        with pytest.raises(ValueError, match="SESSION_SECRET 未设置"):
            production(session_secret=None).validate_runtime_secrets()

    def test_placeholder_secret_refuses_start(self) -> None:
        # 这个值在 .env.example 和 git 历史里，公开可查
        with pytest.raises(ValueError, match="仍是占位符"):
            production(session_secret="replace-with-a-random-secret").validate_runtime_secrets()

    def test_short_secret_refuses_start(self) -> None:
        with pytest.raises(ValueError, match="太短"):
            production(access_code_secret="abc123").validate_runtime_secrets()

    @pytest.mark.parametrize(
        "origins",
        [
            "https://knownmap.com,http://localhost:5173",
            "http://127.0.0.1:8000",
            "https://knownmap.com,http://0.0.0.0:3000",
        ],
    )
    def test_local_cors_origin_refuses_start(self, origins: str) -> None:
        # 放行本机来源等于允许任意本地页面带 Cookie 调生产 API
        with pytest.raises(ValueError, match="含本机来源"):
            production(cors_origins=origins).validate_runtime_secrets()

    def test_empty_cors_refuses_start(self) -> None:
        with pytest.raises(ValueError, match="CORS 为空"):
            production(cors_origins="").validate_runtime_secrets()

    def test_debug_log_level_refuses_start(self) -> None:
        with pytest.raises(ValueError, match="不得为 DEBUG"):
            production(log_level="DEBUG").validate_runtime_secrets()

    def test_in_memory_database_refuses_start(self) -> None:
        with pytest.raises(ValueError, match="内存库"):
            production(database_url="sqlite+pysqlite:///:memory:").validate_runtime_secrets()

    def test_all_problems_reported_at_once(self) -> None:
        # 一次只报一个问题，运维要重启好几轮才能改全
        with pytest.raises(ValueError) as caught:
            production(
                session_secret="change-me",
                cors_origins="http://localhost:5173",
                log_level="DEBUG",
            ).validate_runtime_secrets()
        message = str(caught.value)
        assert "占位符" in message
        assert "本机来源" in message
        assert "DEBUG" in message

    def test_development_is_not_constrained(self) -> None:
        # 本机开发要能用短密钥、本机 CORS 和 DEBUG 日志
        Settings(
            app_env="development",
            session_secret=None,
            cors_origins="http://localhost:5173",
            log_level="DEBUG",
        ).validate_runtime_secrets()


class TestLogRedaction:
    def call(self, **event) -> dict:
        return redact_sensitive(None, "info", {"event": "x", **event})

    @pytest.mark.parametrize(
        "field",
        [
            "password",
            "password_hash",
            "temporary_password",
            "session_secret",
            "raw_token",
            "token_digest",
            "cookie",
            "access_code",
            "authorization",
            "credential_version",
            "proof_salt",
        ],
    )
    def test_sensitive_field_is_redacted(self, field: str) -> None:
        assert self.call(**{field: "机密内容"})[field] == "[已脱敏]"

    def test_ordinary_fields_pass_through(self) -> None:
        result = self.call(admin_id="a1", duration_ms=12, action="login")
        assert result["admin_id"] == "a1"
        assert result["duration_ms"] == 12
        assert result["action"] == "login"

    def test_nested_dict_is_redacted(self) -> None:
        # 最常见的漏法：logger.info("x", payload=request_body)
        result = self.call(payload={"login_name": "t1", "password": "机密"})
        assert result["payload"]["login_name"] == "t1"
        assert result["payload"]["password"] == "[已脱敏]"

    def test_list_of_dicts_is_redacted(self) -> None:
        result = self.call(items=[{"access_code": "KM-X"}, {"id": "ok"}])
        assert result["items"][0]["access_code"] == "[已脱敏]"
        assert result["items"][1]["id"] == "ok"

    def test_matching_is_case_insensitive(self) -> None:
        assert self.call(Password="x")["Password"] == "[已脱敏]"
        assert self.call(ACCESS_CODE="x")["ACCESS_CODE"] == "[已脱敏]"

    def test_self_referencing_structure_does_not_hang(self) -> None:
        loop: dict = {"id": "a"}
        loop["self"] = loop
        redact_sensitive(None, "info", {"event": "x", "loop": loop})

    def test_event_message_itself_is_untouched(self) -> None:
        # 只按字段名脱敏；事件名是开发者写的字面量
        assert self.call()["event"] == "x"
