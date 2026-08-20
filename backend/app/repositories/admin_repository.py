from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.admin import Admin


def get_admin_by_login_name(session: Session, login_name: str) -> Admin | None:
    return session.scalar(select(Admin).where(Admin.login_name == login_name))


def get_admin_by_id(session: Session, admin_id: str) -> Admin | None:
    return session.get(Admin, admin_id)


def add_admin(session: Session, admin: Admin) -> Admin:
    session.add(admin)
    return admin
