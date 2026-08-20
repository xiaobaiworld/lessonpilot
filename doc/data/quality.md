# KnownMap 数据质量与治理

更新时间：2026-08-20

状态：当前校验规则、已知漂移和验证入口。

上级入口：[`../data-spec.md`](../data-spec.md)

## 1. Schema 真源

| 数据边界 | 权威来源 | 辅助证据 |
| --- | --- | --- |
| SQLite 表和索引 | `backend/app/models/` + `backend/app/migrations/versions/` | 空库迁移测试、SQLite `.schema` |
| HTTP 请求/响应 | `backend/app/schemas/` + FastAPI 路由 | `/openapi.json`、集成测试 |
| 节点与插件课程 | `src/shared/course-contract.js` | `tests/course-contract.test.js`、后端 schema 测试 |
| v2 多课节课程包 | `src/shared/course-package-contract.js` | `tests/course-package-contract.test.js` |
| 插件本地对象 | `src/background/storage.js`、`course-downloader.js`、`operations.js` | Node 单元测试 |
| 生产发布记录 | `tools/web-release.sh` 和 `deploy/releases/*.json` | 服务器 release 文件、标签、SHA256 |

数据库 model 与 migration 不一致时不能只选一边沉默处理。必须先确认是 migration 漏写、
model 超前，还是本机数据库没有升级。

## 2. 当前校验矩阵

| 数据 | 主要规则 | 执行位置 | 失败结果 |
| --- | --- | --- | --- |
| 登录请求 | 登录名 3-80、密码 1-256 | Pydantic | HTTP 422 |
| 课程 | 标题 1-200、描述最多 2000 | Pydantic + service trim | HTTP 422 或不写库 |
| 课节 | 标题、BVID、递增顺序、教师归属 | Pydantic + service + DB | 404/422 或不写库 |
| 草稿节点 | 封闭字段、合法组合、顺序、唯一 ID、答案引用 | Pydantic | HTTP 422 |
| 发布 | 有课节、有非空草稿、插件 adapter 可构造 | service | `DRAFT_NOT_READY` |
| 授权码 | 固定格式、摘要存在、未过期、课程已发布 | service | 401/404/409 |
| 下载响应 | 仅含 `courses[]`，每门课程通过 v2 契约 | plugin background | 拒绝且不覆盖已保存数据 |
| 学习状态 | 状态、尝试次数、答案类型和长度 | plugin background | 丢弃非法节点状态 |
| 发布记录 | commit、文件清单、SHA256、线上状态 | release script | 发布失败或回滚 |

## 3. 数据质量目标

| 指标 | 当前目标 | 验证 |
| --- | --- | --- |
| 必填字段完整率 | 100% | Pydantic、数据库非空约束 |
| 节点 ID 唯一率 | 100% | 后端和共享契约 |
| 发布版本重复率 | 0 | 联合唯一约束 |
| 无效下载覆盖已保存课程 | 0 次 | 插件原子写入测试 |
| 授权码原文落库/日志 | 0 次 | schema 检查、敏感扫描 |
| 发布记录可追溯率 | 100% | release ID、commit、tag、SHA256 |
| 课程与分层学习状态身份一致 | 100% | 插件读写校验 |

## 4. 已知漂移和风险

### 4.1 本地 SQLite 文件不是 schema 真源

2026-08-20 只读检查发现，Git 忽略的 `backend/knownmap.db`：

- 存在 9 张业务表；
- `alembic_version` 表没有版本行；
- `access_codes` 表缺少 0007 的 `code_type` 和 `expires_at`。

这不改变代码中的目标 schema，但说明该本机数据库当前未可靠登记迁移状态。使用它前必须
先备份并执行 `uv run alembic upgrade head`，不能依赖开发环境的 `create_all()` 修补已有表。
本文件不记录任何表内业务值。

### 4.2 课程身份已统一

数据库、发布包、授权范围和插件统一使用后台 UUID。BVID 只用于页面匹配；同一课程内
重复 BVID 会在发布 schema 和插件契约层被拒绝。

### 4.3 多课程主链路已接通

- 数据库、服务层和教师课程 API 已允许多个有序课节；
- 发布服务聚合课程全部课节，授权码通过 `AccessGrant` 裁剪范围；
- 下载 API 返回 `courses[]`；
- 插件只使用 `studentCourseStore`，运行时和 UI 已接入；
- 内置示例课程首次读取自动加入，授权课程同 BVID 时优先；
- 学生、领取记录、学习事件、复听次数和待复习清单仍不存在。

### 4.4 状态枚举缺少数据库约束

`Teacher.status`、`Course.status`、`Lesson.status`、`OperationLog.result` 和
`AccessCode.code_type` 是字符串列。当前正确值由代码路径保证，直接数据库写入可能产生非法值。
如果未来增加管理脚本、批量导入或多服务写入，应评估数据库 `CHECK` 约束或枚举类型。

### 4.5 学习数据只在本机

`learningState.lastAnswer` 属于敏感学生内容，只存在 Chrome 本地存储。当前没有导出、同步、
保留期限、删除按钮或教师查看路径。跨设备和教师报表不属于当前实现。

### 4.6 生产数据恢复策略不完整

生产 SQLite 与代码发布目录分离，代码回滚不会回滚数据库。当前文档没有已验证的自动备份、
恢复演练和数据库迁移回滚流程。涉及下一次 schema migration 前必须补充数据迁移和恢复计划。

## 5. 自动化验证

```bash
node --test tests/*.test.js

cd backend
uv run pytest --cov=app --cov-report=term-missing
uv run alembic upgrade head
```

补充只读检查：

```bash
sqlite3 backend/knownmap.db ".schema"

cd backend
uv run python -c "from app.main import app; print(len(app.openapi()['paths']))"
```

文档验证：

- 所有相对 Markdown 链接存在；
- `doc/data-spec.md` 能到达所有数据子文档；
- 代码中的存储键、字段名、API 路径和错误码可以在数据文档检索到；
- 当前实现与目标模型分别标记；
- 不在文档中记录真实密码、Cookie、会话 token、授权码原文或生产数据行。

## 6. 变更接入规则

以下变更必须先更新数据文档和测试，再修改实现：

- 新表、列、索引、约束或 migration；
- Pydantic 请求/响应字段；
- `PluginCourseConfig` 或节点 schema；
- Chrome storage key 或对象结构；
- 授权范围、有效期、领取记录或学生学习数据；
- 发布记录 schema；
- 数据保留、删除、导出、备份或恢复策略。

每次变更至少记录当前 schema version、迁移方式、兼容范围、失败回滚和验证命令。

多课程后续变更必须持续验证：

- 同名课程和相同 BVID 不发生身份碰撞；
- 一门课程的多个课节不会丢失或互相覆盖；
- 课节/节点范围授权不能读取范围外内容；
- 旧单课程响应和旧 key 始终被拒绝，不重新引入兼容路径；
- 内置示例课程不能覆盖教师授权课程；
- 日志不出现授权码、节点正文、字幕或学生答案。
