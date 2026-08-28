"""Add teacher-side access code recipient fields."""

from alembic import op
import sqlalchemy as sa


revision = "20260828_access_code_management"
down_revision = "20260827_course_version_operations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("v1_access_codes", sa.Column("recipient_label", sa.String(200), nullable=True))
    op.add_column("v1_access_codes", sa.Column("recipient_note", sa.String(1000), nullable=True))
    op.add_column("v1_operation_audit", sa.Column("idempotency_key", sa.String(64), nullable=True))


def downgrade() -> None:
    raise NotImplementedError("v1 不支持降级；开发阶段重建空数据库")
