from datetime import datetime, timedelta, timezone
from hashlib import sha256
import hmac
import secrets

from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from app.models.teacher import Teacher
from app.models.teacher_session import TeacherSession
from app.repositories.teacher_repository import get_teacher_by_login_name

password_hash = PasswordHash.recommended()


def normalize_login_name(login_name: str) -> str:
    return login_name.strip()


def hash_password(raw_password: str) -> str:
    return password_hash.hash(raw_password)


def verify_password(raw_password: str, stored_hash: str) -> bool:
    return password_hash.verify(raw_password, stored_hash)


def authenticate_teacher(
    session: Session,
    login_name: str,
    raw_password: str,
) -> Teacher | None:
    teacher = get_teacher_by_login_name(session, normalize_login_name(login_name))
    if teacher is None or teacher.status != "active":
        return None
    return teacher if verify_password(raw_password, teacher.password_hash) else None


def digest_session_token(token: str, session_secret: str) -> str:
    return hmac.new(
        session_secret.encode("utf-8"),
        token.encode("utf-8"),
        sha256,
    ).hexdigest()


def create_teacher_session(
    session: Session,
    teacher: Teacher,
    *,
    session_secret: str,
    ttl_seconds: int = 86400,
) -> tuple[str, TeacherSession]:
    raw_token = secrets.token_urlsafe(32)
    row = TeacherSession(
        teacher_id=teacher.id,
        token_digest=digest_session_token(raw_token, session_secret),
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds),
    )
    session.add(row)
    return raw_token, row


def revoke_teacher_session(row: TeacherSession) -> None:
    row.revoked_at = datetime.now(timezone.utc)
