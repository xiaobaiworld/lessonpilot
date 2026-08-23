"""6D：备份保留与恢复演练。

备份没验证过能读就不算备份。这些测试用真实 SQLite 文件跑，
不 mock sqlite3——mock 掉的正是可能出错的那一层。
"""

import importlib.util
from pathlib import Path
import sqlite3
import sys

import pytest

DEPLOY = Path(__file__).resolve().parents[3] / "deploy" / "teacher-platform"


def _load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, DEPLOY / filename)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


backup_tool = _load("knownmap_backup", "knownmap-backup.py")
restore_tool = _load("knownmap_restore_check", "knownmap-restore-check.py")


def make_database(path: Path, *, orphan_workspace: bool = False) -> None:
    """建一个结构与生产一致的最小库。"""
    connection = sqlite3.connect(path)
    connection.executescript(
        """
        CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL);
        CREATE TABLE admins (id VARCHAR(36) PRIMARY KEY);
        CREATE TABLE teachers (id VARCHAR(36) PRIMARY KEY);
        CREATE TABLE workspaces (
            id VARCHAR(36) PRIMARY KEY, owner_teacher_id VARCHAR(36));
        CREATE TABLE courses (
            id VARCHAR(36) PRIMARY KEY, workspace_id VARCHAR(36));
        CREATE TABLE lessons (
            id VARCHAR(36) PRIMARY KEY, course_id VARCHAR(36));
        CREATE TABLE script_drafts (
            id VARCHAR(36) PRIMARY KEY, lesson_id VARCHAR(36));
        CREATE TABLE published_scripts (id VARCHAR(36) PRIMARY KEY);
        CREATE TABLE access_codes (
            id VARCHAR(36) PRIMARY KEY, course_id VARCHAR(36));

        INSERT INTO alembic_version VALUES ('0011_fix_admin_auth_schema');
        INSERT INTO admins VALUES ('a1');
        INSERT INTO teachers VALUES ('t1');
        INSERT INTO courses VALUES ('c1', 'w1');
        INSERT INTO lessons VALUES ('l1', 'c1');
        INSERT INTO script_drafts VALUES ('d1', 'l1');
        INSERT INTO access_codes VALUES ('k1', 'c1');
        """
    )
    owner = "ghost" if orphan_workspace else "t1"
    connection.execute("INSERT INTO workspaces VALUES ('w1', ?)", (owner,))
    connection.commit()
    connection.close()


@pytest.fixture
def source_db(tmp_path: Path) -> Path:
    path = tmp_path / "knownmap.db"
    make_database(path)
    return path


class TestBackupRetention:
    def test_default_retention_is_thirty_days(self) -> None:
        # 6D 已接受的保留期是 30 天
        import inspect

        signature = inspect.signature(backup_tool.create_backup)
        assert signature.parameters["retention_days"].default == 30

    def test_backup_is_readable_and_complete(self, source_db: Path, tmp_path: Path) -> None:
        backup = backup_tool.create_backup(source_db, tmp_path / "backups")
        assert backup.is_file()

        connection = sqlite3.connect(f"file:{backup}?mode=ro", uri=True)
        try:
            assert connection.execute("PRAGMA integrity_check").fetchone() == ("ok",)
            assert connection.execute("SELECT COUNT(*) FROM teachers").fetchone()[0] == 1
        finally:
            connection.close()

    def test_backup_file_is_owner_only(self, source_db: Path, tmp_path: Path) -> None:
        backup = backup_tool.create_backup(source_db, tmp_path / "backups")
        assert backup.stat().st_mode & 0o777 == 0o600

    def test_old_backups_are_pruned_and_current_kept(self, source_db: Path, tmp_path: Path) -> None:
        import os
        import time

        directory = tmp_path / "backups"
        stale = directory / "knownmap-20200101T000000Z.db"
        directory.mkdir(mode=0o700, parents=True)
        stale.write_bytes(b"old")
        ancient = time.time() - 60 * 60 * 24 * 40
        os.utime(stale, (ancient, ancient))

        fresh = backup_tool.create_backup(source_db, directory, retention_days=30)

        assert not stale.exists()
        assert fresh.exists()


class TestRestoreDrill:
    def test_healthy_backup_passes(self, source_db: Path, tmp_path: Path) -> None:
        backup = backup_tool.create_backup(source_db, tmp_path / "backups")
        result = restore_tool.check_restore(backup)

        assert result["ok"] is True
        assert result["problems"] == []
        assert result["migration"] == "0011_fix_admin_auth_schema"
        assert result["counts"]["teachers"] == 1

    def test_broken_ownership_is_reported(self, tmp_path: Path) -> None:
        # 行数统计看不出这个问题：数量没变，引用断了
        path = tmp_path / "broken.db"
        make_database(path, orphan_workspace=True)

        result = restore_tool.check_restore(path)

        assert result["ok"] is False
        assert any("owner_teacher_id" in p for p in result["problems"])
        assert any("工作空间数量不是 1" in p for p in result["problems"])

    def test_missing_table_is_reported(self, tmp_path: Path) -> None:
        path = tmp_path / "partial.db"
        connection = sqlite3.connect(path)
        connection.execute("CREATE TABLE teachers (id VARCHAR(36) PRIMARY KEY)")
        connection.commit()
        connection.close()

        result = restore_tool.check_restore(path)

        assert result["ok"] is False
        assert any("缺少表 courses" in p for p in result["problems"])

    def test_drill_does_not_modify_the_backup(self, source_db: Path, tmp_path: Path) -> None:
        # 演练改动了备份，就等于把仅有的一份可用数据也搭进去
        backup = backup_tool.create_backup(source_db, tmp_path / "backups")
        before = backup.read_bytes()

        restore_tool.check_restore(backup)

        assert backup.read_bytes() == before

    def test_empty_alembic_version_is_reported(self, tmp_path: Path) -> None:
        # 结构齐全但没有版本号：无法判断这份备份能否被当前代码使用
        path = tmp_path / "no-version.db"
        make_database(path)
        connection = sqlite3.connect(path)
        connection.execute("DELETE FROM alembic_version")
        connection.commit()
        connection.close()

        result = restore_tool.check_restore(path)

        assert result["ok"] is False
        assert any("alembic_version" in p for p in result["problems"])

    def test_missing_backup_file_fails_loudly(self, tmp_path: Path) -> None:
        with pytest.raises(SystemExit):
            restore_tool.check_restore(tmp_path / "nope.db")
