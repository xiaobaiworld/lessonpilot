"""access codes

Revision ID: 0006_access_codes
Revises: 0005_published_scripts
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0006_access_codes"
down_revision: str | None = "0005_published_scripts"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "access_codes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("course_id", sa.String(length=36), nullable=False),
        sa.Column("code_digest", sa.String(length=64), nullable=False),
        sa.Column("code_hint", sa.String(length=5), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_access_codes_course_id"), "access_codes", ["course_id"], unique=False)
    op.create_index(
        op.f("ix_access_codes_code_digest"),
        "access_codes",
        ["code_digest"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_access_codes_code_digest"), table_name="access_codes")
    op.drop_index(op.f("ix_access_codes_course_id"), table_name="access_codes")
    op.drop_table("access_codes")
