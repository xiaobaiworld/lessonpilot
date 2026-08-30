# KnownMap 项目开发规则

适用范围：本仓库全部代码、文档和工具。

与 `~/.claude/CLAUDE.md`（全局规则）共同生效。全局规则已经写明的内容不在此重复；
本文件只写 KnownMap 特有的边界。两者冲突时以全局规则为准，并把冲突写入 `doc/lessons.md`。

## 1. 权威顺序

解释冲突时按以下顺序，完整定义见
[`design/v1/README.md` 第 2 节](design/v1/README.md#2-权威顺序)：

1. 已冻结 v1 需求和已接受产品决策；
2. 已通过人工审核的 v1 设计；
3. 可重复运行结果、真实人工验收和生产记录；
4. 当前代码和数据库迁移所描述的实现事实；
5. 已完成演化审计的旧设计、计划和研究资料。

需求、设计和代码都可能有错。高权重内容与已验证的技术或安全事实冲突时必须重新审核，
不得静默选一方。

## 1.1 学生插件版本必须自动升级

这是项目硬性定义，不是可选提醒：**只要插件发生改动，就必须更新插件版本号**，不等待产品负责人或用户再次提醒。凡是会进入学生插件包或改变插件行为的改动，都属于“插件发生改动”，包括 `v1/extension/` 下的运行时代码、弹窗、设置页、背景脚本、内容脚本、清单、权限、内置图片/音频、资源清单、构建配置和打包清单。

- 插件版本唯一真源是 `v1/extension/manifest/targets.ts` 的 `EXTENSION_VERSION`；`manifest.json` 由构建生成，`v1/package.json` 的工作区版本不是插件版本。
- 开始插件任务时先读取当前已发布版本，在同一次改动中按功能规模自动更新 `EXTENSION_VERSION`；不得用旧版本号生成新的插件包，也不得把版本判断留给用户补充。
- 小功能递增补丁版本 `0.0.1`，大一些的功能递增次版本 `0.1`，核心流程、数据结构或插件架构升级递增大版本 `1.x`；一次改动符合多个等级时按较高等级处理。
- 仅修改文档、设计草稿或只影响测试且不进入插件包的内容，不触发插件版本升级；只要同时修改了插件包输入或插件行为，仍必须升级。
- 发布前必须检查 `EXTENSION_VERSION`、local/production 两套 manifest、最终 ZIP 和线上下载包版本一致；发现插件输入已变更而版本未变更时，停止发布并先修正版本。

## 2. 真源入口

| 内容 | 真源 |
| --- | --- |
| 需求 | [`requirements/v1/README.md`](requirements/v1/README.md) |
| 设计 | [`design/v1/README.md`](design/v1/README.md) |
| 开发计划 | [`plans/v1-development-plan.md`](plans/v1-development-plan.md) |
| 测试计划 | [`plans/v1-test-plan.md`](plans/v1-test-plan.md) |
| 需求追踪 | [`traceability/v1-requirements.tsv`](traceability/v1-requirements.tsv) |
| 决策 | [`decisions/`](decisions/)，v1 段为 `D-V1-001` 至 `D-V1-013` |
| 初期发布流程 | [`decisions/2026-08-26-early-stage-release-process.md`](decisions/2026-08-26-early-stage-release-process.md)（`D-V1-013`，当前阶段运行约定） |
| 文档地图 | [`INDEX.md`](INDEX.md) |
| 插件本机资源（方向已确认，尚未实施） | [`插件文件资源管理.md`](插件文件资源管理.md) |

`doc/archive/` 只用于追溯，不指导开发。标为「当前证据」的文档只证明 v0.9.1 现状，
不定义 v1 目标。

## 3. 编号规则

编号前缀清单和「已保留未签发」名单见
[`requirements/v1/README.md` 第 1.2 节](requirements/v1/README.md#12-需求编号规则)，
机器可读副本在 `tools/lib/requirement-ids.mjs`。

- 引用编号必须能解析到定义。`node tools/doc-check.mjs` 会拒绝指向不存在编号的引用。
- 需求之间的上下游关系只写在追踪矩阵里，不写回需求条目 —— 双向维护已经证明会漂移。
- 编号进入已接受状态后不复用；被替代时保留原编号和替代关系。

## 4. 契约真源边界

按 `ARCH-DEC-02`（[`design/v1/03-system-architecture.md` 第 14 节](design/v1/03-system-architecture.md#arch-dec-02跨语言契约真源)）：

| 契约 | 真源 | 消费端 |
| --- | --- | --- |
| HTTP API | FastAPI/Pydantic 生成的 OpenAPI | Web 客户端、插件 |
| 课程发布包 | 仓库内版本化 JSON Schema | 后端生成、插件校验 |
| 插件内部消息 | 仓库内版本化 JSON Schema | popup / background / content |

同一契约不允许两份手写校验器。Python 与 TypeScript 侧都从真源生成或据其校验。
契约变更必须同步版本、校验、消费端和测试；无法迁移或安全拒绝旧数据时不切换新契约
（`DEV-STRUCT-001`、`DEV-STRUCT-002`）。

## 5. 服务端模块边界

按 [`design/v1/03-system-architecture.md` 第 7 节](design/v1/03-system-architecture.md#7-服务端业务模块)，
FastAPI 是一个部署单元、一个事务边界，内部分六个业务模块：身份与会话、工作空间与课程、
制作与发布、授权与交付、管理与支持、运行与审计。

- 一个模块不得直接查询或修改另一个模块拥有的表；跨模块动作经显式应用服务组合。
- 依赖方向：路由 → 应用服务 → 领域规则与契约 → 仓储接口 → 适配器。反向依赖不允许。
- 路由只处理协议、认证入口、参数和错误映射；仓储只负责持久化，不决定权限或发布语义。
- 对外错误使用稳定代码和 `request_id`，不返回内部异常、路径或堆栈。

表归属见 [`design/v1/03-system-architecture.md` 第 7.0 节](design/v1/03-system-architecture.md#70-表归属)，
机器可读副本在 `tools/v1-module-check.mjs`。模型类仅作类型标注（例如把已认证的 `Teacher`
对象作为参数类型）不算跨模块访问；`select`、`session.get`、按列过滤和构造实例才算。

当前后端只位于 `v1/backend/app/modules/<domain>/`，按目录判定归属且零豁免。
根 `backend/` 已删除；需要另一个模块的数据时调用该模块的应用服务，不恢复旧白名单。

## 6. 客户端边界

- 教师应用与管理员应用不共享登录状态、角色路由守卫或资源授权决定，可共享无业务权限的
  视觉组件和 HTTP 基础设施。
- 插件中 popup 和 content 不得旁路 background 直接访问网络或底层存储。
- background 不信任页面消息、网络响应或已有本机存储，每次跨边界读取都复验。
- 宿主适配器只暴露运行所需最小播放能力，不把 B 站 DOM 选择器扩散到课程逻辑。
- 学生本机学习数据不上传（`SEC-PRIV-001`）。

## 6.1 本地服务启动与教师人工验收账号

只要用户要求启动本地服务并准备人工验收，启动动作必须同时完成下面的准备，不得只启动
API 和前端就交给用户登录：

1. 先确认后端实际使用的 `DATABASE_URL`，并向用户说明当前连接的是哪一个数据库；不得把
   临时数据库、测试数据库和用户平时的本地数据库混用或静默切换。
2. 在当前数据库中确保存在一个专用的本地教师验收账号，并准备至少一门课程和一个课节，
   使用户打开教师端后可以直接进入节点编辑页面。
3. 如果验收账号不存在，可以使用一次性 seed 或管理员创建流程建立；如果账号已存在，
   不得为了“启动服务”重复执行会覆盖密码的教师 seed。密码未知时必须走管理员重置流程，
   并把本次新密码明确告知用户。
4. 启动完成后必须提供教师端地址、教师验收账号和密码、预置课程/课节位置；密码只用于
   本地验收，不得写入 Git、生产配置、长期日志或截图。
5. 人工验收结束后，若使用临时数据库或临时账号，必须停止对应服务并说明临时数据的
   清理情况；不得停止或重启主工作区中不属于本次任务的服务。

当前实现中，`dev-up.sh` 只负责迁移和启动服务，不负责创建教师验收账号。执行上述规则时，
必须由启动服务的 Agent 显式完成账号/课程准备，或补充等价的安全启动脚本；不得把“前端
能打开”当作“人工验收环境已准备好”。教师账号的数据库字段和密码安全边界见
`v1/backend/app/modules/identity/models.py`：数据库只保存用户名和 Argon2 密码哈希，
不保存可再次查看的密码原文。

## 7. 文档同步门禁

每个阶段结束前（`DEV-DOC-*`）：

1. 需求/设计编号已回链，追踪矩阵已更新；
2. `changelog.md`、`next.md` 与实际状态一致；
3. 新踩的坑已写入 `doc/lessons.md`；没有新经验就明确写「本阶段无新增 lessons」；
4. 无秘密、真实个人数据或未经授权的第三方内容进入仓库。

文档与代码必须在同一个提交或连续两个提交内同步。

## 8. 检查与测试命令

```bash
npm test                                  # 前端、插件与文档一致性测试
node tools/doc-check.mjs                  # 编号可解析、链接、矩阵覆盖、权威唯一
node tools/endpoint-check.mjs             # 端点清单与后端实现对照
node tools/v1-module-check.mjs            # v1 模块与表归属
npm run check:contract                    # v1 契约 Schema 与版本清单
node tools/secret-scan.mjs                # 仓库秘密扫描（SEC-SECRET-003）
node tools/dependency-check.mjs           # 依赖锁定与约束（DEV-DEP-001 离线部分）
cd v1/backend && uv run ruff check .      # 后端 lint
cd v1/backend && uv run ruff format --check . # 后端格式
node tools/build-traceability.mjs         # 重新生成追踪矩阵
node tools/build-traceability.mjs --check # 校验矩阵与需求文档一致
cd v1/backend && uv run pytest            # 后端测试
```

新增或修改 HTTP 端点前先在
[`design/v1/06-interface-contracts.md` 第 4.5 节](design/v1/06-interface-contracts.md#45-v1-http-端点清单)
登记。`endpoint-check` 把未登记端点视为失败：清单是按冻结需求推导的实现基准，
代码不能先于契约设计存在。改名旧路径在依据列标注 `旧路径：<方法> <路径>`，退役后移除标注。

提交前全绿。文档检查失败与测试失败同等对待，不允许「文档下次再说」。

用 `npm test` 而不是直接写 `node --test tests/*.test.js`：测试同时有 `.test.js`（CommonJS）
和 `.test.mjs`（ESM，文档一致性检查需要 `import` 工具模块），单个 glob 会静默漏掉一类。

根 `npm test` 是仓库总入口，覆盖 Node/TypeScript 与文档相关测试；后端使用
`cd v1/backend && uv run pytest`。依赖、端点、模块、契约、秘密和发布清单检查都以 v1 为真源。

依赖：Node 侧 `npm ci`（`ajv` 用于契约校验），后端 `cd v1/backend && uv sync --frozen`。
两侧都必须从仓库内解析，不依赖开发机全局安装（`DEV-DEP-001`）。
这条踩过两次：`ajv` 曾只能从 `/Users/bai/node_modules` 解析，`ruff` 曾只有
`[tool.ruff]` 配置而没有声明依赖 —— 两者在本机都能跑，在 CI 的 `--frozen` 环境都会失败。

秘密扫描发现命中时，先确认该凭证是否已在真实环境使用；若是，**先吊销再改代码** ——
从 Git 历史移除比从工作区移除困难得多。确认是占位或示例时，在
`tools/secret-scan.mjs` 的 `ALLOWLIST` 按「文件 + 规则」登记并写明理由，不整目录豁免。

漏洞库查询（`npm audit`、`pip-audit`）只在 CI 执行，需要联网。
**不要在本机用 `npm audit` 判断有无漏洞** —— 常用镜像源不实现 advisories 端点，
本机跑只会得到 404 而不是「无漏洞」，那是最坏的假绿。

## 9. 语言

文档、注释和提交信息使用中文。既有英文文件不作为语言依据 —— 新增和修改内容用中文。
