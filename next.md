# KnownMap 当前下一步

更新时间：2026-08-18

当前阶段：教师平台本地发布与插件授权下载闭环

当前状态：节点 1–7、教师应用体验校正和品牌组合标识修正已完成；下一步执行节点 8

## 当前唯一目标

让插件可以使用授权码下载并保存最新课程配置，并在指定 B 站原页面运行四种课程节点。

计划入口：`doc/teacher-platform-dev-plan.md`
已完成体验计划：`doc/plans/teacher-platform-experience-polish.md`

## 当前步骤

- [x] 读取全局规范、项目规则、历史决策和当前页面代码
- [x] 确认 KnownMap 保持长期品牌，教师应用命名为“KnownMap 互动课程工具”
- [x] 建立 D-017、体验校正设计和实施计划
- [x] P1 先写页面契约和密码安全失败测试
- [x] P2 修正登录页、全局外壳和密码显示或隐藏
- [x] P3 重整“我的课程”和课程设计工作面
- [x] P4 运行全量测试、浏览器验收、安全检查和文档收口

## 教师应用体验校正验证结果

- 产品名称：KnownMap 互动课程工具；
- 品牌组合标识：Logo 内部几何缩小至 82%，页眉 K/M 分别使用暖金和陶土节点色；
- 登录密码：源码无默认值，可显示或隐藏，登录成功和退出后清空；
- 工作台：移除原型、W0、开发账号、本地 API 和未来能力说明；
- 新课程：课程与课节为空表单，固定视频能力边界明确；
- 字幕：未导入时不伪造示例字幕；导入后节点重绑进入草稿 payload；
- 时间轴：固定视频完整 3:42，无字幕时保留已有节点；支持键盘放置；
- 发布：请求期间锁定保存、节点组件和时间轴；
- 会话隔离：退出后课程、字幕、发布版本、授权码和路由状态清空；
- 自动化：Node 234 pass，后端 37 pass；
- 安全：Bandit 无发现，`pip-audit` 无已知漏洞；
- 浏览器：1440、900、375 三档无页面级横向溢出、console error 或 page error；
- 验收记录：`tests/manual/teacher-platform-experience-polish/README.md`。

## 节点 7 修正当前步骤

- [x] 确认销售页视觉参照和点击/拖放双入口
- [x] 写入需求、决策、设计和实施计划
- [x] V7.1 先写节点组件注册表失败测试
- [x] V7.2 写纯时间轴模型失败测试
- [x] V7.3 替换教师编辑器页面骨架
- [x] V7.4 实现点击放置
- [x] V7.5 实现拖放创建和节点移动
- [x] V7.6 实现类型化弹窗、删除和字幕同步
- [x] V7.7 接回草稿、发布和授权码
- [x] V7.8 完成日志、可访问性和响应式收口
- [x] V7.9 完成浏览器和全量回归
- [x] V7.10 同步文档并转入节点 8

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

## 节点 7 验证结果

- 后端全量测试：37 passed；
- 后端总覆盖率：87%；
- Node 全量回归：229 passed；
- 页面 API 客户端测试：3 passed；
- Python `compileall` 和 Node 脚本语法检查：通过；
- CORS：`http://127.0.0.1:4173` 携带 cookie 的预检通过；
- Playwright 本地验收：点击和拖放创建、编辑、移动、删除、保存刷新、发布和授权码创建均成功；
- 同一字幕附近的多个节点可分别显示和操作；
- 桌面页面无横向溢出；375px 页面宽度保持 375px，时间轴只在局部容器滚动；
- 375px 弹窗宽 337px，完整位于视口内；
- 浏览器控制台：新页面会话无 error、warning 和页面脚本异常；
- 验收记录：`tests/manual/teacher-visual-node-editor/README.md`；
- 已知测试环境警告：SQLite 测试连接存在既有 ResourceWarning，Starlette TestClient 存在既有弃用警告，不影响本节点通过。

## 节点 8 完成门禁

- 插件可以输入授权码并调用下载 API；
- 插件保存下载后的 `PluginCourseConfig`；
- B 站原页面按课程节点触发暂停和学习窗口；
- 下载失败、配置校验失败和课程不匹配均有稳定处理。
