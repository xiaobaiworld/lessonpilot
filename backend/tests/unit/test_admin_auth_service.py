from datetime import UTC, datetime
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from app.models import Admin, AdminSession


def test_admin_models_create_expected_tables_and_defaults(database_session) -> None:
    inspector = inspect(database_session.bind)

    assert {"admins", "admin_sessions"} <= set(inspector.get_table_names())

    admin_columns = {column["name"]: column for column in inspector.get_columns("admins")}
    assert admin_columns["id"]["primary_key"] == 1
    assert admin_columns["login_name"]["nullable"] is False
    assert admin_columns["password_hash"]["nullable"] is False
    assert admin_columns["display_name"]["nullable"] is False
    assert admin_columns["status"]["nullable"] is False
    assert admin_columns["created_at"]["nullable"] is False
    assert admin_columns["updated_at"]["nullable"] is False
    assert admin_columns["login_name"]["type"].length == 80
    assert admin_columns["password_hash"]["type"].length == 255
    assert admin_columns["display_name"]["type"].length == 120
    assert admin_columns["status"]["type"].length == 20

    session_columns = {column["name"]: column for column in inspector.get_columns("admin_sessions")}
    assert session_columns["id"]["primary_key"] == 1
    assert session_columns["admin_id"]["nullable"] is False
    assert session_columns["token_digest"]["nullable"] is False
    assert session_columns["expires_at"]["nullable"] is False
    assert session_columns["revoked_at"]["nullable"] is True
    assert session_columns["created_at"]["nullable"] is False
    assert session_columns["token_digest"]["type"].length == 64

    admin = Admin(
        login_name="admin-schema-test",
        password_hash="hashed-placeholder",
        display_name="Schema Admin",
    )
    database_session.add(admin)
    database_session.flush()

    assert admin.status == "active"
    assert admin.created_at.tzinfo is not None
    assert admin.created_at.utcoffset() == UTC.utcoffset(admin.created_at)
    assert Admin.__table__.c.updated_at.onupdate is not None
    assert Admin.__table__.c.created_at.default is not None

    admin_session = AdminSession(
        admin_id=admin.id,
        token_digest="a" * 64,
        expires_at=datetime.now(UTC),
    )
    database_session.add(admin_session)
    database_session.flush()


def test_admin_auth_constraints_and_indexes_match_contract(database_session) -> None:
    inspector = inspect(database_session.bind)

    admin_indexes = {
        (index["name"], tuple(index["column_names"]), index["unique"])
        for index in inspector.get_indexes("admins")
    }
    assert ("ix_admins_login_name", ("login_name",), 1) in admin_indexes
    assert Admin.__table__.c.login_name.unique is True

    session_indexes = {
        (index["name"], tuple(index["column_names"]), index["unique"])
        for index in inspector.get_indexes("admin_sessions")
    }
    assert {
        ("ix_admin_sessions_admin_id", ("admin_id",), 0),
        ("ix_admin_sessions_token_digest", ("token_digest",), 1),
    } <= session_indexes
    assert AdminSession.__table__.c.token_digest.unique is True

    foreign_keys = inspector.get_foreign_keys("admin_sessions")
    assert any(
        foreign_key["constrained_columns"] == ["admin_id"]
        and foreign_key["referred_table"] == "admins"
        and foreign_key["referred_columns"] == ["id"]
        for foreign_key in foreign_keys
    )


def test_admin_auth_migration_adds_auth_tables_without_changing_teacher_or_course_tables(
    tmp_path,
    monkeypatch,
) -> None:
    backend_dir = Path(__file__).resolve().parents[2]
    database_path = tmp_path / "admin-auth-migration.db"
    database_url = f"sqlite+pysqlite:///{database_path}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    alembic_config = Config(str(backend_dir / "alembic.ini"))

    command.upgrade(alembic_config, "0008_multi_lesson_courses")

    engine = create_engine(database_url)
    before = {
        table_name: {
            "columns": [
                (column["name"], str(column["type"]), column["nullable"])
                for column in inspect(engine).get_columns(table_name)
            ],
            "indexes": [
                (index["name"], tuple(index["column_names"]), index["unique"])
                for index in inspect(engine).get_indexes(table_name)
            ],
            "foreign_keys": [
                (
                    foreign_key["constrained_columns"],
                    foreign_key["referred_table"],
                    foreign_key["referred_columns"],
                )
                for foreign_key in inspect(engine).get_foreign_keys(table_name)
            ],
        }
        for table_name in ("teachers", "teacher_sessions", "courses")
    }

    command.upgrade(alembic_config, "head")

    inspector = inspect(engine)
    assert {"admins", "admin_sessions"} <= set(inspector.get_table_names())
    after = {
        table_name: {
            "columns": [
                (column["name"], str(column["type"]), column["nullable"])
                for column in inspector.get_columns(table_name)
            ],
            "indexes": [
                (index["name"], tuple(index["column_names"]), index["unique"])
                for index in inspector.get_indexes(table_name)
            ],
            "foreign_keys": [
                (
                    foreign_key["constrained_columns"],
                    foreign_key["referred_table"],
                    foreign_key["referred_columns"],
                )
                for foreign_key in inspector.get_foreign_keys(table_name)
            ],
        }
        for table_name in ("teachers", "teacher_sessions", "courses")
    }
    assert after == before

    command.downgrade(alembic_config, "0008_multi_lesson_courses")
    assert "admins" not in inspect(engine).get_table_names()
    assert "admin_sessions" not in inspect(engine).get_table_names()

    engine.dispose()
