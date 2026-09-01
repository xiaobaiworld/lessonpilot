from __future__ import annotations

import json
import re
from pathlib import Path
from uuid import uuid4

from app.modules.authoring_release.application_service import AuthoringReleaseApplicationService
from app.modules.identity import repository
from app.modules.workspace_course.application_service import WorkspaceCourseApplicationService

BVID_PATTERN = re.compile(r"BV[a-zA-Z0-9]{10}")
NODE_TIME_SECONDS = 10


def parse_bvid(value: str) -> str:
    match = BVID_PATTERN.search(value.strip())
    if not match:
        raise ValueError(f"无法从输入解析 BVID：{value!r}")
    return match.group(0)


def load_subtitle(path: Path) -> dict:
    suffix = path.suffix.lower()
    if suffix == ".srt":
        subtitle_format = "srt"
    elif suffix == ".vtt":
        subtitle_format = "vtt"
    else:
        raise ValueError(f"字幕文件必须是 .srt 或 .vtt：{path}")

    content = path.read_text(encoding="utf-8")
    return {
        "schemaVersion": 1,
        "filename": path.name,
        "format": subtitle_format,
        "content": content,
    }


def build_notice_node(
    node_id: str, title: str, body: str, time_seconds: int = NODE_TIME_SECONDS
) -> dict:
    return {
        "id": node_id,
        "enabled": True,
        "family": "attention",
        "interaction": "notice",
        "anchor": {"kind": "time_cross", "timeSeconds": time_seconds},
        "title": title.strip(),
        "content": {
            "schemaVersion": 1,
            "blocks": [{"type": "paragraph", "children": [{"text": body.strip()}]}],
        },
        "interactionData": None,
        "presentationHints": {"windowSize": "m", "windowStyle": "document"},
        "effects": {"pause": True},
    }


def resolve_path(value: str, base_dir: Path | None) -> Path:
    path = Path(value).expanduser()
    if not path.is_absolute() and base_dir is not None:
        path = (base_dir / path).resolve()
    else:
        path = path.resolve()
    if not path.is_file():
        raise ValueError(f"字幕文件不存在：{path}")
    return path


def create_course(
    *,
    session,
    teacher_login: str,
    title: str,
    description: str | None,
    bilibili_url: str,
    lesson_title: str | None,
    node_title: str,
    node_body: str,
    subtitle_path: Path | None = None,
    subtitle: dict | None = None,
) -> tuple[str, str]:
    teacher = repository.get_teacher_by_login_name(session, teacher_login)
    if not teacher:
        raise ValueError(f"教师账号不存在：{teacher_login!r}")

    if subtitle is None:
        if subtitle_path is None:
            raise ValueError("必须提供 subtitle_path 或 subtitle")
        subtitle = load_subtitle(subtitle_path)
    else:
        subtitle = {
            key: subtitle[key]
            for key in ("schemaVersion", "filename", "format", "content")
        }

    video_id = parse_bvid(bilibili_url)
    courses = WorkspaceCourseApplicationService(session)
    authoring = AuthoringReleaseApplicationService(session)

    course = courses.create_course(teacher.id, title, description)
    lesson = courses.create_lesson(
        teacher.id,
        course.id,
        lesson_title or title,
        "bilibili",
        video_id,
    )
    authoring.save_draft(
        teacher.id,
        lesson.id,
        1,
        {
            "nodes": [build_notice_node(str(uuid4()), node_title, node_body)],
            "assets": [],
            "subtitle": subtitle,
        },
        None,
    )
    return course.id, lesson.id


def load_manifest(path: Path) -> tuple[str, list[dict]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("manifest 根节点必须是对象")
    teacher_login = data.get("teacher_login")
    courses = data.get("courses")
    if not isinstance(teacher_login, str) or not teacher_login.strip():
        raise ValueError("manifest 缺少 teacher_login")
    if not isinstance(courses, list) or not courses:
        raise ValueError("manifest.courses 必须是非空数组")
    return teacher_login.strip(), courses


def course_from_entry(
    entry: dict,
    *,
    teacher_login: str,
    base_dir: Path | None,
    cookie_header: str | None = None,
) -> dict:
    if not isinstance(entry, dict):
        raise ValueError("courses 数组项必须是对象")
    title = entry.get("title")
    bilibili_url = entry.get("bilibili_url")
    subtitle_file = entry.get("subtitle_file")
    fetch_subtitle = entry.get("fetch_subtitle_from_bilibili") is True
    if not isinstance(title, str) or not title.strip():
        raise ValueError("课程缺少 title")
    if not isinstance(bilibili_url, str) or not bilibili_url.strip():
        raise ValueError(f"课程 {title!r} 缺少 bilibili_url")
    if fetch_subtitle and subtitle_file:
        raise ValueError(f"课程 {title!r} 不能同时设置 subtitle_file 和 fetch_subtitle_from_bilibili")
    if not fetch_subtitle and (
        not isinstance(subtitle_file, str) or not subtitle_file.strip()
    ):
        raise ValueError(f"课程 {title!r} 需要 subtitle_file 或 fetch_subtitle_from_bilibili")
    if fetch_subtitle and not cookie_header:
        raise ValueError("使用 fetch_subtitle_from_bilibili 时必须提供 B 站 Cookie")

    description = entry.get("description")
    if description is not None and not isinstance(description, str):
        raise ValueError(f"课程 {title!r} 的 description 必须是字符串")

    lesson_title = entry.get("lesson_title")
    if lesson_title is not None and not isinstance(lesson_title, str):
        raise ValueError(f"课程 {title!r} 的 lesson_title 必须是字符串")

    node_title = entry.get("node_title", "重点提示")
    node_body = entry.get("node_body", "请留意本节核心内容")
    if not isinstance(node_title, str) or not node_title.strip():
        raise ValueError(f"课程 {title!r} 的 node_title 无效")
    if not isinstance(node_body, str) or not node_body.strip():
        raise ValueError(f"课程 {title!r} 的 node_body 无效")

    page_index = entry.get("page_index", 0)
    if not isinstance(page_index, int) or page_index < 0:
        raise ValueError(f"课程 {title!r} 的 page_index 必须是非负整数")

    spec = {
        "teacher_login": teacher_login,
        "title": title.strip(),
        "description": description.strip()
        if isinstance(description, str) and description.strip()
        else None,
        "bilibili_url": bilibili_url.strip(),
        "lesson_title": lesson_title.strip()
        if isinstance(lesson_title, str) and lesson_title.strip()
        else None,
        "node_title": node_title.strip(),
        "node_body": node_body.strip(),
    }
    if fetch_subtitle:
        from scripts.create_courses.bilibili_subtitle import fetch_subtitle_document

        spec["subtitle"] = fetch_subtitle_document(
            bilibili_url.strip(),
            cookie_header=cookie_header,
            page_index=page_index,
        )
    else:
        spec["subtitle_path"] = resolve_path(subtitle_file, base_dir)
    return spec
