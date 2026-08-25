from app.config import Settings


def make_settings(**overrides: object) -> Settings:
    values = {
        "app_env": "test",
        "database_url": "sqlite+pysqlite:///:memory:",
        "session_secret": "s" * 48,
        "access_code_secret": "a" * 48,
    }
    values.update(overrides)
    return Settings(**values)
