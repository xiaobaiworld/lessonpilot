from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.access_code import AccessCode


def get_access_code_by_digest(session: Session, digest: str) -> AccessCode | None:
    return session.scalar(select(AccessCode).where(AccessCode.code_digest == digest))


def add_access_code(session: Session, code: AccessCode) -> AccessCode:
    session.add(code)
    return code
