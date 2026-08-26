"""Store immutable node asset manifests with draft release snapshots.

The binary is intentionally not stored in the database. These JSON columns keep
the portable metadata and make the published snapshot self-describing.
"""

from alembic import op
import sqlalchemy as sa


revision = "20260826_rich_node_assets"
down_revision = "c9b7a7b60da5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "v1_release_lesson_snapshots",
        sa.Column("assets", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
    )


def downgrade() -> None:
    raise NotImplementedError("v1 不支持降级；开发阶段重建空数据库")
