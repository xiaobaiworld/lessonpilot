"""v1 Database Initialization Test

Verifies:
1. Clean database startup gate
2. Legacy schema rejection
3. Migration immutability
"""

import sys
import pytest


def test_v1_database_init_check():
    """Verify v1 database init logic."""
    from .init_check import check_database_init, reject_legacy_schema, verify_migration_immutability

    is_valid, status = check_database_init()
    assert is_valid, "Database init should return valid for clean DB"
    assert status["migration_head"] == "0012_v1_schema_bootstrap"
    assert status["schema_version"] == "v1.0.0"


def test_legacy_schema_rejection():
    """Verify legacy tables are in the rejection list."""
    from .init_check import reject_legacy_schema

    rules = reject_legacy_schema()
    legacy_tables = rules["reject_tables"]

    assert "published_scripts" in legacy_tables, "v0 published_scripts should be rejected"
    assert "script_nodes" in legacy_tables, "v0 script_nodes should be rejected"
    assert "admin_users" in legacy_tables, "v0 admin_users should be rejected"
    assert "learner_state" in legacy_tables, "v0 learner_state should be rejected"


def test_migration_immutability():
    """Verify migration chain immutability."""
    from .init_check import verify_migration_immutability

    rules = verify_migration_immutability()
    assert rules["v1_baseline"] == "0012_v1_schema_bootstrap"
    assert rules["v0_max"] == "0011_fix_admin_auth_schema"
    assert "immutable forward" in rules["policy"].lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
