"""scoped access grants

Revision ID: 0009_access_grants
Revises: 0008_multi_lesson_courses
"""

from collections.abc import Sequence
from uuid import uuid4

import sqlalchemy as sa
from alembic import op


revision: str = "0009_access_grants"
down_revision: str | None = "0008_multi_lesson_courses"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "access_grants",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("access_code_id", sa.String(length=36), nullable=False),
        sa.Column("course_id", sa.String(length=36), nullable=False),
        sa.Column("lesson_id", sa.String(length=36), nullable=True),
        sa.Column("node_id", sa.String(length=80), nullable=True),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "node_id IS NULL OR lesson_id IS NOT NULL",
            name="ck_access_grants_node_requires_lesson",
        ),
        sa.ForeignKeyConstraint(["access_code_id"], ["access_codes.id"]),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"]),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_access_grants_access_code_id"),
        "access_grants",
        ["access_code_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_access_grants_course_id"),
        "access_grants",
        ["course_id"],
        unique=False,
    )

    access_grants = sa.table(
        "access_grants",
        sa.column("id", sa.String),
        sa.column("access_code_id", sa.String),
        sa.column("course_id", sa.String),
    )
    connection = op.get_bind()
    existing_codes = connection.execute(
        sa.text("SELECT id, course_id FROM access_codes")
    ).mappings()
    rows = [
        {
            "id": str(uuid4()),
            "access_code_id": row["id"],
            "course_id": row["course_id"],
        }
        for row in existing_codes
    ]
    if rows:
        connection.execute(access_grants.insert(), rows)


def downgrade() -> None:
    op.drop_index(op.f("ix_access_grants_course_id"), table_name="access_grants")
    op.drop_index(op.f("ix_access_grants_access_code_id"), table_name="access_grants")
    op.drop_table("access_grants")
