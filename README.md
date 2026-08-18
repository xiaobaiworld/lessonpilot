# KnownMap

品牌域名：`knownmap.com`
Logo 规范：[`docs/superpowers/specs/2026-08-18-knownmap-brand-update-design.md`](docs/superpowers/specs/2026-08-18-knownmap-brand-update-design.md)

KnownMap 把老师已有的 B 站录播课变成可在原视频页面运行的互动课程。老师在公网工作台导入一条 B 站视频链接和对应字幕，配置互动节点；学生在 PC Chrome 安装本机插件后，于 B 站原页面到点暂停、作答、查看反馈并继续播放。

第一阶段销售页和原型 Demo 已完成并归档。当前开发目标是本地教师平台：教师用预建测试账号发布一门课程，通过授权码让学生在 B 站插件中下载并运行课程配置。

## 当前范围

- 本地 FastAPI + SQLite 教师平台；
- 预建教师测试账号，登录名加密码；
- 一门课程和一个课节；
- B 站视频绑定和课程发布；
- 重点标注、选择题、填空题、问答题四种节点；
- 教师创建课程授权码；
- 学生使用 KnownMap 提供的解压版 Chrome 插件下载课程；
- 本地数据库和插件本地课程配置；
- 教师 API 和教师编辑器公网部署作为后续阶段，不在当前实现范围；
- 销售页已经作为 `knownmap.com` 的生产首页发布。

问答题只保存学生原始回答，并展示老师预设的参考反馈；第一阶段不评分、不调用 AI。

## 当前状态

技术 spike 已证明插件可以在指定 B 站页面定位播放器、监听时间、暂停、seek 和卸载注入 UI，但完整产品闭环尚未实现。

当前开发阶段是 **教师平台本地发布与插件授权下载闭环**。节点 1–7 已完成：教师网页已接入本地 FastAPI，可以登录、建课、编辑四种节点、保存草稿、发布课程和创建授权码；插件下载与运行接入属于下一节点。

从 [`next.md`](next.md) 开始，完整计划见 [`doc/teacher-platform-dev-plan.md`](doc/teacher-platform-dev-plan.md)。第一阶段计划已归档，不再是当前排期。

## 目标页面

| 路径 | 第一阶段职责 | 当前实现状态 |
| --- | --- | --- |
| `/teacher-web/` | 历史销售页和教师工作台原型 | 保留作视觉和历史入口 |
| `/teacher-web/workspace.html` | 历史 1A 连接诊断页 | 保留作协议诊断参考 |
| `/teacher-web/forsales.html` | 公网销售页 | 第一阶段已完成，也是 `knownmap.com` 当前生产首页 |
| `/teacher-web/editor.html` | 当前教师工作台 | 本地开发主入口，已接入教师平台 API |

## Web 生产发布

销售页生产地址是 [https://knownmap.com](https://knownmap.com)。生产服务器通过本机 SSH
别名 `aliyun` 连接；公网只发布销售页白名单，不发布教师编辑器、后端、测试、文档、
插件源码或仓库元数据。

当用户说“发布到网站”或“发布到 Web 网站”时，使用统一入口：

```bash
tools/web-release.sh deploy <git-ref>
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

完整规则见 [`doc/web-production-release-design.md`](doc/web-production-release-design.md)。
GitHub Pages 工作流保留为第一阶段历史部署入口，不再代表 `knownmap.com` 当前生产版本。

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

当前教师页面已作为“KnownMap 互动课程工具”接入本地 API 和可视化节点时间轴；插件下载和运行仍待后续节点。

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

运行自动化测试：

```bash
node --test tests/*.test.js
```

加载当前插件 spike：

1. 打开 `chrome://extensions/`，启用开发者模式；
2. 选择“加载已解压的扩展程序”，目录为仓库的 `src/`；
3. 打开 `https://www.bilibili.com/video/BV1WW4y1e7GL/` 验证现有 spike。

固定视频和固定节点只用于 spike 回归，1C 必须改为读取教师工作台保存的当前课程。

## 文档入口

开始任何跨文件实现前先读 [`doc/INDEX.md`](doc/INDEX.md)。当前事实源为：

| 文档 | 职责 |
| --- | --- |
| [`doc/requirements/teacher-platform-local-stage.md`](doc/requirements/teacher-platform-local-stage.md) | 当前教师平台本地阶段范围和验收 |
| [`doc/teacher-platform-architecture.md`](doc/teacher-platform-architecture.md) | FastAPI、SQLite、教师端和插件边界 |
| [`doc/teacher-platform-data-spec.md`](doc/teacher-platform-data-spec.md) | 当前教师平台数据模型和插件输出 |
| [`doc/teacher-platform-api-spec.md`](doc/teacher-platform-api-spec.md) | 当前教师认证、课程、发布和下载 API |
| [`doc/DECISIONS.md`](doc/DECISIONS.md) | 决策、假设、证据和重开条件 |
| [`doc/teacher-platform-dev-plan.md`](doc/teacher-platform-dev-plan.md) | 当前阶段开发节点、测试和提交门禁 |
| [`next.md`](next.md) | 唯一当前执行步骤 |

品牌资源：

- [`docs/knownmap-logo-resources.md`](docs/knownmap-logo-resources.md)：Logo 含义、形态、颜色和使用场景；
- `src/assets/knownmap-logo.svg`：唯一 Logo 源文件；
- `src/assets/knownmap/knownmap-circle.svg`：圆形深绿底变体；
- `src/assets/knownmap/knownmap-square.svg`：方形深绿底变体；
- `src/assets/knownmap/knownmap-transparent.svg`：透明背景变体，边缘使用品牌深绿色；
- `src/assets/icon-16.png`、`icon-24.png`、`icon-48.png`、`icon-128.png`：扩展资源；
- `teacher-web/assets/knownmap-icon.png`：网页导出资源。

解释冲突时按：当前阶段需求 -> v0.2 产品规格 -> 当前数据/API 规范 -> 架构 -> 计划。第一阶段原型、推广视频和远期平台文档不得覆盖当前范围。

## 核心边界

- 学生宿主只使用 B 站原页面加 PC Chrome 插件；跨源网页无法稳定控制 B 站播放器。
- 教师工作台通过版本化 `window.postMessage` 与白名单 content script 通信，再由插件后台严格校验和存储。
- 完整字幕只留在教师浏览器，不发送给插件；插件只接收运行所需课程配置。
- 更换课程 URL 时必须提醒；确认后清除旧课程，取消则完整保留。
- 第一阶段允许礼宾式协助，不以自动抓字幕、自助安装或应用商店发布为完成条件。
