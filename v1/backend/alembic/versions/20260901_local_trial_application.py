"""Replace Feishu followups with the local trial application model."""

from alembic import op
import sqlalchemy as sa


revision = "20260901_local_trial_application"
down_revision = "20260828_bilibili_video_reference"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 开发阶段没有需要迁移的飞书业务数据；旧跟进表只含外部记录引用，直接重建为本地关系。
    op.drop_table("v1_trial_followups")
    op.create_table(
        "v1_trial_applications",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("contact", sa.String(length=255), nullable=False),
        sa.Column("course_category", sa.String(length=120), nullable=False),
        sa.Column("video_status", sa.String(length=120), nullable=False),
        sa.Column("bilibili_url", sa.String(length=500), nullable=True),
        sa.Column("teaching_problem", sa.Text(), nullable=False),
        sa.Column("subtitle_status", sa.String(length=120), nullable=False),
        sa.Column("validation_question", sa.Text(), nullable=True),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_trial_applications_submitted_at",
        "v1_trial_applications",
        ["submitted_at"],
        unique=False,
    )
    op.create_table(
        "v1_trial_followups",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("trial_application_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("teacher_id", sa.String(length=36), nullable=True),
        sa.Column("updated_by_admin_id", sa.String(length=36), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["trial_application_id"], ["v1_trial_applications.id"]),
        sa.ForeignKeyConstraint(["updated_by_admin_id"], ["v1_admin_accounts.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("trial_application_id"),
    )


def downgrade() -> None:
    raise NotImplementedError("v1 不支持降级；开发阶段重建空数据库")
