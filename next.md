# KnownMap 当前下一步

更新时间：2026-08-18

当前阶段：教师平台本地发布与插件授权下载闭环

当前状态：节点 1–6 已完成，准备执行节点 7：现有教师界面接入真实 API

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
- [x] 支持 notice、choice、blank、free_text 四种严格节点 schema
- [x] 保存和读取单课节脚本草稿
- [x] 拒绝未知字段、空文案、重复 ID、错误答案引用和乱序节点
- [x] 记录脚本草稿成功和失败操作日志

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

## 节点 4 验证结果

- 后端全量测试：25 passed；
- Python `compileall`：通过；
- Alembic 空数据库迁移：成功创建 `script_drafts`；
- 草稿保存、替换、读取：HTTP 集成测试通过；
- 其他教师访问：统一返回 404 `RESOURCE_NOT_FOUND`；
- schema：四种节点、严格字段和排序规则测试通过；
- 操作日志：记录草稿保存和读取动作；
- FastAPI TestClient 仍有既有 `httpx` 兼容性弃用警告，不影响测试结果。

## 节点 5 完成门禁

- 草稿可以发布为不可变版本；
- 发布输出符合 `PluginCourseConfig`；
- 无草稿、空节点和越权发布均被拒绝；
- 发布动作写入操作日志。

## 节点 5 验证结果

- 后端全量测试：31 passed；
- Node 插件契约回归：204 passed；
- Python `compileall`：通过；
- Alembic 空数据库迁移：成功创建 `published_scripts`；
- 第一次发布生成版本 1，再次发布生成版本 2；
- 修改草稿后旧发布版本 JSON 保持不变；
- `PluginCourseConfig` 的 `courseId`、`videoRef` 和 UTC 毫秒时间格式测试通过；
- 无草稿、空节点返回 409 `DRAFT_NOT_READY`；
- 其他教师发布返回 404 `RESOURCE_NOT_FOUND`；
- 发布成功和失败动作进入操作日志。

## 节点 6 完成门禁

- 已发布课程可以创建高熵授权码；
- 数据库只保存授权码摘要和提示，不保存原文；
- 插件下载 API 只凭授权码返回最新发布配置；
- 无效码和未发布课程返回稳定错误码；
- 不创建学生账号、领取记录或学习数据。

## 节点 6 验证结果

- 后端全量测试：36 passed；
- Node 插件回归：204 passed；
- Python `compileall`：通过；
- Alembic 空数据库迁移：成功创建 `access_codes`；
- 授权码格式和高熵生成规则测试通过；
- 数据库仅保存 HMAC-SHA256 摘要和末五位提示；
- 有效授权码返回最新 `PluginCourseConfig`，重新发布后无需换码；
- 畸形码和未知码统一返回 401 `INVALID_ACCESS_CODE`；
- 未发布课程返回 409 `COURSE_NOT_PUBLISHED`；
- 创建和下载操作进入日志，日志不包含授权码原文。

## 节点 7 完成门禁

- 教师可在现有工作台登录或恢复会话；
- 可创建/读取课程和唯一课节；
- 可编辑四种节点并保存草稿；
- 可发布课程并创建、复制一次性授权码；
- 页面错误状态、加载状态和未登录状态可用；
- 桌面和移动视口无关键内容重叠或横向溢出。
