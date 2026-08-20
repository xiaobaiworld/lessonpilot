"""allow multiple lessons per course

Revision ID: 0008_multi_lesson_courses
Revises: 0007_access_code_types
"""

from collections.abc import Sequence

from alembic import op


revision: str = "0008_multi_lesson_courses"
down_revision: str | None = "0007_access_code_types"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NAMING_CONVENTION = {
    "uq": "uq_%(table_name)s_%(column_0_name)s",
}


def upgrade() -> None:
    with op.batch_alter_table(
        "lessons",
        recreate="always",
        naming_convention=NAMING_CONVENTION,
    ) as batch_op:
        batch_op.drop_constraint("uq_lessons_course_id", type_="unique")


def downgrade() -> None:
    with op.batch_alter_table(
        "lessons",
        recreate="always",
        naming_convention=NAMING_CONVENTION,
    ) as batch_op:
        batch_op.create_unique_constraint("uq_lessons_course_id", ["course_id"])
