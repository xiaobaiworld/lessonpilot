"""Add course lineage and atomic version-operation idempotency facts."""

from alembic import op
import sqlalchemy as sa


revision = "20260827_course_version_operations"
down_revision = "20260827_optional_rights_attestation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("v1_courses", sa.Column("version_family_id", sa.String(36), nullable=True))
    op.add_column("v1_courses", sa.Column("source_course_id", sa.String(36), nullable=True))
    op.add_column("v1_courses", sa.Column("source_release_id", sa.String(36), nullable=True))
    op.add_column(
        "v1_courses",
        sa.Column("version_number", sa.Integer(), nullable=False, server_default="1"),
    )
    op.execute("UPDATE v1_courses SET version_family_id = id WHERE version_family_id IS NULL")
    with op.batch_alter_table("v1_courses") as batch_op:
        batch_op.alter_column(
            "version_family_id", existing_type=sa.String(36), nullable=False
        )
    op.create_index(
        "ix_courses_version_family_id", "v1_courses", ["version_family_id"], unique=False
    )
    op.create_table(
        "v1_course_version_operations",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("teacher_id", sa.String(36), nullable=False),
        sa.Column("source_course_id", sa.String(36), nullable=False),
        sa.Column("source_release_id", sa.String(36), nullable=False),
        sa.Column("mode", sa.String(20), nullable=False),
        sa.Column("idempotency_key", sa.String(64), nullable=False),
        sa.Column("result_course_id", sa.String(36), nullable=False),
        sa.Column("source_retained", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["teacher_id"], ["v1_teacher_accounts.id"]),
        sa.ForeignKeyConstraint(["result_course_id"], ["v1_courses.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "teacher_id",
            "idempotency_key",
            name="uq_course_version_operations_teacher_intent",
        ),
    )
    op.create_index(
        "ix_course_version_operations_source_course",
        "v1_course_version_operations",
        ["source_course_id"],
        unique=False,
    )
    op.create_index(
        "ix_course_version_operations_result_course",
        "v1_course_version_operations",
        ["result_course_id"],
        unique=False,
    )


def downgrade() -> None:
    raise NotImplementedError("v1 不支持降级；开发阶段重建空数据库")
