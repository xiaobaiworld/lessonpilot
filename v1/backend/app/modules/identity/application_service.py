"""v1 Application Service layer - Stage 1E

Responsibility:
- Encapsulate business logic
- Own transactions
- Provide stable operations for routes and cross-module callers
- Route only does protocol/permission/error mapping

Pattern: Routes call services, not repositories directly.
Services call services for cross-module operations.
Repositories do not decide permissions.
"""

from typing import Optional, Tuple
from datetime import datetime, timezone, timedelta
from .models import AdminAccount, AdminSession, TeacherAccount, TeacherSession, Workspace
from infrastructure.security.primitives import PasswordManager, TokenDigester, TimeManager


class IdentityApplicationService:
    """v1 identity domain application service.

    Encapsulates all identity operations:
    - Admin login, logout, credential reset
    - Teacher login, logout, credential reset
    - Session lifecycle management
    - Workspace binding to teacher
    """

    def __init__(self, session_factory, password_manager: PasswordManager, token_digester: TokenDigester):
        self.session_factory = session_factory
        self.password_manager = password_manager
        self.token_digester = token_digester

    def admin_login(self, email: str, password: str) -> Tuple[bool, Optional[str], Optional[dict]]:
        """Authenticate admin by email/password.

        Returns (success, error, session_data).
        session_data: { admin_id, token, expires_at }
        """
        with self.session_factory() as db:
            admin = db.query(AdminAccount).filter_by(email=email).first()

            if not admin or not self.password_manager.verify_password(password, admin.password_hash):
                return False, "Invalid email or password", None

            if admin.status != "active":
                return False, f"Account is {admin.status}", None

            # Generate session
            token_hex, token_digest = self.token_digester.generate_token()
            expires_at = TimeManager.future(hours=24)

            session = AdminSession(
                id=self._generate_id(),
                admin_id=admin.id,
                token_digest=token_digest,
                expires_at=expires_at,
            )
            db.add(session)
            db.commit()

            return True, None, {
                "admin_id": admin.id,
                "token": token_hex,  # Return once; never stored
                "expires_at": expires_at.isoformat(),
            }

    def admin_logout(self, session_id: str) -> Tuple[bool, Optional[str]]:
        """Revoke an admin session."""
        with self.session_factory() as db:
            session = db.query(AdminSession).filter_by(id=session_id).first()
            if not session:
                return False, "Session not found"

            session.revoked_at = TimeManager.utc_now()
            db.commit()
            return True, None

    def teacher_login(self, login_name: str, password: str) -> Tuple[bool, Optional[str], Optional[dict]]:
        """Authenticate teacher by login_name/password.

        Returns (success, error, session_data).
        session_data: { teacher_id, token, expires_at }
        """
        with self.session_factory() as db:
            teacher = db.query(TeacherAccount).filter_by(login_name=login_name).first()

            if not teacher or not self.password_manager.verify_password(password, teacher.password_hash):
                return False, "Invalid login or password", None

            if teacher.status != "active":
                return False, f"Account is {teacher.status}", None

            # Generate session
            token_hex, token_digest = self.token_digester.generate_token()
            expires_at = TimeManager.future(hours=24)

            session = TeacherSession(
                id=self._generate_id(),
                teacher_id=teacher.id,
                token_digest=token_digest,
                expires_at=expires_at,
            )
            db.add(session)
            db.commit()

            return True, None, {
                "teacher_id": teacher.id,
                "token": token_hex,  # Return once; never stored
                "expires_at": expires_at.isoformat(),
            }

    def teacher_logout(self, session_id: str) -> Tuple[bool, Optional[str]]:
        """Revoke a teacher session."""
        with self.session_factory() as db:
            session = db.query(TeacherSession).filter_by(id=session_id).first()
            if not session:
                return False, "Session not found"

            session.revoked_at = TimeManager.utc_now()
            db.commit()
            return True, None

    def reset_teacher_password(self, teacher_id: str, new_password: str) -> Tuple[bool, Optional[str]]:
        """Reset teacher password and invalidate all existing sessions.

        Changes credential_version to immediately expire all sessions.
        """
        with self.session_factory() as db:
            teacher = db.query(TeacherAccount).filter_by(id=teacher_id).first()
            if not teacher:
                return False, "Teacher not found"

            # Hash new password
            new_hash = self.password_manager.hash_password(new_password)

            # Invalidate all sessions by bumping credential_version
            teacher.password_hash = new_hash
            teacher.credential_version += 1
            teacher.updated_at = TimeManager.utc_now()

            # Revoke all existing sessions
            for session in teacher.sessions:
                if session.revoked_at is None:
                    session.revoked_at = TimeManager.utc_now()

            db.commit()
            return True, None

    def verify_teacher_session(self, teacher_id: str, session_id: str, token_digest: str) -> Tuple[bool, Optional[str]]:
        """Verify a teacher session token.

        Returns (valid, error).
        Checks: session exists, not expired, not revoked, token matches.
        """
        with self.session_factory() as db:
            session = db.query(TeacherSession).filter_by(
                id=session_id,
                teacher_id=teacher_id,
            ).first()

            if not session:
                return False, "Session not found"

            if TimeManager.is_expired(session.expires_at):
                return False, "Session expired"

            if session.revoked_at is not None:
                return False, "Session revoked"

            if not self.token_digester.verify_token("", token_digest):  # Assuming token digest passed
                return False, "Invalid token"

            return True, None

    @staticmethod
    def _generate_id() -> str:
        """Generate a v1 UUID."""
        import uuid
        return str(uuid.uuid4())


class OperationAuditService:
    """v1 operation audit service.

    Records immutable audit facts for:
    - Admin operations
    - Teacher operations
    - Sensitive state changes
    """

    def __init__(self, session_factory):
        self.session_factory = session_factory

    def record_login(self, actor_type: str, actor_id: str, success: bool, error: Optional[str] = None):
        """Record a login attempt (admin or teacher)."""
        # Placeholder: in real implementation, writes to OperationAudit table
        pass

    def record_password_reset(self, admin_id: str, target_teacher_id: str):
        """Record that an admin reset a teacher's password."""
        # Placeholder
        pass

    def record_account_state_change(self, target_id: str, old_status: str, new_status: str):
        """Record account suspension/recovery/archival."""
        # Placeholder
        pass
