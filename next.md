# KnownMap 当前下一步

更新时间：2026-08-23

## v1 重构进度

执行计划：`doc/plans/v1-code-refactor-execution-plan.md`

| 阶段 | 状态 |
| --- | --- |
| 0 工程、契约、干净初始化 | 已完成 |
| 1 身份、工作空间、课程底座 | 已完成 |
| 2 发布、授权、兑换、课程包 | 已完成 |
| 3 教师与管理员 Web 应用 | 已完成，本机真实后端验证通过 |
| 4 学生插件课程库与本机状态 | 逻辑与打包完成，待真实 Chrome 验收 |
| 5 B 站运行时与学习状态机 | 纯状态机与宿主适配完成，待真实 B 站验收 |
| 6 安全、运维、发布与切换 | 未开始 |
| 7 真实验收与 v1.0.0 | 未开始 |
| 8 观察、责任清零与旧系统退役 | 未开始 |

测试 137 项通过（`cd v1 && npm test`）。

## 已在真实后端跑通的链路

```text
管理员登录 → 创建教师 → 一次性密码
教师登录 → 新建课程 → 添加课节（粘贴 B 站链接）→ 导入字幕定位节点
  → 保存草稿 → 发布 → 创建授权码
授权码 → 插件兑换 → 本机课程库（节点内容一字不差）
```

最后一步用 `redeemAccessCode` 对真实后端验证过，装入的课程节点与教师配置一致。

## 本机启动

```bash
cd backend && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
cd v1 && npm run dev:admin      # http://localhost:5173
cd v1 && npm run dev:teacher    # http://localhost:5174
cd v1/extension && npm run build:local   # 产物在 dist/local
```

账号由 `python -m app.seed [admin|teacher]` 用环境变量创建，密码不入仓库。

## 下一步：在真实 Chrome 里验收插件

这是阶段 4 与 5 的门禁，只能人工做：

1. `chrome://extensions` 开发者模式加载 `v1/extension/dist/local`；
2. 工具栏打开 KnownMap，输入教师端生成的授权码，确认课程出现在列表；
3. 点课节链接进 B 站原页面，确认到点暂停、窗口出现、作答后继续播放；
4. 刷新页面，确认已作答节点不再重复弹；
5. 站内切到另一个视频，确认旧监听和窗口都不残留；
6. 非视频页（首页、空间页）不出现任何 KnownMap UI。

需要留证的边界（阶段 5E 门禁）：seek、全屏、播放器重建、离线、扩展更新。

## 阶段 4/5 未迁入的部分

- **多候选选择界面。** 同一 BVID 命中多个课节时，`findCandidates` 返回全部
  候选，但 content script 目前取第一个并打日志。`D-V1-010` 要求让学生显式
  选择，选择界面待补。
- **横向时间轴。** 教师端节点定位现在靠字幕列表和手填 `mm:ss`；
  `v1/web/shared/src/editor/TimelineModel.ts` 已就位待接 UI。

## 阶段 6 的已知工作

- `tools/web-release.sh` 从 git archive 复制已跟踪文件，而 v1 是 Vite 构建
  产物，发布路径需要改造后才能切换旧入口；
- 固定 ZIP 需按 `BUILD_ARTIFACTS` 清单生成，并保证同一提交可重复构建、
  摘要一致。

## 已知问题

- 迁移 `0008_multi_lesson_courses` 在缺少命名约束 `uq_lessons_course_id` 的旧
  本机库上会失败。`D-V1-012` 要求 v1 从干净 schema 初始化，本机遇到这个错误
  应重建数据库，不要改动已冻结的迁移。
- `backend/.env` 的 `CORS_ORIGINS` 需包含 5173、5174，否则 Cookie 会话的跨源
  请求全部失败。该文件被 Git 忽略，换机器需重新配置。
