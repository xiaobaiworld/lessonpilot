from typing import ClassVar, Literal

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
    admin_session_cookie_name: str = "knownmap_admin_session"
    admin_login_name: str = "admin"
    admin_display_name: str = "KnownMap 管理员"
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
        """启动校验。不合格就拒绝启动，而不是带着弱配置对外服务。

        只检查"存在"是不够的：`.env.example` 里的占位符是公开的，复制到
        生产会通过存在性检查，但等于没有密钥。授权码密钥尤其严重——
        它一旦泄露，任何人都能伪造授权码；而它丢失会永久废掉全部已发码
        （doc/lessons.md 2026-08-20）。
        """
        if self.app_env != "production":
            return

        problems: list[str] = []

        for name, value in (
            ("SESSION_SECRET", self.session_secret),
            ("ACCESS_CODE_SECRET", self.access_code_secret),
        ):
            if not value:
                problems.append(f"{name} 未设置")
                continue
            if value in self.PLACEHOLDER_SECRETS:
                problems.append(f"{name} 仍是占位符，这个值是公开的")
            elif len(value) < 32:
                # 32 字节以下的 HMAC 密钥不值得依赖
                problems.append(f"{name} 太短（{len(value)} 字符，至少 32）")

        # 生产 CORS 放行本机来源，等于允许任意本地页面带着 Cookie 调 API
        local_origins = [o for o in self.cors_origin_list if self._is_local_origin(o)]
        if local_origins:
            problems.append(f"生产 CORS 含本机来源：{', '.join(local_origins)}")

        if not self.cors_origin_list:
            problems.append("生产 CORS 为空，教师端将无法调用 API")

        # 生产开 DEBUG 会把请求细节写进日志
        if self.effective_log_level == "DEBUG":
            problems.append("生产日志级别不得为 DEBUG")

        if self.database_url.startswith("sqlite") and ":memory:" in self.database_url:
            problems.append("生产数据库不得为内存库")

        if problems:
            raise ValueError("生产环境配置不合格：" + "；".join(problems))

    #: `.env.example` 与文档里出现过的占位符，公开可查，不可作为真实密钥
    PLACEHOLDER_SECRETS: ClassVar[frozenset[str]] = frozenset(
        {
            "replace-with-a-random-secret",
            "change-me",
            "changeme",
            "secret",
            "your-secret-here",
        }
    )

    @staticmethod
    def _is_local_origin(origin: str) -> bool:
        lowered = origin.lower()
        return any(
            marker in lowered
            for marker in ("localhost", "127.0.0.1", "0.0.0.0", "[::1]")
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
