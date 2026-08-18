# KnownMap 当前下一步

更新时间：2026-08-18

当前阶段：教师平台本地发布与插件授权下载闭环

当前状态：节点 1–2 已完成，准备执行节点 3：课程、单课节和 B 站视频绑定

## 当前唯一目标

完成开发节点 3：课程、单课节和 B 站视频绑定的持久化 API。

计划入口：`doc/teacher-platform-dev-plan.md`

## 当前步骤

- [x] 建立 `Teacher` 和 `TeacherSession` 数据模型
- [x] 建立 Argon2 密码慢哈希
- [x] 建立幂等测试账号 seed 命令
- [x] 实现登录、退出和会话恢复 API
- [x] 实现 HttpOnly、SameSite 会话 cookie
- [x] 实现受保护端点的教师身份依赖
- [x] 记录登录成功、失败、会话恢复和退出操作日志
- [x] 执行真实 seed、登录、恢复、退出和失效会话验证
- [x] 执行依赖漏洞扫描和 Bandit 静态安全扫描

## 节点 1 验证结果

- 后端测试：4 passed；
- Node 回归：204 passed；
- Python `compileall`：通过；
- Alembic 空数据库迁移：成功创建 `alembic_version` 和 `operation_logs`；
- `GET /health`：HTTP 200；
- `GET /docs`：HTTP 200；
- `X-Request-Id`：已验证；
- 开发/测试日志：DEBUG；
- 正常运行日志配置：INFO + JSON renderer；
- 操作日志：健康检查成功记录已写入 SQLite；
- 警告：FastAPI TestClient 当前环境出现 `httpx` 兼容性弃用警告，不影响本节点通过，后续测试依赖升级时单独处理。

## 节点 2 验证结果

- 后端全量测试：10 passed；
- Node 回归：204 passed；
- Python `compileall`：通过；
- Alembic 空数据库迁移：成功创建 `teachers` 和 `teacher_sessions`；
- seed：成功创建测试教师，密码只保存 Argon2 哈希；
- 登录：HTTP 200，并设置 `knownmap_session` HttpOnly cookie；
- `/api/v1/auth/me`：登录后 HTTP 200；
- 退出：HTTP 200，退出后 `/me` 返回 401；
- 操作日志：记录登录成功、会话恢复和退出；
- `pip-audit`：无已知漏洞；
- Bandit：无发现；
- pytest：从存在 `PYSEC-2026-1845` 的 8.4.2 升级到 9.1.1。

## 验证命令

```bash
cd backend
uv sync
uv run pytest tests/integration/test_health.py -q
uv run uvicorn app.main:app --port 8000
```

```bash
node --test tests/*.test.js
```

## 节点 3 完成门禁

- 登录教师可以创建课程；
- 课程自动归属当前教师工作空间；
- 每门课程当前只能创建一个课节；
- 课节必须绑定合法 BVID；
- 其他教师不能访问不属于自己的课程；
- 课程和课节可以从 SQLite 重新读取；
- 创建、读取和失败操作进入操作日志。
