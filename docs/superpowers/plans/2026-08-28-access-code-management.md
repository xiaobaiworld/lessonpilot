# 授权码创建与管理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有教师授权码页面上实现多课程/课节范围、批量创建、接收人记录、逐条与批量冻结/恢复/作废，并保持授权记录可追溯且不物理删除。

**Architecture:** 复用 `AccessCodesPage` 和顶级 `/api/v1/teacher/access-codes` 路径。授权与交付应用服务拥有授权码状态、范围、幂等和批量事务；运行与审计应用服务拥有操作审计；学生兑换和更新接口保持原路径并继续读取授权状态。前端在单课程入口中默认选中当前课程，使用现有课程摘要加载教师自己的已发布课程。

**Tech Stack:** React + TypeScript + Vitest + happy-dom；FastAPI + Pydantic + SQLAlchemy + Alembic + pytest；SQLite；仓库现有文档检查和构建命令。

---

### Task 1: 扩展授权码数据结构与创建 DTO

**Files:**
- Create: `v1/backend/alembic/versions/20260828_access_code_management.py`
- Modify: `v1/backend/app/modules/entitlement_delivery/models.py`
- Modify: `v1/backend/app/modules/entitlement_delivery/schemas.py`
- Test: `v1/backend/tests/test_migration.py`
- Test: `v1/backend/tests/test_entitlement_delivery_api.py`

- [ ] **Step 1: 写迁移和 DTO 的失败测试**

在 `test_entitlement_delivery_api.py` 增加以下行为断言：

```python
def test_access_code_creation_persists_teacher_recipient_record(client):
    response = client.post(
        "/api/v1/teacher/access-codes",
        json={
            "idempotency_key": "recipient-0001",
            "grants": [{"course_id": course_id, "scope": "course"}],
            "recipient_label": "春季班",
            "recipient_note": "已通过微信发送",
        },
    )
    assert response.status_code == 201
    assert response.json()["recipient_label"] == "春季班"
    assert response.json()["recipient_note"] == "已通过微信发送"
```

在 `test_migration.py` 的表/列检查中加入 `recipient_label` 和 `recipient_note` 的存在断言。

- [ ] **Step 2: 运行失败测试**

运行：

```bash
cd v1/backend
uv run pytest tests/test_entitlement_delivery_api.py -k recipient -v
uv run pytest tests/test_migration.py -v
```

预期：新增行为因响应没有接收人字段而失败，迁移列断言因列不存在而失败。

- [ ] **Step 3: 增加最小数据结构**

在 `AccessCode` 增加可空的 `recipient_label` 和 `recipient_note` 字段；不保存授权码明文。创建 `20260828_access_code_management.py`，从当前迁移 head 开始，为 `v1_access_codes` 增加这两列，不删除或重写已有记录。

在 `GrantWrite`/`AccessCodeWrite` 中增加长度受限、可空的接收人和备注字段；`AccessCodeBatchWrite` 继承同一字段。保持 `extra="forbid"`、现有 `grants`、时间字段和 `count` 范围。

- [ ] **Step 4: 运行测试并检查迁移**

运行：

```bash
cd v1/backend
uv run pytest tests/test_migration.py tests/test_entitlement_delivery_api.py -k "recipient or migration" -v
uv run ruff check app/modules/entitlement_delivery alembic/versions/20260828_access_code_management.py tests/test_migration.py tests/test_entitlement_delivery_api.py
```

预期：迁移和创建响应测试通过，未出现秘密字段或明文码断言回归。

- [ ] **Step 5: 提交**

```bash
git add v1/backend/alembic/versions/20260828_access_code_management.py \
  v1/backend/app/modules/entitlement_delivery/models.py \
  v1/backend/app/modules/entitlement_delivery/schemas.py \
  v1/backend/tests/test_migration.py \
  v1/backend/tests/test_entitlement_delivery_api.py
git commit -m "feat: 增加授权码教师记录字段"
```

### Task 2: 实现创建范围、接收人更新和状态服务

**Files:**
- Modify: `v1/backend/app/modules/entitlement_delivery/application_service.py`
- Modify: `v1/backend/app/modules/entitlement_delivery/routes.py`
- Create: `v1/backend/app/modules/runtime_audit/application_service.py`
- Test: `v1/backend/tests/test_entitlement_delivery_api.py`

- [ ] **Step 1: 写状态、批量和权限失败测试**

覆盖以下用例：

```python
def test_freeze_restore_and_terminate_keep_access_code_record(client):
    frozen = client.post(f"/api/v1/teacher/access-codes/{code_id}/freeze")
    assert frozen.status_code == 200
    assert frozen.json()["status"] == "frozen"

    restored = client.post(f"/api/v1/teacher/access-codes/{code_id}/restore")
    assert restored.status_code == 200
    assert restored.json()["status"] == "active"

    terminated = client.post(f"/api/v1/teacher/access-codes/{code_id}/terminate")
    assert terminated.status_code == 200
    assert terminated.json()["status"] == "terminated"

    impossible = client.post(f"/api/v1/teacher/access-codes/{code_id}/restore")
    assert impossible.status_code == 422
    assert client.get(f"/api/v1/teacher/access-codes/{code_id}").json()["id"] == code_id
```

另外覆盖：冻结码和作废码不能学生首次领取或更新；冻结可恢复；作废不可恢复；批量冻结/恢复/作废只执行适用状态；批量目标包含其它教师记录时整体拒绝；批量中任一写入失败时无部分状态变化；重复幂等键不重复执行；接收人更新不改变范围、时间或领取数量；操作写入审计且审计不含完整码、摘要、接收人原文。

- [ ] **Step 2: 运行新增测试确认失败**

```bash
cd v1/backend
uv run pytest tests/test_entitlement_delivery_api.py -k "freeze or restore or batch_action or recipient_update" -v
```

预期：状态端点不存在或 `frozen` 状态未被接受而失败。

- [ ] **Step 3: 建立审计应用服务和授权状态方法**

在 `runtime_audit/application_service.py` 提供两个最小方法：

```python
import json
from uuid import uuid4

from sqlalchemy import select

from app.modules.runtime_audit.models import OperationAudit


class RuntimeAuditApplicationService:
    def __init__(self, session):
        self.session = session

    def record(self, *, action, actor_id, target_id, result, reason_code, request_id, metadata):
        item = OperationAudit(
            id=str(uuid4()),
            action=action,
            actor_type="teacher",
            actor_id=actor_id,
            target_type="access_code",
            target_id=target_id,
            result=result,
            reason_code=reason_code,
            metadata_json=json.dumps(metadata, ensure_ascii=True, separators=(",", ":")),
            request_id=request_id,
        )
        self.session.add(item)
        return item

    def list_target_events(self, *, target_id):
        return list(
            self.session.scalars(
                select(OperationAudit)
                .where(
                    OperationAudit.target_type == "access_code",
                    OperationAudit.target_id == target_id,
                )
                .order_by(OperationAudit.occurred_at.desc())
            )
        )
```

方法只构造/查询 `OperationAudit`，元数据序列化前过滤完整授权码、校验摘要、本机标识、本机证明、接收人原文和课程正文。授权模块通过这个服务访问审计表，不直接跨模块查询。

在 `EntitlementApplicationService` 增加：

- `update_recipient(teacher_id, code_id, recipient_label, recipient_note)`；
- `freeze(teacher_id, code_id)`；
- `restore(teacher_id, code_id)`；
- `terminate(teacher_id, code_id)` 的不可恢复状态校验；
- `batch_action(teacher_id, code_ids, action, idempotency_key, request_id)`；
- `_public` 所需的接收人和派生时间状态；
- 所有写操作的归属校验、状态适用性校验、审计写入和事务回滚。

状态转移固定为 `active -> frozen -> active`，`active|frozen -> terminated`；`terminated` 没有反向转移。批量动作先加载并锁定/校验全部目标，再统一更新，任何目标不属于当前教师或不适用当前动作时整体失败。

- [ ] **Step 4: 增加路由和错误映射**

在 `routes.py` 增加：

```text
PUT  /api/v1/teacher/access-codes/{access_code_id}/recipient
POST /api/v1/teacher/access-codes/{access_code_id}/freeze
POST /api/v1/teacher/access-codes/{access_code_id}/restore
POST /api/v1/teacher/access-codes/batch-actions
```

保留 `POST /api/v1/teacher/access-codes/{access_code_id}/terminate` 作为作废端点。所有写端点使用 `require_teacher`、固定错误码和 `request_id`；批量端点不得由路由循环调用单条服务。

- [ ] **Step 5: 运行后端授权测试**

```bash
cd v1/backend
uv run pytest tests/test_entitlement_delivery_api.py -v
uv run ruff check .
uv run ruff format --check .
```

预期：授权码创建、范围归属、学生兑换、最新课程更新、领取数量限制、状态管理和批量原子性测试全部通过。

- [ ] **Step 6: 提交**

```bash
git add v1/backend/app/modules/entitlement_delivery/application_service.py \
  v1/backend/app/modules/entitlement_delivery/routes.py \
  v1/backend/app/modules/runtime_audit/application_service.py \
  v1/backend/tests/test_entitlement_delivery_api.py
git commit -m "feat: 支持授权码状态与批量管理"
```

### Task 3: 扩展教师端 API 类型与授权创建请求

**Files:**
- Modify: `v1/web/teacher/src/api.ts`
- Test: `v1/web/teacher/src/api.test.ts`

- [ ] **Step 1: 写 API 调用失败测试**

在 `api.test.ts` 覆盖：

- 创建请求传递多门 `grants`、`redeem_from`、`redeem_until`、每项 `valid_from`/`valid_until`、`recipient_label`、`recipient_note`；
- 批量请求传递 `count` 和整批接收人记录；
- 接收人更新使用 `PUT`；
- 单条冻结、恢复、作废使用对应端点；
- 批量状态动作只发一次 `POST /batch-actions`，不循环发送。

- [ ] **Step 2: 运行 API 测试确认失败**

```bash
npm --prefix v1/web test -- src/api.test.ts
```

预期：`TeacherAPI` 尚未提供新方法或请求体仍被硬编码为单课程而失败。

- [ ] **Step 3: 扩展类型和方法**

在 `api.ts` 增加创建输入类型、接收人字段、状态事件字段和范围摘要类型。将现有 `createAccessCode`/`createAccessCodeBatch` 改为接收完整输入对象，同时保留调用方可明确传入单课程的便捷参数。

增加：

```text
updateAccessCodeRecipient(codeId, recipientLabel, recipientNote)
freezeAccessCode(codeId)
restoreAccessCode(codeId)
batchAccessCodeAction(codeIds, action)
```

方法只负责序列化 HTTP DTO，不在前端决定课程最新版本、教师权限、状态可用性或事务结果。

- [ ] **Step 4: 运行测试**

```bash
npm --prefix v1 test -- src/api.test.ts
npm --prefix v1 run type-check
```

预期：API 请求测试和 TypeScript 类型检查通过。

- [ ] **Step 5: 提交**

```bash
git add v1/web/teacher/src/api.ts v1/web/teacher/src/api.test.ts
git commit -m "feat: 接入授权码管理 API"
```

### Task 4: 实现创建栏、列表详情和批量管理界面

**Files:**
- Modify: `v1/web/teacher/src/pages/AccessCodesPage.tsx`
- Modify: `v1/web/teacher/src/index.css`
- Modify: `v1/web/teacher/src/pages/AccessCodesPage.test.ts`
- Modify: `v1/web/teacher/src/App.tsx` only if route state must preserve selected code

- [ ] **Step 1: 写教师页面失败测试**

在 `AccessCodesPage.test.ts` 覆盖：

1. 页面加载当前课程和授权码列表；
2. 创建栏默认选中当前课程，可添加教师自己的已发布课程；
3. 数量输入 1–100，数量大于 1 调用批量 API；
4. 接收人和备注可留空并在生成后显示；
5. 列表每行有复选框，表头全选后显示批量工具条；
6. 冻结、恢复、作废按钮调用正确 API；
7. 作废前出现不可恢复确认，取消确认不发请求；
8. 详情显示范围、接收人、时间、领取摘要和状态；
9. 错误时保留列表和选择状态，不把请求发送显示成成功。

- [ ] **Step 2: 运行页面测试确认失败**

```bash
npm --prefix v1 test -- src/pages/AccessCodesPage.test.ts
```

预期：当前页面只有课程级数量输入和终止操作，新增选择器、接收人、复选框和批量操作断言失败。

- [ ] **Step 3: 实现页面状态和创建流程**

在 `AccessCodesPage.tsx` 增加以下有限状态：

```text
createDraft
selectedCodeIds
selectedCodeId
courseOptions
recipientEditor
notice/error
busyAction
```

页面进入时复用 `getCourse(courseId)`、`listCourses()` 和 `listAccessCodes(courseId)`；课程选项仅在展示层过滤当前教师自己的已发布课程，提交时由服务端再次校验。创建请求根据数量选择单个或批量端点，生成成功后刷新列表并展示完整码。

范围界面先支持整门课程和指定课节，保存为多个 `GrantWrite`；节点级结构不在本轮页面暴露。创建后接收人和备注通过详情栏独立编辑。

- [ ] **Step 4: 实现列表、详情和批量状态操作**

列表增加行选择框、全选框、搜索文本和本地状态/领取筛选。选中记录后展示“冻结 / 恢复 / 作废 / 清除选择”。单条与批量操作都显示影响数量；作废确认文案明确“只停止未来在线资格，不删除记录或学生已安装课程”。

详情栏展示完整授权码、接收人记录、范围、双时间、领取摘要和状态历史；作废后隐藏恢复按钮，冻结后显示恢复按钮。

- [ ] **Step 5: 增加响应式样式**

在 `index.css` 增加管理列表、创建栏、详情栏、复选框、状态徽标和批量操作条样式。桌面端采用列表 + 右侧详情，窄屏改为单列；不允许批量操作条、表格文字和详情内容重叠。

- [ ] **Step 6: 运行前端测试和构建**

```bash
npm --prefix v1 test -- src/pages/AccessCodesPage.test.ts
npm --prefix v1 run type-check
npm --prefix v1 run build
```

预期：教师页面回归、类型检查和生产构建通过。

- [ ] **Step 7: 提交**

```bash
git add v1/web/teacher/src/pages/AccessCodesPage.tsx \
  v1/web/teacher/src/index.css \
  v1/web/teacher/src/pages/AccessCodesPage.test.ts \
  v1/web/teacher/src/App.tsx
git commit -m "feat: 完成授权码创建与管理界面"
```

### Task 5: 文档同步与完整自动化验证

**Files:**
- Modify: `docs/superpowers/plans/2026-08-28-access-code-management.md`
- Modify: `doc/requirements/v1/12-acceptance-traceability.md` only with verified implementation evidence
- Modify: `doc/traceability/v1-requirements.tsv` only with verified implementation evidence
- Modify: `changelog.md` only after all required checks pass
- Modify: `next.md` for the current execution slice

- [ ] **Step 1: 运行完整检查**

```bash
npm test
node tools/doc-check.mjs
node tools/endpoint-check.mjs
node tools/v1-module-check.mjs
npm run check:contract
node tools/secret-scan.mjs
node tools/dependency-check.mjs
cd v1/backend && uv run pytest
cd ../.. && npm --prefix v1 run type-check && npm --prefix v1 run build
```

预期：所有文档、契约、模块、秘密、依赖、后端测试和教师端构建检查通过。端点清单必须与新增路由一致。

- [ ] **Step 2: 更新验证证据**

只把已经通过自动化或人工验证的文件、测试和日期写入需求追踪矩阵与 `changelog.md`；不把设计阶段草图或未验证的自定义生成规则写成已交付能力。

- [ ] **Step 3: 检查工作树和提交范围**

```bash
git diff --check
git status --short
git log -6 --oneline
```

确认不包含用户原有的无关修改，不修改或删除学生本机数据，不提交真实授权码、账号或测试秘密。

### Task 6: 真实教师界面登录与手工验收

**Files:**
- No source changes unless manual verification finds a reproducible defect
- Add manual evidence under `tests/manual/v1/` only after verification

- [ ] **Step 1: 启动本地后端和教师端**

使用仓库现有开发脚本启动后端与教师 Web；若默认端口被占用，选择另一个端口并让教师端 API origin 指向同一后端。读取健康接口确认数据库和迁移已就绪。

- [ ] **Step 2: 通过浏览器登录教师端**

使用本地测试教师账号登录，进入已发布课程的“授权码管理”。不在截图、日志或文档中记录密码和完整授权码。

- [ ] **Step 3: 手工创建单个和批量授权码**

真实点击“新建授权码”，确认当前课程默认选中，添加第二门自己的已发布课程，设置课节范围、接收人和数量 1；再创建数量 3 的批量授权码。确认列表出现独立记录、完整码、范围、接收人和领取摘要。

- [ ] **Step 4: 手工执行状态操作**

勾选两条记录执行冻结，确认状态变为“冻结”；执行恢复，确认回到“有效”；再勾选一条执行作废，确认二次确认文案和最终状态为“作废”，刷新页面后记录仍存在且不能恢复。记录浏览器可见结果和对应 request ID，不记录完整码。

- [ ] **Step 5: 手工验证异常和回归**

刷新页面确认状态和接收人仍保留；验证作废记录不能再被恢复；确认批量操作条在无选择时隐藏、在有选择时出现；确认移动窗口下没有重叠。若发现缺陷，回到对应任务先写失败测试，再修复并重新执行自动化和手工验证。

- [ ] **Step 6: 保存人工验收记录**

在 `tests/manual/v1/` 新增带日期的简短记录：环境、登录结果、创建数量、状态转移、刷新后保留、学生链路未被改动、截图路径和未验证项。文件不得包含密码、完整授权码、接收人真实隐私或本机标识。
