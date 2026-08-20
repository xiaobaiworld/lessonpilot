"""fix administrator authentication schema

Revision ID: 0011_fix_admin_auth_schema
Revises: 0010_admin_auth
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011_fix_admin_auth_schema"
down_revision: str | None = "0010_admin_auth"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_UNIQUE_NAMING_CONVENTION = {
    "uq": "uq_%(table_name)s_%(column_0_name)s",
}


def upgrade() -> None:
    op.get_bind().execute(
        sa.text(
            "DELETE FROM admin_sessions "
            "WHERE NOT EXISTS ("
            "SELECT 1 FROM admins WHERE admins.id = admin_sessions.admin_id"
            ")"
        )
    )

    with op.batch_alter_table(
        "admins",
        recreate="always",
        naming_convention=_UNIQUE_NAMING_CONVENTION,
    ) as batch_op:
        batch_op.drop_constraint("uq_admins_login_name", type_="unique")
        batch_op.drop_index("ix_admins_login_name")
        batch_op.alter_column(
            "status",
            existing_type=sa.String(length=20),
            existing_nullable=False,
            server_default=None,
        )
        batch_op.create_index("ix_admins_login_name", ["login_name"], unique=True)

    with op.batch_alter_table(
        "admin_sessions",
        recreate="always",
        naming_convention=_UNIQUE_NAMING_CONVENTION,
    ) as batch_op:
        batch_op.drop_constraint("uq_admin_sessions_token_digest", type_="unique")
        batch_op.drop_index("ix_admin_sessions_admin_id")
        batch_op.drop_index("ix_admin_sessions_token_digest")
        batch_op.create_index("ix_admin_sessions_admin_id", ["admin_id"], unique=False)
        batch_op.create_index(
            "ix_admin_sessions_token_digest",
            ["token_digest"],
            unique=True,
        )


def downgrade() -> None:
    with op.batch_alter_table(
        "admin_sessions",
        recreate="always",
        table_args=(sa.UniqueConstraint("token_digest"),),
    ) as batch_op:
        batch_op.drop_index("ix_admin_sessions_admin_id")
        batch_op.drop_index("ix_admin_sessions_token_digest")
        batch_op.create_index("ix_admin_sessions_admin_id", ["admin_id"], unique=False)
        batch_op.create_index(
            "ix_admin_sessions_token_digest",
            ["token_digest"],
            unique=False,
        )

    with op.batch_alter_table(
        "admins",
        recreate="always",
        table_args=(sa.UniqueConstraint("login_name"),),
    ) as batch_op:
        batch_op.drop_index("ix_admins_login_name")
        batch_op.alter_column(
            "status",
            existing_type=sa.String(length=20),
            existing_nullable=False,
            server_default="active",
        )
        batch_op.create_index("ix_admins_login_name", ["login_name"], unique=False)
