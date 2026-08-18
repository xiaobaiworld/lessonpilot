# KnownMap 教师平台本地阶段开发计划

版本：0.1

更新时间：2026-08-18

状态：实施中（节点 1–3 已完成）

关联文档：

- 需求：`doc/requirements/teacher-platform-local-stage.md`
- 架构：`doc/teacher-platform-architecture.md`
- 数据：`doc/teacher-platform-data-spec.md`
- API：`doc/teacher-platform-api-spec.md`
- 产品规格：`doc/AI_Learning_Companion_Product_Function_Spec_v0.2.md`
- 决策：`doc/decisions/2026-08-18-teacher-platform-local-slice.md`

## 1. 目标

在本地构建一个可运行的教师发布和插件授权下载闭环：

```text
预建教师账号
→ 登录教师界面
→ 创建一门课程和一个课节
→ 编辑四种初始互动节点
→ 保存草稿
→ 发布课程
→ 创建授权码
→ 插件在 B 站页面提交授权码
→ 下载已发布 PluginCourseConfig
→ 保存并运行课程
```

## 2. 明确不在本计划内

- 公网服务器、域名、TLS、生产部署和监控平台；
- 管理员账号管理页面；
- 教师注册和 Google 登录；
- 学生账号、Learning Identity 和领取记录；
- 授权码停用、过期、人数限制和多授权码合并；
- 学习事件、进度、作答数据和教师报表；
- 独立学生网页；
- Chrome Web Store 发布；
- 多课节教师操作界面；
- 四种初始节点以外的新节点。

## 3. 工程执行规则

### 3.1 小步循环

每个工作节点按以下顺序执行：

```text
更新 next.md
→ 写失败测试或固定手动验收
→ 最小实现
→ 运行节点测试
→ 同步需求/架构/数据/API 文档
→ 小提交
→ 清空 next.md 或写入下一节点
```

### 3.2 测试层级

- 服务层核心业务：单元测试，目标行覆盖率至少 80%；
- schema、配置转换和节点校验：单元测试，目标行覆盖率至少 90%；
- API 和 SQLite：集成测试，使用临时测试数据库；
- 教师发布和插件下载：API E2E 测试；
- Chrome 插件和 B 站真实页面：人工验证，结果写入 `tests/manual/`。

### 3.3 文档和提交

- 代码与测试不在文档契约完成前开始；
- 每个节点只修改自己的模块和必要文档；
- 通过验证后才更新 `changelog.md`；
- 大阶段完成后执行完整文档审计，再考虑 PR/MR；
- 当前本地阶段不自动创建公网部署配置，不把未验证的公网能力写入 changelog。

## 4. 工作节点总览

| 节点 | 结果 | 主要依赖 |
| --- | --- | --- |
| 0 | 旧 Demo 计划归档，当前需求/架构/API/数据文档建立 | 已完成 |
| 1 | FastAPI + SQLite 可启动，有 OpenAPI 和健康检查 | 0 |
| 2 | 预建教师账号和登录会话可用 | 1 |
| 3 | 课程、单课节和 B 站视频绑定可持久化 | 2 |
| 4 | 四种节点草稿可保存、校验和读取 | 3 |
| 5 | 草稿可发布为不可混淆的已发布版本 | 4 |
| 6 | 教师可创建授权码，插件下载 API 可按码返回课程 | 5 |
| 7 | 现有教师界面接入真实 API | 2–6 |
| 8 | 插件输入授权码、下载、保存并运行课程 | 6 |
| 9 | 本地完整闭环、回归和文档收口 | 7–8 |

## 5. 节点 1：后端骨架和本地数据库

### 目标

建立可测试的 FastAPI 服务、SQLite 连接、Alembic 迁移、配置和结构化日志。

### 文件

- 创建：`backend/pyproject.toml`
- 创建：`backend/.env.example`
- 创建：`backend/app/main.py`
- 创建：`backend/app/config.py`
- 创建：`backend/app/db.py`
- 创建：`backend/app/logging.py`
- 创建：`backend/app/middleware.py`
- 创建：`backend/app/api/v1/health.py`
- 创建：`backend/alembic.ini`
- 创建：`backend/alembic/`
- 创建：`backend/tests/integration/test_health.py`
- 修改：`.gitignore`
- 修改：`README.md`

### 验收

- `GET /health` 返回服务状态和 API 版本；
- `GET /docs` 能打开 Swagger；
- SQLite URL 通过环境变量读取；
- 缺少必要 secret 时开发启动给出明确配置错误；
- 每个请求有 `X-Request-Id` 响应头；
- 日志包含 request ID、动作、结果和耗时；
- 测试可以在临时 SQLite 数据库中重复运行。

### 验证

```bash
cd backend
uv sync
uv run pytest tests/integration/test_health.py -q
uv run uvicorn app.main:app --port 8000
```

### 提交边界

`feat: bootstrap local teacher platform api`

## 6. 节点 2：预建教师账号和登录

### 目标

支持手工 seed 的测试教师账号、登录、退出和会话恢复。

### 文件

- 创建：`backend/app/models/teacher.py`
- 创建：`backend/app/models/teacher_session.py`
- 创建：`backend/app/schemas/auth.py`
- 创建：`backend/app/api/v1/auth.py`
- 创建：`backend/app/services/auth_service.py`
- 创建：`backend/app/repositories/teacher_repository.py`
- 创建：`backend/app/repositories/teacher_session_repository.py`
- 创建：`backend/app/seed.py`
- 创建：`backend/tests/unit/test_auth_service.py`
- 创建：`backend/tests/integration/test_auth_api.py`
- 修改：`backend/app/main.py`
- 修改：`backend/app/db.py`
- 修改：`backend/.env.example`

### 验收

- seed 命令可以创建或更新指定测试账号，不产生重复账号；
- 密码只存慢哈希；
- 正确登录创建服务端会话并设置 HttpOnly 会话 cookie；
- 错误登录不区分账号不存在和密码错误；
- disabled 账号不能登录；
- `/auth/me` 能恢复会话；
- `/auth/logout` 会销毁会话；
- 数据库只保存会话 token 摘要，不保存原文；
- 密码和 cookie 不进入日志；
- 未登录教师 API 返回统一 `AUTH_REQUIRED`。

### 验证

```bash
cd backend
uv run alembic upgrade head
uv run python -m app.seed
uv run pytest tests/unit/test_auth_service.py tests/integration/test_auth_api.py -q
```

### 提交边界

`feat: add seeded teacher authentication`

## 7. 节点 3：课程、单课节和视频绑定

### 目标

建立 `Teacher -> Workspace -> Course -> Lesson` 数据关系，支持当前教师界面使用一门课程和一个课节。

### 文件

- 创建：`backend/app/models/course.py`
- 创建：`backend/app/models/lesson.py`
- 创建：`backend/app/schemas/course.py`
- 创建：`backend/app/schemas/lesson.py`
- 创建：`backend/app/api/v1/teacher_courses.py`
- 创建：`backend/app/api/v1/teacher_lessons.py`
- 创建：`backend/app/services/course_service.py`
- 创建：`backend/app/repositories/course_repository.py`
- 创建：`backend/app/repositories/lesson_repository.py`
- 创建：`backend/tests/unit/test_course_service.py`
- 创建：`backend/tests/integration/test_course_api.py`

### 验收

- 登录教师可以创建课程；
- 课程自动归属当前教师的工作空间；
- 课程标题和描述经过 Pydantic 校验；
- 每门课程当前只能创建一个课节；
- 课节必须绑定合法 BVID；
- 第二次创建课节返回 `LESSON_LIMIT_REACHED`；
- 其他教师无法通过 ID 读取或修改课程；
- 课程和课节可以重新读取；
- 数据库事务失败时不留下半条关系。

### 验证

```bash
cd backend
uv run pytest tests/unit/test_course_service.py tests/integration/test_course_api.py -q
```

### 提交边界

`feat: add teacher course and lesson resources`

## 8. 节点 4：脚本 schema、草稿和四种节点

### 目标

将现有共享课程契约的四种节点接入后端，支持草稿保存和读取，不影响已发布版本。

### 文件

- 创建：`backend/app/schemas/script.py`
- 创建：`backend/app/services/script_service.py`
- 创建：`backend/app/repositories/script_repository.py`
- 创建：`backend/app/api/v1/teacher_scripts.py`
- 创建：`backend/tests/unit/test_script_schema.py`
- 创建：`backend/tests/unit/test_script_service.py`
- 创建：`backend/tests/integration/test_script_api.py`
- 修改：`src/shared/course-contract.js`（仅在发现服务端与现有插件契约确实需要共同变更时）
- 修改：`tests/course-contract.test.js`（仅随共享契约变更）

### 验收

- 四种节点都能通过后端 schema；
- 未知节点组合、未知字段、空文案、重复 ID、错误答案引用被拒绝；
- 草稿只写入 `ScriptDraft`；
- 草稿保存不改变 `PublishedScript`；
- 接口响应不返回数据库密码、授权码摘要等内部字段；
- schema 错误包含字段路径，但不回显题目正文；
- 同一输入在后端和现有共享契约中得到一致的关键结论。

### 验证

```bash
cd backend
uv run pytest tests/unit/test_script_schema.py tests/unit/test_script_service.py tests/integration/test_script_api.py -q
node --test tests/course-contract.test.js
```

### 提交边界

`feat: persist validated lesson script drafts`

## 9. 节点 5：课程发布和插件配置适配器

### 目标

通过课程发布端点把课程下唯一课节的草稿发布为稳定版本，并生成现有插件可以消费的 `PluginCourseConfig`。

### 文件

- 创建：`backend/app/models/published_script.py`
- 创建：`backend/app/adapters/plugin_course_config.py`
- 创建：`backend/app/api/v1/teacher_publish.py`
- 创建：`backend/tests/unit/test_plugin_course_adapter.py`
- 创建：`backend/tests/integration/test_publish_api.py`
- 修改：`backend/app/services/script_service.py`
- 修改：`doc/teacher-platform-data-spec.md`（实现后同步实际字段）
- 修改：`doc/teacher-platform-api-spec.md`（实现后同步实际响应）

### 验收

- 没有课节、草稿或节点时不能发布；
- 当前外部只提供课程发布端点，不同时维护另一套课节发布端点；
- 发布成功生成版本号和时间；
- 后续草稿保存不改写已发布 JSON；
- 插件适配器输出通过 `src/shared/course-contract.js` 的语义校验；
- 输出不包含完整字幕、教师内部字段、草稿状态或数据库关系字段；
- 发布事务失败时没有半个版本；
- 同一课节重复发布产生可区分版本。

### 验证

```bash
cd backend
uv run pytest tests/unit/test_plugin_course_adapter.py tests/integration/test_publish_api.py -q
node --test tests/course-config.test.js tests/course-contract.test.js
```

### 提交边界

`feat: publish versioned plugin course configuration`

## 10. 节点 6：授权码和课程下载 API

### 目标

提供当前阶段唯一必要的授权能力：教师创建绑定课程的授权码，插件按授权码下载最新已发布配置。

### 文件

- 创建：`backend/app/models/access_code.py`
- 创建：`backend/app/schemas/access_code.py`
- 创建：`backend/app/schemas/public_download.py`
- 创建：`backend/app/services/access_code_service.py`
- 创建：`backend/app/services/download_service.py`
- 创建：`backend/app/repositories/access_code_repository.py`
- 创建：`backend/app/api/v1/teacher_access_codes.py`
- 创建：`backend/app/api/v1/public_download.py`
- 创建：`backend/tests/unit/test_access_code_service.py`
- 创建：`backend/tests/integration/test_download_api.py`

### 验收

- 只有当前教师自己的已发布课程可以创建授权码；
- 授权码使用安全随机数生成；
- 数据库只保存摘要，不保存授权码原文；
- 创建响应只返回一次授权码原文；
- 有效授权码返回最新已发布插件配置；
- 无效授权码统一返回 `INVALID_ACCESS_CODE`；
- 未发布课程返回 `COURSE_NOT_AVAILABLE`；
- 下载接口不接受客户端 course ID 作为授权依据；
- 不创建学生账号、领取记录或学习事件；
- 日志不记录授权码原文。

### 验证

```bash
cd backend
uv run pytest tests/unit/test_access_code_service.py tests/integration/test_download_api.py -q
```

### 提交边界

`feat: add course access code download flow`

## 11. 节点 7：教师界面接入 API

### 目标

把现有教师界面的原型状态替换为真实 API 数据，保持当前视觉和主要交互形态。

### 文件

- 创建：`teacher-web/api-client.js`
- 创建：`teacher-web/auth-session.js`
- 修改：`teacher-web/index.html`
- 修改：`teacher-web/app.js`
- 修改：`teacher-web/styles.css`（只补真实状态、错误和登录需要的样式）
- 修改：`teacher-web/workspace.html`（若当前诊断页需要与真实工作台分离）
- 创建：`tests/teacher-api-client.test.js`
- 创建：`tests/manual/teacher-platform-local/README.md`

### 验收

- 未登录打开教师工作台时显示登录入口；
- 登录成功后读取当前教师课程；
- 创建课程和课节的失败不会显示假成功；
- 草稿保存失败时保留当前页面编辑状态；
- 发布成功显示版本和状态；
- 创建授权码后只在教师端显示一次原文，并提供复制；
- 前端不直接访问 SQLite；
- API 地址由配置注入，不写死到业务函数；
- 动态课程和节点文本继续使用安全 DOM API。

### 验证

```bash
node --test tests/teacher-api-client.test.js
python3 -m http.server 4173
```

手动验证记录至少覆盖：登录、创建课程、创建课节、保存草稿、发布、创建授权码、刷新页面恢复状态、错误提示。

### 提交边界

`feat: connect teacher workspace to local api`

## 12. 节点 8：插件授权码输入和课程下载

### 目标

让学生在 B 站原页面通过我们提供的解压版插件输入授权码、下载课程并保存到插件本地存储。

### 文件

- 创建：`src/content/access-code/access-panel.js`
- 创建：`src/content/access-code/access-panel.css`
- 创建：`src/shared/api-config.js`
- 修改：`src/manifest.json`
- 修改：`src/content/index.js`
- 修改：`src/background/storage.js`
- 修改：`src/background/operations.js`
- 创建：`tests/access-code-panel.test.js`
- 创建：`tests/plugin-download-flow.test.js`
- 修改：`tests/manual/stage-1a-bridge/README.md`（仅补充与当前流程的关系）

### 验收

- 插件提供授权码输入入口；
- 输入过程不把授权码写入日志；
- 插件请求本地 FastAPI 下载端点；
- 成功响应先通过共享课程契约校验，再写入 `chrome.storage.local`；
- 无效响应不覆盖已有课程；
- 下载的课程只在匹配 BVID 页面启动；
- 课程下载失败显示可操作错误；
- 插件不访问独立学生网页；
- 插件继续使用当前 B 站原页面宿主和四种节点运行时。

### 验证

```bash
node --test tests/access-code-panel.test.js tests/plugin-download-flow.test.js tests/course-contract.test.js
```

人工验证：

1. 加载解压版插件；
2. 打开 B 站目标视频；
3. 输入有效授权码；
4. 确认插件保存课程；
5. 刷新页面并确认不重复初始化；
6. 输入无效授权码；
7. 确认已有课程没有被覆盖；
8. 打开其他 BVID，确认课程不启动。

### 提交边界

`feat: download courses from plugin access code`

## 13. 节点 9：本地完整闭环和收口

### 目标

验证教师发布到插件运行的完整路径，并同步文档和验证记录。

### 文件

- 修改：`tests/e2e/test_teacher_publish_download.py`
- 创建：`tests/manual/teacher-platform-local/README.md`
- 修改：`README.md`
- 修改：`doc/INDEX.md`
- 修改：`doc/teacher-platform-architecture.md`
- 修改：`doc/teacher-platform-data-spec.md`
- 修改：`doc/teacher-platform-api-spec.md`
- 修改：`doc/teacher-platform-dev-plan.md`
- 修改：`changelog.md`
- 修改：`next.md`

### 自动化验收

```bash
cd backend
uv run pytest --cov=app --cov-report=term-missing
node --test tests/*.test.js
```

至少验证：

- 登录；
- 课程和课节创建；
- 四种节点保存；
- 发布；
- 授权码创建；
- 授权码下载；
- 配置 schema 校验；
- 越权访问拒绝；
- 无效授权码拒绝；
- 数据库重建；
- 重复请求不会覆盖错误课程。

### 手动验收

在同一台 Mac 上：

```text
启动 FastAPI + SQLite
→ 启动教师静态页面
→ 登录预建测试账号
→ 创建一门课程和一个课节
→ 配置四种节点
→ 发布课程
→ 创建授权码
→ 在 B 站页面加载解压版插件
→ 输入授权码下载课程
→ 完成一次课程互动
```

证据保留：

- 命令和测试结果写入人工验证记录；
- 截图只保留必要的页面状态，不记录密码和完整授权码；
- 日志检查记录 request ID 和错误路径；
- 发现问题先写失败测试，再修复。

### 阶段收口

本地闭环通过后：

1. 更新本计划状态为“本地阶段已验证”；
2. 在 `doc/DECISIONS.md` 和决策文件中记录验证结果；
3. 更新 `doc/INDEX.md` 的当前权威状态；
4. 仅记录已验证本地能力，不宣称公网已部署；
5. 由用户确认是否进入公网部署和学生数据阶段。

## 14. 文档健康评估

本计划约 534 行，超过 `DEV_PLAN.md` 的 400 行软阈值，但未达到需要立即重构的 175% 阈值。

本轮已完成拆分评估：

- 需求、架构、数据和 API 已分别拆出，避免本计划承担多个事实源；
- 本计划只承担执行顺序、文件范围、验收、测试和提交门禁；
- 节点 1–9 存在强顺序依赖，拆成多个执行计划会把测试门禁、共享契约和提交顺序分散到多个入口；
- 当前保留单份执行计划，并用“节点总览”和明确的工作节点边界支持检索；
- 当后续加入学生数据、管理员后台或公网部署时，必须新建独立阶段计划，不继续扩写本文件。

## 15. 未来扩展顺序

当前阶段验证完成后，按以下顺序重新立项，不在本计划中提前实现：

1. 多课节课程管理；
2. 授权码停用、过期和领取记录；
3. Learning Identity 和学生列表；
4. 插件学习事件上传；
5. 教师学习数据和 CSV 导出；
6. 管理员账号和教师测试批次管理；
7. 公网部署和生产安全配置；
8. 新互动节点类型。
