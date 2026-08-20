from datetime import UTC, datetime
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

from app.config import Settings
from app.db import create_database_engine, create_session_factory, create_tables
from app.models import Admin, AdminSession


def _schema_snapshot(engine, table_names: tuple[str, ...]) -> dict:
    inspector = inspect(engine)
    return {
        table_name: {
            "columns": [
                (
                    column["name"],
                    str(column["type"]),
                    column["nullable"],
                    column["default"],
                )
                for column in inspector.get_columns(table_name)
            ],
            "indexes": [
                (index["name"], tuple(index["column_names"]), index["unique"])
                for index in inspector.get_indexes(table_name)
            ],
            "unique_constraints": [
                (constraint["name"], tuple(constraint["column_names"]))
                for constraint in inspector.get_unique_constraints(table_name)
            ],
            "foreign_keys": [
                (
                    tuple(foreign_key["constrained_columns"]),
                    foreign_key["referred_table"],
                    tuple(foreign_key["referred_columns"]),
                )
                for foreign_key in inspector.get_foreign_keys(table_name)
            ],
        }
        for table_name in table_names
    }


def _assert_old_admin_auth_schema(engine) -> None:
    inspector = inspect(engine)
    assert {
        (index["name"], tuple(index["column_names"]), index["unique"])
        for index in inspector.get_indexes("admins")
    } == {("ix_admins_login_name", ("login_name",), 0)}
    assert [
        (constraint["name"], tuple(constraint["column_names"]))
        for constraint in inspector.get_unique_constraints("admins")
    ] == [(None, ("login_name",))]

    assert {
        (index["name"], tuple(index["column_names"]), index["unique"])
        for index in inspector.get_indexes("admin_sessions")
    } == {
        ("ix_admin_sessions_admin_id", ("admin_id",), 0),
        ("ix_admin_sessions_token_digest", ("token_digest",), 0),
    }
    assert [
        (constraint["name"], tuple(constraint["column_names"]))
        for constraint in inspector.get_unique_constraints("admin_sessions")
    ] == [(None, ("token_digest",))]

    admin_columns = {column["name"]: column for column in inspector.get_columns("admins")}
    assert admin_columns["status"]["default"] == "'active'"
    _assert_admin_session_foreign_key_declared(engine)


def _assert_current_admin_auth_schema(engine) -> None:
    inspector = inspect(engine)
    assert {
        (index["name"], tuple(index["column_names"]), index["unique"])
        for index in inspector.get_indexes("admins")
    } == {("ix_admins_login_name", ("login_name",), 1)}
    assert inspector.get_unique_constraints("admins") == []

    assert {
        (index["name"], tuple(index["column_names"]), index["unique"])
        for index in inspector.get_indexes("admin_sessions")
    } == {
        ("ix_admin_sessions_admin_id", ("admin_id",), 0),
        ("ix_admin_sessions_token_digest", ("token_digest",), 1),
    }
    assert inspector.get_unique_constraints("admin_sessions") == []

    admin_columns = {column["name"]: column for column in inspector.get_columns("admins")}
    assert admin_columns["status"]["default"] is None

    _assert_admin_session_foreign_key_declared(engine)


def _assert_admin_session_foreign_key_declared(engine) -> None:
    foreign_keys = inspect(engine).get_foreign_keys("admin_sessions")
    assert any(
        foreign_key["constrained_columns"] == ["admin_id"]
        and foreign_key["referred_table"] == "admins"
        and foreign_key["referred_columns"] == ["id"]
        for foreign_key in foreign_keys
    )


def _admin_auth_data_snapshot(engine) -> dict:
    with engine.connect() as connection:
        admin = connection.execute(
            text(
                "SELECT id, login_name, password_hash, display_name, status, "
                "created_at, updated_at "
                "FROM admins WHERE id = :admin_id"
            ),
            {"admin_id": "admin-existing"},
        ).mappings().one()
        admin_session = connection.execute(
            text(
                "SELECT id, admin_id, token_digest, expires_at, revoked_at, created_at "
                "FROM admin_sessions WHERE id = :session_id"
            ),
            {"session_id": "session-existing"},
        ).mappings().one()

    return {
        "admin": dict(admin),
        "admin_session": dict(admin_session),
    }


def _access_grant_data_snapshot(engine) -> dict:
    with engine.connect() as connection:
        row = connection.execute(
            text(
                "SELECT id, access_code_id, course_id, lesson_id, node_id, "
                "valid_from, valid_until, created_at "
                "FROM access_grants WHERE id = :grant_id"
            ),
            {"grant_id": "grant-existing"},
        ).mappings().one()
    return dict(row)


def _assert_orphan_admin_session_absent(engine) -> None:
    with engine.connect() as connection:
        count = connection.execute(
            text("SELECT COUNT(*) FROM admin_sessions WHERE id = :session_id"),
            {"session_id": "session-orphan"},
        ).scalar_one()
    assert count == 0


def _assert_orphan_admin_session_present(engine) -> None:
    with engine.connect() as connection:
        row = connection.execute(
            text(
                "SELECT id, admin_id FROM admin_sessions "
                "WHERE id = :session_id"
            ),
            {"session_id": "session-orphan"},
        ).mappings().one()
    assert dict(row) == {
        "id": "session-orphan",
        "admin_id": "admin-missing",
    }


def _assert_project_engine_rejects_orphan_session(database_url: str, token_digest: str) -> None:
    engine = create_database_engine(Settings(database_url=database_url))
    session_factory = create_session_factory(engine)
    with session_factory() as session:
        session.add(
            AdminSession(
                admin_id="missing-admin",
                token_digest=token_digest,
                expires_at=datetime.now(UTC),
            )
        )
        with pytest.raises(IntegrityError):
            session.flush()
    engine.dispose()


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


def test_project_sqlite_engine_enforces_admin_session_foreign_keys(tmp_path) -> None:
    database_url = f"sqlite+pysqlite:///{tmp_path / 'admin-auth-runtime.db'}"
    engine = create_database_engine(Settings(database_url=database_url))
    create_tables(engine)
    engine.dispose()
    _assert_project_engine_rejects_orphan_session(database_url, "b" * 64)


def test_admin_auth_schema_fix_migrates_existing_data_and_is_reversible(
    tmp_path,
    monkeypatch,
) -> None:
    backend_dir = Path(__file__).resolve().parents[2]
    database_path = tmp_path / "admin-auth-migration.db"
    database_url = f"sqlite+pysqlite:///{database_path}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    alembic_config = Config(str(backend_dir / "alembic.ini"))

    command.upgrade(alembic_config, "0010_admin_auth")

    old_engine = create_engine(database_url)
    _assert_old_admin_auth_schema(old_engine)
    preserved_tables = ("teachers", "teacher_sessions", "courses", "access_grants")
    preserved_schema = _schema_snapshot(old_engine, preserved_tables)
    created_at = datetime(2026, 8, 18, 9, 10, 11, tzinfo=UTC)
    updated_at = datetime(2026, 8, 19, 10, 11, 12, tzinfo=UTC)
    expires_at = datetime(2026, 9, 18, 9, 10, 11, tzinfo=UTC)
    revoked_at = datetime(2026, 8, 20, 8, 0, 0, tzinfo=UTC)
    grant_valid_from = datetime(2026, 8, 1, 0, 0, 0, tzinfo=UTC)
    grant_valid_until = datetime(2027, 8, 1, 0, 0, 0, tzinfo=UTC)
    with old_engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO teachers "
                "(id, login_name, password_hash, display_name, status, created_at, updated_at) "
                "VALUES "
                "(:id, :login_name, :password_hash, :display_name, :status, "
                ":created_at, :updated_at)"
            ),
            {
                "id": "teacher-existing",
                "login_name": "teacher-existing",
                "password_hash": "teacher-password-hash",
                "display_name": "Existing Teacher",
                "status": "active",
                "created_at": created_at,
                "updated_at": updated_at,
            },
        )
        connection.execute(
            text(
                "INSERT INTO workspaces (id, owner_teacher_id, name, created_at) "
                "VALUES (:id, :owner_teacher_id, :name, :created_at)"
            ),
            {
                "id": "workspace-existing",
                "owner_teacher_id": "teacher-existing",
                "name": "Existing Workspace",
                "created_at": created_at,
            },
        )
        connection.execute(
            text(
                "INSERT INTO courses "
                "(id, workspace_id, title, description, status, created_at, updated_at) "
                "VALUES "
                "(:id, :workspace_id, :title, :description, :status, "
                ":created_at, :updated_at)"
            ),
            {
                "id": "course-existing",
                "workspace_id": "workspace-existing",
                "title": "Existing Course",
                "description": "Preserved during admin migration",
                "status": "published",
                "created_at": created_at,
                "updated_at": updated_at,
            },
        )
        connection.execute(
            text(
                "INSERT INTO lessons "
                "(id, course_id, title, sort_order, platform, video_id, status, "
                "created_at, updated_at) "
                "VALUES "
                "(:id, :course_id, :title, :sort_order, :platform, :video_id, :status, "
                ":created_at, :updated_at)"
            ),
            {
                "id": "lesson-existing",
                "course_id": "course-existing",
                "title": "Existing Lesson",
                "sort_order": 1,
                "platform": "youtube",
                "video_id": "video-existing",
                "status": "published",
                "created_at": created_at,
                "updated_at": updated_at,
            },
        )
        connection.execute(
            text(
                "INSERT INTO access_codes "
                "(id, course_id, code_digest, code_hint, created_at, code_type, expires_at) "
                "VALUES "
                "(:id, :course_id, :code_digest, :code_hint, :created_at, "
                ":code_type, :expires_at)"
            ),
            {
                "id": "access-code-existing",
                "course_id": "course-existing",
                "code_digest": "f" * 64,
                "code_hint": "abcde",
                "created_at": created_at,
                "code_type": "long_term",
                "expires_at": expires_at,
            },
        )
        connection.execute(
            text(
                "INSERT INTO access_grants "
                "(id, access_code_id, course_id, lesson_id, node_id, valid_from, "
                "valid_until, created_at) "
                "VALUES "
                "(:id, :access_code_id, :course_id, :lesson_id, :node_id, "
                ":valid_from, :valid_until, :created_at)"
            ),
            {
                "id": "grant-existing",
                "access_code_id": "access-code-existing",
                "course_id": "course-existing",
                "lesson_id": "lesson-existing",
                "node_id": "node-existing",
                "valid_from": grant_valid_from,
                "valid_until": grant_valid_until,
                "created_at": created_at,
            },
        )
        connection.execute(
            text(
                "INSERT INTO admins "
                "(id, login_name, password_hash, display_name, status, created_at, updated_at) "
                "VALUES "
                "(:id, :login_name, :password_hash, :display_name, :status, "
                ":created_at, :updated_at)"
            ),
            {
                "id": "admin-existing",
                "login_name": "existing-admin",
                "password_hash": "existing-password-hash",
                "display_name": "Existing Admin",
                "status": "active",
                "created_at": created_at,
                "updated_at": updated_at,
            },
        )
        connection.execute(
            text(
                "INSERT INTO admin_sessions "
                "(id, admin_id, token_digest, expires_at, revoked_at, created_at) "
                "VALUES "
                "(:id, :admin_id, :token_digest, :expires_at, :revoked_at, :created_at)"
            ),
            {
                "id": "session-existing",
                "admin_id": "admin-existing",
                "token_digest": "d" * 64,
                "expires_at": expires_at,
                "revoked_at": revoked_at,
                "created_at": created_at,
            },
        )
        connection.execute(
            text(
                "INSERT INTO admin_sessions "
                "(id, admin_id, token_digest, expires_at, revoked_at, created_at) "
                "VALUES "
                "(:id, :admin_id, :token_digest, :expires_at, NULL, :created_at)"
            ),
            {
                "id": "session-orphan",
                "admin_id": "admin-missing",
                "token_digest": "e" * 64,
                "expires_at": expires_at,
                "created_at": created_at,
            },
        )
    preserved_admin_auth_data = _admin_auth_data_snapshot(old_engine)
    preserved_access_grant_data = _access_grant_data_snapshot(old_engine)
    _assert_orphan_admin_session_present(old_engine)
    with old_engine.connect() as connection:
        assert connection.exec_driver_sql("PRAGMA foreign_key_check").all() != []
    old_engine.dispose()

    command.upgrade(alembic_config, "head")

    upgraded_engine = create_engine(database_url)
    _assert_current_admin_auth_schema(upgraded_engine)
    with upgraded_engine.connect() as connection:
        assert connection.exec_driver_sql("PRAGMA foreign_key_check").all() == []
    _assert_orphan_admin_session_absent(upgraded_engine)
    assert _admin_auth_data_snapshot(upgraded_engine) == preserved_admin_auth_data
    assert _access_grant_data_snapshot(upgraded_engine) == preserved_access_grant_data
    assert _schema_snapshot(upgraded_engine, preserved_tables) == preserved_schema
    upgraded_engine.dispose()

    _assert_project_engine_rejects_orphan_session(database_url, "c" * 64)

    command.downgrade(alembic_config, "0010_admin_auth")

    downgraded_engine = create_engine(database_url)
    _assert_old_admin_auth_schema(downgraded_engine)
    _assert_admin_session_foreign_key_declared(downgraded_engine)
    _assert_orphan_admin_session_absent(downgraded_engine)
    assert _admin_auth_data_snapshot(downgraded_engine) == preserved_admin_auth_data
    assert _access_grant_data_snapshot(downgraded_engine) == preserved_access_grant_data
    assert _schema_snapshot(downgraded_engine, preserved_tables) == preserved_schema
    downgraded_engine.dispose()

    _assert_project_engine_rejects_orphan_session(database_url, "a" * 64)
