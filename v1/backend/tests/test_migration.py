from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text


def test_empty_database_upgrades_to_single_v1_head(tmp_path: Path, monkeypatch) -> None:
    database_path = tmp_path / "knownmap-v1.db"
    database_url = f"sqlite+pysqlite:///{database_path}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    config = Config("alembic.ini")

    command.upgrade(config, "head")

    engine = create_engine(database_url)
    tables = set(inspect(engine).get_table_names())
    assert {
        "alembic_version",
        "v1_access_codes",
        "v1_admin_accounts",
        "v1_admin_sessions",
        "v1_course_releases",
        "v1_course_version_operations",
        "v1_courses",
        "v1_grant_items",
        "v1_lessons",
        "v1_operation_audit",
        "v1_preview_sessions",
        "v1_redemptions",
        "v1_release_availability",
        "v1_release_lesson_snapshots",
        "v1_rights_attestations",
        "v1_script_drafts",
        "v1_teacher_accounts",
        "v1_teacher_sessions",
        "v1_trial_followups",
        "v1_video_references",
        "v1_workspaces",
    } == tables
    with engine.connect() as connection:
        assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
        access_code_columns = {
            row[1] for row in connection.execute(text("PRAGMA table_info(v1_access_codes)"))
        }
        assert {"recipient_label", "recipient_note"} <= access_code_columns
        audit_columns = {
            row[1] for row in connection.execute(text("PRAGMA table_info(v1_operation_audit)"))
        }
        assert "idempotency_key" in audit_columns

    command.upgrade(config, "head")
    command.check(config)
