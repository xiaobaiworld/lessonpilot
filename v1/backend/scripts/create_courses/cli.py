from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from app.config import Settings
from app.infrastructure.database.session import create_database_engine, create_session_factory

from scripts.create_courses.bilibili_subtitle import (
    BilibiliSubtitleError,
    fetch_subtitle_document,
    load_cookie_header,
)
from scripts.create_courses.service import (
    course_from_entry,
    create_course,
    load_manifest,
    resolve_path,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="在本地数据库批量创建课程")
    parser.add_argument("--manifest", type=Path, help="JSON 清单文件路径")
    parser.add_argument("--teacher", help="教师登录名（单课程模式）")
    parser.add_argument("--title", help="课程标题（单课程模式）")
    parser.add_argument("--description", help="课程说明（单课程模式）")
    parser.add_argument("--bilibili-url", help="B 站视频 URL 或 BVID（单课程模式）")
    parser.add_argument("--subtitle-file", type=Path, help="本地字幕文件 .srt/.vtt")
    parser.add_argument(
        "--fetch-subtitle-from-bilibili",
        action="store_true",
        help="使用你自己的 B 站 Cookie 在线拉取字幕",
    )
    parser.add_argument(
        "--bilibili-cookie-file",
        type=Path,
        help="B 站 Cookie 文件；也可用环境变量 BILIBILI_COOKIE_FILE",
    )
    parser.add_argument(
        "--page-index",
        type=int,
        default=0,
        help="多分 P 视频的分 P 索引，从 0 开始",
    )
    parser.add_argument("--lesson-title", help="课节标题，默认与课程标题相同")
    parser.add_argument("--node-title", default="重点提示", help="第 10 秒互动节点标题")
    parser.add_argument("--node-body", default="请留意本节核心内容", help="第 10 秒互动节点正文")
    return parser


def _load_manifest_cookie(manifest_path: Path, override: Path | None) -> str | None:
    if override:
        return load_cookie_header(cookie_file=str(override))
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    cookie_file = data.get("bilibili_cookie_file")
    if cookie_file is None:
        return None
    if not isinstance(cookie_file, str) or not cookie_file.strip():
        raise ValueError("manifest.bilibili_cookie_file 必须是非空字符串")
    path = Path(cookie_file).expanduser()
    if not path.is_absolute():
        path = (manifest_path.parent / path).resolve()
    return load_cookie_header(cookie_file=str(path))


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.manifest:
        manifest_path = args.manifest.resolve()
        teacher_login, entries = load_manifest(manifest_path)
        cookie_header = _load_manifest_cookie(manifest_path, args.bilibili_cookie_file)
        specs = [
            course_from_entry(
                entry,
                teacher_login=teacher_login,
                base_dir=manifest_path.parent,
                cookie_header=cookie_header,
            )
            for entry in entries
        ]
    else:
        if args.fetch_subtitle_from_bilibili:
            if args.subtitle_file:
                parser.error("不能同时使用 --subtitle-file 和 --fetch-subtitle-from-bilibili")
            missing = [
                name
                for name, value in (
                    ("--teacher", args.teacher),
                    ("--title", args.title),
                    ("--bilibili-url", args.bilibili_url),
                )
                if not value
            ]
            if missing:
                parser.error(f"单课程模式需要：{', '.join(missing)}；或使用 --manifest")
            cookie_header = load_cookie_header(
                cookie_file=str(args.bilibili_cookie_file) if args.bilibili_cookie_file else None
            )
            subtitle = fetch_subtitle_document(
                args.bilibili_url.strip(),
                cookie_header=cookie_header,
                page_index=args.page_index,
            )
            specs = [
                {
                    "teacher_login": args.teacher.strip(),
                    "title": args.title.strip(),
                    "description": args.description.strip() if args.description else None,
                    "bilibili_url": args.bilibili_url.strip(),
                    "subtitle": subtitle,
                    "lesson_title": args.lesson_title.strip() if args.lesson_title else None,
                    "node_title": args.node_title,
                    "node_body": args.node_body,
                }
            ]
        else:
            missing = [
                name
                for name, value in (
                    ("--teacher", args.teacher),
                    ("--title", args.title),
                    ("--bilibili-url", args.bilibili_url),
                    ("--subtitle-file", args.subtitle_file),
                )
                if not value
            ]
            if missing:
                parser.error(
                    f"单课程模式需要：{', '.join(missing)}；"
                    "或使用 --fetch-subtitle-from-bilibili / --manifest"
                )
            specs = [
                {
                    "teacher_login": args.teacher.strip(),
                    "title": args.title.strip(),
                    "description": args.description.strip() if args.description else None,
                    "bilibili_url": args.bilibili_url.strip(),
                    "subtitle_path": resolve_path(str(args.subtitle_file), None),
                    "lesson_title": args.lesson_title.strip() if args.lesson_title else None,
                    "node_title": args.node_title,
                    "node_body": args.node_body,
                }
            ]

    settings = Settings()
    session_factory = create_session_factory(create_database_engine(settings))
    created: list[tuple[str, str, str]] = []

    with session_factory() as session:
        for spec in specs:
            course_id, lesson_id = create_course(session=session, **spec)
            created.append((spec["title"], course_id, lesson_id))

    for title, course_id, lesson_id in created:
        print(f"已创建：{title}  course_id={course_id}  lesson_id={lesson_id}")
    print(f"共创建 {len(created)} 门课程")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, BilibiliSubtitleError) as error:
        print(f"错误：{error}", file=sys.stderr)
        raise SystemExit(1) from error
