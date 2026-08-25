# KnownMap

KnownMap 把老师已有的 B 站录播课变成在原视频页面运行的互动课程。老师导入视频
和字幕、配置节点、发布并发出授权码；学生在 PC Chrome 安装插件后，于 B 站页面
到点暂停、作答、看反馈并继续播放。

## 当前系统

自 2026-08-24 起，仓库只继续开发、测试和发布 V1：

| 部分 | 当前真源 |
| --- | --- |
| FastAPI 与 SQLite | `backend/` |
| 管理员应用 | `v1/web/admin/` |
| 教师应用 | `v1/web/teacher/` |
| 学生 Chrome 插件 | `v1/extension/` |
| 销售页与学生说明 | `v1/public-site/` |
| 跨端契约 | `v1/contracts/` |

根目录 `backend/` 虽然沿用历史路径，但承载的是当前生产 V1 API，不属于旧系统。
旧教师页面、旧插件和只服务旧实现的测试/工具已集中归档到
[`archive/legacy-v0.9.1/`](archive/legacy-v0.9.1/)，不再参与默认运行、测试或发布。
归档任务与回退说明见
[`doc/plans/legacy-system-archive-task.md`](doc/plans/legacy-system-archive-task.md)。

## 入口

| 想知道 | 读 |
| --- | --- |
| 系统整体 | [`doc/SYSTEM-OVERVIEW.md`](doc/SYSTEM-OVERVIEW.md) |
| 当前下一步 | [`next.md`](next.md) |
| 文档分类与权威顺序 | [`doc/INDEX.md`](doc/INDEX.md) |
| 当前 V1 目录与命令 | [本页“本地运行”](#本地运行) |
| 开发规则 | [`doc/dev-rules.md`](doc/dev-rules.md) |
| 已踩问题 | [`doc/lessons.md`](doc/lessons.md) |
| 需求与设计 | [`doc/requirements/v1/`](doc/requirements/v1/) / [`doc/design/v1/`](doc/design/v1/) |
| 常用网页链接 | [`link.html`](link.html) |

品牌资源说明见
[`docs/knownmap-logo-resources.md`](docs/knownmap-logo-resources.md)。

## 本地运行

```bash
# 后端
cd backend
uv sync
cp .env.example .env
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000

# 管理员与教师应用
cd ../v1
npm ci
npm run dev:admin       # http://localhost:5173
npm run dev:teacher     # http://localhost:5174

# 学生插件
npm run build:local --workspace @v1/extension
# chrome://extensions/ 加载 v1/extension/dist/local
```

`backend/.env` 的 `CORS_ORIGINS` 需包含本机 5173 与 5174。账号由
`python -m app.seed [admin|teacher]` 通过环境变量创建，密码不写入仓库。

静态销售页可从仓库根目录启动：

```bash
python3 -m http.server 4173
# http://localhost:4173/v1/public-site/
```

## 验证

```bash
npm ci
npm test
npm run check

cd backend
uv sync
uv run pytest
uv run ruff check .
uv run ruff format --check .

cd ../v1
npm run lint
npm run type-check
npm run build
npm run build:production --workspace @v1/extension
```

根 `npm test` 覆盖当前仓库检查与全部 V1 Vitest，不再执行归档测试。

## 发布与回退

生产统一使用 `v1-apps`，从已经推送且 CI 通过的精确提交构建：

```bash
KNOWNMAP_SSH_HOST=aliyun-us KNOWNMAP_PUBLISH_PROFILE=v1-apps \
  tools/teacher-platform-release.sh deploy <git-ref>
```

查询和回滚：

```bash
tools/teacher-platform-release.sh status
tools/web-release.sh list
tools/web-release.sh verify <release-id>
tools/web-release.sh rollback <release-id>
```

旧 URL `/admin.html` 与 `/teacher-web/editor.html` 保留为 V1 重定向；
`/teacher-web/forsales.html`、`/teacher-web/student-guide.html` 和
`knownmapplugin.zip` 保留为当前 V1 内容的兼容路径/文件名，不代表旧系统仍在运行。
