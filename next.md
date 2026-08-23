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
| 4 学生插件课程库与本机状态 | 代码完成，待真实 Chrome 验收 |
| 5 B 站运行时与学习状态机 | 代码完成，待真实 B 站验收 |
| 6 安全、运维、发布与切换 | 6A 发布链路、6B 版本闸门、6E 旧入口重定向已完成；6C 环境校验与 6D 备份恢复需生产权限 |
| 7 真实验收与 v1.0.0 | 待人工在 Chrome + B 站执行 |
| 8 观察、责任清零与旧系统退役 | 阶段 7 之后 |

测试：v1 167 项、旧系统 381 项，`npm run check` 全通。

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

## 发布

```bash
KNOWNMAP_PUBLISH_PROFILE=v1-apps tools/web-release.sh build <ref> <输出目录>
```

在归档的精确提交里跑 `npm ci` → `npm test` → 构建，产出：

- `/admin/`、`/teacher/`：两个 v1 应用；
- `/admin.html`、`/teacher-web/editor.html`：旧入口重定向到新地址（6E，不删除）；
- `/downloads/student-plugin/knownmap-v1.zip`：生产目标插件，打包前检查无本机地址；
- 销售页与试用表单原样保留，不随框架迁移改写。

切换前用 `contracts/release-gate.ts` 核对版本支持矩阵，任一组件不符则拒绝切换。

## 下一步：真实 Chrome 验收（阶段 4/5 门禁，只能人工）

1. `chrome://extensions` 开发者模式加载 `v1/extension/dist/local`；
2. 工具栏打开 KnownMap，输入教师端生成的授权码，确认课程出现在列表；
3. 点课节链接进 B 站原页面，确认到点暂停、窗口出现、作答后继续播放；
4. 刷新页面，确认已作答节点不再重复弹；
5. 站内切到另一个视频，确认旧监听和窗口都不残留；
6. 非视频页（首页、空间页）不出现任何 KnownMap UI；
7. 同一 BVID 配到两门课程时出现选择面板，关闭它则不启动任何课程。

阶段 5E 还要留证：seek、全屏、播放器重建、离线、扩展更新。

## 需要生产权限才能做的

- **6C 环境启动校验、密钥/SAST、日志禁入、健康探针**：需要阿里云 ECS；
- **6D 备份保留 30 天与代表性恢复演练**：需要生产数据库；
- **阶段 7 生产切换**：发布链路已就绪，执行需要部署权限。

## 已知问题

- 迁移 `0008_multi_lesson_courses` 在缺少命名约束 `uq_lessons_course_id` 的旧
  本机库上会失败。`D-V1-012` 要求 v1 从干净 schema 初始化，本机遇到这个错误
  应重建数据库，不要改动已冻结的迁移。
- `backend/.env` 的 `CORS_ORIGINS` 需包含 5173、5174，否则 Cookie 会话的跨源
  请求全部失败。该文件被 Git 忽略，换机器需重新配置。
- `v1/web/*/src/index.css` 通过 `@import` 引用 `teacher-web/styles.css`
  （视觉真源，不另抄一份）。发布时该文件已随归档带上；阶段 8 删除旧系统时
  把它移进 `v1/` 并更新这一行路径。
