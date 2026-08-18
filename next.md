# KnownMap 当前下一步

更新时间：2026-08-18

当前阶段：教师平台本地发布与插件授权下载闭环

当前状态：节点 1–3 已完成，准备执行节点 4：四种节点脚本草稿

## 当前唯一目标

完成开发节点 4：四种节点脚本 schema、草稿保存、校验和读取。

计划入口：`doc/teacher-platform-dev-plan.md`

## 当前步骤

- [x] 建立 `Workspace`、`Course` 和 `Lesson` 数据模型
- [x] seed 后为教师创建唯一工作空间
- [x] 实现课程创建、列表和详情 API
- [x] 实现单课节创建和详情 API
- [x] 校验 B 站平台和 BVID
- [x] 从服务层和数据库层限制每门课程一个课节
- [x] 校验教师对课程和课节的资源归属
- [x] 记录课程和课节创建、读取和失败操作日志
- [x] 执行真实 HTTP、SQLite 和迁移验证

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

## 节点 3 验证结果

- 后端全量测试：16 passed；
- Node 回归：204 passed；
- Python `compileall`：通过；
- Alembic：成功创建 `workspaces`、`courses` 和 `lessons`；
- seed：教师初始化后立即拥有唯一工作空间；
- 创建课程：HTTP 201；
- 创建唯一课节：HTTP 201；
- 非法 BVID：HTTP 422；
- 第二个课节：HTTP 409 `LESSON_LIMIT_REACHED`；
- 其他教师访问：HTTP 404 `RESOURCE_NOT_FOUND`；
- SQLite：课程、课节、平台和 BVID 持久化一致；
- 操作日志：记录课程/课节创建和读取；
- `pip-audit`：无已知漏洞；
- Bandit：无发现。

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

## 节点 4 完成门禁

- 四种节点都能通过后端 schema；
- 未知节点组合、未知字段、空文案、重复 ID 和错误答案引用被拒绝；
- 草稿保存后可以读取；
- 草稿保存不产生已发布版本；
- 课节不属于当前教师时返回 `RESOURCE_NOT_FOUND`；
- 草稿操作进入操作日志；
- 后端校验与现有共享插件契约保持一致。
