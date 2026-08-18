# KnownMap 当前下一步

更新时间：2026-08-18

当前阶段：教师平台本地发布与插件授权下载闭环

当前状态：节点 1 已完成，准备执行节点 2：预建教师账号和登录

## 当前唯一目标

完成开发节点 2：预建教师测试账号、登录、退出和会话恢复。

计划入口：`doc/teacher-platform-dev-plan.md`

## 当前步骤

- [x] 建立 `backend/` Python 项目和锁定依赖
- [x] 建立环境变量配置和 `.env.example`
- [x] 先写运行日志、操作日志和健康检查测试
- [x] 建立 SQLite 连接、操作日志表、Alembic 迁移入口和测试数据库 fixture
- [x] 建立 FastAPI 应用、`/health` 和 `/docs`
- [x] 建立 request ID 中间件和分级 structlog 日志
- [x] 验证开发/测试与正常运行环境的日志级别差异
- [x] 更新架构/API/数据文档中的实际启动命令和日志字段
- [x] 运行后端测试和现有 Node 回归测试

## 节点 1 验证结果

- 后端测试：3 passed；
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

## 节点 2 完成门禁

- seed 命令可以幂等创建测试教师账号；
- 密码只保存为慢哈希；
- 登录、退出和会话恢复测试通过；
- 未登录访问受保护端点被拒绝；
- 操作日志记录登录成功、登录失败和退出；
- 日志不包含密码、token 或密码哈希。
