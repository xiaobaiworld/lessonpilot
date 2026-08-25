# KnownMap backend 迁移到 v1/backend 计划

状态：已完成
建立日期：2026-08-25
当前目标：把根目录 `backend/` 的运行责任迁入 `v1/backend/`，从空数据库完成新版闭环；全部测试通过后删除根目录旧后端。

## 1. 已确认事实

1. 当前仍处于开发阶段，没有真实用户、生产业务数据或需要兼容的外部消费者。
2. 不迁移旧 SQLite 业务数据；v1 使用一份新的初始迁移，从空数据库初始化。
3. 不设置 7 日观察期，也不要求两次真实交付或浏览器观察；自动化测试和空库端到端闭环通过即满足切换门槛。
4. 迁移开始时根 `backend/` 是唯一可运行的 FastAPI；现已由 `v1/backend/` 完整承接。
5. 目标仍是一个 FastAPI + SQLite 模块化单体，不拆微服务，不增加消息队列、缓存、容器编排或新的依赖注入框架。
6. Git 历史保存旧实现；新版测试通过并删除根 `backend/` 后，不在工作树长期保留第二套后端作回滚副本。

## 2. 权威依据

- v1 需求：`doc/requirements/v1/README.md`
- v1 架构及六模块边界：`doc/design/v1/03-system-architecture.md`
- 领域数据：`doc/design/v1/04-domain-data-model.md`
- 数据生命周期：`doc/design/v1/05-data-flow-lifecycle.md`
- HTTP 与课程包契约：`doc/design/v1/06-interface-contracts.md`
- 原目录隔离决策：`doc/plans/v1-replacement-plan.md`
- 项目开发规则：`doc/dev-rules.md`

本计划替代旧切换资料中的以下执行条件：生产数据迁移、7 日观察期、两次真实用户交付和真实消费者清零。原因是产品负责人已确认当前没有用户和生产业务数据。需求和设计中的安全、权限、数据完整性及契约要求不因此降低。

## 3. 完成定义

只有以下条件全部成立，迁移才算完成：

1. `cd v1/backend && uv sync --frozen` 成功；依赖和锁文件均位于 `v1/backend/`。
2. `uv run alembic upgrade head` 能把一份空 SQLite 数据库直接初始化到唯一 v1 head。
3. `uv run uvicorn app.main:app --host 127.0.0.1 --port 8001` 可独立启动。
4. `v1/backend/` 不 import、读取或执行根 `backend/` 中的代码、配置、迁移或虚拟环境。
5. 新版管理员 Web、教师 Web 和学生插件实际使用的 API 全部由 `v1/backend/` 提供。
6. 设计 06 的 41 个端点逐项具有明确结果：已实现并测试，或先修改需求/设计明确后置；不允许以检查工具返回 0 掩盖未处置缺口。
7. 从空数据库跑通：管理员初始化 → 创建教师 → 教师登录 → 创建课程/课节 → 保存草稿 → 发布 → 创建授权码 → 插件兑换并取得课程包。
8. 管理员/教师隔离、工作空间越权、并发 revision、原子发布、授权码一次显示、课程包校验和日志脱敏均有自动化反例。
9. 根测试、v1 测试、后端 pytest、Ruff、类型检查、文档/端点/模块/契约/秘密/依赖门禁全部通过；不另设观察期或人工验收门槛。
10. 发布、systemd、备份恢复和本地运行说明均只引用 `v1/backend/`。
11. 根 `backend/` 及只服务旧后端的测试、白名单和迁移入口已删除；删除后再次执行第 9 项并通过。

## 4. 目标结构

```text
v1/backend/
├── pyproject.toml
├── uv.lock
├── alembic.ini
├── .env.example
├── alembic/
│   ├── env.py
│   └── versions/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── db.py
│   ├── api/
│   ├── infrastructure/
│   │   ├── database/
│   │   ├── logging/
│   │   └── security/
│   └── modules/
│       ├── identity/
│       ├── workspace_course/
│       ├── authoring_release/
│       ├── entitlement_delivery/
│       ├── admin_support/
│       └── runtime_audit/
└── tests/
```

依赖方向固定为：

```text
路由 → 应用服务 → 领域规则/契约 → 仓储 → SQLite
```

模块不得直接查询或修改其它模块拥有的表。跨模块动作通过拥有方应用服务组合。

## 5. 执行阶段

### 阶段 A：独立运行基线

- [x] 删除 `v1/backend/app.py` 与 `v1/backend/app/` 的同名入口歧义，统一使用 `app.main:app`。
- [x] 建立独立 `pyproject.toml`、`uv.lock`、`alembic.ini` 和 `.env.example`。
- [x] 建立配置、数据库会话、FastAPI 生命周期、统一错误、`request_id`、结构化日志。
- [x] 建立 `/health`、`/api/v1/meta/version`、`/api/v1/meta/contracts`。
- [x] 建立启动、环境拒绝、日志脱敏和空库初始化测试。

验收：不设置 `PYTHONPATH` 指向仓库根，也能从 `v1/backend/` 独立安装、迁移、启动和测试。

### 阶段 B：单一初始数据库

- [x] 依据设计 04 和六模块表归属建立一份 v1 初始迁移。
- [x] 不复制旧 `0001`–`0011` 演化链，也不建立旧数据兼容分支。
- [x] 数据库只保存服务端权威数据；不保存完整字幕、学生回答或学习进度。
- [x] 外键、唯一性、状态和排序约束在数据库或领域边界中可执行验证。

验收：随机临时路径上的空库可以一次升级到 head；重复执行无额外副作用。

### 阶段 C：身份、工作空间和课程

- [x] 接通管理员/教师认证、HttpOnly 会话、退出、停用、恢复和密码重置。
- [x] 接通唯一工作空间、课程、课节、视频引用、归档、revision 和整组课节排序。
- [x] 所有教师对象访问从可信会话推导工作空间；跨教师访问安全拒绝且无副作用。

### 阶段 D：制作、发布、授权与课程包

- [x] 接通整份草稿保存、四类节点验证和 revision 冲突。
- [x] 接通课程级原子发布、不可变快照、发布历史和 availability。
- [x] 接通授权码、授权项、兑换、终止、更新和范围裁剪。
- [x] 课程包按 Schema 生成；授权码、密码、会话、字幕和学生状态不得进入课程包。

### 阶段 E：客户端与工具切换

- [x] 管理员 Web、教师 Web、插件和本地脚本全部指向新 API。
- [x] `endpoint-check`、`module-check`、`contract-check`、`dependency-check` 和根测试只以 v1 后端为当前真源。
- [x] systemd、发布、备份、恢复、版本探针和 README 改为 `v1/backend/`。
- [x] 从空库执行自动化端到端闭环；按产品负责人要求不另设真实浏览器验收门槛。

### 阶段 F：删除旧后端

- [x] 确认仓库内无运行代码、测试、工具、文档命令或发布配置引用根 `backend/`。
- [x] 从工作树删除根 `backend/` 及旧后端专用资产；提交由当前工作树统一处理。
- [x] 删除后执行完整门禁；失败项均在新真源修复，没有恢复双后端共存。
- [x] 更新 `README.md`、`doc/SYSTEM-OVERVIEW.md`、`doc/INDEX.md`、`next.md`、`changelog.md` 和必要 lessons。

## 6. 最小验证命令

```bash
cd v1/backend
uv sync --frozen
uv run ruff check .
uv run ruff format --check .
uv run pytest

tmp_db="$(mktemp -d)/knownmap-v1.db"
DATABASE_URL="sqlite:///$tmp_db" uv run alembic upgrade head
DATABASE_URL="sqlite:///$tmp_db" uv run uvicorn app.main:app --host 127.0.0.1 --port 8001

cd /Users/bai/code/lessonpilot
npm test
npm run check
```

临时数据库只用于验收，不写入仓库。涉及 shell 清理时只删除已确认的 `mktemp -d` 目录。

## 7. 风险与处理

| 风险 | 处理 |
| --- | --- |
| 把能启动误报为迁移完成 | 完成定义要求空库业务闭环和删除后总门禁 |
| 新旧模型语义不一致 | 以冻结需求、设计和契约为准，不以旧表字段为真源 |
| 41 个端点中缺失项被工具容忍 | 删除前逐项实现或先修改权威范围，门禁不得只检查未知端点 |
| 两套后端继续漂移 | 阶段 A 后新增后端代码只进入 `v1/backend/`；旧后端只读参考 |
| 为迁移顺带引入新架构 | 复用 FastAPI、SQLAlchemy、Alembic、Pydantic、uv；不增加无当前需求的基础设施 |

## 8. 当前执行记录

- 2026-08-25：产品负责人确认没有用户、生产业务数据或生产观察要求；取消旧计划中的数据迁移和 7 日观察门槛。
- 2026-08-25：目录审计确认根 `backend/` 仍是唯一可运行 API，`v1/backend/app.py` 是 placeholder。
- 2026-08-25：`node tools/endpoint-check.mjs` 报告清单 41 个、代码 22 个、已对齐 15 个、待实现 26 个、待退役旧路径 7 个；工具当前仍以“没有未登记端点”为成功，后续需收紧完成门禁。
- 2026-08-25：完成独立 Python 工程、锁文件、FastAPI 入口、数据库会话、请求 ID、日志脱敏和三个运行探针；服务已在 `127.0.0.1:8001` 实际启动并逐项返回 200。
- 2026-08-25：六个原型模块已合并到同一 SQLAlchemy metadata，并生成单一 v1 初始迁移；空库 `upgrade head`、重复升级和 `alembic check` 通过。
- 2026-08-25：补齐预览会话、权利确认和试用跟进，冻结唯一初始迁移 `c9b7a7b60da5`；空库、重复升级和 metadata 一致性测试通过。
- 2026-08-25：身份、工作空间、课程、草稿、预览、发布、授权、兑换和更新全部接通；OpenAPI 与设计清单 41/41 对齐，空库完整交付闭环测试通过。
- 2026-08-25：教师 Web、学生插件、CI、依赖检查、systemd 和发布脚本已切换到 `v1/backend/`；进入删除根旧后端前的最后引用清理。
- 2026-08-25：根旧后端已删除；后端 16 项、legacy Node 269 项、v1 Vitest 217 项及全部静态、契约、文档、依赖、秘密和构建门禁通过，独立 Uvicorn 空库启动探针通过。迁移完成，不进入观察期。
