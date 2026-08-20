#!/usr/bin/env python3

import argparse
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import sqlite3


def create_backup(
    database_path: Path,
    backup_directory: Path,
    *,
    retention_days=14,
) -> Path:
    backup_directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(backup_directory, 0o700)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    destination = backup_directory / f"knownmap-{timestamp}.db"
    temporary = destination.with_suffix(".db.next")

    source_uri = f"file:{database_path}?mode=ro"
    with sqlite3.connect(source_uri, uri=True) as source:
        with sqlite3.connect(temporary) as target:
            source.backup(target)
            integrity = target.execute("PRAGMA integrity_check").fetchone()
            if integrity != ("ok",):
                raise RuntimeError(f"backup integrity check failed: {integrity!r}")

    os.chmod(temporary, 0o600)
    os.replace(temporary, destination)

    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    for candidate in backup_directory.glob("knownmap-*.db"):
        if candidate == destination:
            continue
        modified = datetime.fromtimestamp(candidate.stat().st_mtime, timezone.utc)
        if modified < cutoff:
            candidate.unlink()

    return destination


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--database",
        type=Path,
        default=Path("/var/lib/knownmap/knownmap.db"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("/var/backups/knownmap"),
    )
    parser.add_argument("--retention-days", type=int, default=14)
    args = parser.parse_args()

    if args.retention_days < 1:
        raise SystemExit("retention days must be positive")
    if not args.database.is_file():
        raise SystemExit(f"database does not exist: {args.database}")

    backup = create_backup(
        args.database,
        args.output,
        retention_days=args.retention_days,
    )
    print(backup)


if __name__ == "__main__":
    main()
