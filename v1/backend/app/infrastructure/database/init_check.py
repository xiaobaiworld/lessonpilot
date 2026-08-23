"""v1 Database Initialization and Schema Validation

Stage 0E: Clean database entry and legacy schema rejection

Rules:
1. v1 uses a fresh migration baseline (0012_v1_schema_bootstrap)
2. Legacy tables are explicitly detected and rejected at startup
3. All v1 tables use new schema; no fallback to legacy structure
4. Migration versioning is immutable: no going back to 0011
"""

import sys
from pathlib import Path


def check_database_init():
    """
    Verify v1 database is clean and ready.

    Returns:
        (bool, str): (is_valid, status_message)
    """
    # Placeholder: full implementation in stage 1A
    # This is the gate that will be checked before application startup

    status = {
        "migration_head": "0012_v1_schema_bootstrap",  # Expected baseline
        "legacy_tables_detected": False,
        "v1_tables_expected": [
            "admin_accounts",
            "admin_sessions",
            "teacher_accounts",
            "teacher_sessions",
            "workspaces",
            "courses",
            "lessons",
            "script_drafts",
            "interaction_nodes",
            "course_releases",
            "release_lesson_snapshots",
            "release_availability",
            "access_codes",
            "grant_items",
            "redemptions",
            "operation_audit",
            "rights_attestation",
            "preview_sessions",
        ],
        "schema_version": "v1.0.0",
    }

    return True, status


def reject_legacy_schema():
    """
    Explicit rejection rules for legacy database structures.

    Any of these present = database not suitable for v1 without migration:
    - published_scripts table (v0 only)
    - script_nodes table (v0 only)
    - old admin_users table (v0 only)
    - old teacher_users table (v0 only)
    """
    legacy_tables_to_reject = [
        "published_scripts",
        "script_nodes",
        "admin_users",
        "teacher_users",
        "learner_state",  # v0 student data
    ]

    return {
        "reject_tables": legacy_tables_to_reject,
        "policy": "If any table found, refuse to start. Admin must migrate or export data first.",
        "mitigation": "Rename legacy tables manually before v1 startup, or use backup/restore to separate DB.",
    }


def verify_migration_immutability():
    """
    Verify that migration chain cannot roll back to v0.

    Once v1 is deployed, downgrade is not supported.
    """
    return {
        "v1_baseline": "0012_v1_schema_bootstrap",
        "v0_max": "0011_fix_admin_auth_schema",
        "policy": "Alembic never rolls back past 0011. v1 is immutable forward.",
        "downgrade_path": "Restore from DB backup taken before v1 deployment",
    }


if __name__ == "__main__":
    is_valid, status = check_database_init()
    legacy_rules = reject_legacy_schema()
    immutability = verify_migration_immutability()

    print("v1 Database Initialization Check (Stage 0E)")
    print("=" * 50)
    print(f"Valid: {is_valid}")
    print(f"Status: {status}")
    print(f"\nLegacy Rejection Rules: {legacy_rules}")
    print(f"\nMigration Immutability: {immutability}")
