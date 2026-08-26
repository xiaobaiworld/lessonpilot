#!/usr/bin/env python3
"""备份恢复演练与对账。

备份没验证过能读就不算备份。这个工具把一份备份恢复到临时位置，
核对结构与业务对象数量，并检查归属关系没有断——只看文件存在或字节数
无法发现"恢复出来的库里课程指向了不存在的教师"。

只读运行：从不写生产库，也不改动被检查的备份文件。

    python3 knownmap-restore-check.py --backup /var/backups/knownmap/xxx.db
    python3 knownmap-restore-check.py --latest
"""

import argparse
import json
from pathlib import Path
import shutil
import sqlite3
import sys
import tempfile

#: 恢复后必须存在的表。少一张就说明备份不完整或来自不兼容的版本。
REQUIRED_TABLES = (
    "admins",
    "teachers",
    "workspaces",
    "courses",
    "lessons",
    "script_drafts",
    "published_scripts",
    "access_codes",
    "alembic_version",
)

#: 归属对账：子表的外键必须都能在父表找到。
#: 断开的引用意味着恢复出来的数据无法使用，而行数统计看不出这一点。
OWNERSHIP_CHECKS = (
    ("workspaces", "owner_teacher_id", "teachers", "id"),
    ("courses", "workspace_id", "workspaces", "id"),
    ("lessons", "course_id", "courses", "id"),
    ("script_drafts", "lesson_id", "lessons", "id"),
    ("access_codes", "course_id", "courses", "id"),
)


def latest_backup(directory: Path) -> Path:
    backups = sorted(directory.glob("knownmap-*.db"))
    if not backups:
        raise SystemExit(f"目录里没有备份：{directory}")
    return backups[-1]


def check_restore(backup: Path) -> dict:
    """把备份恢复到临时目录并核对。返回结构化结果。"""
    if not backup.is_file():
        raise SystemExit(f"备份不存在：{backup}")

    problems: list[str] = []
    counts: dict[str, int] = {}
    migration = None

    with tempfile.TemporaryDirectory(prefix="knownmap-restore-") as workspace:
        # 复制后再打开：演练绝不能改动备份本身
        restored = Path(workspace) / "restored.db"
        shutil.copy2(backup, restored)

        connection = sqlite3.connect(f"file:{restored}?mode=ro", uri=True)
        try:
            integrity = connection.execute("PRAGMA integrity_check").fetchone()
            if integrity != ("ok",):
                problems.append(f"完整性检查未通过：{integrity!r}")

            present = {
                row[0]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                )
            }
            for table in REQUIRED_TABLES:
                if table not in present:
                    problems.append(f"缺少表 {table}")

            for table in REQUIRED_TABLES:
                if table in present and table != "alembic_version":
                    counts[table] = connection.execute(
                        f"SELECT COUNT(*) FROM {table}"  # noqa: S608 - 表名来自常量
                    ).fetchone()[0]

            if "alembic_version" in present:
                row = connection.execute(
                    "SELECT version_num FROM alembic_version"
                ).fetchone()
                migration = row[0] if row else None
                if migration is None:
                    problems.append("alembic_version 表为空，无法判断 schema 版本")

            # 归属对账
            for child, fk, parent, pk in OWNERSHIP_CHECKS:
                if child not in present or parent not in present:
                    continue
                orphans = connection.execute(
                    f"SELECT COUNT(*) FROM {child} c "  # noqa: S608 - 全部来自常量
                    f"WHERE c.{fk} IS NOT NULL "
                    f"AND NOT EXISTS (SELECT 1 FROM {parent} p WHERE p.{pk} = c.{fk})"
                ).fetchone()[0]
                if orphans:
                    problems.append(
                        f"{child}.{fk} 有 {orphans} 行指向不存在的 {parent}"
                    )

            # 每个教师应当恰好有一个工作空间：一对一是 v1 的权限模型基础
            if {"teachers", "workspaces"} <= present:
                mismatched = connection.execute(
                    "SELECT COUNT(*) FROM teachers t "
                    "WHERE (SELECT COUNT(*) FROM workspaces w "
                    "       WHERE w.owner_teacher_id = t.id) <> 1"
                ).fetchone()[0]
                if mismatched:
                    problems.append(f"{mismatched} 个教师的工作空间数量不是 1")
        finally:
            connection.close()

    return {
        "backup": str(backup),
        "bytes": backup.stat().st_size,
        "migration": migration,
        "counts": counts,
        "problems": problems,
        "ok": not problems,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--backup", type=Path, help="要演练的备份文件")
    group.add_argument("--latest", action="store_true", help="演练备份目录里最新的一份")
    parser.add_argument(
        "--directory",
        type=Path,
        default=Path("/var/backups/knownmap"),
        help="备份目录，配合 --latest",
    )
    parser.add_argument("--json", action="store_true", help="输出 JSON")
    args = parser.parse_args()

    backup = latest_backup(args.directory) if args.latest else args.backup
    result = check_restore(backup)

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"备份：{result['backup']}（{result['bytes']} 字节）")
        print(f"迁移版本：{result['migration']}")
        for table, count in sorted(result["counts"].items()):
            print(f"  {table}: {count}")
        if result["problems"]:
            print("\n问题：")
            for problem in result["problems"]:
                print(f"  - {problem}")
        else:
            print("\n恢复演练通过：结构完整，归属关系一致。")

    sys.exit(0 if result["ok"] else 1)


if __name__ == "__main__":
    main()
