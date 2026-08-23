# KnownMap 当前下一步

更新时间：2026-08-23

## 当前执行切片：v1 重构阶段 3（教师与管理员 Web 应用）

执行计划：`doc/plans/v1-code-refactor-execution-plan.md` 第 6 节

阶段 0–2 的完整执行记录见 `doc/archive/2026-08-23-v1-stage-0-2/next.md`
与 `doc/status/v1-stage-{0,1,2}-completion-2026-08-23.md`。

## 已在真实后端验证的主链路

用本机真实 FastAPI + SQLite 跑通，不是 mock：

```text
新建课程 → 添加课节（粘贴 B 站链接）→ 编辑互动节点 → 保存草稿
  → 发布课程 → 创建授权码 → 学生端凭码下载，节点内容一字不差
```

管理端同样已验证：登录、教师列表（含已发布课程数）、创建教师、重置密码、
一次性密码显示后清空、退出、刷新恢复会话。

代码规模：26 个文件 2164 行（从 42 个文件 3064 行简化而来）。
测试 26 项通过，两个应用生产构建通过。

## 本机启动

```bash
cd backend && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
cd v1/web/admin   && npm run dev   # http://localhost:5173
cd v1/web/teacher && npm run dev   # http://localhost:5174
```

测试账号由 `python -m app.seed [admin|teacher]` 用环境变量创建，密码不入仓库。

## 阶段 3 剩余项

- [ ] 字幕导入与时间轴取景。节点时刻目前手填 `mm:ss`；原系统的 SRT 导入和
      横向时间轴（`teacher-web/visual-node-editor.js`）尚未迁入。
      `v1/web/shared/src/editor/` 已有 `TimelineModel`、`NodeRegistry`、
      `SubtitleParser` 三个纯模块和 9 项测试，等待接入 UI。
- [ ] 3F 旧页面切换。新应用通过真实浏览器对照后，把 `teacher-web/admin.html`
      和 `teacher-web/editor.html` 重定向到 v1；销售页 `forsales.html` 与
      试用表单保持原样，不随框架迁移改写。

## 下一阶段：4（学生插件课程库与本机状态）

前置已就绪：`/api/v1/public/course-download` 已能用真实授权码返回 v2 课程包
（`schemaVersion: 2`、多课节、节点完整）。

## 已知问题

- 迁移 `0008_multi_lesson_courses` 会在缺少命名约束 `uq_lessons_course_id` 的
  旧本机库上失败。`D-V1-012` 要求 v1 从干净 schema 初始化，因此本机遇到这个
  错误应重建数据库，不要改动已冻结的迁移。
- `backend/.env` 的 `CORS_ORIGINS` 需包含 5173、5174，否则 Cookie 会话的跨源
  请求全部失败。该文件被 Git 忽略，换机器需重新配置。

## 遗留门禁（阶段 7 之前必须收口）

- 真实 Chrome 加载解压插件，在 B 站原页面完成一次完整互动；
- 公网闭环：插件下载地址仍固定为本机 `127.0.0.1:8000`
  （`src/shared/api-config.js`），未指向生产 API。
