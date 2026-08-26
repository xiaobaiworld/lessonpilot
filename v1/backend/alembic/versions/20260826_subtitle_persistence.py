"""Persist teacher-side subtitle documents in release snapshots."""

from alembic import op
import sqlalchemy as sa


revision = "20260826_subtitle_persistence"
down_revision = "20260826_rich_node_assets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "v1_release_lesson_snapshots",
        sa.Column("subtitle", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    raise NotImplementedError("v1 不支持降级；开发阶段重建空数据库")
