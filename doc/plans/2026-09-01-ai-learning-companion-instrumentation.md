# AI Learning Companion 埋点与日志可观测性模块计划

- 版本：0.1
- 日期：2026-09-01
- 状态：M0/M1 已完成；Umami 适配、老师业务路径、学生本地检查点和 Dashboard 仍待后续切片
- 决策依据：[`D-V1-028`](../decisions/2026-09-01-analytics-umami.md)
- 产品约束：[`D-V1-011`](../decisions/2026-08-22-v1-data-persistence-strategy.md)、[`D-V1-006`](../decisions/2026-08-22-v1-data-retention.md)
- 当前执行关系：本计划独立于 `next.md` 当前的学生陪伴形象切片；实现开始时再建立新的执行切片

## 0. 规范加载声明

本轮已读取并适用：

- 全局入口与 `GLOBAL_DEV_WORKFLOW.md`：复杂模块计划、文档/决策/验证顺序；
- 项目 `doc/dev-rules.md`、`doc/INDEX.md`、`doc/lessons.md` 和 `next.md`：权威顺序、学生数据边界、插件版本和当前工作区保护；
- v1 需求 01、04、05、06、08、09：角色、数据归属、接口、安全隐私、日志和测试门禁；
- v1 设计 03、04、05、06、07、08：模块边界、数据流、契约、交互和安全设计；
- `OBSERVABILITY_STANDARD.md`：事件/日志/指标分层、request ID、脱敏和验证；
- `TESTING_STANDARD.md`：测试先行、自动化与人工验收分层；
- `DATA_MODELING_AND_FLOW_STANDARD.md`：Schema 真源、数据流、字段字典和血缘；
- `SECURITY_CODING_STANDARD.md`：外部输入、凭证、敏感数据和依赖安全；
- `ERROR_HANDLING_AND_LESSONS_STANDARD.md`：失败恢复、日志证据和 lessons 收口；
- `agent/tools/SYSTEM_CAPABILITY_INDEX.md`：确认 Docker 能力入口，但本轮不假设 Docker daemon 或线上 Umami 已可用。

暂不适用：`AI_LLM_INTEGRATION_STANDARD.md`，因为当前计划不接入 LLM；如果 AI 调用进入实现范围，先补读该规范并把 AI 运行指标独立成专项。

## 1. 目标

建立一个低投入、可替换、可验证的埋点与日志可观测性模块，能够：

1. 明确事件名、触发时机、属性、隐私级别、保留策略和指标映射；
2. 在老师 Web 中显式记录关键产品路径，并使用 Umami 查看趋势、漏斗和必要的回放；
3. 为学生端保留有限的本地学习检查点，不自动上传学生学习数据；
4. 让 Dashboard 指标从稳定的事件或业务真源派生，而不是把界面按钮点击直接当成教学结果；
5. 让关键后端动作符合项目日志规范，能用 `request_id` 串联 start/success/failure/retry，并在不记录正文的前提下定位失败；
6. 让未来切换 OpenReplay、PostHog、Matomo 或自建 Dashboard 时只替换适配器，不重写业务事件。

## 2. 范围

### 2.1 本轮范围

- 事件命名和公共事件信封；
- JSON Schema、TypeScript 类型、事件注册表和 AJV 校验；
- 老师 Web 显式 `track()` 封装；
- Umami 配置适配器和本地/测试 Mock；
- 老师 Web 关键路径的事件接入；
- 现有 FastAPI/`structlog` 日志规范的关键动作接入与统一脱敏验证；
- 老师指标、学生本地指标和 Dashboard 定义；
- 隐私、保留、脱敏、失败降级和验证门禁；
- Umami 自托管部署说明与最小 Smoke Test；
- 埋点事件与技术日志的关联、分层、保留和成本边界。

### 2.2 明确不做

- 不在学生插件或 B 站内容脚本中启用 Session Replay；
- 不记录无关网页浏览历史、字幕全文、课程正文、原始回答或网络请求正文；
- 不新建远程学生账号、学生报表、跨设备学习档案或自动上传端点；
- 不用 Umami 替代课程、发布、授权和学习状态的业务真源；
- 不引入数据仓库、CDP、Prometheus、全链路追踪或复杂告警；
- 不在本轮实现 AI/LLM 调用指标；
- 不把 Umami 当作集中技术日志平台；
- 不为浏览器端埋点新增一个上传原始错误正文的日志接口。

## 3. 目标架构

```mermaid
flowchart LR
  TW[教师 Web] --> TC[track() 封装]
  TC --> V[Schema + 注册表 + 脱敏校验]
  V --> U[Umami 适配器]
  U --> UD[Umami 自托管]
  V --> MT[测试 Mock / 本地日志]

  TW --> FE[前端诊断摘要]
  FE -.不自动上传正文.-> MT

  SW[学生插件运行时] --> LC[本地学习检查点]
  LC --> LS[本机存储]
  LC -.用户主动导出.-> EX[匿名/脱敏导出文件]

  DB[服务端课程/发布/授权真源] --> BM[业务事实指标]
  DB --> BL[FastAPI structlog 技术日志]
  BL --> LR[日志检索/本地运行日志]
  UD --> UX[老师 UX 分析]
  BM --> TD[老师业务 Dashboard]
  EX --> SD[未来学生指标分析]
```

### 3.1 数据责任

| 数据 | 权威来源 | 当前去向 | 允许的用途 |
|---|---|---|---|
| 老师操作体验事件 | 老师 Web 事件封装 | Umami；测试 Mock | 找到路径阻塞、失败重试和页面体验问题 |
| 课程/发布/授权事实 | 现有服务端业务模块 | 现有数据库和业务查询 | 老师业务 Dashboard |
| 技术诊断日志 | FastAPI/`structlog` 运行与动作日志 | 标准输出/受控日志采集 | 定位请求、失败、重试、耗时和依赖问题 |
| 学生正式学习结果 | 学生插件本机学习状态/`NodeAttempt` | 本机；未来主动导出 | 学生本地进度与经同意的学习证据 |
| 前端错误摘要 | 发生错误的应用 | 本地诊断或受控事件 | 排障，不还原业务正文 |
| AI 调用运行数据 | AI 服务端调用边界 | 未来 OpenTelemetry | 延迟、错误、Token 和成本 |

## 4. 事件公共契约

### 4.1 公共信封

所有事件都必须使用同一公共信封；业务属性放入 `properties`，不能把动态值拼入 `event_name`。

```json
{
  "event_id": "uuid",
  "event_name": "lesson_preview_started",
  "event_version": "1.0.0",
  "occurred_at": "2026-09-01T08:00:00.000Z",
  "actor_type": "teacher",
  "source": "teacher_web",
  "environment": "production",
  "session_id": "opaque-session-id",
  "request_id": null,
  "course_id": "course-id",
  "lesson_id": "lesson-id",
  "release_id": null,
  "status": "success",
  "duration_ms": null,
  "properties": {
    "entry": "lesson_page"
  },
  "privacy_class": "operational"
}
```

### 4.2 字段规则

| 字段 | 规则 |
|---|---|
| `event_id` | 每次采集生成 UUID；重试复用同一 ID，适配器不得重复制造业务事件 |
| `event_name` | 小写 snake_case、稳定、无动态值，长度适配 Umami 限制；不把课程名、版本号或日期写进名称 |
| `event_version` | 事件结构有不兼容变化时递增；新增可选属性不改变旧事件含义 |
| `occurred_at` | 记录真实发生时间，不使用接收时间覆盖它 |
| `actor_type` | 只允许 `teacher`、`student_local`、`system`、`preview`；预览不得混入真实学生统计 |
| `source` | 只允许注册的 `teacher_web`、`student_extension`、`admin_web`、`server`、`test` |
| `session_id` | 只用于当前应用会话关联；不使用邮箱、手机号、授权码或可逆个人标识 |
| `request_id` | 仅在事件由一次 API 请求直接触发时保留内部关联；Umami 适配器默认丢弃，避免高基数字段污染分析；日志必须保留同一关联标识 |
| `course_id` 等对象 ID | 只发送稳定、不含正文的 ID；没有对象时为 `null`，不得猜测关联 |
| `status` | `started`、`success`、`failure`、`cancelled`、`skipped`、`unknown`；业务结果与请求发送状态分开 |
| `duration_ms` | 只记录耗时，不记录时间线全文或播放器逐帧事件 |
| `properties` | 只允许注册属性、低基数枚举、计数、时长和脱敏错误类别；禁止自由传入对象 |
| `privacy_class` | `operational`、`learning_local`、`diagnostic`；远程 Umami 只接受 `operational` 和受控 `diagnostic` |

### 4.3 埋点与技术日志的分工

| 层 | 真源 | 记录什么 | 去向 | 禁止事项 |
|---|---|---|---|---|
| 业务事实 | 现有课程、发布、授权和学习状态模块 | 成功产生的业务状态 | 业务数据库/业务查询 | 用日志或埋点反推并覆盖真源 |
| 产品分析事件 | `analytics-event.schema.json` 与事件注册表 | 老师路径、结果摘要、受控 UX 行为 | Umami 或 Mock | 记录完整输入、正文、凭证或无穷高频行为 |
| 技术诊断日志 | 项目日志规范、`structlog` 动作封装 | 请求/任务、模块、动作、状态、耗时、错误类型和脱敏摘要 | 标准输出/受控日志采集 | 复制产品事件全文、秘密、学生本机数据或原始错误正文 |

同一个动作可以同时产生产品事件和技术日志，但两者不互相替代：产品事件回答“老师在哪条路径遇到阻塞”，技术日志回答“这次请求由哪个模块以什么原因失败”。二者通过内部 `request_id`/`event_id` 关联；高基数关联字段不进入 Umami 的分析维度。

技术日志统一遵守项目 `OBSERVABILITY_STANDARD.md` 与 `DEV-LOG-001`：至少具备 `timestamp`、`level`、`module`、`action`、`event`、请求上下文中的 `request_id`，成功/失败时具备 `duration_ms`，失败时具备 `error_type` 和脱敏 `error_message`；生产默认不输出 `debug`。

## 5. v0.1 事件目录草案

以下是计划中的初始目录，正式实现前需要把每行补齐“触发时机、必填属性、失败语义和指标引用”，并通过需求/设计审核。

### 5.1 老师 Web 事件

| 事件名 | 触发时机 | 关键属性 | 结果用途 |
|---|---|---|---|
| `teacher_app_loaded` | 教师应用完成首屏可用 | `route`、`app_version` | 首屏可用与进入路径 |
| `course_opened` | 教师打开课程详情 | `course_id`、`entry` | 课程工作入口 |
| `lesson_opened` | 教师打开课节编辑页 | `course_id`、`lesson_id`、`has_draft` | 编辑入口与草稿恢复 |
| `draft_save_started` | 点击保存草稿后请求开始 | `course_id`、`lesson_id`、`draft_revision` | 保存漏斗起点 |
| `draft_save_result` | 保存请求有明确结果 | `status`、`duration_ms`、`error_code` | 保存成功率和失败类型 |
| `preview_started` | 成功建立教师预览会话 | `course_id`、`lesson_id`、`draft_revision` | 预览使用情况；预览数据隔离 |
| `publish_result` | 发布请求有明确结果 | `course_id`、`release_id`、`status`、`duration_ms`、`error_code` | 发布成功率和阻塞点 |
| `access_code_create_result` | 授权码生成请求有明确结果 | `course_id`、`batch_size`、`status`、`error_code` | 交付路径和失败类型 |
| `teacher_error_seen` | 教师页面展示受控错误 | `error_code`、`module`、`recoverable` | 排障；不传错误正文 |

### 5.2 学生本地检查点

这些事件不进入远程 Umami；它们只为本机学习状态、主动导出和未来需求保留最小结构。

| 事件名 | 触发时机 | 关键属性 | 禁止内容 |
|---|---|---|---|
| `lesson_started` | 学生确认进入已安装课节 | `course_id`、`lesson_id`、`release_id` | B 站无关页面信息 |
| `node_presented` | 节点真正显示给学生 | `node_id`、`node_family`、`position_index` | 节点正文、字幕、页面截图 |
| `node_submitted` | 学生完成一次正式提交 | `node_id`、`outcome`、`attempt_index`、`duration_ms` | 原始回答、选项文本、输入内容 |
| `node_completed` | 节点按学习规则进入完成状态 | `node_id`、`outcome` | 用打开或播放代替完成 |
| `lesson_completed` | 课节完成条件满足 | `lesson_id`、`completed_count`、`total_count` | 学生身份和联系方式 |
| `local_runtime_error` | 本机运行失败且有受控错误类别 | `error_code`、`recoverable` | 网络响应正文、课程正文 |

### 5.3 AI 运行事件（后置）

不进入本轮实现。若未来有 AI 调用，使用 OpenTelemetry 的 Span/事件记录 `operation`、模型、耗时、Token、错误类型和成本摘要，禁止记录完整 prompt 或模型输出。

### 5.4 技术日志动作目录

以下动作使用项目现有结构化日志，不发送到 Umami。每个动作覆盖 `start`、`success`、`failure`；发生可重试的外部依赖或任务重试时增加 `retry`。

| `module` | `action` | 关键日志字段 | 触发边界 |
|---|---|---|---|
| `authoring` | `draft_save` | `course_id`、`lesson_id`、`draft_revision`、`duration_ms`、`error_type`、`error_message` | 服务端真正开始/结束草稿保存 |
| `authoring` | `preview_create` | `course_id`、`lesson_id`、`release_id`、`duration_ms`、`error_type` | 预览会话创建和失败 |
| `authoring` | `release_publish` | `course_id`、`release_id`、`duration_ms`、`error_type` | 发布事务有明确结果 |
| `entitlement` | `access_code_create` | `course_id`、`batch_size`、`duration_ms`、`error_type` | 授权码批次创建有明确结果；不记录授权码 |
| `entitlement` | `course_download` | `course_id`、`release_id`、`duration_ms`、`error_type` | 课程下载/交付有明确结果；不记录本机证明 |
| `runtime` | `course_install` | `course_id`、`release_id`、`duration_ms`、`error_type` | 插件课程安装有明确结果；不记录学生回答/进度 |
| `runtime` | `state_recover` | `course_id`、`release_id`、`duration_ms`、`error_type` | 本机状态恢复成功或失败；不记录状态正文 |

HTTP 中间件日志继续记录请求级 `http.request.success`/`http.request.failure`，业务动作日志不能替代中间件日志，也不能把每个底层函数都扩展成日志动作。

## 6. 指标与 Dashboard

### 6.1 老师业务 Dashboard

业务指标必须从服务端权威事实派生；事件只用于补充体验路径。

| Dashboard | 指标 | 计算来源 | 当前是否实现 |
|---|---|---|---|
| 课程交付概览 | 草稿保存成功率、发布成功率、授权码创建成功率 | 服务端结果 + 受控事件 | 计划中 |
| 制作阻塞 | 保存/预览/发布失败按错误类别分布 | `*_result`、`teacher_error_seen` | 计划中 |
| 课程使用 | 课程打开数、课节打开数、预览启动数 | Umami 显式事件 | 计划中 |
| 交付路径 | 发布 → 授权码 → 领取的转化 | 服务端发布/授权/领取事实 | 计划中 |
| 数据质量 | 未注册事件、缺少必填属性、版本不兼容 | Schema 校验日志/测试 | 计划中 |

### 6.2 学生指标

v0.1 只定义本机可观察指标，不做跨学生汇总：

- 当前课节完成数 / 节点总数；
- 正式尝试次数；
- 按结果分类的节点完成数；
- 最近学习时间；
- 本机运行错误数和可恢复率。

不把“打开次数”“播放时长”直接当学习完成，不把预览、示例课程和测试操作计入学生指标。

## 7. 模块与文件边界

实现阶段按以下边界落盘，实际文件新增前仍需核对当前目录状态：

```text
v1/contracts/
  schemas/analytics-event.schema.json
  analytics-event.ts
  analytics-event-registry.ts
  analytics-event.test.ts

v1/web/shared/src/analytics/
  types.ts
  registry.ts
  sanitize.ts
  tracker.ts
  tracker.test.ts
  adapters/umami.ts
  adapters/mock.ts
  diagnostics.ts

v1/web/teacher/src/analytics/
  teacher-events.ts
  teacher-events.test.ts

v1/extension/
  runtime/local-learning-events.ts
  runtime/local-learning-events.test.ts
  storage/...

v1/backend/app/infrastructure/logging/
  config.py                 # 现有 structlog 配置与脱敏入口
  action_logger.py          # 统一 start/success/failure/retry 字段封装
  action_logger.test.py     # 若项目测试布局允许；否则放入 v1/backend/tests/

deploy/umami/
  README.md
  docker-compose.yml 或官方部署参数记录
```

约束：

- `contracts` 只保存 Schema、类型和注册表，不依赖 Umami SDK；
- `web/shared` 只提供无业务权限的事件封装和适配器；
- `web/teacher` 只在真实业务动作结果明确后发结果事件，不在按钮点击处伪造成功；
- `extension` 只写有限本地检查点，不能旁路 background 访问网络；若改动插件，必须同步递增 `EXTENSION_VERSION`；
- `backend` 第一阶段不新增埋点端点、不直接查询其它模块表、不把 Umami 事件写入业务数据库；
- `backend` 的技术日志沿用现有 `structlog` 基础设施；新增动作封装只负责字段、脱敏和关联，不改变业务事务边界；
- 前端诊断只保留受控摘要并受环境开关控制；不新增“上传错误正文”的通用日志接口；
- `deploy/umami` 只记录可重复部署与备份/保留边界，不把真实密钥写入仓库。

## 8. 分阶段实施计划

### M0：需求与设计冻结（已完成）

修改范围：新增本计划和决策记录；补充 v1 需求 09 中的 `DEV-LOG-002`、`DEV-LOG-003`，并在设计 08 增加埋点与技术日志边界。

验收：每个目标事件和技术日志动作都有触发条件、属性/字段、权限/隐私级别、数据去向、保留期、失败语义、关联方式和指标映射；明确学生远程上报仍未开放。需求、设计和追踪矩阵已同步。

提交：单独文档提交；不修改业务代码，不修改 `next.md` 当前执行切片。

### M1：契约、注册表和本地校验（已完成）

修改范围：`v1/contracts/`、`v1/web/shared/src/analytics/` 的纯函数与测试，以及后端 `structlog` 动作封装与测试。

先写测试：

- 合法事件通过 Schema；
- 未注册事件、动态事件名、缺少对象 ID、错误类型、未知枚举和超大属性被拒绝；
- 脱敏器移除密码、Cookie、授权码、邮箱、课程正文、回答和网络正文；
- `event_id` 重试保持稳定；
- `preview` 不可映射到真实学生统计；
- 日志动作缺少 `module`/`action`/`event`/`request_id` 时被拒绝或测试失败；
- 日志 `failure` 缺少脱敏错误类型/摘要时被拒绝；
- `start`/`success`/`failure`/`retry` 的同一 `request_id` 能串联，且重复重试不伪造业务成功；
- 禁止字段扫描覆盖契约样例和测试产物。

验收命令：`npm --prefix v1 test`、`npm --prefix v1 run type-check`、`node v1/contracts/check-contracts.mjs`、`node v1/contracts/check-versions.mjs`、`node tools/doc-check.mjs`。

### M2：Umami 适配器与部署 Smoke Test

修改范围：Umami adapter、配置模板、Mock、`deploy/umami/README.md`；先不接入生产域名。

实现原则：

- Umami 地址、website ID 和启用开关来自环境配置；
- 本地测试默认使用 Mock，不向外部网络发送；
- Umami 事件只接受 `operational` / 受控 `diagnostic`；
- 关闭自动 pageview、自动交互追踪和默认身份识别；
- 发送失败不能阻塞保存、发布、授权或学生学习；
- Umami 发送失败只写一条受控 `analytics.adapter.failure` 技术日志，包含适配器、错误类型和耗时，不包含事件属性正文；
- Replay 默认关闭；若开启，只允许老师 Web、严格遮罩、短时保留和抽样。

验证：本机 Docker 可用时用匿名测试数据启动 Umami，确认自定义事件、属性和漏斗可见；Docker 不可用时只完成配置校验和 Mock 集成，不把未运行写成通过。

### M3：老师 Web 关键路径

修改范围：教师应用现有课程、课节、预览、发布和授权交互；不改业务事务。

接入规则：

- 页面加载/打开事件只在真实页面可用后触发；
- 保存、预览、发布、授权只发 `started` 和明确结果；
- 失败事件只传稳定 `error_code`、模块、可恢复性和耗时；
- 不发送教师联系方式、登录凭证、课程标题全文、节点正文、字幕或授权码；
- 预览使用 `actor_type=preview`，不进入学生统计。
- API 触发的关键动作同时由后端记录技术日志；前端不把“点击按钮”写成后端成功日志。

测试：组件测试验证触发次数、属性和失败分支；重复点击、旧异步响应、路由切换和 Umami 不可用不得产生重复业务动作或阻塞用户。

日志验收：保存、预览、发布和授权的成功、失败、重试均可用同一 `request_id` 串联；日志中的课程/课节只使用安全 ID，错误摘要经过脱敏，且不出现正文、密码、Cookie、授权码或会话信息。

### M4：学生本地检查点

修改范围：插件运行时和现有本机学习状态；需要在正式需求/设计审核后开始。

实现规则：

- 只记录课程内、已授权、已安装课程的离散学习检查点；
- 不记录无关 B 站页面、播放器全量 `timeupdate`、字幕全文、课程正文和原始回答；
- 事件与现有 `NodeAttempt`/进度状态保持一致，不另造第二个完成真源；
- 记录失败、取消、跳过和不支持，不把它们合并成完成；
- 只落本机，导出必须主动触发且显式标记为匿名/脱敏数据。

测试：运行时正常/重复/乱序/旧会话/存储失败/课程更新/删除恢复矩阵；验证任何网络请求都不携带学生学习事件或本机状态。

### M5：Dashboard 与指标验收

修改范围：Umami dashboard 配置说明、指标注册表、匿名夹具和人工验收记录。

验证内容：

- 每个 Dashboard 指标能回到事件或业务真源；
- 缺少来源时显示未知，不用零值或示例数据填充；
- 老师业务指标与老师 UX 指标分开；
- 预览、示例课程和测试操作不进入学生统计；
- 同一事件重复发送不把成功数翻倍；
- Umami 数据保留、账号权限、备份和删除边界有记录。
- 技术日志能独立回答请求是否到达、哪个模块失败、耗时和错误类型；不能用 Dashboard 事件替代日志证据。

### M6：收口

必须运行：

```bash
npm test
node tools/doc-check.mjs
node tools/secret-scan.mjs
node tools/dependency-check.mjs
npm --prefix v1 run type-check
npm --prefix v1 run build
cd v1/backend && uv run pytest
```

收口动作：更新相关需求/设计/索引、`changelog.md` 和必要的 `doc/lessons.md`；如果修改插件，检查并更新插件版本、两套 manifest 和 ZIP；按小步规则提交并推送。未完成的真实 Umami 部署、学生主动导出或人工浏览器验收必须明确标为未验证。

## 9. 风险与停止条件

| 风险 | 处理 | 停止条件 |
|---|---|---|
| Umami 部署占用过多时间 | 先使用 Mock 和本地契约；部署单独验证 | 没有满足最低资源的环境就不把线上接入塞进业务开发 |
| 回放泄露课程/回答 | 老师端默认关闭 Replay，必要时严格遮罩；学生端永久不接 | 无法证明采集前脱敏时停止录制 |
| 事件与业务结果不一致 | 业务事实从服务端真源派生，事件只记录路径/结果 | 任何 Dashboard 指标无法回溯来源就不发布 |
| 发送失败影响主流程 | 适配器异步、可丢弃、错误隔离 | 发现埋点异常阻塞保存/发布/学习时回滚接入 |
| 事件数量膨胀 | 只保留决策需要的离散事件，禁止自动全量采集 | 超过目录或属性预算时先删事件，不扩容平台 |
| 供应链/许可证问题 | 锁定版本、扫描依赖、记录 Umami MIT 许可证 | 发现实际镜像/依赖许可与记录不一致时暂停部署 |

## 10. 完成定义

本模块只有同时满足以下条件才可标记完成：

1. 事件目录、触发时机、属性、老师/学生指标和 Dashboard 定义已经审核；
2. Schema、注册表、埋点脱敏、日志动作封装和适配器测试通过；
3. 老师 Web 关键路径能在 Umami 或 Mock 中观察到正确事件，发送失败不影响主流程；
4. 关键后端动作产生符合 `DEV-LOG-001` 的结构化日志，`request_id` 可串联，日志默认不暴露 debug 和敏感数据；
5. 学生插件没有远程回放或自动学习数据上传，有限本地检查点与现有学习状态一致；
6. 业务指标能回到服务端事实，UX 指标能回到事件，预览/示例/测试数据已隔离；
7. 文档、决策、需求、设计、测试、索引、changelog 和 lessons 状态一致。
