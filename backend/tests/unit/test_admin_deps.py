from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import Request

from app.api.errors import ApiError
from app.config import Settings
from app.seed import seed_teacher_account
from app.services.auth_service import create_teacher_session


def _request(settings: Settings, cookies: dict[str, str] | None = None) -> Request:
    cookie_header = "; ".join(f"{name}={value}" for name, value in (cookies or {}).items())
    headers = [(b"cookie", cookie_header.encode("latin-1"))] if cookie_header else []
    app = SimpleNamespace(state=SimpleNamespace(settings=settings))
    return Request(
        {
            "type": "http",
            "app": app,
            "headers": headers,
            "method": "GET",
            "path": "/api/v1/admin/auth/me",
            "query_string": b"",
            "scheme": "http",
            "server": ("testserver", 80),
            "client": ("testclient", 50000),
        }
    )


def _assert_admin_auth_required(request: Request, database_session) -> None:
    from app.api.deps import require_admin

    with pytest.raises(ApiError) as error:
        require_admin(request, database_session)

    assert error.value.status_code == 401
    assert error.value.code == "AUTH_REQUIRED"
    assert error.value.message == "需要管理员登录。"


def test_require_admin_accepts_active_admin_session_and_sets_request_state(
    database_session,
) -> None:
    from app.api.deps import require_admin
    from app.seed import seed_admin_account
    from app.services.admin_auth_service import create_admin_session

    settings = Settings(session_secret="test-session-secret")
    admin = seed_admin_account(
        database_session,
        login_name="admin",
        password="correct-password",
        display_name="KnownMap 管理员",
    )
    database_session.flush()
    raw_token, admin_session = create_admin_session(
        database_session,
        admin,
        session_secret=settings.session_secret,
        ttl_seconds=60,
    )
    database_session.flush()
    request = _request(settings, {settings.admin_session_cookie_name: raw_token})

    assert require_admin(request, database_session) == admin
    assert request.state.admin_session is admin_session


def test_require_admin_rejects_missing_forged_and_teacher_cookies(database_session) -> None:
    settings = Settings(session_secret="test-session-secret")
    teacher = seed_teacher_account(
        database_session,
        login_name="teacher",
        password="teacher-password",
        display_name="Teacher",
    )
    database_session.flush()
    teacher_token, _ = create_teacher_session(
        database_session,
        teacher,
        session_secret=settings.session_secret,
        ttl_seconds=60,
    )
    database_session.flush()

    _assert_admin_auth_required(_request(settings), database_session)
    _assert_admin_auth_required(
        _request(settings, {settings.admin_session_cookie_name: "forged-token"}),
        database_session,
    )
    _assert_admin_auth_required(
        _request(settings, {settings.session_cookie_name: teacher_token}),
        database_session,
    )


@pytest.mark.parametrize("invalid_state", ["expired", "revoked", "disabled"])
def test_require_admin_rejects_inactive_admin_sessions(
    database_session,
    invalid_state,
) -> None:
    from app.seed import seed_admin_account
    from app.services.admin_auth_service import create_admin_session, revoke_admin_session

    settings = Settings(session_secret="test-session-secret")
    admin = seed_admin_account(
        database_session,
        login_name=f"admin-{invalid_state}",
        password="correct-password",
        display_name="KnownMap 管理员",
    )
    database_session.flush()
    raw_token, admin_session = create_admin_session(
        database_session,
        admin,
        session_secret=settings.session_secret,
        ttl_seconds=60,
    )
    database_session.flush()

    if invalid_state == "expired":
        admin_session.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    elif invalid_state == "revoked":
        revoke_admin_session(admin_session)
    else:
        admin.status = "disabled"
    database_session.flush()

    _assert_admin_auth_required(
        _request(settings, {settings.admin_session_cookie_name: raw_token}),
        database_session,
    )
