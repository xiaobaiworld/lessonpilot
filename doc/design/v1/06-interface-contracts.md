# 06 v1 接口与集成契约设计

文档版本：`1.1.0`

状态：已于 2026-08-22 通过人工审核；2026-08-27 增补教师课程列表聚合指标、学生作答统计预留字段及节点预览消费边界；按 `D-V1-018` 增补版本级授权和后续升级兼容契约边界；本文件把已接受接口需求落为可实现的跨边界契约，不替代业务需求、数据模型或安全运维设计

`1.0.1` 增补第 4.5 节 v1 HTTP 端点清单。这是**增量补充，不改变已冻结的契约语义**：
原文定义了信封、兑换和更新的字段边界，但从未枚举完整端点，实现时缺少可对照的基准。
清单按已冻结需求推导，并由 `node tools/endpoint-check.mjs` 与后端实现持续对照。

需求真源：[`../../requirements/v1/README.md`](../../requirements/v1/README.md)

前置设计：[`03-system-architecture.md`](03-system-architecture.md)、[`04-domain-data-model.md`](04-domain-data-model.md)、[`05-data-flow-lifecycle.md`](05-data-flow-lifecycle.md)

## 1. 目的与边界

本文件冻结 KnownMap v1 各边界之间“传什么、谁负责校验、失败如何表达、版本如何兼容”的最小契约：

1. Web 应用与 FastAPI 的 HTTP API；
2. 插件页面、后台和内容脚本之间的内部消息；
3. 兑换服务与插件之间的课程发布包；
4. 教师字幕和课程导入/导出文件；
5. 插件与哔哩哔哩页面/播放器的宿主适配边界；
6. 公开销售页、飞书表单和人工运营之间的外部集成。

本文件不展开通用密码策略、日志保留、备份、发布命令和页面视觉；这些内容由 08、09、开发规范和交互
设计承接。接口契约不等于数据库模型：外部响应不得直接暴露 SQL 表或服务端内部字段。

## 2. 契约真源与共同规则

### 2.1 真源分工

| 边界 | 机器可检查真源 | 适配层 |
| --- | --- | --- |
| HTTP API | FastAPI/Pydantic 生成的 OpenAPI | TypeScript 客户端、服务端路由和契约测试 |
| 课程包 | 仓库内版本化 JSON Schema | Python 生成/校验层、插件 TypeScript 校验层 |
| 插件消息 | 仓库内版本化 JSON Schema | popup/background/content 的消息适配器 |
| 教师文件 | 版本化 JSON Schema 与字幕格式测试夹具 | 浏览器解析器、导入导出器 |
| 发布清单 | 构建产物清单 Schema | 构建脚本、部署脚本、回滚检查 |

同一字段只能有一个协议真源。数据库迁移、页面表单对象和旧 `course.json` 不能直接充当公开契约。

### 2.2 所有契约的共同约束

- 顶层包含协议名称和 `schemaVersion`；未知主版本安全拒绝，已知主版本只按明确兼容规则处理；
- 字段默认封闭，禁止客户端向未知字段注入任意对象；
- 身份使用稳定 ID，显示名称只用于展示，不能作为权限或关联主键；
- 时间使用带时区的 ISO 8601，服务端持久化 UTC，过期边界按需求定义为明确的包含/不包含；
- 响应包含 `requestId` 或等价关联标识，错误包含稳定 `errorCode`，不得只返回可变人类文案；
- 请求、响应和日志均执行大小上限、字段白名单和敏感字段脱敏；
- 网络重试不能制造重复业务事实；需要幂等的动作必须携带业务幂等键；
- 认证、授权、完整性和业务状态都由权威一侧重新校验，客户端展示字段不构成授权证明。

## 3. 参与方与信任方向

```text
公开销售页 ──批准的 HTTPS 表单链接──> 飞书公开表单 ──人工读取──> 管理员/运营

教师 Web ──教师会话 HTTP──> FastAPI ──事务──> SQLite

插件 popup/content ──版本化内部消息──> 插件 background
                                      ├─HTTPS──> FastAPI 兑换/课程服务
                                      └─本机存储──> Chrome extension storage

插件 content ──最小适配调用──> 当前 B 站主播放器
```

页面、内容脚本、课程包和本机已有存储都是不可信输入；后台服务和 FastAPI 业务层不能因输入来自“自己的
另一个组件”而跳过校验。学生插件不携带教师会话，也不通过授权码获得工作空间成员身份。

## 4. HTTP API 契约

### 4.1 统一请求/响应信封

业务请求的协议字段由 API 具体模型定义，统一元数据至少包括：

```json
{
  "requestId": "req-uuid",
  "schemaVersion": 1,
  "data": {}
}
```

错误响应使用同样的关联标识：

```json
{
  "requestId": "req-uuid",
  "schemaVersion": 1,
  "error": {
    "errorCode": "GRANT_CODE_INVALID",
    "retryable": false,
    "messageKey": "grant.code.invalid"
  }
}
```

`messageKey` 只用于客户端本地化，不把异常堆栈、SQL 信息、授权码摘要、本机身份或内部路径返回给用户。
同一个 `requestId` 不是幂等键；会改变业务状态的请求必须另带 `idempotencyKey`。

### 4.2 Web 业务 API

管理员和教师 API 遵循以下边界：

- 浏览器只提交业务输入，不提交“我是哪个角色/工作空间”的可信声明；
- FastAPI 根据当前会话重算角色、教师身份和工作空间归属；
- 读操作返回当前允许的最小字段；写操作返回新修订、状态和稳定 ID；
- 草稿保存、发布、授权码创建、终止来源等动作分别使用明确操作，不通过一个任意 PATCH 改写多个领域；
- 写请求失败时返回固定错误码和可重试性，原草稿、发布或授权状态保持不变。

最小公共错误码集合：

| 错误码 | 语义 | 默认恢复 |
| --- | --- | --- |
| `AUTH_REQUIRED` / `AUTH_ROLE_FORBIDDEN` | 会话缺失或角色不允许 | 重新登录或返回所属页面 |
| `WORKSPACE_SCOPE_FORBIDDEN` | 不属于当前工作空间 | 不重试同一对象，修正来源 |
| `REVISION_CONFLICT` | 草稿修订落后 | 重新读取并人工合并 |
| `RELEASE_NOT_DELIVERABLE` | 发布不可交付或被暂停 | 修正内容/权利状态后重试 |
| `VALIDATION_FAILED` | 输入或结构不符合契约 | 按字段错误修正 |
| `IDEMPOTENCY_REPLAY` | 已有相同业务结果 | 返回原结果或查询当前状态 |
| `TEMPORARY_UNAVAILABLE` | 服务或依赖暂时不可用 | 退避后重试，不改变本机旧状态 |
| `INTERNAL_ERROR` | 未能安全确定结果 | 显示失败，依赖 requestId 排查 |

错误码可以增加，但不能改变既有错误的含义；详细字段错误只在授权用户的业务响应中返回，普通日志记录
固定原因码和关联标识。

### 4.3 首次课程兑换

兑换请求由插件后台发送，示意结构如下：

```json
{
  "schemaVersion": 1,
  "idempotencyKey": "redeem-attempt-uuid",
  "accessCode": "KM-EXAMPLE-ONLY",
  "localIdentityId": "local-id",
  "localProof": "high-entropy-device-proof",
  "client": {
    "extensionVersion": "1.0.0",
    "browserFamily": "chrome"
  }
}
```

原始授权码只在 TLS 请求中短暂出现，服务端不得回显、日志记录或保存。`localIdentityId` 用于建立领取关系；
`localProof` 是当前机器后续更新/重新下载的最小证明，服务端只保存不可反推摘要。丢失本机证明时必须重新
输入仍可领取的授权码，不能用一个可猜测的普通 ID 恢复资格。

当授权码已经登记了默认上限 20 个不同的本地浏览器标识，而请求携带的是新的标识时，服务端返回
`ACCESS_CODE_DEVICE_LIMIT_REACHED`，不创建 `Redemption`，不返回课程包；已经登记过的同一标识不受该错误影响。

成功响应包含安全的兑换引用、学生可读摘要和完整课程包：

```json
{
  "schemaVersion": 1,
  "requestId": "req-uuid",
  "data": {
    "redemption": {
      "sourceRef": "safe-source-reference",
      "status": "accepted"
    },
    "courses": [
      {
        "courseId": "course-uuid",
        "title": "课程名称",
        "releaseId": "release-uuid",
        "releaseNumber": 3,
        "installKind": "new",
        "authorizedScope": {"type": "course"},
        "packageDigest": "sha256:...",
        "package": {}
      }
    ]
  }
}
```

服务端只返回当前机器全部有效来源合并后的允许内容，不接收客户端自选课程 ID 来扩大范围。授权无效、过期、
无可交付发布或跨工作空间时，不返回任何课程正文；响应可以返回稳定错误码和安全的重试建议。

### 4.4 免输授权码的重新下载/更新

更新请求不携带原始授权码，至少包含：

```json
{
  "schemaVersion": 1,
  "idempotencyKey": "update-attempt-uuid",
  "localIdentityId": "local-id",
  "localProof": "high-entropy-device-proof",
  "courseIds": ["course-uuid"],
  "knownReleases": [{"courseId": "course-uuid", "releaseId": "release-uuid"}]
}
```

`courseIds` 和 `knownReleases` 只表达查询意图，不能授予范围。服务端重新计算全部有效资格，返回每门课程的
当前发布版本、范围变化和完整包，或返回 `UP_TO_DATE`。如果某课程不再具备在线资格，响应只说明该课程不能
更新，不删除本机已安装内容。

### 4.5 v1 HTTP 端点清单

按 `ARCH-DEC-02`，OpenAPI 是 HTTP 契约的真源，本清单不替代它。清单的作用是给实现提供
**可对照的完整基准**：阶段 1–3 每建立一个端点就在此勾对，避免漏接口、路径命名不一致，
或把某个模块的能力挂到另一个模块的路径下。

`node tools/endpoint-check.mjs` 从 `v1/backend/` 的 OpenAPI 读取实际实现并比对本清单。

列含义：**模块**为 03 第 7 节的六个业务模块；**状态**为 `已有`（v0.9.1 已实现且路径不变）、
`改名`（能力已有但路径需调整）、`新建`（v1 新增）；**依据**为冻结需求或设计位置。

`改名` 行在依据列用 `旧路径：<方法> <路径>` 记录当前实现的位置。检查工具据此把旧路径
识别为「待退役」，而不是「未登记的野端点」 —— 两者处置完全不同：前者随重构删除，
后者说明实现绕过了契约设计。旧路径退役后从依据列移除该标注。

#### 身份与会话

| 方法 | 路径 | 状态 | 依据 |
| --- | --- | --- | --- |
| POST | `/api/v1/admin/auth/login` | 已有 | `FR-AUTH-001` |
| POST | `/api/v1/admin/auth/logout` | 已有 | `FR-AUTH-001` |
| GET | `/api/v1/admin/auth/me` | 已有 | `FR-AUTH-001` 会话恢复 |
| POST | `/api/v1/teacher/auth/login` | 改名 | `FR-AUTH-004`；旧路径：`POST /api/v1/auth/login` |
| POST | `/api/v1/teacher/auth/logout` | 改名 | `FR-AUTH-004`；旧路径：`POST /api/v1/auth/logout` |
| GET | `/api/v1/teacher/auth/me` | 改名 | 会话恢复；旧路径：`GET /api/v1/auth/me` |

教师端点加 `/teacher` 前缀是为了让角色在路径上与 `/admin` 对称，便于按前缀审计
和配置反向代理。这不改变 `INT-WEB-001`：角色仍由服务端从会话重算，路径前缀不是权限依据。

#### 管理与支持

| 方法 | 路径 | 状态 | 依据 |
| --- | --- | --- | --- |
| GET | `/api/v1/admin/teachers` | 已有 | `FR-ADMIN-*` |
| POST | `/api/v1/admin/teachers` | 已有 | `FR-AUTH-002` |
| POST | `/api/v1/admin/teachers/{teacher_id}/reset-password` | 已有 | `FR-AUTH-003` |
| POST | `/api/v1/admin/teachers/{teacher_id}/deactivate` | 新建 | `FR-AUTH-003` 停用并终止会话 |
| POST | `/api/v1/admin/teachers/{teacher_id}/reactivate` | 新建 | `FR-AUTH-003` 恢复登录资格 |
| GET | `/api/v1/admin/trial-followups` | 新建 | `FR-INTAKE-*`、`DATA-INTAKE-002` |
| PATCH | `/api/v1/admin/trial-followups/{followup_id}` | 新建 | `DATA-INTAKE-002` 跟进状态独立生命周期 |

停用与恢复必须是独立动作，不能用 `PATCH teachers/{id}` 改状态字段代替 —— 停用要在同一事务内
终止该教师全部会话（04 第 5 节 `credential_version`），这不是一次普通字段更新。

#### 工作空间与课程

| 方法 | 路径 | 状态 | 依据 |
| --- | --- | --- | --- |
| GET | `/api/v1/teacher/courses` | 已有 | `FR-COURSE-*`、`FR-WS-*` |
| POST | `/api/v1/teacher/courses` | 已有 | `FR-COURSE-001` |
| GET | `/api/v1/teacher/courses/{course_id}` | 已有 | `FR-COURSE-*` |
| PATCH | `/api/v1/teacher/courses/{course_id}` | 新建 | `FR-COURSE-*`；带 `revision` 前置条件 |
| POST | `/api/v1/teacher/courses/{course_id}/archive` | 新建 | 04 第 6 节归档用状态而非物理删除 |
| POST | `/api/v1/teacher/courses/{course_id}/lessons` | 已有 | `FR-COURSE-*` 允许同内容多课节 |
| GET | `/api/v1/teacher/lessons/{lesson_id}` | 已有 | `FR-COURSE-*` |
| PATCH | `/api/v1/teacher/lessons/{lesson_id}` | 新建 | 课节元数据与视频引用，带 `revision` |
| DELETE | `/api/v1/teacher/lessons/{lesson_id}` | 新建 | `FR-COURSE-*`；不破坏已发布快照 |
| PUT | `/api/v1/teacher/courses/{course_id}/lesson-order` | 新建 | 04 第 6 节整组重排必须是一个事务 |

课节重排是**整组提交**，不是逐个 `PATCH sequence`。04 第 6 节要求「整组重排是一个事务，
不留下重复或部分顺序」，逐个更新无法满足该约束，因此单独建立一个端点。

教师课程列表响应的每个 `item` 额外返回 `metrics` 聚合字段：`lesson_count`、
`draft_lesson_count`、`draft_node_count`、`published_node_count`、`access_code_count`、
`redeemed_count`、`student_submission_count`、`release_number` 和 `published_at`。这些字段只用于教师工作台总览，分别由课程、
制作/发布和授权模块提供；`redeemed_count` 是按不可逆本机标识去重后的已领取浏览器设备数量，不代表学生账号或学生作答。
`student_submission_count` 是为后续学生作答统计预留的可空字段：当前阶段固定返回 `null`，因为学生回答只保存在学生本机，
现有服务端没有接收或保存作答事件。后续实现前必须另行确定统计口径（按学生、设备、课程版本、作业还是提交事件去重）、数据来源、保留期限和隐私边界；
在此之前前端不得把 `redeemed_count` 或其他数字当作学生作答数。

#### 制作与发布

| 方法 | 路径 | 状态 | 依据 |
| --- | --- | --- | --- |
| POST | `/api/v1/teacher/assets/upload` | 新建 | `FR-AUTHOR-014`、`DATA-CONTENT-006`；上传图片、音频或视频并生成 `assetId` |
| POST | `/api/v1/teacher/assets/import-url` | 新建 | `FR-AUTHOR-014`、`DATA-CONTENT-006`；服务器导入安全的 HTTP(S) 媒体 URL |
| GET | `/api/v1/teacher/assets/{asset_id}` | 新建 | 教师预览和后续资源交付按稳定 `assetId` 读取 |
| POST | `/api/v1/teacher/subtitles/repair` | 新建 | `D-V1-017`；上传 SRT/VTT，临时检查并自动修复可确定的时间重叠，不写入草稿 |
| GET | `/api/v1/teacher/lessons/{lesson_id}/draft` | 已有 | `FR-AUTHOR-*` |
| PUT | `/api/v1/teacher/lessons/{lesson_id}/draft` | 已有 | 整份聚合替换，带 `revision` |
| GET | `/api/v1/teacher/courses/{course_id}/course-file` | 新建 | `FR-PORT-001`、`FR-PORT-005`；导出已保存草稿或指定发布版本 |
| POST | `/api/v1/teacher/course-files/import/preview` | 新建 | `FR-PORT-003`、`FR-PORT-004`；只校验并返回摘要，不写入 |
| POST | `/api/v1/teacher/course-files/import` | 新建 | `FR-PORT-003`、`FR-PORT-004`；确认后原子建立新课程草稿 |
| POST | `/api/v1/teacher/lessons/{lesson_id}/preview-sessions` | 新建 | 04 第 7.3 节 `PreviewSession` |
| POST | `/api/v1/teacher/preview-sessions/{preview_session_id}/end` | 新建 | 预览结束/过期，不产生学生数据 |
| POST | `/api/v1/teacher/courses/{course_id}/rights-attestation` | 新建 | `D-V1-008`、04 第 10 节 |
| POST | `/api/v1/teacher/courses/{course_id}/releases` | 改名 | 带 `idempotencyKey`；课程至少有一节课节即可创建新的发布快照，不要求测试预览；旧路径：`POST /api/v1/teacher/courses/{course_id}/publish` |
| GET | `/api/v1/teacher/courses/{course_id}/releases` | 新建 | 发布历史与当前可交付版本 |
| GET | `/api/v1/teacher/releases/{release_id}` | 新建 | 单次发布及课节快照 |
| POST | `/api/v1/teacher/releases/{release_id}/availability` | 新建 | 04 第 8 节 `ReleaseAvailability` 与内容分离 |

`publish` 改为 `POST .../releases`：发布产生的是一个**不可变资源** `CourseRelease`，
不是对课程执行一个动作。这让 `GET .../releases` 自然成为历史查询，也避免把
「暂停交付」误做成再发布一次 —— 后者由 `availability` 端点改状态，不改快照。

#### 授权与交付

| 方法 | 路径 | 状态 | 依据 |
| --- | --- | --- | --- |
| POST | `/api/v1/teacher/access-codes` | 改名 | 请求指定一个已发布课程的 `course_id`，原文只返回一次；兑换/更新时自动解析最新可交付版本；旧路径：`POST /api/v1/teacher/courses/{course_id}/access-codes` |
| GET | `/api/v1/teacher/access-codes` | 改名 | 支持按课程过滤；旧路径：`GET /api/v1/teacher/courses/{course_id}/access-codes` |
| GET | `/api/v1/teacher/access-codes/{access_code_id}` | 新建 | 尾号、范围、窗口、状态；不返回原文 |
| POST | `/api/v1/teacher/access-codes/{access_code_id}/terminate` | 新建 | `FR-GRANT-*`；只重算未来在线资格 |
| POST | `/api/v1/student/redemptions` | 改名 | 首次兑换，见 4.3；旧路径：`POST /api/v1/public/course-download` |
| POST | `/api/v1/student/course-updates` | 新建 | 免输授权码更新，见 4.4 |

当前课程级授权接口边界：`POST /teacher/access-codes` 的目标对象是一个已发布课程的 `courseId`；兑换和更新时服务端自动解析该课程最新可交付版本。
请求与响应必须能回溯授权的 `courseId` 以及实际返回的 `releaseId`；版本级授权目标后续再增加。
本次不新增版本操作端点，发布、修改本版本和增加版本的最终路径需在实现前按 `D-V1-018` 重新冻结事务契约。

后续升级兼容可新增或扩展课程升级关系查询/写入契约，但当前不实现。当前 `/student/course-updates` 按 `courseId` 返回其最新可交付版本；
只有进入跨独立课程升级时，才需冻结课程族、升级关系和本机状态迁移规则。

授权码端点从 `/teacher/courses/{course_id}/access-codes` 提升为顶级
`/teacher/access-codes`：一个授权码可以通过多个 `GrantItem` 覆盖多门课程
（04 第 9 节），挂在单门课程路径下会暗示「授权码属于某课程」这一错误模型。
当前实现的这个嵌套也正是 `access_code_service` 直接查 `Course`/`Lesson` 表的诱因之一。

学生端点使用 `/api/v1/student/` 而不是 `/public/`：兑换与更新都要求 `localIdentityId`
和 `localProof`，不是匿名公开能力。真正无需任何身份的只有销售页静态资源和健康检查。

#### 运行与审计

| 方法 | 路径 | 状态 | 依据 |
| --- | --- | --- | --- |
| GET | `/health` | 已有 | `OPS-HEALTH-*` |
| GET | `/api/v1/meta/version` | 新建 | `OPS-RELEASE-001` 组件与契约版本可识别 |
| GET | `/api/v1/meta/contracts` | 新建 | 课程包/消息 Schema 版本，供客户端兼容判定 |

`OperationAudit` 不开放查询端点。04 第 10 节把它定为受控弱关联记录，
v1 通过服务器端排障访问，不建面向页面的审计查询 API（`FR-ADMIN-*` 未要求）。

#### 清单口径与偏离规则

- 当前实现 48 个端点；本清单 48 个（`已有` 14、`改名` 7、`新建` 27）。
  其中 44 个已对齐；新增的教师课程文件导入预览、导入和导出端点属于本轮实现。
  差额主要来自课节顺序、预览会话、发布资源化、授权码终止、试用跟进和版本元数据。
  数量由 `node tools/endpoint-check.mjs` 实时统计，本段只说明差额来源，不手工维护数字。
- 清单不含 v1 明确排除的能力：教师自助注册（`FR-AUTH-002` 由管理员创建）、
  学生登录（`SCOPE-06` 单机标识）、AI 相关端点（`D-V1-002`）、
  教师查看学习反馈（`FR-REPORT-*` 后续阶段）、跨设备同步（`OPEN-01`）。
- 实现时发现清单缺项或多余项，先改本节再改代码；`endpoint-check` 失败不能靠改测试绕过。
- 路径与方法的最终事实仍以 OpenAPI 导出为准；两者不一致时以本节为待修正信号，
  不默认代码正确 —— 清单是按冻结需求推导的，代码可能只是还没写到。



## 5. 课程发布包契约

### 5.1 包的结构

课程包是 `CourseRelease` 按授权范围形成的只读投影，示意结构如下：

```json
{
  "schemaVersion": 1,
  "packageType": "course-release",
  "courseId": "course-uuid",
  "releaseId": "release-uuid",
  "releaseNumber": 3,
  "title": "课程名称",
  "packageDigest": "sha256:...",
  "authorizedScope": {
    "type": "course",
    "lessonIds": [],
    "nodeIds": []
  },
  "lessons": [
    {
      "lessonId": "lesson-uuid",
      "releaseLessonId": "release-lesson-uuid",
      "order": 1,
      "title": "课节名称",
      "videoRef": {
        "platform": "bilibili",
        "videoId": "BV...",
        "partId": null
      },
      "nodes": []
    }
  ]
}
```

必须保留课程、发布、课节和节点稳定标识及课节显式顺序。内容相同的多个课节也必须作为不同实例返回，不能
通过标题、视频或脚本去重。节点类型、内容、触发规则和运行所需配置遵循 04 的聚合 JSON 契约。

每个节点的公开内容投影至少包括：

```json
{
  "id": "node-uuid",
  "interaction": "notice",
  "anchor": { "kind": "time_cross", "timeSeconds": 23 },
  "content": { "schemaVersion": 1, "blocks": [] },
  "interactionData": null,
  "presentationHints": {
    "windowSize": "m",
    "windowStyle": "document",
    "windowPosition": "bottom-right"
  }
}
```

`content` 只保存结构化正文，媒体块只保存 `assetId`；B 站播放视频只出现在课节 `videoRef`。教师端预览
使用教师资源接口把 `assetId` 临时解析为媒体地址，不能把该地址回写为课程包真源。

### 5.2 禁止出现在包中的字段

课程包不得包含：密码、会话令牌、授权码原文或摘要、教师私有账号字段、完整字幕文件、学生回答、学生学习
状态、服务端数据库主键以外的内部调试字段、任意 HTML/脚本执行内容和第三方视频文件。

包中允许包含教师确认纳入发布的必要教学语义和节点内容；第三方视频仍由受支持宿主页面播放，插件只保存
精确视频引用。

字幕原文经教师保存草稿动作进入服务端草稿和发布快照（`DATA-CONTENT-005`、`D-V1-014`），并可随
`TeacherCourseFile` 在教师之间流转；这两处都不是课程包，本节"禁止完整字幕文件"的边界不受影响，
课程包仍不携带字幕。

### 5.3 插件校验最低顺序

插件后台收到包后，必须先在内存或临时区完成：

1. 包大小、JSON 解析和 Schema 校验；
2. `courseId`、`releaseId`、版本和授权范围一致性校验；
3. 课节顺序、课节归属、节点唯一性和节点类型校验；
4. 视频引用格式和允许平台校验；
5. 包摘要/完整性校验；
6. 安装摘要生成和学生确认；
7. 原子写入本机课程库。

任一步失败都不写入当前课程，不覆盖其它课程，也不把错误响应当作空课程安装。

## 6. 插件内部消息契约

### 6.1 消息信封

popup、content script 和 background 之间统一使用：

```json
{
  "schemaVersion": 1,
  "messageId": "msg-uuid",
  "operation": "course.redeem",
  "source": "popup",
  "payload": {}
}
```

响应必须包含原 `messageId`、`operation`、`ok` 和 `data` 或 `error`：

```json
{
  "schemaVersion": 1,
  "messageId": "msg-uuid",
  "operation": "course.redeem",
  "ok": true,
  "data": {}
}
```

接收方只执行白名单操作。空响应、非对象、未知版本、未知操作、旧上下文响应、超时和重复消息均进入可恢
复错误路径；不能直接读取 `result.error` 或把消息数据当作任意存储路径。

### 6.2 最小操作集合

| 操作 | 发起方 | 处理方 | 结果 |
| --- | --- | --- | --- |
| `course.redeem` | popup | background | 兑换摘要和候选课程包 |
| `course.install` | popup | background | 校验并原子安装结果 |
| `course.list` | popup/content | background | 本机课程摘要 |
| `course.update.check` | popup | background | 当前资格和版本差异 |
| `course.update.apply` | popup | background | 学生确认后的原子更新 |
| `learning.load` | content | background | 当前会话锁定的课节/节点 |
| `learning.save` | content | background | 本机学习状态写入结果 |
| `preview.start` | teacher preview | background | 绑定的临时预览会话 |
| `preview.end` | teacher preview | background | 释放预览绑定和临时状态 |

网络访问、本机持久化和课程包安装只能由 background 执行。content script 不取得服务端凭证，不直接写课程
库；popup 关闭或 background 重启后，未提交的候选结果必须可丢弃或从恢复点继续。

## 7. 教师文件契约

### 7.1 字幕输入

SRT/VTT 是教师浏览器内的解析输入格式；服务端不提供独立字幕上传接口，原文只随教师明确保存草稿动作提交。解析器须：

- 限制文件大小、编码和总字幕句数；
- 严格解析真实时间戳，保留毫秒精度和句子顺序；
- 对无效、重叠或零时长 cue 返回可解释问题，不静默丢失；
- 未保存时不把原始字幕文件、HTML 或脚本发送到网络；保存请求中的字幕原文仍按封闭字段和大小规则校验；
- 保存成功后字幕原文进入草稿/发布聚合，但不进入课程包或插件。

### 7.2 课程导入/导出

`TeacherCourseFile` 是版本化、封闭字段、自描述的 JSON 文件。导出包含课程结构、课节、视频引用、节点教学
语义、教师已保存的字幕原文（`DATA-PORT-003`、`D-V1-014`）和来源版本提示；不包含 B 站播放视频或节点媒体文件本体、凭证、会话、
教师页面状态或学生数据。这份文件只在教师之间流转，不发给学生或插件，携带字幕不改变第 5.2 节课程包
禁止字段清单。

导入流程必须是“读取 staging → 解析 → Schema/大小/内容安全校验 → 预览 → 教师确认 → 创建新课程/草稿”，
不能覆盖现有对象、改变线上发布、生成授权码或执行文件中的代码。来源 ID 仅作追溯提示，不能直接成为目标主键。

## 8. 哔哩哔哩宿主适配契约

课程运行时只依赖抽象的 `PlayerAdapter` 能力：识别可信主播放器、读取当前播放状态、在节点需要时暂停/恢复、
监听播放器替换和页面生命周期。B 站 DOM 选择器、frame 探测和重绑细节留在适配器内部，不能扩散到课程业务、
课程包或通用节点代码。

适配器必须遵守：

- 只在完整视频引用匹配时激活；
- 同一视频对应多个课节时交给课程/会话选择，不在适配器静默选择；
- 只做课程运行所需的最小暂停/恢复，不改倍速、不阻止跳过、不下载或重新托管视频；
- 播放器重建、单页切换、全屏变化或主播放器不可信时清理旧绑定并安全停止；
- 适配器失败不破坏本机课程库和学习状态。

## 9. 公开表单与外部集成契约

公开销售页只保存经过批准的 HTTPS 飞书/Lark 公开表单地址和人工联系兜底信息。它不读取、缓存、转发或解析
表单正文，不调用内部教师/管理员 API，不把表单提交显示成已开户或已创建课程。

飞书是试用申请正文的权威来源。获准运营人员人工读取最小申请内容，再按管理员流程创建教师和工作空间；
外部表单会话、申请正文和内部教师会话之间不共享令牌。地址不可达、未公开、域名不符或提交结果未知时，页面
必须显示真实失败状态和人工入口。

## 10. 版本、兼容与迁移

### 10.1 版本规则

- 主版本变化表示字段语义、身份或安全边界不兼容；客户端安全拒绝并显示升级提示；
- 次版本增加可选字段时，接收方忽略已声明可忽略字段，发送方不得依赖旧客户端理解它；
- 删除字段、改变单位、改变 ID 语义或把可选字段改为必填必须升级主版本；
- 同一 `releaseId + authorizedScope + packageSchemaVersion` 必须产生语义一致的课程包；
- 课程包必须同时携带并校验 `courseId` 和实际 `releaseId`；当前 `releaseId` 由服务端按课程解析，不由前端替换；
- 协议版本和内容版本分开：插件升级不自动改变已安装课程的 `releaseId`。

`D-V1-019` 规定，当前教师端生成授权码只绑定 `courseId`；服务端在兑换和更新时自动返回该课程最新可交付版本。
独立版本授权、课程族、课程升级关系和跨课程版本更新属于后续兼容设计。

### 10.2 当前实现迁移映射

| 当前实现 | v1 契约位置 | 处理方式 |
| --- | --- | --- |
| `POST /api/v1/public/course-download` 只收 `access_code` | 4.3 兑换 API | 保留兼容适配期；新增本机标识、幂等和正式兑换关系 |
| 响应顶层只有 `courses` | 4.1/4.3 结果信封 | 迁移为版本化信封，课程包增加发布身份、范围和摘要 |
| 插件收到后立即写 `studentCourseStore` | 5.3、6.2 | 增加独立校验、学生确认、临时区和原子提交 |
| 后端按课节 `PublishedScript` 组装 | 5.1 | 改由 `CourseRelease + ReleaseLessonSnapshot` 投影，不生成混合发布 |
| popup/content 可能旁路旧消息 | 6.1 | 统一由 background 处理，未知/空响应安全失败 |
| 旧预览桥字段 | `preview.start/end` | 仅在受信任握手和临时会话内兼容，禁止产生学生数据 |

迁移适配器必须能识别旧响应并阻止其绕过 v1 校验。旧课程包不能直接被当作 v1 发布包，除非完成明确的版本
转换、完整性校验和人工/自动迁移验收。

## 11. 需求与旧资料承接

### 11.1 冻结需求承接

本文件主要承接：

- `INT-WEB-*`：角色、工作空间和 HTTP 业务边界；
- `INT-EXT-*`：插件后台、popup、content 和预览消息边界；
- `INT-BILI-*`：视频匹配、播放器最小控制和页面生命周期；
- `INT-PACKAGE-*`：兑换、课程包、版本、校验和原子安装；
- `INT-FILE-*`：字幕及教师课程文件；
- `INT-TRIAL-*`：销售页、飞书公开表单和人工运营；
- `FR-GRANT-*`、`FR-LIB-*`、`FR-PORT-*`、`FR-RUNTIME-*` 及 `DATA-DELIVERY-*`、`DATA-LOCAL-*`。

### 11.2 旧资料承接

| 来源 | 吸收内容 | 不继承内容 |
| --- | --- | --- |
| `SRC-004`、`SRC-025` | 共享契约、双端校验、超时和失败不假成功经验 | 旧网页—本机桥作为生产主路径 |
| `SRC-028`、`SRC-031` | 当前 API、release JSON 和安全禁入事实 | 当前字段直接成为 v1 外部契约 |
| `SRC-033`、`SRC-063` | ZIP、SHA-256、固定提交和回滚证据 | 旧发布目录替代课程级发布包 |
| `SRC-034`、`SRC-049` | 课程校验、一次显示授权码、查询脱敏和失败保护 | 单课程优先级、静默安装、旧两类授权码 |
| `SRC-056`、`SRC-065`、`SRC-071` | 插件消息、课程包、多课程本机库和人工验证经验 | 未执行的公网/真实 Chrome 结论 |

完整来源去向以 [`02-legacy-document-register.md`](02-legacy-document-register.md) 为准。

## 12. 本文件完成条件

本文件通过人工审核前，至少应确认：

1. HTTP、课程包、插件消息、教师文件、宿主适配和外部表单分别有唯一责任方；
2. 首次兑换、免输码更新、学生确认安装和失败恢复的字段边界可直接进入 Schema/OpenAPI；
3. 原始授权码、本机证明、课程正文、学生数据和教师私有数据不会通过接口或日志泄露；
4. 版本兼容、未知字段、未知版本、幂等、超时和旧响应处理均有明确行为；
5. 当前代码的兼容适配点与必须重写的旧行为已经区分；
6. `SRC-*` 承接与 02 的登记一致，且不重复复制通用安全规范；
7. 第 4.5 节端点清单覆盖全部已冻结需求所需能力，每个端点归属 03 第 7 节的一个业务模块，
   且 `node tools/endpoint-check.mjs` 无「清单外端点」。

通过后，下一份文档为 [`07-product-interaction-state.md`](07-product-interaction-state.md)，具体冻结页面职责、
学生兑换/安装确认、教师工作流、学习窗口和交互状态恢复。
