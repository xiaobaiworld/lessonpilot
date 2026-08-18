"""create teacher accounts and sessions

Revision ID: 0002_teacher_auth
Revises: 0001_operation_logs
Create Date: 2026-08-18
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0002_teacher_auth"
down_revision: str | None = "0001_operation_logs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "teachers",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("login_name", sa.String(length=80), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("login_name"),
    )
    op.create_index("ix_teachers_login_name", "teachers", ["login_name"])

    op.create_table(
        "teacher_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("teacher_id", sa.String(length=36), nullable=False),
        sa.Column("token_digest", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["teacher_id"], ["teachers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_digest"),
    )
    op.create_index("ix_teacher_sessions_teacher_id", "teacher_sessions", ["teacher_id"])
    op.create_index("ix_teacher_sessions_token_digest", "teacher_sessions", ["token_digest"])


def downgrade() -> None:
    op.drop_index("ix_teacher_sessions_token_digest", table_name="teacher_sessions")
    op.drop_index("ix_teacher_sessions_teacher_id", table_name="teacher_sessions")
    op.drop_table("teacher_sessions")
    op.drop_index("ix_teachers_login_name", table_name="teachers")
    op.drop_table("teachers")
