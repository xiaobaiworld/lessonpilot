from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "knownmap-teacher-platform"
    app_version: str = "0.1.0"
    api_version: str = "v1"
    app_env: Literal["development", "test", "production"] = "development"
    database_url: str = "sqlite+pysqlite:///./knownmap.db"
    session_secret: str | None = None
    access_code_secret: str | None = None
    log_level: str | None = None
    session_ttl_seconds: int = 86400
    session_cookie_name: str = "knownmap_session"
    cors_origins: str = "http://127.0.0.1:4173,http://localhost:4173"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def effective_log_level(self) -> str:
        if self.log_level:
            return self.log_level.upper()
        return "DEBUG" if self.app_env in {"development", "test"} else "INFO"

    def validate_runtime_secrets(self) -> None:
        if self.app_env == "production":
            missing = [
                name
                for name, value in (
                    ("SESSION_SECRET", self.session_secret),
                    ("ACCESS_CODE_SECRET", self.access_code_secret),
                )
                if not value
            ]
            if missing:
                raise ValueError(f"Missing required production secrets: {', '.join(missing)}")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
