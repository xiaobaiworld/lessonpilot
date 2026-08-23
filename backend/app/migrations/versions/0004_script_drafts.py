"""script drafts

Revision ID: 0004
Revises: 0003_courses_and_lessons
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0004"
down_revision: str | None = "0003_courses_and_lessons"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "script_drafts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("lesson_id", sa.String(length=36), nullable=False),
        sa.Column("schema_version", sa.Integer(), nullable=False),
        sa.Column("config_json", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("lesson_id", name="uq_script_drafts_lesson_id"),
    )
    op.create_index(
        op.f("ix_script_drafts_lesson_id"), "script_drafts", ["lesson_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_script_drafts_lesson_id"), table_name="script_drafts")
    op.drop_table("script_drafts")
