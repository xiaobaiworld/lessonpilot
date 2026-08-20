from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.access_grant import AccessGrant


def add_access_grants(session: Session, grants: list[AccessGrant]) -> list[AccessGrant]:
    session.add_all(grants)
    return grants


def list_access_grants_by_code(
    session: Session,
    access_code_id: str,
) -> list[AccessGrant]:
    return list(
        session.scalars(
            select(AccessGrant)
            .where(AccessGrant.access_code_id == access_code_id)
            .order_by(
                AccessGrant.course_id,
                AccessGrant.lesson_id,
                AccessGrant.node_id,
                AccessGrant.id,
            )
        ).all()
    )
