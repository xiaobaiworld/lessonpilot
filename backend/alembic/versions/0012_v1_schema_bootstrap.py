"""Alembic migration: v1 identity models initialization (0012_v1_schema_bootstrap)

This is the v1 baseline migration. It creates:
- AdminAccount, AdminSession
- TeacherAccount, TeacherSession
- Workspace

No legacy tables are referenced; this is a clean slate.
"""

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    """Create v1 identity schema."""

    # AdminAccount
    op.create_table(
        'v1_admin_accounts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('credential_version', sa.Integer(), default=1, nullable=False),
        sa.Column('status', sa.Enum('active', 'suspended', 'archived', name='admin_status'), default='active', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_admin_accounts_email', 'v1_admin_accounts', ['email'])

    # AdminSession
    op.create_table(
        'v1_admin_sessions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('admin_id', sa.String(36), sa.ForeignKey('v1_admin_accounts.id'), nullable=False),
        sa.Column('token_digest', sa.String(64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_admin_sessions_admin_id', 'v1_admin_sessions', ['admin_id'])
    op.create_index('ix_admin_sessions_token_digest', 'v1_admin_sessions', ['token_digest'])

    # TeacherAccount
    op.create_table(
        'v1_teacher_accounts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('login_name', sa.String(255), unique=True, nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('credential_version', sa.Integer(), default=1, nullable=False),
        sa.Column('status', sa.Enum('active', 'suspended', 'archived', name='teacher_status'), default='active', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_teacher_accounts_login_name', 'v1_teacher_accounts', ['login_name'])

    # TeacherSession
    op.create_table(
        'v1_teacher_sessions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('teacher_id', sa.String(36), sa.ForeignKey('v1_teacher_accounts.id'), nullable=False),
        sa.Column('token_digest', sa.String(64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_teacher_sessions_teacher_id', 'v1_teacher_sessions', ['teacher_id'])
    op.create_index('ix_teacher_sessions_token_digest', 'v1_teacher_sessions', ['token_digest'])

    # Workspace
    op.create_table(
        'v1_workspaces',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('owner_teacher_id', sa.String(36), sa.ForeignKey('v1_teacher_accounts.id'), unique=True, nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('status', sa.String(50), default='active', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_workspaces_owner_teacher_id', 'v1_workspaces', ['owner_teacher_id'])


def downgrade() -> None:
    """Drop v1 identity schema (not supported; raise instead)."""
    raise NotImplementedError("v1 migrations do not support downgrade; restore from backup")
