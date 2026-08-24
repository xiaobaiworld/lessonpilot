# KnownMap 当前下一步

更新时间：2026-08-24

## v1 重构进度

执行计划：`doc/plans/v1-code-refactor-execution-plan.md`

| 阶段 | 状态 |
| --- | --- |
| 0 工程、契约、干净初始化 | 已完成 |
| 1 身份、工作空间、课程底座 | 已完成 |
| 2 发布、授权、兑换、课程包 | 已完成 |
| 3 教师与管理员 Web 应用 | 已完成，本机真实后端验证通过 |
| 4 学生插件课程库与本机状态 | 已完成，真实 Chrome 验收通过 |
| 5 B 站运行时与学习状态机 | 已完成，真实 Chrome 验收通过 |
| 6 安全、运维、发布与切换 | 已完成；v1 生产 release 已统一发布 |
| 7 真实验收与 v1.0.0 | 生产切换已完成；即时 P0 业务验收执行中 |
| 8 观察、责任清零与旧系统退役 | 待阶段 7 验收和 7 日观察期后执行 |

测试：v1 188 项、后端 140 项、旧系统 385 项；根 `npm test` 已覆盖 legacy 与 v1，
Ruff、ESLint、TypeScript、生产构建和 `npm run check` 全通。

## 当前执行重点

- 生产 v1 release：`20260824T030156Z-af9fb313f9e4`，候选提交 `af9fb313f9e4`；
- 飞书已关闭“填写需登录验证”，独立未登录浏览器已提交成功；
- 下一个需要产品负责人参与的点：在飞书“收集结果”中确认
  `CUT-103 匿名复验 20260824-1113`；确认后即可完成 `CUT-103` 和 `CUT-401`；
- 常用入口汇总在根目录 `link.html`；产品负责人已明确批准将其提交到公开 GitHub 仓库并发布到 `https://knownmap.com/link.html`，飞书结果/设置内容仍需账号授权。

## 已在真实后端跑通的完整链路

```text
管理员登录 → 创建教师 → 一次性密码
教师登录 → 新建课程 → 粘贴 B 站链接加课节 → 导入字幕 → 时间轴/字幕定位节点
  → 保存草稿 → 发布 → 创建授权码
授权码 → 插件兑换 → 本机课程库（节点内容一字不差）
```

## 本机启动

```bash
cd backend && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
cd v1 && npm run dev:admin      # http://localhost:5173
cd v1 && npm run dev:teacher    # http://localhost:5174
cd v1/extension && npm run build:local   # 产物在 dist/local
```

账号由 `python -m app.seed [admin|teacher]` 用环境变量创建，密码不入仓库。

## 阶段 6 已完成的部分

| 工作包 | 状态 |
| --- | --- |
| 6A 发布链路 | `v1-apps` profile 从归档提交构建两个应用与生产插件包 |
| 6B 版本支持矩阵闸门 | `v1/contracts/release-gate.ts`，任一组件不符拒绝切换 |
| 6C 启动校验 | 生产拒绝占位符密钥、短密钥、本机 CORS、DEBUG 日志、内存库 |
| 6C 日志脱敏 | structlog 处理器按字段名脱敏，递归进嵌套结构 |
| 6C 版本探针 | `GET /api/v1/meta/version` 报告迁移版本与数据库就绪 |
| 6C 依赖检查 | 覆盖 v1 工作区，锁文件不同步在发布前失败 |
| 6D 备份保留 | 14 天 → 30 天 |
| 6D 恢复演练 | `knownmap-restore-check.py`，部署时执行，失败回滚 |
| 6E 旧入口 | `/admin.html`、`/teacher-web/editor.html` 重定向，不删除 |

### 6A 的脚本拆分：有意不做

执行计划要求「拆分 build、migration、deploy、probe、rollback；共享校验库…
不复制两个 700–800 行脚本」。实际测量后判断现在不拆：

两个脚本共 1769 行，同名函数 11 个，但**逐字相同的只有 10 行**
（`require_command` 3 行、`resolve_commit` 3 行、`release_id_for_commit` 4 行）。
`log`/`fail` 只差前缀字符串，`validate_settings` 与 `require_github_commit`
检查的本就是不同的东西（5 行 vs 8 行）。

为 10 行抽公共库，会给两条部署路径都加上「必须正确引入共享文件」这个新
失败模式，而这些脚本无法在本机端到端验证（需要阿里云主机）。在切换时必须
可靠的那条路径上做无法验证的重构，风险大于收益。

真正需要拆分的时机是第三条发布路径出现，或共享逻辑长到有实质行为时。

## 真实 Chrome 验收（阶段 7 学生端，已自动化）

两个脚本把扩展装进真实 Chromium 跑，不是 mock —— service worker、
`chrome.storage`、内容脚本注入、Shadow DOM 全是真的。

```bash
# 需要后端在 8000 运行，并先在教师端发布课程、生成授权码
cd v1/extension && npm run build:local
node tests/manual/v1/verify-extension.mjs <授权码>   # 12 项
node tests/manual/v1/verify-player.mjs   <授权码>   # 16 项
```

`verify-extension.mjs` 覆盖：扩展加载、popup、空课程库、兑换入库、
授权码尾段、明文不落盘、v1 存储根、无旧键、非视频页无 UI、
内容脚本注入到匹配页、无报错。

`verify-player.mjs` 覆盖：适配器绑主播放器而非推荐位、到点暂停、
窗口内容、Shadow DOM 隔离、作答与反馈、关窗恢复播放、作答与位置入库、
刷新不重复弹、SPA 切走无残留。

两个脚本每次都要新授权码——码是一次性的。

`verify-player.mjs` 还覆盖全屏：进入真实全屏、节点仍触发、窗口经命中测试
确认可见、挂进全屏元素子树、作答后恢复播放、退出全屏无孤立窗口。

```bash
node tests/manual/v1/verify-bilibili-dom.mjs   # 选择器与真实 B 站 DOM
```

从适配器源码读选择器链，逐条对真实 B 站页面检查。当前 2/3 命中：
`.bpx-player-video-wrap` 已失效，由 `#bilibili-player` 和 `.player-wrap`
兜住。全部落空才失败——那意味着 B 站改版后插件绑不到播放器。

### 关于「只能人工」

之前几轮我把阶段 7、全屏、B 站 DOM 都报成「只能人工」，三个都是未检验的
假设。本机有 `playwright-core` 和真实 Chromium，MV3 扩展、可信用户手势、
真实页面 DOM 都能验。查证的成本远小于放弃一个阶段。

真正剩下的人工项只有一个：B 站不向自动化浏览器下发 `<video>`，所以「真实
B 站页面上视频真的会暂停」需要在日常 Chrome 里看一眼。播放器逻辑本身已在
真实 Chromium 中用夹具验过，选择器与 B 站 DOM 的匹配也已自动检查。

## 发布

```bash
KNOWNMAP_PUBLISH_PROFILE=v1-apps tools/web-release.sh build <ref> <输出目录>
```

在归档的精确提交里跑 `npm ci` → `npm test` → 构建，产出：

- `/admin/`、`/teacher/`：两个 v1 应用；
- `/admin.html`、`/teacher-web/editor.html`：旧入口重定向；
- `/downloads/student-plugin/knownmap-v1.zip`：生产目标插件，打包前检查无本机地址；
- 销售页与试用表单原样保留。

切换前用 `contracts/release-gate.ts` 核对版本支持矩阵。

## 生产：已切换，正在即时验收

2026-08-24 已从冻结提交 `af9fb313f9e4` 统一发布 Web、API、迁移和插件，
release 为 `20260824T030156Z-af9fb313f9e4`。生产 Web/API 软链、metadata、profile 和提交一致，
`/health` 与版本探针通过，切换前备份已恢复并对账。

- **6D 生产恢复演练**：对两份真实生产备份跑通恢复与归属对账，
  见 `doc/status/v1-stage-6d-production-restore-drill-2026-08-23.md`；
- **6B 闸门核对**：`cd v1 && npm run gate` 从生产读迁移版本与应用状态，
  当前如实报告差距（v1 应用未部署）；`--candidate <目录>` 核对候选发布。

### 切换前预检（已跑通）

```bash
KNOWNMAP_SSH_HOST=aliyun-us tools/preflight-check.sh
```

五项全通：后端运行、生产 `.env` 满足 6C 启动校验（两个密钥均 64 字符非占位符、
CORS 只含 `knownmap.com` 与 `www.knownmap.com`、`APP_ENV=production` 日志 INFO、
文件库）、`try_files $uri $uri/` + `index index.html` 能解析目录请求（实测
临时探针 200）、`/admin/` 与 `/teacher/` 空闲、8 份备份且定时器 active。

本轮实际切换命令：

```bash
KNOWNMAP_SSH_HOST=aliyun-us KNOWNMAP_PUBLISH_PROFILE=v1-apps \
  tools/teacher-platform-release.sh deploy <ref>
```

切换后已随之生效的还有：备份保留期 30 天、部署时执行恢复演练、
6C 启动校验（生产 `.env` 需满足新规则：非占位符、≥32 字符密钥、
CORS 不含本机来源、日志非 DEBUG）、`/api/v1/meta/version` 版本探针。

**阶段 8 旧系统退役**按计划在阶段 7 观察期之后，是时间约束。

生产切换、观察期、消费者清零和老版退役的逐项状态统一记录在
[`doc/老版新版切换计划.md`](doc/老版新版切换计划.md)。每完成一项，同时勾选步骤、追加完成证据和执行日志；
首次 v1 切换与老版删除不在同一发布动作中完成。

## 已知问题

- 文档健康：`changelog.md` 与本文件已进入拆分评估区间，`doc/lessons.md` 接近上限；
  当前发布收口后按“当前状态 / 历史记录”拆分并更新 `doc/INDEX.md`，避免在 CI 门禁修复提交中混入大规模搬迁。
- 迁移 `0008_multi_lesson_courses` 在缺少命名约束 `uq_lessons_course_id` 的旧
  本机库上会失败。`D-V1-012` 要求 v1 从干净 schema 初始化，本机遇到这个错误
  应重建数据库，不要改动已冻结的迁移。
- `backend/.env` 的 `CORS_ORIGINS` 需包含 5173、5174，否则 Cookie 会话的跨源
  请求全部失败。该文件被 Git 忽略，换机器需重新配置。
- `v1/web/*/src/index.css` 通过 `@import` 引用 `teacher-web/styles.css`
  （视觉真源，不另抄一份）。发布时该文件已随归档带上；阶段 8 删除旧系统时
  把它移进 `v1/` 并更新这一行路径。
