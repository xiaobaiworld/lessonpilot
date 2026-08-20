"""access code types and expiration

Revision ID: 0007_access_code_types
Revises: 0006_access_codes
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0007_access_code_types"
down_revision: str | None = "0006_access_codes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "access_codes",
        sa.Column(
            "code_type",
            sa.String(length=20),
            server_default="long_term",
            nullable=False,
        ),
    )
    op.add_column(
        "access_codes",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("access_codes", "expires_at")
    op.drop_column("access_codes", "code_type")
