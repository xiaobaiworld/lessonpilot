"""v1 Identity models - AdminAccount, TeacherAccount, Sessions, Workspace

Stage 1B: Create schemas and migrations for:
- AdminAccount with Argon2 password hash
- TeacherAccount with credential versioning
- AdminSession and TeacherSession with HMAC token digests
- Workspace with explicit owner and status
"""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum, Index
from sqlalchemy.orm import relationship
import enum

from app.infrastructure.database.base import Base


class AdminStatus(str, enum.Enum):
    """Administrator account status."""

    active = "active"
    suspended = "suspended"
    archived = "archived"


class TeacherStatus(str, enum.Enum):
    """Teacher account status."""

    active = "active"
    suspended = "suspended"
    archived = "archived"


class AdminAccount(Base):
    """v1 Administrator account.

    - login_name is the unique login identifier per administrator
    - password_hash stores Argon2 digest (never plaintext)
    - credential_version invalidates all sessions on password change
    """

    __tablename__ = "v1_admin_accounts"

    id = Column(String(36), primary_key=True)  # UUID
    login_name = Column(String(80), unique=True, nullable=False)
    display_name = Column(String(120), nullable=False)
    password_hash = Column(String(255), nullable=False)  # Argon2 digest
    credential_version = Column(Integer, default=1, nullable=False)
    status = Column(Enum(AdminStatus), default=AdminStatus.active, nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    sessions = relationship("AdminSession", back_populates="account", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_admin_accounts_login_name", "login_name"),)


class AdminSession(Base):
    """v1 Administrator session.

    - token_digest stores HMAC digest of session token (never plaintext)
    - admin_id + token_digest uniqueness prevents duplicates
    - expires_at + revoked_at handle lifecycle
    """

    __tablename__ = "v1_admin_sessions"

    id = Column(String(36), primary_key=True)  # UUID
    admin_id = Column(String(36), ForeignKey("v1_admin_accounts.id"), nullable=False)
    token_digest = Column(String(64), nullable=False)  # SHA256 hex
    credential_version = Column(Integer, nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    account = relationship("AdminAccount", back_populates="sessions")

    __table_args__ = (
        Index("ix_admin_sessions_admin_id", "admin_id"),
        Index("ix_admin_sessions_token_digest", "token_digest"),
    )


class TeacherAccount(Base):
    """v1 Teacher account.

    - login_name is the unique identifier (normalized)
    - password_hash stores Argon2 digest
    - credential_version invalidates all sessions on password change
    - v1: one teacher has exactly one workspace (see Workspace.owner_teacher_id)
    """

    __tablename__ = "v1_teacher_accounts"

    id = Column(String(36), primary_key=True)  # UUID
    login_name = Column(String(255), unique=True, nullable=False)
    display_name = Column(String(120), nullable=False)
    password_hash = Column(String(255), nullable=False)  # Argon2 digest
    credential_version = Column(Integer, default=1, nullable=False)
    status = Column(Enum(TeacherStatus), default=TeacherStatus.active, nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    sessions = relationship(
        "TeacherSession", back_populates="account", cascade="all, delete-orphan"
    )
    workspace = relationship("Workspace", back_populates="owner", uselist=False)

    __table_args__ = (Index("ix_teacher_accounts_login_name", "login_name"),)


class TeacherSession(Base):
    """v1 Teacher session.

    - token_digest stores HMAC digest of session token (never plaintext)
    - expires_at + revoked_at handle lifecycle
    """

    __tablename__ = "v1_teacher_sessions"

    id = Column(String(36), primary_key=True)  # UUID
    teacher_id = Column(String(36), ForeignKey("v1_teacher_accounts.id"), nullable=False)
    token_digest = Column(String(64), nullable=False)  # SHA256 hex
    credential_version = Column(Integer, nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    account = relationship("TeacherAccount", back_populates="sessions")

    __table_args__ = (
        Index("ix_teacher_sessions_teacher_id", "teacher_id"),
        Index("ix_teacher_sessions_token_digest", "token_digest"),
    )
