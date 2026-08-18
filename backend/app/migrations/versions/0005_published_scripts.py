"""published scripts

Revision ID: 0005_published_scripts
Revises: 0004
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0005_published_scripts"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "published_scripts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("lesson_id", sa.String(length=36), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("config_json", sa.JSON(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("published_by", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"]),
        sa.ForeignKeyConstraint(["published_by"], ["teachers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("lesson_id", "version", name="uq_published_scripts_lesson_version"),
    )
    op.create_index(
        op.f("ix_published_scripts_lesson_id"),
        "published_scripts",
        ["lesson_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_published_scripts_lesson_id"), table_name="published_scripts")
    op.drop_table("published_scripts")
