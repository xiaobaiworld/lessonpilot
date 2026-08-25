from pathlib import Path
from typing import ClassVar, Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "knownmap-v1-backend"
    app_version: str = "0.1.0"
    api_version: str = "v1"
    app_env: Literal["development", "test", "production"] = "development"
    database_url: str = "sqlite+pysqlite:///./knownmap-v1.db"
    session_secret: str | None = None
    access_code_secret: str | None = None
    session_ttl_seconds: int = 86400
    session_cookie_name: str = "knownmap_teacher_session"
    admin_session_cookie_name: str = "knownmap_admin_session"
    cors_origins: str = (
        "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174,http://localhost:5174"
    )
    log_level: str | None = None
    contracts_manifest_path: Path = (
        Path(__file__).resolve().parents[2] / "contracts" / "versions.json"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PLACEHOLDER_SECRETS: ClassVar[frozenset[str]] = frozenset(
        {
            "replace-with-a-random-secret",
            "change-me",
            "changeme",
            "secret",
            "your-secret-here",
        }
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def effective_log_level(self) -> str:
        if self.log_level:
            return self.log_level.upper()
        return "DEBUG" if self.app_env in {"development", "test"} else "INFO"

    def validate_runtime(self) -> None:
        if self.app_env != "production":
            return

        problems: list[str] = []
        for name, value in (
            ("SESSION_SECRET", self.session_secret),
            ("ACCESS_CODE_SECRET", self.access_code_secret),
        ):
            if not value:
                problems.append(f"{name} 未设置")
            elif value in self.PLACEHOLDER_SECRETS:
                problems.append(f"{name} 仍是公开占位符")
            elif len(value) < 32:
                problems.append(f"{name} 太短（至少 32 字符）")

        local_origins = [
            origin
            for origin in self.cors_origin_list
            if any(
                marker in origin.lower()
                for marker in ("localhost", "127.0.0.1", "0.0.0.0", "[::1]")
            )
        ]
        if local_origins:
            problems.append(f"生产 CORS 含本机来源：{', '.join(local_origins)}")
        if not self.cors_origin_list:
            problems.append("生产 CORS 为空")
        if self.effective_log_level == "DEBUG":
            problems.append("生产日志级别不得为 DEBUG")
        if self.database_url.startswith("sqlite") and ":memory:" in self.database_url:
            problems.append("生产数据库不得使用内存库")

        if problems:
            raise ValueError("生产环境配置不合格：" + "；".join(problems))
