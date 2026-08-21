from datetime import datetime, timedelta, timezone
from hashlib import sha256
import hmac
import secrets

from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError
from sqlalchemy.orm import Session

from app.models.admin import Admin
from app.models.admin_session import AdminSession
from app.repositories.admin_repository import (
    add_admin,
    get_admin_by_login_name,
)

admin_password_hash = PasswordHash.recommended()
DUMMY_ADMIN_PASSWORD_HASH = admin_password_hash.hash(secrets.token_urlsafe(32))


def normalize_admin_login_name(login_name: str) -> str:
    return login_name.strip()


def hash_admin_password(raw_password: str) -> str:
    return admin_password_hash.hash(raw_password)


def verify_admin_password(raw_password: str, stored_hash: str) -> bool:
    try:
        return admin_password_hash.verify(raw_password, stored_hash)
    except UnknownHashError:
        return False


def authenticate_admin(
    session: Session,
    login_name: str,
    raw_password: str,
) -> Admin | None:
    admin = get_admin_by_login_name(
        session,
        normalize_admin_login_name(login_name),
    )
    stored_hash = admin.password_hash if admin is not None else DUMMY_ADMIN_PASSWORD_HASH
    password_is_valid = verify_admin_password(raw_password, stored_hash)
    if admin is None or admin.status != "active" or not password_is_valid:
        return None
    return admin


def digest_admin_session_token(token: str, session_secret: str) -> str:
    return hmac.new(
        session_secret.encode("utf-8"),
        token.encode("utf-8"),
        sha256,
    ).hexdigest()


def create_admin_session(
    session: Session,
    admin: Admin,
    *,
    session_secret: str,
    ttl_seconds: int = 86400,
) -> tuple[str, AdminSession]:
    raw_token = secrets.token_urlsafe(32)
    row = AdminSession(
        admin_id=admin.id,
        token_digest=digest_admin_session_token(raw_token, session_secret),
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds),
    )
    session.add(row)
    return raw_token, row


def revoke_admin_session(row: AdminSession) -> None:
    row.revoked_at = datetime.now(timezone.utc)


def seed_admin_account(
    session: Session,
    *,
    login_name: str,
    password: str,
    display_name: str,
) -> Admin:
    normalized_login_name = normalize_admin_login_name(login_name)
    normalized_display_name = display_name.strip()
    if not normalized_login_name:
        raise ValueError("Admin login name must not be blank")
    if not password.strip():
        raise ValueError("Admin password must not be blank")
    if not normalized_display_name:
        raise ValueError("Admin display name must not be blank")

    existing = get_admin_by_login_name(session, normalized_login_name)
    if existing is not None:
        return existing

    admin = add_admin(
        session,
        Admin(
            login_name=normalized_login_name,
            password_hash=hash_admin_password(password),
            display_name=normalized_display_name,
            status="active",
        ),
    )
    session.flush()
    return admin
