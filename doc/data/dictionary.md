# KnownMap 数据字典

更新时间：2026-08-20

状态：当前代码字段字典。已接入、底层已实现待接入和纯目标字段分别标注。

上级入口：[`../data-spec.md`](../data-spec.md)

## 1. 公共约定

| 约定 | 当前规则 |
| --- | --- |
| 数据库 UUID | 36 字符 UUID 字符串，由服务端 `uuid4()` 默认生成 |
| API 命名 | 后端 API 使用 `snake_case`，插件契约使用 `camelCase` |
| 时间 | 后端使用 UTC datetime；插件契约要求 UTC ISO 8601 毫秒格式 |
| BVID | `^BV[a-zA-Z0-9]+$` |
| 节点 ID | 1-80 个可打印 ASCII 字符，非空 |
| 未知字段 | Pydantic 严格模型和插件共享契约拒绝未知字段 |
| 敏感级别 | `public`、`internal`、`sensitive`、`secret` |

## 2. 数据库字段

### 2.1 `teachers`

| 字段 | 类型 | 空值 | 默认/约束 | API 暴露 | 敏感级别 |
| --- | --- | --- | --- | --- | --- |
| `id` | `VARCHAR(36)` | 否 | UUID 主键 | 是 | internal |
| `login_name` | `VARCHAR(80)` | 否 | 唯一索引；请求长度 3-80 | 是 | sensitive |
| `password_hash` | `VARCHAR(255)` | 否 | `pwdlib` 推荐慢哈希 | 否 | secret |
| `display_name` | `VARCHAR(120)` | 否 | seed 输入 | 是 | internal |
| `status` | `VARCHAR(20)` | 否 | 默认 `active` | 是 | internal |
| `created_at` | datetime | 否 | 服务端 UTC | 否 | internal |
| `updated_at` | datetime | 否 | 服务端 UTC，更新时刷新 | 否 | internal |

### 2.2 `teacher_sessions`

| 字段 | 类型 | 空值 | 默认/约束 | 说明 | 敏感级别 |
| --- | --- | --- | --- | --- | --- |
| `id` | `VARCHAR(36)` | 否 | UUID 主键 | 会话记录 ID | internal |
| `teacher_id` | `VARCHAR(36)` | 否 | 外键、索引 | 教师归属 | internal |
| `token_digest` | `VARCHAR(64)` | 否 | HMAC-SHA256、唯一索引 | 不保存原 token | secret |
| `expires_at` | datetime | 否 | 登录时间 + TTL | 过期后拒绝 | internal |
| `revoked_at` | datetime | 是 | 默认空 | 退出时写入 | internal |
| `created_at` | datetime | 否 | 服务端 UTC | 创建时间 | internal |

浏览器 Cookie 保存随机 token，使用 `HttpOnly`、`SameSite=Lax`；生产环境增加 `Secure`。

### 2.3 `workspaces`

| 字段 | 类型 | 空值 | 默认/约束 | 说明 | 敏感级别 |
| --- | --- | --- | --- | --- | --- |
| `id` | `VARCHAR(36)` | 否 | UUID 主键 | 工作空间 ID | internal |
| `owner_teacher_id` | `VARCHAR(36)` | 否 | 外键、唯一索引 | 当前唯一 Owner | internal |
| `name` | `VARCHAR(120)` | 否 | 自动生成 | 当前无编辑 API | internal |
| `created_at` | datetime | 否 | 服务端 UTC | 创建时间 | internal |

### 2.4 `courses`

| 字段 | 类型 | 空值 | 默认/约束 | API 映射 | 敏感级别 |
| --- | --- | --- | --- | --- | --- |
| `id` | `VARCHAR(36)` | 否 | UUID 主键 | `id` | internal |
| `workspace_id` | `VARCHAR(36)` | 否 | 外键、索引 | 不直接返回 | internal |
| `title` | `VARCHAR(200)` | 否 | trim 后长度 1-200 | `title` | internal |
| `description` | `TEXT` | 是 | API 最长 2000 | `description` | internal |
| `status` | `VARCHAR(20)` | 否 | `draft` / `published` 语义 | `status` | internal |
| `created_at` | datetime | 否 | 服务端 UTC | `created_at` | internal |
| `updated_at` | datetime | 否 | 服务端 UTC | `updated_at` | internal |

### 2.5 `lessons`

| 字段 | 类型 | 空值 | 默认/约束 | API 映射 | 敏感级别 |
| --- | --- | --- | --- | --- | --- |
| `id` | `VARCHAR(36)` | 否 | UUID 主键 | `id` | internal |
| `course_id` | `VARCHAR(36)` | 否 | 外键、普通索引；0008 已移除唯一约束 | `course_id` | internal |
| `title` | `VARCHAR(200)` | 否 | trim 后长度 1-200 | `title` | internal |
| `sort_order` | integer | 否 | 当前按同课程最大值加 1 | `sort_order` | internal |
| `platform` | `VARCHAR(20)` | 否 | 当前只允许 `bilibili` | `video_ref.platform` | internal |
| `video_id` | `VARCHAR(80)` | 否 | BVID 格式 | `video_ref.video_id` | internal |
| `status` | `VARCHAR(20)` | 否 | `draft` / `published` 语义 | `status` | internal |
| `created_at` | datetime | 否 | 服务端 UTC | `created_at` | internal |
| `updated_at` | datetime | 否 | 服务端 UTC | `updated_at` | internal |

### 2.6 `script_drafts`

| 字段 | 类型 | 空值 | 默认/约束 | 说明 | 敏感级别 |
| --- | --- | --- | --- | --- | --- |
| `id` | `VARCHAR(36)` | 否 | UUID 主键 | 草稿记录 ID | internal |
| `lesson_id` | `VARCHAR(36)` | 否 | 外键、唯一约束 | 一个课节一个当前草稿 | internal |
| `schema_version` | integer | 否 | 当前必须为 `1` | 草稿 schema 版本 | internal |
| `config_json` | JSON | 否 | `{"nodes":[]}` | 完整节点数组 | sensitive |
| `updated_at` | datetime | 否 | 服务端 UTC | 保存时间 | internal |

### 2.7 `published_scripts`

| 字段 | 类型 | 空值 | 默认/约束 | 说明 | 敏感级别 |
| --- | --- | --- | --- | --- | --- |
| `id` | `VARCHAR(36)` | 否 | UUID 主键 | 发布记录 ID | internal |
| `lesson_id` | `VARCHAR(36)` | 否 | 外键、索引 | 课节归属 | internal |
| `version` | integer | 否 | 每课节从 1 递增；联合唯一 | 发布版本 | internal |
| `config_json` | JSON | 否 | 当前为 `PluginCourseConfig` | 不可变输出快照 | sensitive |
| `published_at` | datetime | 否 | 服务端 UTC | 发布时间 | internal |
| `published_by` | `VARCHAR(36)` | 否 | 教师外键 | 发布者 | internal |

### 2.8 `access_codes`

| 字段 | 类型 | 空值 | 默认/约束 | 说明 | 敏感级别 |
| --- | --- | --- | --- | --- | --- |
| `id` | `VARCHAR(36)` | 否 | UUID 主键 | 授权码记录 ID | internal |
| `course_id` | `VARCHAR(36)` | 否 | 课程外键、索引 | 当前只绑定一门课程 | internal |
| `code_digest` | `VARCHAR(64)` | 否 | HMAC-SHA256、唯一索引 | 可检索摘要 | secret |
| `code_hint` | `VARCHAR(5)` | 否 | 原码最后 5 位 | 教师历史列表使用 | sensitive |
| `code_type` | `VARCHAR(20)` | 否 | `short_term` / `long_term` | 0007 新增 | internal |
| `expires_at` | datetime | 是 | 短期 7 天；长期为空 | 0007 新增 | internal |
| `created_at` | datetime | 否 | 服务端 UTC | 创建时间 | internal |

原始授权码格式是 `KM-XXXXX-XXXXX-XXXXX-XXXXX`，字符集为 Base32 大写字母和数字 2-7。
原文只在创建响应中返回一次，不写入数据库、日志或长期文档。

### 2.9 `operation_logs`

| 字段 | 类型 | 空值 | 说明 | 敏感级别 |
| --- | --- | --- | --- | --- |
| `id` | integer | 否 | 自增主键 | internal |
| `timestamp` | datetime | 否 | 服务端 UTC | internal |
| `request_id` | `VARCHAR(100)` | 否 | HTTP 请求关联 ID | internal |
| `actor_type` | `VARCHAR(40)` | 否 | `teacher` / `plugin` / `system` / `anonymous` | internal |
| `actor_id` | `VARCHAR(80)` | 是 | 当前没有学生 ID | internal |
| `module` | `VARCHAR(80)` | 否 | 业务模块 | internal |
| `action` | `VARCHAR(120)` | 否 | 稳定动作名 | internal |
| `target_type` | `VARCHAR(80)` | 是 | 目标实体类型 | internal |
| `target_id` | `VARCHAR(80)` | 是 | 目标实体 ID | internal |
| `result` | `VARCHAR(20)` | 否 | `success` / `failure` | internal |
| `error_code` | `VARCHAR(80)` | 是 | 稳定错误码 | internal |
| `duration_ms` | integer | 是 | 动作耗时 | internal |

## 3. 插件课程契约

### 3.1 `CoursePackage` v2

| 字段 | 类型 | 必填 | 当前规则 | 来源 | 敏感级别 |
| --- | --- | --- | --- | --- | --- |
| `schemaVersion` | integer | 是 | 固定 `2` | 发布 adapter | internal |
| `courseId` | UUID/string | 是 | 直接使用后台 `Course.id` | `Course.id` | internal |
| `title` | string | 是 | 学生界面显示课程名称 | `Course.title` | internal |
| `lessons` | array | 是 | 至少一个课节；UUID 和同课程 BVID 不重复 | `Course.lessons` | sensitive |
| `updatedAt` | string | 是 | UTC ISO 毫秒格式 | 发布 adapter 生成 | internal |

`lessons[]` 包含 `lessonId`、课节标题、`videoRef`、非空 `nodes` 和 `updatedAt`。完整字幕、
教师账号、工作空间、授权码摘要和操作日志不得进入该对象。

### 3.2 节点公共字段

| 字段 | 类型 | 必填 | 当前规则 | 敏感级别 |
| --- | --- | --- | --- | --- |
| `id` | string | 是 | 1-80 个可打印 ASCII；课程内唯一 | internal |
| `enabled` | boolean | 是 | `false` 时运行时跳过 | internal |
| `family` | enum | 是 | `attention` / `practice` / `followup` | internal |
| `interaction` | enum | 是 | `notice` / `choice` / `blank` / `free_text` | internal |
| `trigger.kind` | enum | 是 | 固定 `time_cross` | internal |
| `trigger.timeSeconds` | number | 是 | 有限、非负 | internal |
| `trigger.captionId` | string/null | 否 | 只校验 ID 格式；字幕引用由教师前端负责 | internal |
| `effects.pause` | boolean | 是 | 固定 `true` | internal |
| `display` | object | 是 | 按节点类型闭合校验 | sensitive |
| `evaluation` | object/null | 是 | 按节点类型闭合校验 | sensitive |

合法组合：

| `family` | `interaction` | `display` 关键字段 | `evaluation` 关键字段 |
| --- | --- | --- | --- |
| `attention` | `notice` | `title`、`body`、可选引用和高亮 | `null` |
| `practice` | `choice` | `title`、`prompt`、2-8 个选项 | `answer`、`explanation` |
| `practice` | `blank` | `title`、`prompt` | `acceptedAnswers`、固定 normalize、`explanation` |
| `followup` | `free_text` | `title`、`prompt` | `referenceFeedback` |

## 4. Chrome 本地存储

### 4.1 `currentCourse`

教师工作台历史预览桥使用，值为完整 `PluginCourseConfig`。保存时整对象替换，读取时再次
校验。它不等于学生领取课程。

### 4.2 `activePreviewSession`

| 字段 | 类型 | 当前规则 |
| --- | --- | --- |
| `schemaVersion` | integer | 固定 `1` |
| `sessionId` | string | `session-<UUID>` |
| `courseId` | string | 必须匹配 `currentCourse.courseId` |
| `courseUpdatedAt` | string | 固定到创建会话时课程版本 |
| `startedAt` | string | 后台生成 ISO 时间 |
| `nodeStates` | object map | 每个节点初始为 `{status:"pending", attempts:0, answer:null}` |

当前代码只创建预览会话，没有持久化更新该会话节点状态的处理器。

### 4.3 `studentCourseStore`

| 字段 | 类型 | 当前规则 |
| --- | --- | --- |
| `storageVersion` | integer | 固定 `2` |
| `installedCourses` | object map | 按 `courseId` 保存已校验的 v2 课程包装 |
| `learningStates` | object map | 按 `courseId + lessonId` 保存课节状态 |

`installedCourses[courseId]` 包含 `courseId`、`title`、`installedAt`、`source`、`readOnly`
和完整 `course` 包。示例课程使用 `source: "example"`、`readOnly: true`。

`learningStates[courseId][lessonId]`：

| 字段 | 类型 | 当前规则 |
| --- | --- | --- |
| `schemaVersion` | integer | 固定 `1` |
| `courseId` | UUID/string | 与外层课程一致 |
| `lessonId` | UUID/string | 与外层课节一致 |
| `courseUpdatedAt` | string | 对应课程包 `updatedAt` |
| `lessonUpdatedAt` | string | 对应课节 `updatedAt` |
| `nodeStates` | object map | 只保存已经作答的节点 |

`nodeStates[nodeId]`：

| 字段 | 类型 | 当前规则 | 敏感级别 |
| --- | --- | --- | --- |
| `status` | enum | `completed` / `retry` | internal |
| `attempts` | integer | 安全整数，至少 1 | internal |
| `lastAnswer` | string/null | 最长 2000；原始学生回答 | sensitive |

课程同 ID 更新时，只保留新课程中仍存在且结构合法的节点状态。不同课程彼此并存。
`studentCourseStore` 是学生侧唯一 key，不读取或迁移 `installedCourse` / `learningState`。

## 5. 教师浏览器临时数据

| 数据 | 位置 | 生命周期 | 是否进入后端 |
| --- | --- | --- | --- |
| `captions` | `teacher-web/app.js` 内存 | 当前页面会话 | 否 |
| `durationSeconds` | 编辑器状态 | 由字幕、节点和 513 秒下限计算 | 否 |
| `selectedNodeId` | 编辑器状态 | 当前页面会话 | 否 |
| `armedPluginId` | 编辑器状态 | 一次放置动作 | 否 |
| 节点编辑 `dialog.draft` | 编辑器状态 | 弹窗打开期间 | 保存节点后才进入草稿 |
| `knownmap_teacher_session=1` | `sessionStorage` | 当前标签页会话 | 否，只表示应尝试 `/auth/me` |
| 会话 token | HttpOnly Cookie | TTL 内或退出前 | 浏览器自动发送，不可被页面 JS 读取 |

字幕文件内容和解析后的字幕正文只在教师浏览器中存在。

历史阶段 1B 曾使用 `localStorage` key `lessonpilot.workspaceDraft.v1` 保存单个网页草稿。
当前 FastAPI 编辑器不读写该 key；它仅作为兼容保留标识，不得复用于新的多课程 store。

## 6. API 包装结构

| API 对象 | 关键字段 | 说明 |
| --- | --- | --- |
| `CourseDetail` | 课程字段 + `lessons[]` | 按 `sort_order, created_at` 返回多个课节 |
| `ScriptDraftResponse` | `schema_version`、`config`、`lesson_id`、`node_count`、`updated_at` | 草稿读取/保存 |
| `PublishResponse` | `course_id`、`lesson_id`、`version`、`published_at`、`course` | `course` 是插件输出 |
| `AccessCodeCreated` | 原始码、课程信息、类型、时间 | 原始码只返回一次 |
| `AccessCodeListResponse` | 总数、分类计数、脱敏记录 | 不返回原始码或摘要 |
| `CourseDownloadResponse` | `course` | 当前只返回一门课程 |
| API 错误 | `error.code/message/request_id` | 不返回堆栈、SQL 或敏感字段 |

## 7. 其它结构化数据文件

| 文件/位置 | 结构 | 状态 | 权威性 |
| --- | --- | --- | --- |
| `teacher-web/course.json` | 旧演示课程元数据 | 历史/演示 | 非当前后端 schema |
| `teacher-web/demo-captions.js` | 内置字幕数组 | 演示数据 | 非生产课程数据 |
| `doc/*.srt` | 教师示例字幕 | 测试/演示输入 | 原始数据样例 |
| `deploy/releases/*.json` | Web/后端生产发布记录 | 已验证发布事实 | 每次发布记录权威 |
| `src/manifest.json` | Chrome 扩展清单 | 当前插件构建配置 | 插件元数据权威 |
| `backend/knownmap.db` | 本地忽略的 SQLite 运行数据 | 可变本机状态 | 不是 schema 权威 |
| `/var/lib/knownmap/knownmap.db` | 生产 SQLite | 生产运行数据 | 不进入 Git |

## 8. 多课程字段

### 8.1 `AccessGrant`

| 字段 | 类型 | 空值 | 当前规则 |
| --- | --- | --- | --- |
| `id` | UUID/string | 否 | 独立主键 |
| `access_code_id` | UUID/string | 否 | 授权码外键、查询索引 |
| `course_id` | UUID/string | 否 | 课程外键、查询索引 |
| `lesson_id` | UUID/string | 是 | 课节范围；必须属于 `course_id` |
| `node_id` | string | 是 | 节点范围；非空时 `lesson_id` 必须非空 |
| `valid_from` | datetime | 是 | 现实时间授权起点 |
| `valid_until` | datetime | 是 | 现实时间授权终点 |
| `created_at` | datetime | 否 | 服务端 UTC |

`valid_from/valid_until` 与视频内 `trigger.timeSeconds` 是不同维度，不得互相替代。

### 8.2 `CoursePackage` v2

状态：JavaScript 与 Pydantic 契约、后端发布和公开下载均已接入。

| 字段 | 类型 | 必填 | 计划规则 |
| --- | --- | --- | --- |
| `schemaVersion` | integer | 是 | 固定 `2` |
| `courseId` | UUID/string | 是 | 直接使用后台 `Course.id` |
| `title` | string | 是 | 学生界面显示名称 |
| `lessons` | array | 是 | 至少一个已发布课节，`lessonId` 不重复 |
| `updatedAt` | UTC ISO string | 是 | 课程包更新时间 |

`lessons[]`：

| 字段 | 类型 | 必填 | 计划规则 |
| --- | --- | --- | --- |
| `lessonId` | UUID/string | 是 | 后台 `Lesson.id` |
| `title` | string | 是 | 学生界面显示名称 |
| `videoRef` | object | 是 | 当前只允许 B 站 BVID |
| `nodes` | array | 是 | 非空，复用现有节点校验 |
| `updatedAt` | UTC ISO string | 是 | 课节发布更新时间 |

公开下载包装固定为 `{ "courses": CoursePackage[] }`。旧 `{ "course": ... }` 直接拒绝。

### 8.3 插件本地仓库 v2

状态：`studentCourseStore`、下载器、运行时、UI 和示例课程均已接入。

| 字段 | 类型 | 计划规则 |
| --- | --- | --- |
| `storageVersion` | integer | 固定 `2` |
| `installedCourses` | object map | 按 `courseId` 保存多门课程 |
| `installedCourses[courseId].course.lessons` | array | 保存 v2 课程包的全部授权课节 |
| `learningStates` | object map | 按 `courseId + lessonId` 隔离学习状态 |

首次读取空仓库时自动加入固定 UUID 的只读示例课程。测试期没有正式旧课程，因此不提供
旧 key 迁移。

`assetId` 和真实 Finder 课程目录仍未进入本轮实施范围，不能写成当前字段。
