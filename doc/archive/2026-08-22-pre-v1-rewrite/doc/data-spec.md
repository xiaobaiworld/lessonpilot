# KnownMap 数据规范

版本：2.2

更新时间：2026-08-20

状态：当前数据文档总入口。学生课程主链路只使用 v2 多课程格式，不保留旧单课程兼容。

最近审计：2026-08-20

关键词：SQLite、FastAPI、Pydantic、管理员、教师账号、PluginCourseConfig、Chrome storage、
字幕、授权码、学习状态、发布记录、数据质量。

## 1. 文档职责与权威顺序

KnownMap 已经不是“没有后端的第一阶段原型”。当前系统同时包含：

- 生产 FastAPI + SQLite 教师平台；
- 独立超级管理员认证、教师账号创建和密码重置；
- 教师浏览器中的字幕和编辑器临时状态；
- 不可变课程发布版本；
- 授权码摘要和公开下载响应；
- Chrome 插件预览数据、已安装课程和本地学习状态；
- Git/服务器双边保存的生产发布记录；
- 已实施的 UUID 多课节、多课程存储和多范围授权模型。

数据文档拆分如下：

| 文档 | 职责 | 状态 |
| --- | --- | --- |
| [`data/model.md`](data/model.md) | 当前 ER 模型、基数、约束和目标模型差异 | 当前 |
| [`data/dictionary.md`](data/dictionary.md) | 数据库、API、插件、本地状态和数据文件字段字典 | 当前 |
| [`data/flow.md`](data/flow.md) | 教师发布、字幕、授权下载、学习状态、日志和发布记录数据流 | 当前 |
| [`data/quality.md`](data/quality.md) | 校验矩阵、已知漂移、验证命令和变更门禁 | 当前 |
| [`teacher-platform-data-spec.md`](teacher-platform-data-spec.md) | 旧入口兼容页 | 已由本组文档替代 |

发生冲突时按以下顺序判断：

1. 当前代码和自动化测试；
2. SQLAlchemy model 与 Alembic migration 的一致结果；
3. Pydantic schema 和 `src/shared/course-contract.js`；
4. 本文及数据子文档；
5. 已接受决策中的目标模型；
6. 历史原型和演示数据。

本地或生产数据库中的已有数据能证明“当前存了什么”，不能单独证明 schema 应该是什么。

## 2. 数据目标与来源

### 2.1 数据目标

- 让教师创建课程、课节和互动节点，保存草稿并发布不可变版本；
- 让超级管理员创建教师、重置密码并查看已发布课程数量；
- 让授权码只暴露必要课程配置，不泄露教师内部数据；
- 让插件在下载后再次校验课程，并以原子方式保存课程和学习状态；
- 让字幕留在教师浏览器，不进入课程发布包；
- 让运行日志、操作日志和生产发布记录可追溯但不记录敏感原文；
- 使用 UUID、多课节、多课程和多范围授权；测试期旧单课程数据直接舍弃，不建立兼容边界。

### 2.2 数据来源

| 来源 | 原始格式 | 获取方式 | 当前去向 | 敏感级别 |
| --- | --- | --- | --- | --- |
| 教师登录输入 | JSON | HTTPS/本地 HTTP 表单 | 认证服务；密码不持久化 | secret |
| 管理员登录输入 | JSON | HTTPS/本地 HTTP 表单 | 独立认证服务；密码不持久化 | secret |
| 教师账号管理 | JSON | 管理员 API | `teachers`、`workspaces`；临时密码只返回一次 | secret |
| 课程与课节表单 | JSON | 教师 API | SQLite | internal |
| 节点编辑器 | JSON | 教师 API | `script_drafts.config_json` | sensitive |
| SRT/VTT 字幕 | 文本文件 | 教师浏览器本地选择 | 浏览器内存 | sensitive |
| 授权码创建 | 服务端随机值 | 教师 API | 摘要入库，原文只返回一次 | secret |
| 授权码下载 | JSON | 插件请求 | 最新 `PublishedScript` | sensitive |
| 学生回答 | 字符串 | B 站页面插件 | Chrome local storage | sensitive |
| HTTP 请求 | headers/path/状态 | 中间件和路由 | 运行日志、操作日志摘要 | internal |
| Git commit | Git object | 发布脚本 | release JSON、标签、SHA256 | public/internal |
| 示例课程与字幕 | JSON/JS/SRT | 仓库文件 | 演示和测试 | internal |

## 3. 数据分层

KnownMap 当前采用逻辑分层，不要求每层都有独立数据库：

| 层 | 是否使用 | 当前内容 | 存储位置 |
| --- | --- | --- | --- |
| `raw` | 是 | 教师表单、授权码输入、SRT/VTT、HTTP 请求 | 浏览器/请求内存 |
| `staging` | 是 | `Caption[]`、规范化授权码、Pydantic 输入 | 浏览器/服务进程 |
| `canonical` | 是 | Admin、Teacher、Workspace、Course、Lesson、ScriptDraft | SQLite |
| `derived` | 是 | 操作日志、授权码状态、学习状态 | SQLite / Chrome storage |
| `published` | 是 | `PublishedScript.config_json` | SQLite |
| `output` | 是 | API 响应、`PluginCourseConfig`、release JSON、插件 ZIP | HTTP / Git / 服务器 |

字幕不进入 canonical 后端层。学生学习数据不进入后端 canonical 层。

## 4. 核心实体总览

当前数据库有 12 个业务实体：

```text
Admin
└── AdminSession[]

Teacher
├── TeacherSession[]
└── Workspace
    └── Course[]
        ├── Lesson[]             后端已支持多个
        │   ├── ScriptDraft?
        │   └── PublishedScript[]
        ├── AccessCode[]
        └── AccessGrant[]

OperationLog[]                   使用弱关联审计字段
```

当前关键事实：

- `Course.id` 已是后台 UUID；
- `Admin` 与 `Teacher` 使用独立表、会话表、Cookie 和 API 权限边界；
- `0008_multi_lesson_courses` 已移除 `Lesson.course_id` 唯一约束，后端按 `sort_order` 支持多课节；
- 教师页面当前仍以一个活动课节为主要编辑入口，但发布服务会聚合课程下全部有草稿的课节；
- `AccessCode.course_id` 仅作为教师端管理锚点，下载范围以多条 `AccessGrant` 为准；
- 发布包使用 `CoursePackage` v2，包含课程标题和 `lessons[]`；
- 插件直接使用后台 UUID `courseId` 和 `lessonId`，BVID 只负责页面匹配；
- `studentCourseStore` 是学生课程唯一存储 key，下载器、运行时和 UI 均已接入；
- 内置示例课程首次读取时自动加入；Student、Redemption、LearningEvent、Asset 暂不存在。

完整模型见 [`data/model.md`](data/model.md)。

## 5. 结构化数据文件清单

| 路径/位置 | 数据类型 | 用途 | 生命周期与权威性 |
| --- | --- | --- | --- |
| `backend/app/models/*.py` | ORM schema | 当前数据库目标结构 | schema 事实源之一 |
| `backend/app/migrations/versions/*.py` | migration | 空库重建和已有库升级 | schema 事实源之一 |
| `backend/app/schemas/*.py` | Pydantic schema | API 请求/响应校验 | API 事实源 |
| `src/shared/course-contract.js` | JS schema/validator | 网页与插件课程契约 | 插件契约唯一事实源 |
| `src/shared/course-package-contract.js` | JS schema/validator | v2 UUID 多课节课程包 | 当前学生课程契约 |
| `backend/knownmap.db` | SQLite | 本机开发数据 | Git 忽略，可变，不是 schema 真源 |
| `/var/lib/knownmap/knownmap.db` | SQLite | 生产业务数据 | 不进入 Git |
| `deploy/releases/*.json` | release record | 已验证生产发布事实 | 一次发布一文件 |
| `teacher-web/course.json` | JSON | 旧示例课程元数据 | 历史演示 |
| `teacher-web/demo-captions.js` | JS 数据数组 | 销售页/演示字幕 | 演示 |
| `doc/*.srt` | SRT | 字幕样例 | 测试/演示输入 |
| `src/manifest.json` | JSON | 插件版本、权限和入口 | 插件构建配置 |
| Chrome `storage.local` | JSON-like | 预览、学生课程、学习状态 | 本机可变 |

`.gstack/` 下 JSON/JSONL 是 Agent 工具状态，不属于 KnownMap 产品数据。

## 6. 当前结构摘要

### 6.1 后端持久化

- 管理员和教师密码使用 Argon2 慢哈希；
- 管理员会话、教师会话和授权码只存 HMAC 摘要；
- 创建或重置教师密码时，原始临时密码只存在于当次 HTTPS 响应，不进入数据库或日志；
- 课程与课节使用 UUID 主键，一门课程可保存多个有序课节；
- 草稿按课节整份替换；
- 发布版本按课节单调递增且不可变；
- 课程发布聚合所有课节，授权下载按 `AccessGrant` 裁剪课程、课节和节点范围；
- 业务操作摘要写入 `operation_logs`；
- 生产数据库与代码发布目录分离。

### 6.2 教师浏览器

- `captions`、编辑器选择、缩放、弹窗草稿和脏状态只在页面内存；
- `sessionStorage.knownmap_teacher_session` 只表示页面应尝试恢复会话；
- 真正会话凭证位于 HttpOnly Cookie；
- 管理员 Cookie 为独立的 `knownmap_admin_session`，页面不把它写入 Web Storage；
- 字幕正文不进入后端或插件课程配置。
- `localStorage` key `lessonpilot.workspaceDraft.v1` 是阶段 1B 历史工作台草稿标识；当前
  FastAPI 教师编辑器不再使用它，但名称保留在规范中，避免旧页面或迁移工具误作新 key。

### 6.3 插件本地存储

| key | 当前值 | 用途 |
| --- | --- | --- |
| `currentCourse` | `PluginCourseConfig` | 历史教师预览桥 |
| `activePreviewSession` | `PreviewSession` | 教师预览会话 |
| `studentCourseStore` | `storageVersion: 2` 的多课程 map | 学生课程与分层学习状态的唯一存储 |

`currentCourse` 和 `activePreviewSession` 只属于教师预览桥。学生侧不读取
`installedCourse`、`learningState` 或其他旧单课程 key，也不执行迁移。

详细字段见 [`data/dictionary.md`](data/dictionary.md)。

## 7. 课程输出契约

### 7.1 当前主链路 `CoursePackage` v2

当前发布和下载结构：

```json
{
  "schemaVersion": 2,
  "courseId": "d2045bc7-4ba2-4aff-8f27-3bc336be4f55",
  "title": "英语面试表达：把答案说得具体",
  "lessons": [
    {
      "lessonId": "a1cc724e-19f4-4f12-9377-8ff71753e8c4",
      "title": "第一课",
      "videoRef": {
        "platform": "bilibili",
        "videoId": "BV1WW4y1e7GL"
      },
      "nodes": [],
      "updatedAt": "2026-08-20T00:00:00.000Z"
    }
  ],
  "updatedAt": "2026-08-20T00:00:00.000Z"
}
```

当前规则：

- 顶层字段封闭，未知字段拒绝；
- `courseId` 和 `lessonId` 必须是规范小写 UUID，由后台统一生成；
- 每门课程至少一个课节，每个课节包含标题、BVID、非空节点和更新时间；
- 同一课程内 `lessonId`、节点 ID 和 BVID 不得重复；
- 节点按 `trigger.timeSeconds` 和 `id` 升序；
- `updatedAt` 使用 UTC ISO 毫秒格式；
- 完整字幕、授权码和教师字段不得进入输出；
- 后端发布 adapter 构造一次，插件下载后再次校验；
- 公开下载响应只允许 `{ "courses": [...] }`，旧 `{ "course": ... }` 直接拒绝。

### 7.2 示例课程

- 插件内置一门只读示例课程，使用独立固定 `courseId` 和 `lessonId`；
- 第一次读取学生课程库时自动写入，后续读取不重复写入；
- 示例课程与授权课程保存在同一个 `studentCourseStore`，但不会覆盖授权课程；
- 若示例课程和授权课程匹配同一 BVID，运行时优先选择授权课程；
- UI 显示课程名称；多课节时显示“课程名称 · 课节名称”，不显示内部 UUID。

## 8. 节点结构

公共结构：

```json
{
  "id": "node-1",
  "enabled": true,
  "family": "practice",
  "interaction": "choice",
  "trigger": {
    "kind": "time_cross",
    "timeSeconds": 39,
    "captionId": "caption-18"
  },
  "display": {},
  "evaluation": {},
  "effects": {
    "pause": true
  }
}
```

合法组合只有：

| family | interaction | 语义 |
| --- | --- | --- |
| `attention` | `notice` | 重点标注 |
| `practice` | `choice` | 选择题 |
| `practice` | `blank` | 填空题 |
| `followup` | `free_text` | 问答题 |

选择题答案必须引用现有选项；填空题固定执行 `trim`、`casefold`；问答题不调用 AI，只保存
原始回答并显示教师预设反馈。

## 9. 本地状态和保留规则

### 学生课程

- `studentCourseStore` 使用一次 `chrome.storage.local.set` 作为整库提交边界；
- `installedCourses[courseId]` 保存课程包，`learningStates[courseId][lessonId]` 保存学习状态；
- 新课程按 `courseId` 合并，不替换其他课程；
- 相同课程更新时只迁移新包中仍存在的合法节点状态；
- 同一 service worker 实例内的课程库读改写操作串行执行，避免并发领取互相覆盖；
- 失败路径不覆盖已经保存的课程或状态；
- 当前没有服务端同步、导出或远程删除。

### 教师预览

- `currentCourse` 保存完整课程对象；
- 清除课程时同时清除 `activePreviewSession`；
- `expectedCourseId` 防止旧页面清除新课程；
- 存量数据每次读取都重新校验。

### 数据保留

- 发布版本、授权码记录和操作日志当前没有自动清理策略；
- 教师会话过期后会被拒绝，但当前没有自动删除作业；
- 生产 SQLite 的自动备份和恢复演练尚未形成已验证流程；
- Chrome 本地课程和学习状态由用户替换插件数据或清理扩展数据时删除。

## 10. 消息协议

教师预览桥请求：

```json
{
  "channel": "lessonpilot.workspace.v1",
  "protocolVersion": 1,
  "requestId": "req-550e8400-e29b-41d4-a716-446655440000",
  "type": "SAVE_CURRENT_COURSE",
  "payload": {
    "course": {}
  }
}
```

响应 channel 是 `lessonpilot.extension.v1`。开放操作：

| 操作 | payload | 成功 data |
| --- | --- | --- |
| `PING` | `{}` | `{extensionVersion}` |
| `GET_CURRENT_COURSE` | `{}` | `{course}` |
| `SAVE_CURRENT_COURSE` | `{course}` | `{courseId, updatedAt}` |
| `CLEAR_CURRENT_COURSE` | `{expectedCourseId}` | `{cleared:true}` |
| `START_PREVIEW_SESSION` | `{courseId}` | `{sessionId, startedAt}` |

请求信封由页面、content script、background 分层校验。channel 不匹配在 content script
静默丢弃，避免第三方页面脚本探测插件是否安装。

学生课程下载使用独立的 `chrome.runtime` 消息：

- `GET_INSTALLED_STUDENT_COURSES`
- `DOWNLOAD_STUDENT_COURSE`
- `RECORD_STUDENT_NODE_ATTEMPT`

该组消息当前没有版本化 envelope，处理器仍对 payload、响应和存储内容逐项校验。

## 11. 数据流

```mermaid
flowchart LR
  A["教师输入与本地字幕"] --> B["Pydantic / 浏览器校验"]
  B --> C["SQLite 草稿"]
  C --> D["发布 adapter"]
  D --> E["PublishedScript"]
  E --> F["授权码下载 API"]
  F --> G["插件契约复验"]
  G --> H["studentCourseStore"]
  H --> I["匹配 BVID 的学习运行时"]
```

当前生产教师网页调用 `https://knownmap.com/api/v1`。当前学生插件课程下载仍固定调用
`http://127.0.0.1:8000/api/v1/public/course-download`；生产端点虽已存在，但插件切换和
完整公网闭环尚未完成。

详细失败、重试、日志和发布血缘见 [`data/flow.md`](data/flow.md)。

## 12. 数据质量与安全

最低要求：

- 数据库字段、migration、Pydantic、插件契约和文档保持一致；
- 输入类型、长度、枚举、唯一性、顺序和引用关系可执行校验；
- 授权码、会话 token、密码和摘要不进入日志或文档；
- 教师临时密码只允许出现在创建/重置的即时 HTTPS 响应和当前页面内存；
- 教师列表的 `published_course_count` 只统计 `courses.status = 'published'`；
- 字幕正文、节点正文和学生答案不进入运行日志；
- 下载失败和 schema 失败不破坏已保存数据；
- 发布结果可追溯到课节、发布版本、教师和 request ID；
- 生产发布可追溯到 release ID、Git commit、Git tag 和文件哈希；
- 当前实现与未来模型明确分层。

2026-08-20 的本机审计发现 `backend/knownmap.db` 没有可靠的 Alembic 版本标记，并缺少
0007 列。该文件是 Git 忽略的本机状态，不改变代码目标 schema，但使用前必须备份并运行
migration。详见 [`data/quality.md`](data/quality.md)。

## 13. 校验层分工

| 规则 | 当前执行层 |
| --- | --- |
| 数据库表、列、索引、外键 | SQLAlchemy model + Alembic migration |
| API 类型、长度、严格字段 | Pydantic |
| 教师资源归属 | 服务层查询 |
| 节点组合、排序、ID、答案引用 | 后端 Pydantic + 共享课程契约 |
| `captionId` 格式 | 后端和共享契约 |
| `captionId` 对本地字幕的引用 | 教师编辑器 |
| 字幕解析和 HTML 标签清理 | `teacher-web/subtitle-parser.js` |
| 发布包字段裁剪 | `backend/app/adapters/plugin_course_config.py` |
| 下载响应复验 | `src/background/course-downloader.js` |
| Chrome 存量课程复验 | background 读取路径 |
| 多课程合并与并发写入 | `src/background/course-downloader.js` 的课程库队列 |
| BVID 页面匹配 | `src/content/course-runtime.js` |
| 会话 Cookie 和教师身份 | FastAPI 认证依赖 |
| 管理员 Cookie 和管理员身份 | 独立 FastAPI 管理员认证依赖 |
| 教师账号创建/重置 | 管理员服务层 + Argon2 哈希 |
| 已发布课程数量 | SQLAlchemy 分组聚合，只计 `published` |
| 日志脱敏 | 固定日志字段和不记录原文的调用约束 |
| 发布记录与文件哈希 | `tools/web-release.sh` |

`normalizeCoursePackage()` 只整理每个课节中的节点顺序，不修改课程或课节 ID；
`validateCoursePackage()` 对非法值拒绝，background 不替服务端修复语义错误。

## 14. 当前模型与目标模型

已接受并实施：

- D-023：课程与课节使用后台 UUID，插件不从 BVID 派生身份；
- D-024：后端发布、授权下载、插件运行和学习状态均使用多课节结构；
- D-025：授权码通过多条 `AccessGrant` 覆盖课程、课节、节点和现实有效时间。

当前学生端只接受 v2 多课程响应并写入 `studentCourseStore`。测试期没有正式旧课程，因此
旧单课程响应、旧 key 和迁移适配器全部不在支持范围。实施记录见
[`2026-08-20-multi-course-authorization-and-example-course.md`](../docs/superpowers/plans/2026-08-20-multi-course-authorization-and-example-course.md)。

## 15. 变更记录

| 日期 | 变更 | 影响 |
| --- | --- | --- |
| 2026-08-15 | 建立第一阶段本地课程契约与消息桥规则 | 历史基线 |
| 2026-08-18 | 加入 FastAPI、SQLite、草稿、发布和授权码 | 后端成为 canonical 数据源 |
| 2026-08-20 | 加入短期/长期授权码、插件本地学习状态、生产发布记录 | 数据边界扩展 |
| 2026-08-20 | 拆分模型、字典、流和质量文档，区分当前实现与目标模型 | 当前文档治理 |
| 2026-08-20 | 同步多课节后端、v2 课程包契约和 `studentCourseStore` 的分段实施状态 | 多课程迁移进行中 |
| 2026-08-20 | 完成 v2-only 多课程主链路、范围授权和内置示例课程，舍弃旧单课程兼容 | 多课程主链路生效 |
| 2026-08-20 | 加入独立超级管理员、教师账号创建/重置和已发布课程统计 | 管理后台数据边界生效 |
