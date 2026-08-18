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
- 公网部署作为后续阶段，不在当前实现范围。

问答题只保存学生原始回答，并展示老师预设的参考反馈；第一阶段不评分、不调用 AI。

## 当前状态

技术 spike 已证明插件可以在指定 B 站页面定位播放器、监听时间、暂停、seek 和卸载注入 UI，但完整产品闭环尚未实现。

当前开发阶段是 **教师平台本地发布与插件授权下载闭环**。后端尚未开始编码，需求、架构、数据/API 说明和开发节点已经写入当前文档。

从 [`next.md`](next.md) 开始，完整计划见 [`doc/teacher-platform-dev-plan.md`](doc/teacher-platform-dev-plan.md)。第一阶段计划已归档，不再是当前排期。

## 目标页面

| 路径 | 第一阶段职责 | 当前实现状态 |
| --- | --- | --- |
| `/teacher-web/` | 历史销售页和教师工作台原型 | 当前界面基础，后续接入本地 API |
| `/teacher-web/workspace.html` | 历史 1A 连接诊断页 | 保留作协议诊断参考 |
| `/teacher-web/forsales.html` | 历史公网销售页 | 第一阶段已完成，当前不作为主开发入口 |
| `/teacher-web/editor.html` | 旧原型 | 停止扩展，不发布公网 |

第一阶段默认部署目标是 GitHub Pages。Pages 已于 2026-08-15 启用（source 为 GitHub Actions），`pages` 工作流已在 2026-08-16 成功发布，公网路径实测可访问：

- [销售页](https://xiaobaiworld.github.io/lessonpilot/teacher-web/forsales.html)
- [1A 连接诊断页](https://xiaobaiworld.github.io/lessonpilot/teacher-web/workspace.html)

公网只发布这两个页面、它们加载的脚本和两个共享契约文件，`doc/` 与插件运行时代码不上公网，发布集在 `.github/workflows/pages.yml` 中以白名单方式列举（见 D-010）。实测 `/doc/` 与 `/src/` 均返回 404。站点根目录也返回 404，因为发布集不含首页文件；1B 迁移销售首页时一并处理。

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

当前教师页面仍然是原型界面，后续节点会接入本地 API。

预建本地测试教师账号：

```bash
cd /Users/bai/code/lessonpilot/backend
SEED_TEACHER_LOGIN_NAME=teacher-test-01 \
SEED_TEACHER_PASSWORD='replace-with-a-local-test-password' \
SEED_TEACHER_DISPLAY_NAME='测试教师' \
uv run python -m app.seed
```

测试密码只通过本地环境变量传入，不写入代码或日志。

启动现有静态教师页面：

```bash
cd /Users/bai/code/lessonpilot
python3 -m http.server 4173
```

当前页面可以从 [http://localhost:4173/teacher-web/](http://localhost:4173/teacher-web/) 访问。不要把 `teacher-web/` 作为独立 server root，也不要另开第二个端口；资源和测试夹具均按仓库根目录解析。端口 4173 写入了插件来源白名单，换端口会使消息桥拒绝该页面。

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
