# KnownMap 当前下一步

更新时间：2026-08-21

## 当前执行切片：KnownMap v1 需求逐段审核

- 当前分支：`codex/v1-rewrite`；重构基线：`main@0e503a4`。
- 已接受：v1 需求目录 01–13，包括产品范围、领域术语、用户场景、当前阶段功能与数据、接口、第一阶段非功能结论、安全、开发质量、部署、迁移、验收追踪和旧资料来源登记；`FR-REPORT-*` 保留为后续候选。
- 第一阶段不单独制定 `NFR-*`；响应、容量、并发、可用率和兼容时限留待获得真实依据后重新审核。
- 下一目标：按 `SRC-001` 至 `SRC-082` 提取旧资料；`SRC-001` 至 `SRC-065` 已完成，公开销售与飞书试用申请按 `D-V1-001` 纳入 v1 P0，`D-V1-002` 排除 AI 辅助制作，`D-V1-003` 排除字幕导航与学习/复习指标；当前进入 SRC-066 之后的并发提取。机械归类由 Agent 自行处理，只有实质产品决策、冲突和归档动作提交人工判断。
- 当前限制：全部 v1 需求冻结前，不开始架构定稿或产品代码重写。
- 阶段入口：`doc/requirements/v1/README.md`。

---

## 当前执行切片：超级管理员与教师账号管理

> 本节及后续内容记录 `main@0e503a4` 之前的既有实施状态，等待 v1 旧文档登记阶段统一归档；
> 当前重构目标以本文件顶部新增的 v1 切片为准。

设计入口：`docs/superpowers/specs/2026-08-20-teacher-account-admin-design.md`

实施计划：`docs/superpowers/plans/2026-08-20-teacher-account-admin.md`

当前步骤：实现、合并和生产部署已完成。

涉及文件：

- `tools/teacher-platform-release.sh`
- `tests/teacher-platform-release.test.js`
- `teacher-web/admin.html`
- `teacher-web/admin.js`

验证方式：

```text
node --test tests/*.test.js
cd backend && uv run pytest -q
cd ..
git diff --check
```

已完成的生产发布引导：

- `teacher-platform-v1` 发布包包含 `admin.html` 和 `/teacher-web/admin.js`，销售站发布白名单不变；
- 后端迁移和服务启动后检查远程 `admins` 总数，只有空表才允许首次 seed；
- 管理员初始密码可由 `KNOWNMAP_PRODUCTION_ADMIN_PASSWORD` 显式提供，否则由 `openssl rand -hex 18` 生成；
- 初始密码只通过 root `0600` 临时文件进入一次 seed，trap 和本机失败清理都会删除该文件；
- 生产长期环境文件不包含管理员 seed 密码变量或值；
- 已有任何管理员记录时后续发布跳过 seed，不重置密码、昵称或状态；
- 远程验证新增管理员会话和教师列表未登录 `401` 探针；
- 全量 Node 测试 `331 passed`、后端测试 `96 passed`，Shell 语法和 `git diff --check` 通过。

已完成的生产部署：

- 合并提交 `c0e8aaa94c27019c8b30d317cf800abcc89df84e` 已推送到 `main`；
- GitHub `node-test`、`backend-test`、Pages 构建和部署均通过；
- 生产 release 为 `20260821T020224Z-97cd83806550`，状态为 `verified`；
- 首位超级管理员 `admin` 已创建，初始密码只在发布输出中显示一次；
- 生产管理员登录、会话恢复、教师列表和退出均返回 200；
- 当前生产教师列表为 1 条，对应已发布课程数为 1；
- 未登录管理员会话和教师列表接口均返回 401；
- 管理员密码字段为 Argon2 哈希，长期环境文件无 seed 变量，临时密码文件已删除；
- 生产服务日志没有管理员初始密码或 seed 密码标记；
- 超级管理员登录已应用与教师登录相同的 Nginx 限速，连续错误登录第 7 次返回 429；
- 补丁发布明确跳过管理员 bootstrap 和教师凭据轮换，现有密码均未变化；
- 发布记录为 `deploy/releases/20260821T020224Z-97cd83806550.json`。

已完成的管理员前端工作区：

- 保留销售首页、教师工作台和服务状态三个原入口；
- 未登录时按需打开超级管理员登录，登录后切换到教师账号管理工作区；
- 支持教师列表、已发布课程数、创建教师、重置密码、会话恢复和退出；
- 临时密码只保存在页面内存和文本节点，关闭、退出或会话失效时清空；
- 请求代次会丢弃旧会话和旧教师列表响应，敏感操作串行执行；
- 临时密码未关闭前禁止下一次创建或重置，避免覆盖不可再次获取的凭据；
- 浏览器实测完成登录、列表、创建、复制、清除、重置和退出流程；
- 390px 窄屏页面无整体横向溢出，宽表格只在自身容器内滚动；
- 浏览器页面脚本无运行错误。

已完成的权威文档同步：

- 数据规范和 ER 模型加入 `admins`、`admin_sessions` 及独立认证边界；
- 字段字典记录 Argon2 哈希、HMAC 会话摘要和管理员教师摘要响应；
- 数据流记录管理员 bootstrap、创建/重置教师、一次性密码响应和发布课程 SQL 聚合；
- 数据质量规则禁止密码、哈希、Cookie、原始 token 和临时密码持久化或进入日志；
- API 文档加入管理员登录、会话恢复、退出、教师列表、创建和重置密码端点；
- 架构与部署文档加入独立管理员模块、首次初始化和生产验证步骤；
- 文档敏感词扫描只命中字段名、变量名、占位符和禁止规则，没有真实凭据；
- `git diff --check` 通过。

已完成的老师账号管理后端：

- `GET /api/v1/admin/teachers` 返回教师公开字段和已发布课程数；
- 发布课程数由 SQL 聚合计算，只计 `courses.status = 'published'`；
- `POST /api/v1/admin/teachers` 创建 active 教师及其 workspace，并仅在当次响应返回随机临时密码；
- 重复教师登录名返回冲突，不覆盖既有昵称、状态或密码哈希；
- `POST /api/v1/admin/teachers/{teacher_id}/reset-password` 只更新密码哈希，不自动恢复停用账号；
- 临时密码由系统安全随机源生成，数据库只保存 Argon2 哈希；
- 操作日志只记录管理员 ID、动作、教师 ID、结果和错误码；
- 聚焦测试 `18 passed`，后端全量 `96 passed`，Python 编译和 `git diff --check` 通过。

已完成的管理员认证 API：

- `POST /api/v1/admin/auth/login` 使用独立管理员 Cookie 建立会话；
- `GET /api/v1/admin/auth/me` 只接受有效管理员会话；
- `POST /api/v1/admin/auth/logout` 撤销会话并清除管理员 Cookie；
- 教师 Cookie 不能访问管理员认证接口；
- 登录失败不区分账号不存在或密码错误；
- Cookie 使用 `HttpOnly`、`SameSite=Lax`，生产环境启用 `Secure`；
- 操作日志只记录管理员 ID、动作和结果，不记录密码、Cookie 或 token；
- 聚焦测试 `4 passed`，后端全量 `82 passed`，Python 编译和 `git diff --check` 通过。

已完成的管理员认证服务：

- 管理员密码使用 Argon2 哈希，损坏或不支持的哈希统一按认证失败处理；
- 缺失、禁用和错误密码路径均执行密码校验，减少登录名时序枚举；
- 管理员会话只持久化 HMAC-SHA256 摘要，支持 TTL、撤销和过期过滤；
- 管理员 Cookie、会话表和认证依赖与教师完全隔离；
- 管理员 seed 只能通过显式 `python -m app.seed admin` 路径执行，并且不会覆盖已有管理员密码、名称或状态；
- 管理员初始密码不进入 Settings、`.env.example` 或数据库明文；
- 聚焦测试 `28 passed`，后端全量 `78 passed`，`git diff --check` 通过。

已完成的持久化修正：

- SQLite 项目引擎对每个连接启用外键检查；
- 保留已进入远程仓库的 `0010_admin_auth`，新增可逆 `0011` 修复迁移；
- 管理员登录名和会话摘要统一为具名唯一索引；
- 清除旧结构中无法归属有效管理员的孤立会话；
- 升级、降级、数据保持和外键执行均有自动化验证；
- 聚焦测试 `4 passed`，后端全量 `57 passed`，Alembic 保持单一 head。

安全边界：

- 管理员与教师使用独立会话表、Cookie 和 API 权限边界；
- 管理员与教师密码只保存 Argon2 哈希；
- 创建或重置教师密码时，明文只存在于当次 HTTPS 响应和页面内存；
- 不在日志、浏览器存储、发布记录、环境文件或数据库中保存明文密码。

当前阶段：多课程 v2 数据链路实施；旧单课程测试结构直接舍弃

当前版本：插件 `0.9.1`

当前状态：节点 1–7 已实现并验证；节点 8 已完成代码、自动化测试和用户基本可行性确认，
完整真实 Chrome 边界验收待收口；节点 9 尚未完成。当前开发主线已切换到文末的
“多课程数据底座”，单课程结构仅作为历史测试记录，不再作为兼容基线。

2026-08-21 教师平台已发布到阿里云 ECS：生产工作台、FastAPI、SQLite、systemd 和
Nginx 同源反代均已验证。当前 release ID 为 `20260821T020224Z-97cd83806550`，对应
GitHub SHA `97cd838065504ea2e9a50ad7f8668be504a94bcc`。生产 API 已完成登录、创建课程
和课节、保存四节点草稿、发布 `v1`、创建短期授权码和公开下载的完整探针；生产安全审计、
登录限速、锁定依赖、systemd 沙箱和每日 SQLite 备份也已部署并验证。`/admin.html`
保留销售首页、教师工作台和服务状态入口，并新增受超级管理员会话保护的教师账号管理。

2026-08-20 教师编辑器收尾切片已完成：时间线按真实 `08:33` 显示，右下快捷操作可用，
授权码支持短期/长期分类、历史记录和到期校验。该切片不改变节点 8 的剩余验收事实。

## 当前执行切片：教师时间线参考样式对齐（实现完成，视觉复核待刷新）

设计入口：`doc/teacher-timeline-reference-parity-design.md`

### 可观察事实与验收

- 修改前全页截图：`.gstack/design-reports/screenshots/timeline-before.png`；
- 浏览器 DOM 已确认结束边界被渲染成 `08:33`，177 条固定课程字幕未进入编辑器；
- 自动化先锁定默认字幕、独立结束边界、SVG 图标和连线结构，再修改实现；Node 全量
  `288 pass / 0 fail`，后端 `40 pass`、覆盖率 `87%`；
- 应用内浏览器拒绝自动刷新本地 URL，修改后的截图比对与控制台检查尚未执行；下一次在现有
  标签页手动刷新后，使用同一课程和节点数据完成这两项复核；
- 日志来源为 Node 测试输出和当前编辑器浏览器控制台；本切片不新增正文日志。

### 2026-08-20 合并与发布状态

- 功能分支已合并并推送到 `main`，合并提交为 `01d72eee6aeaa0d18742a78d30f5db76f6e8ba36`；
- GitHub `test` 与 `pages` 工作流均在该提交上通过。Pages 仍按既有白名单发布销售页和诊断页，
  不包含教师编辑器或 FastAPI；
- 正式生产脚本从该提交成功构建候选版本 `20260820T101039Z-01d72eee6aea`，发布门禁测试
  `33 pass / 0 fail`；上传前连接实际生产主机 `43.110.33.202:22` 时，服务器在 SSH banner
  阶段关闭连接。没有上传、切换 `/var/www/knownmap/current`、创建生产标签或生成发布记录；
- 当前 `knownmap.com` 仍是上一个销售静态站版本。教师编辑器和 FastAPI 的公网部署本来就不在
  现有 `sales-static-v1` 发布边界内；若要让本次教师功能在服务器可用，必须先恢复生产 SSH，
  并单独确认教师端域名、HTTPS、API 进程、数据库、密钥、CORS 与回滚设计。

### 规范加载范围

- 已读取：全局开发流程、测试规范、数据建模与数据流规范、错误处理与 lessons 规范；
- 不适用：Python/FastAPI、LLM、认证安全专项，本切片不改后端、模型调用、认证或凭证流程；
- 数据变化仅为固定测试字幕的页面启动来源，canonical caption 结构和解析校验不变；
- 收口方式：失败测试 → 最小实现 → Node 全量测试 → 文档、changelog、lessons 同步已完成；
  浏览器截图与控制台验证仍待手动刷新复核。

## 历史单课程闭环记录（已被 v2 多课程方案替代）

以下内容记录 `0.9.1` 测试过程，不再定义当前课程数据契约。当前实现不兼容
`{ "course": ... }`、`installedCourse` 或 `learningState`。

先在当前教师编辑器标签页手动刷新，确认结束边界、177 条字幕、四种 SVG 图标和摘要连线，
并检查控制台无 error。通过后完成 `tests/manual/teacher-platform-local/README.md` 的节点 8 边界验收，
然后执行节点 9 的公网空数据库完整闭环：

> 让学生在 B 站原页面通过 KnownMap 解压版 Chrome 插件输入授权码，下载、校验并保存最新课程配置，然后只在匹配的 BVID 页面运行课程。

`0.9.1` 已实现工具栏学生入口、页面书包、单课程保存、匹配 BVID 运行，以及空消息、非对象、runtime rejection 和 10 秒超时的可恢复错误。用户已确认当前核心功能基本可行；无效码、不同课程、跨 BVID、SPA 和日志仍需逐项留证。

产品设计入口：`doc/student-plugin-course-delivery-design.md`

决策入口：`doc/decisions/2026-08-18-student-plugin-single-course-delivery.md`

总计划入口：`doc/teacher-platform-dev-plan.md`

已完成执行记录：`doc/archive/2026-08-18-teacher-platform-nodes-1-7/next.md`

## 节点 8 当前执行切片

### 已确认边界

- 沿用已验证的本地 API：`POST /api/v1/public/course-download`，请求仅含
  `access_code`，成功响应为 `{ "course": PluginCourseConfig }`；本节点不凭设计草案
  臆造尚未实现的 content hash envelope。
- 插件后台把 HTTP 响应视为不可信输入，写入前再次使用
  `src/shared/course-contract.js` 校验；失败默认拒绝且不覆盖旧数据。
- 学生安装课程使用独立的 `installedCourse` / `learningState` 键，不复用教师工作台
  预览使用的 `currentCourse` / `activePreviewSession`。
- 不同课程只在学生明确确认后替换；确认和第二次下载之间仍以当前课程 ID 做并发保护。
- B 站运行时从 `installedCourse` 读取课程，只在当前 pathname 的 BVID 与
  `course.videoRef.videoId` 完全相等时挂载；SPA 离开时销毁旧 UI 和监听器。
- 本节点做四种现有节点的最小线性运行适配；不扩展字幕书包、学习报表、学生账号、
  多课程或公网部署。
- 授权码领取成功后，书包的“课程”区域新增一条当前课程记录；记录显示经过校验的完整
  B 站课程 URL，并保留“打开课程视频”操作。未领取课程时只显示空状态，不生成空记录。

### 测试先行

1. `tests/access-code-panel.test.js`：授权码标准化、请求不携带课程 ID、错误文案、
   覆盖确认取消路径、标准 B 站 URL，以及成功领取后单条课程记录的可见渲染。
2. `tests/plugin-download-flow.test.js`：网络错误、401/404、畸形 JSON、课程契约失败、
   同课程更新、不同课程确认、单次原子写入、旧课程和学习状态不被失败路径破坏。
3. `tests/course-runtime.test.js`：BVID 精确匹配、时间跨越触发、SPA 进入/离开销毁、
   重复初始化保护。
4. `tests/manual/teacher-platform-local/README.md`：真实 Chrome 加载、有效/无效授权码、
   刷新持久化、其它 BVID 静默、至少一个真实互动节点、控制台和后端日志脱敏。

### 日志与安全证据

- 自动化：Node 测试输出；后端 pytest 输出。
- 人工：Chrome 扩展 service worker 控制台、B 站页面控制台、FastAPI 结构化日志。
- 预期日志只包含操作名、课程 ID、节点数、结果和错误码；不得出现授权码原文、节点正文、
  字幕正文、Cookie 或学生答案。
- 若实际日志不足以定位失败，只补充固定字段的脱敏诊断日志，不打印请求体或响应正文。

### 2026-08-19 当前验证证据

- `node --test tests/*.test.js`：276 pass / 0 fail。
- `cd backend && uv run pytest --cov=app --cov-report=term-missing`：37 pass，总代码覆盖率 87%。
- JS 语法、`git diff --check` 和敏感原文扫描通过；扫描仅命中公开授权码占位符。
- 真实 Chrome 已确认新书包入口注入、教师端创建四种节点、发布 v1 并创建授权码；课程下载
  仍由浏览器中未重载的旧 service worker 持有，未产生下载 API 请求。必须在
  `chrome://extensions` 手工重新加载 KnownMap 后，从有效授权码下载步骤继续；本记录不把该
  环境阻塞写成功能验收通过。

### 2026-08-20 教师编辑器补充验证

- `node --test tests/*.test.js`：280 pass / 0 fail。
- `cd backend && uv run pytest --cov=app --cov-report=term-missing`：40 pass，总代码覆盖率 87%。
- 本机数据库从未标记的既有 0006 结构安全标记并升级至 `0007_access_code_types`；原课程和授权码记录保留。
- 内置浏览器确认无字幕时间线为 `08:33`，轴线右端与结束标记中心像素一致；清理 1 条旧临时密钥下无法验证的测试记录后，授权码历史最终为总计 2、短期 1、长期 1，分类点击明细正确。
- 通过教师界面创建的短期码调用公开下载端点返回 200；“完成”先保存草稿，再返回“我的课程”。
- 本切片浏览器验收通过，但节点 8 仍需在真实 Chrome 重载解压版扩展后完成学生端领取与 B 站运行验收。

### 2026-08-20 插件 `0.9.1` 验证

- 真实 Chrome 复现旧 service worker 返回空值，页面脚本读取 `result.error` 抛错并永久 loading；现已统一校验消息响应并提供 10 秒超时恢复。
- 新增工具栏课程首页，展示学生授权码、唯一当前课程、完整 B 站链接和教师登录入口；不伪造学生账号能力。
- `node --test tests/*.test.js`：284 pass / 0 fail；后端 40 pass，覆盖率 87%；380×560 弹窗视觉检查通过。
- 用户确认“当前功能基本可行”。该确认不替代无效码、覆盖取消、其它 BVID、SPA 和日志的完整边界验收。

## 开始前检查

- [x] 读取全局规范、`doc/INDEX.md`、当前需求、D-018 和学生插件设计；
- [x] 核对 `src/shared/course-contract.js`、`src/background/storage.js`、`src/background/operations.js` 和现有 B 站运行时；
- [x] 确认本地 FastAPI `/api/v1/public/course-download` 可用；
- [x] 先写节点 8 的失败测试和真实 Chrome 人工验收步骤；
- [x] 不改教师端节点 1–7 已验证的 API 与页面行为，除非失败测试证明存在必要依赖。

## 节点 8 完成门禁

- [x] 插件提供授权码输入入口，授权码不进入日志或长期明文存储；
- [x] 插件调用下载 API，并在写入前使用共享课程契约校验响应；
- [x] 自动化确认无效响应、网络失败和配置错误不覆盖已有课程；
- [x] 自动化确认新授权码对应其他课程时先确认覆盖，取消后保留原课程和本地学习状态；
- [x] 自动化确认下载后的课程只在匹配 BVID 页面启动；
- [x] 自动化确认刷新和 B 站 SPA 切换后不重复初始化或残留旧课程 UI；
- [x] 工具栏首页显示学生授权码、当前课程和教师登录入口；
- [ ] 自动化测试与真实 Chrome 人工验收通过；
- [x] README、需求、架构、数据、API、计划、索引和 changelog 已同步到 `0.9.1` 状态。

## 后续节点 9

节点 8 完成后，仍需执行公网完整闭环验收：

```text
教师登录
→ 创建课程和课节
→ 编辑四种节点
→ 保存草稿并发布
→ 创建授权码
→ 插件下载课程
→ B 站页面完成一次互动
```

节点 9 通过前，不得把“教师发布到学生运行的完整公网闭环”写成已完成。

## 当前开发步骤：多课程数据底座

更新时间：2026-08-20

当前目标：按 `docs/superpowers/plans/2026-08-20-multi-course-authorization-and-example-course.md`
实现课程 UUID、多课节、范围授权、多课程插件存储和内置示例课程。

数据规范入口：`doc/data-spec.md`。后端多课节、v2 课程包契约、v2-only
`studentCourseStore`、内置示例课程、下载器、运行时和课程名称 UI 已实现；后端发布聚合与
`AccessGrant` 多范围授权也已完成。

当前并行步骤：

- [x] 后台 Course/Lesson 从一对一升级为一对多，`0008` migration 与聚焦 pytest 通过；
- [x] 新增多课节课程包 JavaScript 契约，13 项契约测试通过；
- [x] 新增唯一的 `studentCourseStore` v2 存储，多课程合并和独立学习状态测试通过；
- [x] 内置固定 UUID 的示例课程，首次读取自动落库且不覆盖授权课程；
- [x] 删除旧 `{ "course": ... }`、单课程 key 和替换确认路径，Node 全量 305 项通过。
- [x] 后端发布聚合全部课节，授权码支持课程/课节/节点/有效期范围，后端 51 项通过。

本步骤验证：

```text
后台聚焦 pytest
Node 聚焦测试
git diff --check
```

下一步在真实 Chrome 中重新加载解压插件，验证默认示例课程可见、授权课程追加、多课节
BVID 匹配和一次互动状态写入；自动化与文档同步已完成。
