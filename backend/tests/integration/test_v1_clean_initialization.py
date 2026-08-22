from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text


def test_v1_clean_initialization_has_no_legacy_business_rows(tmp_path, monkeypatch) -> None:
    """D-V1-012: a fresh initialization starts without legacy business data."""

    backend_dir = Path(__file__).resolve().parents[2]
    database_path = tmp_path / "v1-clean-init.db"
    database_url = f"sqlite+pysqlite:///{database_path}"
    monkeypatch.setenv("DATABASE_URL", database_url)

    alembic_config = Config(str(backend_dir / "alembic.ini"))
    command.upgrade(alembic_config, "head")

    engine = create_engine(database_url)
    try:
        table_names = set(inspect(engine).get_table_names())
        expected_tables = {
            "admins",
            "admin_sessions",
            "teachers",
            "teacher_sessions",
            "workspaces",
            "courses",
            "lessons",
            "script_drafts",
            "published_scripts",
            "access_codes",
            "access_grants",
            "operation_logs",
        }
        assert expected_tables <= table_names

        with engine.connect() as connection:
            counts = {
                table: connection.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar_one()
                for table in expected_tables
            }

        assert counts == {table: 0 for table in expected_tables}
    finally:
        engine.dispose()
