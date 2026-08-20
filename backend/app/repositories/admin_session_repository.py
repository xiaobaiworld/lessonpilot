from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.admin_session import AdminSession


def get_active_admin_session(
    session: Session,
    token_digest: str,
    now: datetime | None = None,
) -> AdminSession | None:
    current_time = now or datetime.now(timezone.utc)
    return session.scalar(
        select(AdminSession).where(
            AdminSession.token_digest == token_digest,
            AdminSession.revoked_at.is_(None),
            AdminSession.expires_at > current_time,
        )
    )
