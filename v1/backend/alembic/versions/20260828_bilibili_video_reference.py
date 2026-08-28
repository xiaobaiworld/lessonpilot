"""Persist the Bilibili page and content identifiers for lesson references."""

from alembic import op
import sqlalchemy as sa


revision = "20260828_bilibili_video_reference"
down_revision = "20260828_access_code_management"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "v1_video_references",
        sa.Column("page", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column("v1_video_references", sa.Column("cid", sa.String(length=64), nullable=True))
    op.add_column(
        "v1_release_lesson_snapshots",
        sa.Column("video_page", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "v1_release_lesson_snapshots",
        sa.Column("video_cid", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_video_references_platform_page_cid",
        "v1_video_references",
        ["platform", "platform_video_id", "page", "cid"],
        unique=False,
    )


def downgrade() -> None:
    raise NotImplementedError("v1 不支持降级；开发阶段重建空数据库")
