# KnownMap

KnownMap 把老师已有的 B 站录播课变成可在原视频页面运行的互动课程。老师导入
一条 B 站视频链接和字幕、配置互动节点、发布并发出授权码；学生在 PC Chrome 装
插件后，于 B 站原页面到点暂停、作答、看反馈并继续播放。

## 先读这里

**[`doc/SYSTEM-OVERVIEW.md`](doc/SYSTEM-OVERVIEW.md) — 系统总说明。**
系统是什么、由哪四个部分组成、数据怎么流动、关键设计决定为什么这样定、
目录怎么对应、怎么跑起来和怎么验证。跨文件动代码之前先读它。

其余入口：

| 想知道 | 读 |
| --- | --- |
| 系统整体 | [`doc/SYSTEM-OVERVIEW.md`](doc/SYSTEM-OVERVIEW.md) |
| 现在该做什么 | [`next.md`](next.md) |
| 文档分类与权威顺序 | [`doc/INDEX.md`](doc/INDEX.md) |
| 踩过什么坑（动手前必读） | [`doc/lessons.md`](doc/lessons.md) |
| 为什么这样设计 | [`doc/design/v1/`](doc/design/v1/) |
| 要做到什么 | [`doc/requirements/v1/`](doc/requirements/v1/) |

品牌域名 `knownmap.com`；Logo 资源见
[`docs/knownmap-logo-resources.md`](docs/knownmap-logo-resources.md)。

## 当前状态

系统已于 2026-08-24 切换到 v1 生产 release
`20260824T030156Z-af9fb313f9e4`。新系统位于 `v1/`；旧 `backend/`、`teacher-web/`、
`src/` 仍作为固定回滚组合和兼容责任保留，要在即时验收、7 日观察、
两次真实交付和老版消费者清零后才能独立退役（`D-V1-012`）。

生产 Web、API、迁移和插件已由同一冻结提交统一发布；即时 P0 业务验收仍在执行。
逐步状态和证据见 [`doc/老版新版切换计划.md`](doc/老版新版切换计划.md)，当前下一步见
[`next.md`](next.md)。

## v0.9.1 旧系统范围（冻结）

- 本地与阿里云生产环境均运行 FastAPI + SQLite 教师平台；
- 预建教师测试账号，登录名加密码；
- 教师界面当前操作一门课程中的一个课节；后端数据和课程 API 已支持一门课程多个有序课节；
- B 站视频绑定和课程发布；
- 重点标注、选择题、填空题、问答题四种节点；
- 教师创建课程授权码；
- 学生使用 KnownMap `0.9.1` 解压版 Chrome 插件，通过工具栏首页或 B 站页面书包输入授权码并下载课程；
- 插件使用唯一的 `studentCourseStore` 保存多门课程，并按 `courseId + lessonId` 隔离学习状态；
- 插件默认带一门只读示例课程；领取授权课程后与示例课程并存，界面显示课程名称和课节名称；
- v2 UUID 多课节课程包、范围授权、公开多课程下载、下载器、运行时和课程列表 UI 已接通；
- 教师 API 和教师编辑器已部署到 `knownmap.com`；
- 销售页已经作为 `knownmap.com` 的生产首页发布。
- 学生插件包发布代码会从精确 commit 组装 `knownmapplugin.zip`，销售页和插件工具栏首页共用固定下载地址；当前生产 release 尚未包含该 ZIP，需在下一次发布后验证。
- 销售页的飞书真实课程试用表单与独立入口模块已完成，公开链接已通过无登录态访问验收。

问答题只保存学生原始回答，并展示老师预设的参考反馈；第一阶段不评分、不调用 AI。

## 旧系统历史状态

插件已经能够在指定 B 站页面定位播放器、监听时间、暂停、seek、卸载注入 UI，并通过授权码下载和保存课程。工具栏左键首页展示学生授权码入口、当前课程和教师登录入口；空消息、异常返回和超时会恢复表单并提示重新加载。完整边界验收和从空数据库开始的端到端闭环仍未完成。

重构起点曾是 **v1 阶段 0：工程基线与干净初始化**；v1 需求（`1.0.2`）与设计（01–09）
已冻结，开发计划、目录隔离替换决策、代码重构执行计划和测试计划用于历史追溯。

上述已接通的能力属于 v0.9.1 原型基线。按 `D-V1-012`，v1 从空数据库开始，不迁移旧服务端
业务数据和学生本机数据；新系统在同仓库 `v1/` 目录独立建立，旧系统冻结功能和结构变更，
完成真实切换、观察和回退验证后再独立退役。

本节仅保留 v0.9.1 原型能力作为退役清单和回归参考，不再代表当前生产入口。

## 目标页面

| 路径 | 第一阶段职责 | 当前实现状态 |
| --- | --- | --- |
| `/teacher-web/` | 历史销售页和教师工作台原型 | 保留作视觉和历史入口 |
| `/teacher-web/workspace.html` | 历史 1A 连接诊断页 | 保留作协议诊断参考 |
| `/teacher-web/forsales.html` | 公网销售页 | 第一阶段已完成，也是 `knownmap.com` 当前生产首页 |
| `/admin/` | v1 管理员端 | 当前生产主入口 |
| `/teacher/` | v1 教师端 | 当前生产主入口 |
| `/teacher-web/editor.html` | 老教师入口 | 保留兼容，导向 `/teacher/` |

## Web 生产发布

销售页是 [https://knownmap.com](https://knownmap.com)，管理员端是
[https://knownmap.com/admin/](https://knownmap.com/admin/)，教师端是
[https://knownmap.com/teacher/](https://knownmap.com/teacher/)。生产使用 `v1-apps` profile 将两个 Web 应用、
FastAPI、数据库迁移、销售页和学生插件绑定为一个可回滚 release。

当用户说“发布到网站”或“发布到 Web 网站”时，使用统一教师平台入口：

```bash
KNOWNMAP_SSH_HOST=aliyun-us KNOWNMAP_PUBLISH_PROFILE=v1-apps \
  tools/teacher-platform-release.sh deploy <git-ref>
```

发布必须绑定已经推送到 GitHub 的精确 commit SHA。成功后会：

- 在服务器创建不可变发布目录、`release.json` 和 `SHA256SUMS`；
- 原子切换 `/var/www/knownmap/current`；
- 追加服务器发布历史；
- 创建 `web-prod/<release-id>` GitHub 标签；
- 在 `deploy/releases/` 生成待提交的生产发布记录。

查询和回滚：

```bash
tools/web-release.sh status
tools/web-release.sh list
tools/web-release.sh verify <release-id>
tools/web-release.sh history
tools/web-release.sh rollback <release-id>
```

当前发布记录见 [`deploy/releases/README.md`](deploy/releases/README.md)；
原发布设计已归档为 [`doc/archive/.../web-production-release-design.md`](doc/archive/2026-08-22-pre-v1-rewrite/doc/web-production-release-design.md)，
v1 的发布与回滚边界以 [`doc/design/v1/08-security-operations-design.md`](doc/design/v1/08-security-operations-design.md) 为准。
GitHub Pages 工作流保留为第一阶段历史部署入口，不再代表 `knownmap.com` 当前生产版本。

教师平台生产发布使用：

```bash
tools/teacher-platform-release.sh deploy <git-ref>
tools/teacher-platform-release.sh status
```

当前生产版本为 `20260824T030156Z-af9fb313f9e4`，对应 GitHub 提交
`af9fb313f9e4738a0f9de0814f00f05d4558c151` 和标签
`web-prod/20260824T030156Z-af9fb313f9e4`。服务器上的网页、FastAPI、插件和仓库发布记录使用
同一个 release ID；SQLite 数据保存在 `/var/lib/knownmap/knownmap.db`，不随代码版本切换。

## 本地运行

启动本地教师平台 API：

```bash
cd /Users/bai/code/lessonpilot/backend
uv sync
cp .env.example .env
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000
```

API 文档位于 `http://127.0.0.1:8000/docs`，健康检查位于 `http://127.0.0.1:8000/health`。开发环境默认使用 DEBUG 级别和可读控制台日志；正常运行环境使用 INFO 级别和结构化 JSON 日志。业务操作摘要写入 SQLite 的 `operation_logs` 表。

当前教师页面已作为“KnownMap 互动课程工具”接入本地或同源生产 API 和可视化节点时间轴。
插件运行时只读取 `studentCourseStore`。首次读取会自动加入内置只读示例课程；授权码领取
的课程按 UUID 合并保存，不替换其他课程。当前插件下载课程仍连接本机
`http://127.0.0.1:8000`，尚未切到生产 API。

预建本地测试教师账号：

```bash
cd /Users/bai/code/lessonpilot/backend
SEED_TEACHER_LOGIN_NAME=teacher-test-01 \
SEED_TEACHER_PASSWORD=password \
SEED_TEACHER_DISPLAY_NAME='测试教师' \
uv run python -m app.seed
```

本地预建测试账号密码固定为 `password`，仍只通过 seed 环境变量传入，不预填到页面，也不写入日志。

启动现有静态教师页面：

```bash
cd /Users/bai/code/lessonpilot
python3 -m http.server 4173
```

互动课程工具可以从 [http://localhost:4173/teacher-web/editor.html](http://localhost:4173/teacher-web/editor.html) 访问。不要把 `teacher-web/` 作为独立 server root，也不要另开第二个端口；资源和测试夹具均按仓库根目录解析。端口 4173 写入了插件来源白名单，换端口会使消息桥拒绝该页面。

首次运行或拉取新代码后，先组装共享契约：

```bash
node tools/assemble-workspace.js
```

它把 `src/shared/` 复制到 `teacher-web/shared/`，使工作台页面在本地和公网加载同一路径。该目录不入版本库：提交副本会形成第二份契约定义并可能与源文件脱节（D-010）。

安装依赖并运行自动化测试：

```bash
npm ci
npm test
```

`npm test` 覆盖 `.test.js`（CommonJS）与 `.test.mjs`（ESM）两类测试文件。

加载当前插件 `0.9.1`：

1. 打开 `chrome://extensions/`，启用开发者模式；
2. 选择“加载已解压的扩展程序”，目录为仓库的 `src/`；
3. 首次加载或代码更新后点击扩展卡片的“重新加载”，再刷新 B 站页面；
4. 左键点击工具栏 KnownMap 图标，在学生入口输入老师提供的授权码；也可以在 B 站页面右下书包中领取；
5. “我的课程”出现完整 B 站链接后，打开匹配视频验证互动节点。

## 文档入口

开始任何跨文件实现前先读 [`doc/INDEX.md`](doc/INDEX.md)，它区分了当前权威、当前证据和历史归档。

当前权威只有以下几处：

| 文档 | 职责 |
| --- | --- |
| [`doc/requirements/v1/README.md`](doc/requirements/v1/README.md) | v1 需求真源（`1.0.2`，已冻结） |
| [`doc/design/v1/README.md`](doc/design/v1/README.md) | v1 设计真源（01–09，已冻结） |
| [`doc/plans/v1-development-plan.md`](doc/plans/v1-development-plan.md) | 阶段 0–8 目标与产品门禁 |
| [`doc/plans/v1-replacement-plan.md`](doc/plans/v1-replacement-plan.md) | 已接受的 `v1/` 目录隔离替换决策与资产处置依据 |
| [`doc/plans/v1-code-refactor-execution-plan.md`](doc/plans/v1-code-refactor-execution-plan.md) | 代码目录、工作包顺序与提交边界 |
| [`doc/plans/v1-test-plan.md`](doc/plans/v1-test-plan.md) | 测试矩阵与发布门禁 |
| [`doc/dev-rules.md`](doc/dev-rules.md) | 项目专有开发规则 |
| [`doc/traceability/v1-requirements.tsv`](doc/traceability/v1-requirements.tsv) | 256 个稳定编号的追踪矩阵 |
| [`doc/lessons.md`](doc/lessons.md) | 已踩的坑；开始新功能前先读 |
| [`next.md`](next.md) | 当前执行切片 |

原教师平台需求、架构、数据与 API 规范已按
[`doc/design/v1/02-legacy-document-register.md`](doc/design/v1/02-legacy-document-register.md)
归档到 `doc/archive/2026-08-22-pre-v1-rewrite/`。它们只描述 v0.9.1 现状，不定义 v1 目标。

品牌资源：

- [`docs/knownmap-logo-resources.md`](docs/knownmap-logo-resources.md)：Logo 含义、形态、颜色和使用场景；
- `src/assets/knownmap-logo.svg`：唯一 Logo 源文件；
- `src/assets/knownmap/knownmap-circle.svg`：圆形深绿底变体；
- `src/assets/knownmap/knownmap-square.svg`：方形深绿底变体；
- `src/assets/knownmap/knownmap-transparent.svg`：透明背景变体，边缘使用品牌深绿色；
- `src/assets/icon-16.png`、`icon-24.png`、`icon-48.png`、`icon-128.png`：扩展资源；
- `teacher-web/assets/knownmap-icon.png`：网页导出资源。

解释冲突时按 [`doc/dev-rules.md` 第 1 节](doc/dev-rules.md#1-权威顺序) 的权威顺序：
已冻结 v1 需求与决策 -> 已审核 v1 设计 -> 可重复运行结果与真实验收 -> 当前代码事实 -> 已审计旧资料。
已归档文档和历史原型不得覆盖 v1 范围。

## 核心边界

- 学生宿主只使用 B 站原页面加 PC Chrome 插件；跨源网页无法稳定控制 B 站播放器。
- 教师工作台通过版本化 `window.postMessage` 与白名单 content script 通信，再由插件后台严格校验和存储。
- 完整字幕只留在教师浏览器，不发送给插件；插件只接收运行所需课程配置。
- 更换课程 URL 时必须提醒；确认后清除旧课程，取消则完整保留。
- 第一阶段允许礼宾式协助，不以自动抓字幕、自助安装或应用商店发布为完成条件。
