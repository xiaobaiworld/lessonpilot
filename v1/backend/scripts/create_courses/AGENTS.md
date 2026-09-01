# create_courses — Agent 调用说明

在 **本地 KnownMap 数据库** 中批量创建教师课程草稿。每门课默认包含：

- 1 个课程（`draft`）
- 1 个课节（绑定 B 站 `BV…` 视频）
- 1 份课节草稿（字幕 + 第 10 秒 `notice` 互动节点）

工作目录一律为：

```bash
cd v1/backend
```

前置条件：

```bash
uv sync --frozen
uv run alembic upgrade head
```

目标教师账号必须已存在（可用 `uv run python -m app.seed` 或管理端创建）。

---

## 目录结构

| 文件 | 用途 |
|------|------|
| `__main__.py` | CLI 入口：`python -m scripts.create_courses` |
| `cli.py` | 命令行参数解析与主流程 |
| `service.py` | 建课核心逻辑（解析 BVID、写库、manifest） |
| `bilibili_subtitle.py` | 用用户自己的 B 站 Cookie 拉取字幕 |
| `example.manifest.json` | 本地字幕文件的 manifest 示例 |

---

## 推荐调用方式

### A. 仅拉 B 站字幕（不写数据库）

适合先验证 Cookie 和视频是否有 AI/CC 字幕。

```bash
cd v1/backend

BILIBILI_COOKIE_FILE=/path/to/bilibili-cookie.txt \
  uv run python -m scripts.create_courses.bilibili_subtitle \
  "https://www.bilibili.com/video/BV1Ac41187Lm"

# 保存 SRT
BILIBILI_COOKIE_FILE=/path/to/bilibili-cookie.txt \
  uv run python -m scripts.create_courses.bilibili_subtitle \
  "BV1Ac41187Lm" --output /tmp/test.srt
```

### B. 单门课程：在线拉字幕 + 建课

```bash
cd v1/backend

uv run python -m scripts.create_courses \
  --teacher teacher \
  --title "课程标题" \
  --bilibili-url "https://www.bilibili.com/video/BV1Ac41187Lm" \
  --fetch-subtitle-from-bilibili \
  --bilibili-cookie-file /path/to/bilibili-cookie.txt
```

### C. 单门课程：使用本地字幕文件

```bash
cd v1/backend

uv run python -m scripts.create_courses \
  --teacher teacher \
  --title "课程标题" \
  --bilibili-url "https://www.bilibili.com/video/BV1Ac41187Lm" \
  --subtitle-file ./subtitles/lesson1.srt
```

### D. 批量 manifest

**本地字幕：**

```json
{
  "teacher_login": "teacher",
  "courses": [
    {
      "title": "示例课程",
      "bilibili_url": "https://www.bilibili.com/video/BV1Ac41187Lm",
      "subtitle_file": "./subtitles/lesson1.srt"
    }
  ]
}
```

**在线拉 B 站字幕：**

```json
{
  "teacher_login": "teacher",
  "bilibili_cookie_file": "./.local/bilibili-cookie.txt",
  "courses": [
    {
      "title": "示例课程",
      "bilibili_url": "https://www.bilibili.com/video/BV1Ac41187Lm",
      "fetch_subtitle_from_bilibili": true,
      "page_index": 0
    }
  ]
}
```

```bash
cd v1/backend
uv run python -m scripts.create_courses --manifest ./courses.json
```

`subtitle_file` 的相对路径相对于 manifest 文件所在目录。

---

## B 站 Cookie

**必须由用户自行提供**，脚本不会代管或存储到数据库。

支持三种传入方式（优先级：CLI > 环境变量 > manifest）：

| 方式 | 示例 |
|------|------|
| CLI | `--bilibili-cookie-file /path/to/cookie.txt` |
| 环境变量 | `BILIBILI_COOKIE_FILE=/path/to/cookie.txt` |
| 环境变量（内联） | `BILIBILI_COOKIE='SESSDATA=...; bili_jct=...'` |
| manifest | 顶层字段 `bilibili_cookie_file` |

Cookie 文件内容可以是：

- 完整 Cookie 头：`SESSDATA=...; bili_jct=...; DedeUserID=...`
- 仅 `SESSDATA=...` 一行
- 仅 SESSDATA 原始值（脚本会自动补 `SESSDATA=` 前缀）

**安全要求（agent 必须遵守）：**

- 不要把 Cookie 写入仓库、manifest 示例或日志
- 不要把 Cookie 提交到 Git
- 建议放在 `.gitignore` 目录，例如 `v1/backend/.local/bilibili-cookie.txt`

字幕拉取原理：调用 B 站 Web 接口 `x/web-interface/view` + `x/player/wbi/v2`（WBI 签名），优先选择 `ai-zh`，其次 `zh-Hans` / `zh-CN` / `zh`。

---

## Python API（供其它脚本 import）

```python
from scripts.create_courses.bilibili_subtitle import (
    fetch_subtitle_document,
    load_cookie_header,
)
from scripts.create_courses.service import create_course, parse_bvid

# 1. 拉字幕
cookie = load_cookie_header(cookie_file="/path/to/cookie.txt")
subtitle = fetch_subtitle_document(
    "https://www.bilibili.com/video/BV1Ac41187Lm",
    cookie_header=cookie,
    page_index=0,
)
# subtitle: {"schemaVersion", "filename", "format", "content", "_source"}

# 2. 写数据库（需要已有 SQLAlchemy session）
course_id, lesson_id = create_course(
    session=session,
    teacher_login="teacher",
    title="课程标题",
    description=None,
    bilibili_url="BV1Ac41187Lm",
    subtitle=subtitle,
    lesson_title="第一课",
    node_title="重点提示",
    node_body="请留意本节核心内容",
)
```

`create_course` 二选一提供字幕：

- `subtitle_path=Path("...")` — 本地 `.srt` / `.vtt`
- `subtitle={...}` — 已由 `fetch_subtitle_document` 生成的 dict

写入前会自动剥离 `_source` 元数据，只保留后端校验所需的四个字幕字段。

---

## 默认行为与可配置项

| 项 | 默认值 |
|----|--------|
| 课节数 | 1 |
| 互动节点时间 | 第 10 秒 |
| 节点类型 | `notice`（暂停播放） |
| `node_title` | `重点提示` |
| `node_body` | `请留意本节核心内容` |
| 视频平台 | `bilibili` |
| 课程状态 | `draft`（未发布） |

CLI 可覆盖：`--lesson-title`、`--node-title`、`--node-body`、`--page-index`。

---

## 输出

成功时 stdout 示例：

```
已创建：课程标题  course_id=<uuid>  lesson_id=<uuid>
共创建 1 门课程
```

失败时 stderr 以 `错误：` 开头，退出码 `1`。

常见异常类型：

| 类型 | 场景 |
|------|------|
| `ValueError` | 参数/manifest 不合法、教师不存在、字幕文件缺失 |
| `BilibiliSubtitleError` | Cookie 无效、视频无字幕、B 站接口错误 |

---

## 测试

```bash
cd v1/backend
uv run pytest tests/test_bilibili_subtitle.py tests/test_create_courses_script.py -q
```

单元测试使用 mock，**不需要真实 Cookie**。集成测试需用户本地提供 Cookie 后手动执行「A. 仅拉字幕」。

---

## Agent 决策树

```
需要建课？
├─ 否 → 仅测字幕：python -m scripts.create_courses.bilibili_subtitle
└─ 是 → 字幕来源？
    ├─ 已有本地 .srt/.vtt → --subtitle-file 或 manifest.subtitle_file
    └─ 从 B 站拉取 → --fetch-subtitle-from-bilibili + 用户 Cookie
        └─ 批量 → manifest + fetch_subtitle_from_bilibili: true
```

**不要**在未获用户提供 Cookie 的情况下尝试在线拉字幕。

**不要**代替用户发布课程；本工具只创建草稿，发布仍需教师端预览 + 发布流程。
