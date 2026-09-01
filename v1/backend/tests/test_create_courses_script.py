from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from app.infrastructure.database import models  # noqa: F401
from app.infrastructure.database.base import Base
from app.infrastructure.database.session import create_database_engine, create_session_factory
from app.modules.admin_support.application_service import AdminSupportApplicationService
from app.modules.authoring_release.application_service import AuthoringReleaseApplicationService
from app.modules.identity.application_service import IdentityApplicationService
from scripts.create_courses.service import create_course, parse_bvid
from tests.conftest import make_settings


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("BV1Ac41187Lm", "BV1Ac41187Lm"),
        ("https://www.bilibili.com/video/BV1Ac41187Lm/", "BV1Ac41187Lm"),
        ("https://b23.tv/BV1Bc41187Lm?share_source=copy", "BV1Bc41187Lm"),
    ],
)
def test_parse_bvid(value: str, expected: str) -> None:
    assert parse_bvid(value) == expected


def test_parse_bvid_rejects_invalid() -> None:
    with pytest.raises(ValueError, match="无法从输入解析 BVID"):
        parse_bvid("not-a-video")


def _seed_teacher(session: Session) -> str:
    identity = IdentityApplicationService(session, "s" * 48)
    identity.seed_admin("admin", "管理员", "admin-password")
    teacher, _ = AdminSupportApplicationService(session, "s" * 48).create_teacher("teacher", "教师")
    session.commit()
    return teacher.login_name


def test_create_course_writes_subtitle_and_node(tmp_path: Path) -> None:
    subtitle_path = tmp_path / "第一课.srt"
    subtitle_path.write_text(
        "1\n00:00:01,000 --> 00:00:03,000\n欢迎学习\n",
        encoding="utf-8",
    )

    settings = make_settings()
    session_factory = create_session_factory(create_database_engine(settings))
    with session_factory() as session:
        Base.metadata.create_all(session.get_bind())
        teacher_login = _seed_teacher(session)
        course_id, lesson_id = create_course(
            session=session,
            teacher_login=teacher_login,
            title="批量课程",
            description="说明",
            bilibili_url="https://www.bilibili.com/video/BV1Ac41187Lm",
            subtitle_path=subtitle_path,
            lesson_title="第一课",
            node_title="重点",
            node_body="记住这一点",
        )

    with session_factory() as session:
        authoring = AuthoringReleaseApplicationService(session)
        draft = authoring.get_draft(lesson_id)
        assert draft.content["subtitle"]["filename"] == "第一课.srt"
        assert draft.content["nodes"][0]["anchor"]["timeSeconds"] == 10
        assert draft.content["nodes"][0]["title"] == "重点"
        assert course_id
        assert lesson_id
