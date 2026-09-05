import secrets
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy.orm import Session

from app.infrastructure.security.primitives import PasswordManager, TimeManager, TokenDigester
from app.modules.identity import repository
from app.modules.identity.models import (
    AdminAccount,
    AdminSession,
    AdminStatus,
    TeacherAccount,
    TeacherSession,
    TeacherStatus,
)

_PASSWORD_MANAGER = PasswordManager()
_DUMMY_PASSWORD_HASH = _PASSWORD_MANAGER.hash_password(secrets.token_urlsafe(32))


class IdentityApplicationService:
    def __init__(self, session: Session, session_secret: str, ttl_seconds: int = 86400):
        self.session = session
        self.session_secret = session_secret
        self.passwords = _PASSWORD_MANAGER
        self.tokens = TokenDigester(self.session_secret.encode("utf-8"))
        self.ttl_seconds = ttl_seconds
        self._dummy_password_hash = _DUMMY_PASSWORD_HASH

    @staticmethod
    def normalize_login_name(login_name: str) -> str:
        return login_name.strip()

    def seed_admin(self, login_name: str, display_name: str, password: str) -> AdminAccount:
        normalized = self.normalize_login_name(login_name)
        if existing := repository.get_admin_by_login_name(self.session, normalized):
            return existing
        admin = AdminAccount(
            id=str(uuid4()),
            login_name=normalized,
            display_name=display_name.strip(),
            password_hash=self.passwords.hash_password(password),
            status=AdminStatus.active,
        )
        self.session.add(admin)
        self.session.commit()
        return admin

    def admin_login(self, login_name: str, password: str) -> tuple[AdminAccount, str] | None:
        admin = repository.get_admin_by_login_name(
            self.session, self.normalize_login_name(login_name)
        )
        stored_hash = admin.password_hash if admin else self._dummy_password_hash
        password_matches = self.passwords.verify_password(password, stored_hash)
        if not admin or admin.status != AdminStatus.active or not password_matches:
            return None
        raw_token, digest = self.tokens.generate_token()
        self.session.add(
            AdminSession(
                id=str(uuid4()),
                admin_id=admin.id,
                token_digest=digest,
                credential_version=admin.credential_version,
                expires_at=TimeManager.future(hours=self.ttl_seconds / 3600),
            )
        )
        self.session.commit()
        return admin, raw_token

    def teacher_login(self, login_name: str, password: str) -> tuple[TeacherAccount, str] | None:
        teacher = repository.get_teacher_by_login_name(
            self.session, self.normalize_login_name(login_name)
        )
        stored_hash = teacher.password_hash if teacher else self._dummy_password_hash
        password_matches = self.passwords.verify_password(password, stored_hash)
        if not teacher or teacher.status != TeacherStatus.active or not password_matches:
            return None
        raw_token, digest = self.tokens.generate_token()
        self.session.add(
            TeacherSession(
                id=str(uuid4()),
                teacher_id=teacher.id,
                token_digest=digest,
                credential_version=teacher.credential_version,
                expires_at=TimeManager.future(hours=self.ttl_seconds / 3600),
            )
        )
        self.session.commit()
        return teacher, raw_token

    def resolve_admin(self, raw_token: str | None) -> AdminAccount | None:
        if not raw_token:
            return None
        try:
            digest = self.tokens.digest_only(raw_token)
        except Exception:  # noqa: BLE001 - 非法 Cookie 统一按未登录处理
            return None
        row = repository.get_admin_session_by_digest(self.session, digest)
        if not row or row.revoked_at or TimeManager.is_expired(row.expires_at):
            return None
        admin = row.account
        if admin.status != AdminStatus.active or row.credential_version != admin.credential_version:
            return None
        return admin

    def resolve_teacher(self, raw_token: str | None) -> TeacherAccount | None:
        if not raw_token:
            return None
        try:
            digest = self.tokens.digest_only(raw_token)
        except Exception:  # noqa: BLE001 - 非法 Cookie 统一按未登录处理
            return None
        row = repository.get_teacher_session_by_digest(self.session, digest)
        if not row or row.revoked_at or TimeManager.is_expired(row.expires_at):
            return None
        teacher = row.account
        if (
            teacher.status != TeacherStatus.active
            or row.credential_version != teacher.credential_version
        ):
            return None
        return teacher

    def revoke_admin_session(self, raw_token: str | None) -> None:
        row = self._admin_session(raw_token)
        if row:
            row.revoked_at = datetime.now(timezone.utc)
            self.session.commit()

    def change_admin_password(
        self,
        admin: AdminAccount,
        current_password: str,
        new_password: str,
        confirm_password: str,
    ) -> bool:
        if new_password != confirm_password:
            raise ValueError("ADMIN_PASSWORD_CONFIRMATION_MISMATCH")
        if not self.passwords.verify_password(current_password, admin.password_hash):
            return False

        now = datetime.now(timezone.utc)
        admin.password_hash = self.passwords.hash_password(new_password)
        admin.credential_version += 1
        admin.updated_at = now
        for session in admin.sessions:
            if session.revoked_at is None:
                session.revoked_at = now
        self.session.commit()
        return True

    def revoke_teacher_session(self, raw_token: str | None) -> None:
        row = self._teacher_session(raw_token)
        if row:
            row.revoked_at = datetime.now(timezone.utc)
            self.session.commit()

    def _admin_session(self, raw_token: str | None) -> AdminSession | None:
        if not raw_token:
            return None
        try:
            return repository.get_admin_session_by_digest(
                self.session, self.tokens.digest_only(raw_token)
            )
        except Exception:  # noqa: BLE001
            return None

    def _teacher_session(self, raw_token: str | None) -> TeacherSession | None:
        if not raw_token:
            return None
        try:
            return repository.get_teacher_session_by_digest(
                self.session, self.tokens.digest_only(raw_token)
            )
        except Exception:  # noqa: BLE001
            return None

    def create_teacher(self, login_name: str, display_name: str) -> tuple[TeacherAccount, str]:
        normalized = self.normalize_login_name(login_name)
        if repository.get_teacher_by_login_name(self.session, normalized):
            raise ValueError("TEACHER_LOGIN_NAME_EXISTS")
        temporary_password = secrets.token_urlsafe(18)
        teacher = TeacherAccount(
            id=str(uuid4()),
            login_name=normalized,
            display_name=display_name.strip(),
            password_hash=self.passwords.hash_password(temporary_password),
            status=TeacherStatus.active,
        )
        self.session.add(teacher)
        self.session.flush()
        return teacher, temporary_password

    def reset_teacher_password(self, teacher_id: str) -> tuple[TeacherAccount, str] | None:
        teacher = repository.get_teacher_by_id(self.session, teacher_id)
        if not teacher:
            return None
        temporary_password = secrets.token_urlsafe(18)
        teacher.password_hash = self.passwords.hash_password(temporary_password)
        teacher.credential_version += 1
        teacher.updated_at = datetime.now(timezone.utc)
        self.session.commit()
        return teacher, temporary_password

    def set_teacher_status(self, teacher_id: str, status: TeacherStatus) -> TeacherAccount | None:
        teacher = repository.get_teacher_by_id(self.session, teacher_id)
        if not teacher:
            return None
        teacher.status = status
        if status != TeacherStatus.active:
            teacher.credential_version += 1
        teacher.updated_at = datetime.now(timezone.utc)
        self.session.commit()
        return teacher
