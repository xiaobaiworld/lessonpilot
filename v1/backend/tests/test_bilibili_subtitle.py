from unittest.mock import patch

import pytest

from scripts.create_courses.bilibili_subtitle import (
    BilibiliSubtitleError,
    fetch_subtitle_document,
    load_cookie_header,
    normalize_cookie_header,
    subtitle_body_to_srt,
)


def test_normalize_cookie_header_accepts_sessdata_only() -> None:
    assert normalize_cookie_header("abc123") == "SESSDATA=abc123"
    assert normalize_cookie_header("SESSDATA=abc123") == "SESSDATA=abc123"


def test_subtitle_body_to_srt() -> None:
    srt = subtitle_body_to_srt(
        [
            {"from": 1.5, "to": 3.25, "content": "你好"},
            {"from": 4.0, "to": 6.0, "content": "世界"},
        ]
    )
    assert "00:00:01,500 --> 00:00:03,250" in srt
    assert "你好" in srt
    assert "世界" in srt


def test_load_cookie_header_from_env(tmp_path, monkeypatch) -> None:
    cookie_file = tmp_path / "cookie.txt"
    cookie_file.write_text("SESSDATA=test-cookie", encoding="utf-8")
    monkeypatch.delenv("BILIBILI_COOKIE", raising=False)
    monkeypatch.setenv("BILIBILI_COOKIE_FILE", str(cookie_file))
    assert load_cookie_header() == "SESSDATA=test-cookie"


@patch("scripts.create_courses.bilibili_subtitle._request_json")
def test_fetch_subtitle_document_prefers_ai_zh(mock_request_json) -> None:
    mock_request_json.side_effect = [
        {
            "code": 0,
            "data": {
                "aid": 123,
                "cid": 456,
                "title": "测试视频",
                "pages": [{"cid": 456, "part": "第一课"}],
            },
        },
        {
            "code": 0,
            "data": {
                "wbi_img": {
                    "img_url": "https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png",
                    "sub_url": "https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png",
                }
            },
        },
        {
            "code": 0,
            "data": {
                "subtitle": {
                    "subtitles": [
                        {
                            "lan": "en-US",
                            "lan_doc": "English",
                            "subtitle_url": "//subtitle.hdslb.com/en.json",
                        },
                        {
                            "lan": "ai-zh",
                            "lan_doc": "中文",
                            "subtitle_url": "//subtitle.hdslb.com/zh.json",
                        },
                    ]
                }
            },
        },
        {
            "body": [
                {"from": 0.0, "to": 2.0, "content": "第一句"},
                {"from": 2.5, "to": 4.0, "content": "第二句"},
            ]
        },
    ]

    document = fetch_subtitle_document(
        "https://www.bilibili.com/video/BV1Ac41187Lm",
        cookie_header="SESSDATA=test",
    )
    assert document["format"] == "srt"
    assert document["filename"].endswith("_ai-zh.srt")
    assert "第一句" in document["content"]
    assert document["_source"]["lan"] == "ai-zh"

    player_call = mock_request_json.call_args_list[2]
    assert "x/player/wbi/v2" in player_call.args[0]
    subtitle_call = mock_request_json.call_args_list[3]
    assert subtitle_call.args[0] == "https://subtitle.hdslb.com/zh.json"


@patch("scripts.create_courses.bilibili_subtitle._request_json")
def test_fetch_subtitle_document_requires_tracks(mock_request_json) -> None:
    mock_request_json.side_effect = [
        {"code": 0, "data": {"aid": 1, "cid": 2, "title": "t"}},
        {
            "code": 0,
            "data": {
                "wbi_img": {
                    "img_url": "https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png",
                    "sub_url": "https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png",
                }
            },
        },
        {"code": 0, "data": {"subtitle": {"subtitles": []}}},
    ]
    with pytest.raises(BilibiliSubtitleError, match="未返回字幕"):
        fetch_subtitle_document("BV1Ac41187Lm", cookie_header="SESSDATA=test")
