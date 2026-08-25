# KnownMap v1

`v1/` 是当前系统，不再是脚手架或候选目录。

| 目录 | 功能 |
| --- | --- |
| `backend/` | 独立 FastAPI + SQLite 后端、Alembic 初始迁移和 pytest |
| `web/admin/` | 管理员登录、教师账号管理 |
| `web/teacher/` | 课程、课节、草稿、预览、发布和授权码 |
| `web/shared/` | Web 公共 HTTP 客户端与 UI |
| `extension/` | 学生课程库、兑换、B 站运行时和本机学习状态 |
| `contracts/` | 课程包、插件消息、本机存储与版本清单 |

后端六模块位于 `backend/app/modules/`：

- `identity`：管理员、教师、会话；
- `workspace_course`：工作空间、课程、课节和视频引用；
- `authoring_release`：草稿、预览、课程级发布和可交付状态；
- `entitlement_delivery`：授权码、授权范围、兑换和更新；
- `admin_support`：教师接入、权利确认和试用跟进；
- `runtime_audit`：健康、版本、日志和操作审计模型。

```bash
cd backend
uv sync --frozen
uv run alembic upgrade head
uv run pytest

cd ..
npm ci
npm test
npm run type-check
npm run build
```

需求与设计真源分别在 `../doc/requirements/v1/` 和 `../doc/design/v1/`。
