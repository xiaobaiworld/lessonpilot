"""Make course release rights attestation optional (contract later)."""

from alembic import op
import sqlalchemy as sa


revision = "20260827_optional_rights_attestation"
down_revision = "20260826_subtitle_persistence"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("v1_course_releases") as batch_op:
        batch_op.alter_column(
            "rights_attestation_id",
            existing_type=sa.String(length=36),
            nullable=True,
        )


def downgrade() -> None:
    raise NotImplementedError("v1 不支持降级；开发阶段重建空数据库")
