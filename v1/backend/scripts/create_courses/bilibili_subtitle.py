"""Fetch Bilibili subtitles with the caller's own login cookie.

Uses the web player API (WBI-signed) documented in bilibili-API-collect.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from scripts.create_courses.service import parse_bvid

API_BASE = "https://api.bilibili.com"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 57, 6, 11, 38, 36,
    63, 52, 20, 44, 62, 34,
]
PREFERRED_LANGS = ("ai-zh", "zh-Hans", "zh-CN", "zh-Hant", "zh", "en-US", "en")


class BilibiliSubtitleError(Exception):
    pass


@dataclass(frozen=True)
class SubtitleTrack:
    lan: str
    lan_doc: str
    subtitle_url: str


def load_cookie_header(*, cookie_file: str | None = None) -> str:
    path = cookie_file or os.environ.get("BILIBILI_COOKIE_FILE")
    if not path:
        inline = os.environ.get("BILIBILI_COOKIE")
        if inline:
            return normalize_cookie_header(inline)
        raise BilibiliSubtitleError(
            "缺少 B 站登录信息：请设置 --bilibili-cookie-file 或环境变量 BILIBILI_COOKIE_FILE"
        )

    raw = open(path, encoding="utf-8").read().strip()  # noqa: SIM115
    if not raw:
        raise BilibiliSubtitleError(f"Cookie 文件为空：{path}")
    return normalize_cookie_header(raw)


def normalize_cookie_header(raw: str) -> str:
    value = raw.strip()
    if not value:
        raise BilibiliSubtitleError("Cookie 内容为空")
    if "=" not in value:
        return f"SESSDATA={value}"
    if value.lower().startswith("cookie:"):
        return value.split(":", 1)[1].strip()
    return value


def _request_json(url: str, *, cookie_header: str, referer: str) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Referer": referer,
            "Cookie": cookie_header,
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raise BilibiliSubtitleError(f"请求失败：HTTP {error.code} {url}") from error
    except urllib.error.URLError as error:
        raise BilibiliSubtitleError(f"请求失败：{error.reason}") from error
    except json.JSONDecodeError as error:
        raise BilibiliSubtitleError(f"响应不是合法 JSON：{url}") from error

    if payload.get("code") != 0:
        message = payload.get("message") or "未知错误"
        raise BilibiliSubtitleError(f"B 站接口返回错误：{message}")
    return payload


def _mixin_key(img_key: str, sub_key: str) -> str:
    combined = img_key + sub_key
    return "".join(combined[index] for index in MIXIN_KEY_ENC_TAB)[:32]


def _sign_wbi(params: dict[str, str], img_key: str, sub_key: str) -> dict[str, str]:
    signed = dict(params)
    signed["wts"] = str(int(time.time()))
    query = "&".join(
        f"{urllib.parse.quote(key, safe='')}={urllib.parse.quote(signed[key], safe='')}"
        for key in sorted(signed)
    )
    signed["w_rid"] = hashlib.md5((query + _mixin_key(img_key, sub_key)).encode()).hexdigest()
    return signed


def _wbi_keys(cookie_header: str) -> tuple[str, str]:
    payload = _request_json(
        f"{API_BASE}/x/web-interface/nav",
        cookie_header=cookie_header,
        referer="https://www.bilibili.com/",
    )
    wbi_img = payload["data"]["wbi_img"]
    img_key = wbi_img["img_url"].rsplit("/", 1)[-1].split(".", 1)[0]
    sub_key = wbi_img["sub_url"].rsplit("/", 1)[-1].split(".", 1)[0]
    return img_key, sub_key


def _video_view(bvid: str, cookie_header: str) -> dict[str, Any]:
    query = urllib.parse.urlencode({"bvid": bvid})
    payload = _request_json(
        f"{API_BASE}/x/web-interface/view?{query}",
        cookie_header=cookie_header,
        referer=f"https://www.bilibili.com/video/{bvid}",
    )
    return payload["data"]


def _select_track(tracks: list[dict[str, Any]]) -> SubtitleTrack:
    if not tracks:
        raise BilibiliSubtitleError("该视频没有可用字幕，可能未登录、无 AI 字幕或需要大会员")

    by_lang = {track.get("lan"): track for track in tracks if track.get("lan")}
    for lang in PREFERRED_LANGS:
        track = by_lang.get(lang)
        if track and track.get("subtitle_url"):
            return SubtitleTrack(
                lan=lang,
                lan_doc=str(track.get("lan_doc") or lang),
                subtitle_url=str(track["subtitle_url"]),
            )

    for track in tracks:
        subtitle_url = track.get("subtitle_url") or track.get("subtitle_url_v2")
        if subtitle_url:
            return SubtitleTrack(
                lan=str(track.get("lan") or "unknown"),
                lan_doc=str(track.get("lan_doc") or track.get("lan") or "字幕"),
                subtitle_url=str(subtitle_url),
            )

    raise BilibiliSubtitleError("字幕列表存在，但没有可用的 subtitle_url")


def _normalize_subtitle_url(url: str) -> str:
    if url.startswith("//"):
        return f"https:{url}"
    if url.startswith("/"):
        return f"{API_BASE}{url}"
    return url


def _subtitle_tracks(
    *,
    aid: int,
    cid: int,
    bvid: str,
    cookie_header: str,
) -> list[SubtitleTrack]:
    img_key, sub_key = _wbi_keys(cookie_header)
    params = _sign_wbi(
        {
            "aid": str(aid),
            "cid": str(cid),
            "bvid": bvid,
            "isGaiaAvoided": "false",
            "web_location": "1315873",
        },
        img_key,
        sub_key,
    )
    query = urllib.parse.urlencode(params)
    payload = _request_json(
        f"{API_BASE}/x/player/wbi/v2?{query}",
        cookie_header=cookie_header,
        referer=f"https://www.bilibili.com/video/{bvid}",
    )
    tracks = payload.get("data", {}).get("subtitle", {}).get("subtitles") or []
    if not tracks:
        raise BilibiliSubtitleError(
            "播放器接口未返回字幕；请确认 Cookie 有效，且该视频存在 CC/AI 字幕"
        )
    return [
        SubtitleTrack(
            lan=str(track.get("lan") or ""),
            lan_doc=str(track.get("lan_doc") or track.get("lan") or ""),
            subtitle_url=_normalize_subtitle_url(str(track.get("subtitle_url") or "")),
        )
        for track in tracks
        if track.get("subtitle_url") or track.get("subtitle_url_v2")
    ]


def _format_srt_timestamp(seconds: float) -> str:
    total_ms = int(round(seconds * 1000))
    hours, remainder = divmod(total_ms, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, millis = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def subtitle_body_to_srt(body: list[dict[str, Any]]) -> str:
    if not body:
        raise BilibiliSubtitleError("字幕 JSON 的 body 为空")

    blocks: list[str] = []
    for index, item in enumerate(body, start=1):
        content = str(item.get("content") or "").strip()
        if not content:
            continue
        start = _format_srt_timestamp(float(item["from"]))
        end = _format_srt_timestamp(float(item["to"]))
        blocks.append(f"{index}\n{start} --> {end}\n{content}\n")
    if not blocks:
        raise BilibiliSubtitleError("字幕 JSON 没有可用文本")
    return "\n".join(blocks)


def fetch_subtitle_document(
    bilibili_url: str,
    *,
    cookie_header: str,
    page_index: int = 0,
) -> dict[str, Any]:
    bvid = parse_bvid(bilibili_url)
    view = _video_view(bvid, cookie_header)
    pages = view.get("pages") or []
    if pages:
        if page_index < 0 or page_index >= len(pages):
            raise BilibiliSubtitleError(
                f"分 P 索引超出范围：{page_index}，该视频共 {len(pages)} 个分 P"
            )
        page = pages[page_index]
        cid = int(page["cid"])
        part_title = str(page.get("part") or f"P{page_index + 1}")
    else:
        cid = int(view["cid"])
        part_title = "P1"

    aid = int(view["aid"])
    tracks = _subtitle_tracks(aid=aid, cid=cid, bvid=bvid, cookie_header=cookie_header)
    track = _select_track(
        [
            {"lan": item.lan, "lan_doc": item.lan_doc, "subtitle_url": item.subtitle_url}
            for item in tracks
        ]
    )

    subtitle_json = _request_json(
        track.subtitle_url,
        cookie_header=cookie_header,
        referer=f"https://www.bilibili.com/video/{bvid}",
    )
    body = subtitle_json.get("body")
    if not isinstance(body, list):
        raise BilibiliSubtitleError("字幕 JSON 缺少 body 数组")

    safe_title = re.sub(r'[\\/:*?"<>|]+', "_", str(view.get("title") or bvid))[:80]
    filename = f"{safe_title}_{part_title}_{track.lan}.srt"
    document = {
        "schemaVersion": 1,
        "filename": filename,
        "format": "srt",
        "content": subtitle_body_to_srt(body),
    }
    document["_source"] = {
        "bvid": bvid,
        "aid": aid,
        "cid": cid,
        "lan": track.lan,
        "lan_doc": track.lan_doc,
    }
    return document


def main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description="用你自己的 B 站 Cookie 拉取字幕")
    parser.add_argument("bilibili_url", help="B 站视频 URL 或 BVID")
    parser.add_argument("--cookie-file", help="Cookie 文件路径，也可用环境变量 BILIBILI_COOKIE_FILE")
    parser.add_argument("--page-index", type=int, default=0, help="多分 P 视频的分 P 索引，从 0 开始")
    parser.add_argument("--output", type=Path, help="保存 SRT 到文件；默认打印摘要")
    args = parser.parse_args(argv)

    cookie_header = load_cookie_header(cookie_file=args.cookie_file)
    document = fetch_subtitle_document(
        args.bilibili_url,
        cookie_header=cookie_header,
        page_index=args.page_index,
    )
    if args.output:
        args.output.write_text(document["content"], encoding="utf-8")
        print(f"已保存：{args.output}")
    else:
        preview = document["content"][:300].replace("\n", "\\n")
        print(json.dumps(document.get("_source", {}), ensure_ascii=False, indent=2))
        print(f"filename={document['filename']}")
        print(f"preview={preview}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (BilibiliSubtitleError, ValueError) as error:
        print(f"错误：{error}", file=sys.stderr)
        raise SystemExit(1) from error
