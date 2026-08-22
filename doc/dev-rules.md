# KnownMap 项目开发规则

适用范围：本仓库全部代码、文档和工具。

与 `~/.claude/CLAUDE.md`（全局规则）共同生效。全局规则已经写明的内容不在此重复；
本文件只写 KnownMap 特有的边界。两者冲突时以全局规则为准，并把冲突写入 `doc/lessons.md`。

## 1. 权威顺序

解释冲突时按以下顺序，完整定义见
[`design/v1/README.md` 第 2 节](design/v1/README.md#2-权威顺序)：

1. 已冻结 v1 需求和已接受产品决策；
2. 已通过人工审核的 v1 设计；
3. 可重复运行结果、真实人工验收和生产记录；
4. 当前代码和数据库迁移所描述的实现事实；
5. 已完成演化审计的旧设计、计划和研究资料。

需求、设计和代码都可能有错。高权重内容与已验证的技术或安全事实冲突时必须重新审核，
不得静默选一方。

## 2. 真源入口

| 内容 | 真源 |
| --- | --- |
| 需求 | [`requirements/v1/README.md`](requirements/v1/README.md) |
| 设计 | [`design/v1/README.md`](design/v1/README.md) |
| 开发计划 | [`plans/v1-development-plan.md`](plans/v1-development-plan.md) |
| 测试计划 | [`plans/v1-test-plan.md`](plans/v1-test-plan.md) |
| 需求追踪 | [`traceability/v1-requirements.tsv`](traceability/v1-requirements.tsv) |
| 决策 | [`decisions/`](decisions/)，v1 段为 `D-V1-001` 至 `D-V1-012` |
| 文档地图 | [`INDEX.md`](INDEX.md) |

`doc/archive/` 只用于追溯，不指导开发。标为「当前证据」的文档只证明 v0.9.1 现状，
不定义 v1 目标。

## 3. 编号规则

编号前缀清单和「已保留未签发」名单见
[`requirements/v1/README.md` 第 1.2 节](requirements/v1/README.md#12-需求编号规则)，
机器可读副本在 `tools/lib/requirement-ids.mjs`。

- 引用编号必须能解析到定义。`node tools/doc-check.mjs` 会拒绝指向不存在编号的引用。
- 需求之间的上下游关系只写在追踪矩阵里，不写回需求条目 —— 双向维护已经证明会漂移。
- 编号进入已接受状态后不复用；被替代时保留原编号和替代关系。

## 4. 契约真源边界

按 `ARCH-DEC-02`（[`design/v1/03-system-architecture.md` 第 14 节](design/v1/03-system-architecture.md#arch-dec-02跨语言契约真源)）：

| 契约 | 真源 | 消费端 |
| --- | --- | --- |
| HTTP API | FastAPI/Pydantic 生成的 OpenAPI | Web 客户端、插件 |
| 课程发布包 | 仓库内版本化 JSON Schema | 后端生成、插件校验 |
| 插件内部消息 | 仓库内版本化 JSON Schema | popup / background / content |

同一契约不允许两份手写校验器。Python 与 TypeScript 侧都从真源生成或据其校验。
契约变更必须同步版本、校验、消费端和测试；无法迁移或安全拒绝旧数据时不切换新契约
（`DEV-STRUCT-001`、`DEV-STRUCT-002`）。

## 5. 服务端模块边界

按 [`design/v1/03-system-architecture.md` 第 7 节](design/v1/03-system-architecture.md#7-服务端业务模块)，
FastAPI 是一个部署单元、一个事务边界，内部分六个业务模块：身份与会话、工作空间与课程、
制作与发布、授权与交付、管理与支持、运行与审计。

- 一个模块不得直接查询或修改另一个模块拥有的表；跨模块动作经显式应用服务组合。
- 依赖方向：路由 → 应用服务 → 领域规则与契约 → 仓储接口 → 适配器。反向依赖不允许。
- 路由只处理协议、认证入口、参数和错误映射；仓储只负责持久化，不决定权限或发布语义。
- 对外错误使用稳定代码和 `request_id`，不返回内部异常、路径或堆栈。

表归属见 [`design/v1/03-system-architecture.md` 第 7.0 节](design/v1/03-system-architecture.md#70-表归属)，
机器可读副本在 `tools/module-check.mjs`。模型类仅作类型标注（例如把已认证的 `Teacher`
对象作为参数类型）不算跨模块访问；`select`、`session.get`、按列过滤和构造实例才算。

当前 `backend/app/` 仍是按技术分层的平铺结构，与上述模块边界不一致，已有 9 处越界
登记在 `KNOWN_VIOLATIONS` 并附修法，属阶段 1 重构范围。**新增越界会导致测试失败**：

- 需要另一个模块的数据时，调用该模块的应用服务，不 import 它的模型或仓储；
- 新增服务或仓储必须在 `FILE_OWNER` 登记模块归属；
- 新增模型必须同时更新 `MODEL_OWNER` 和设计 03 第 7.0 节的表归属表；
- 修好一处越界后从 `KNOWN_VIOLATIONS` 删除该条 —— 白名单过期同样会失败，
  防止它变成永久豁免。

重构为 `modules/<domain>/` 的时机与范围由开发计划阶段 1 决定。届时检查改为按目录判定，
约束本身不变。

## 6. 客户端边界

- 教师应用与管理员应用不共享登录状态、角色路由守卫或资源授权决定，可共享无业务权限的
  视觉组件和 HTTP 基础设施。
- 插件中 popup 和 content 不得旁路 background 直接访问网络或底层存储。
- background 不信任页面消息、网络响应或已有本机存储，每次跨边界读取都复验。
- 宿主适配器只暴露运行所需最小播放能力，不把 B 站 DOM 选择器扩散到课程逻辑。
- 学生本机学习数据不上传（`SEC-PRIV-001`）。

## 7. 文档同步门禁

每个阶段结束前（`DEV-DOC-*`）：

1. 需求/设计编号已回链，追踪矩阵已更新；
2. `changelog.md`、`next.md` 与实际状态一致；
3. 新踩的坑已写入 `doc/lessons.md`；没有新经验就明确写「本阶段无新增 lessons」；
4. 无秘密、真实个人数据或未经授权的第三方内容进入仓库。

文档与代码必须在同一个提交或连续两个提交内同步。

## 8. 检查与测试命令

```bash
npm test                                  # 前端、插件与文档一致性测试
node tools/doc-check.mjs                  # 编号可解析、链接、矩阵覆盖、权威唯一
node tools/endpoint-check.mjs             # 端点清单与后端实现对照
node tools/module-check.mjs               # 模块边界：跨模块表访问
node tools/contract-check.mjs             # 契约 Schema、版本清单、夹具、双端一致
node tools/module-check.mjs --list        # 查看表归属与文件归属登记
node tools/build-traceability.mjs         # 重新生成追踪矩阵
node tools/build-traceability.mjs --check # 校验矩阵与需求文档一致
cd backend && uv run pytest               # 后端测试
```

新增或修改 HTTP 端点前先在
[`design/v1/06-interface-contracts.md` 第 4.5 节](design/v1/06-interface-contracts.md#45-v1-http-端点清单)
登记。`endpoint-check` 把未登记端点视为失败：清单是按冻结需求推导的实现基准，
代码不能先于契约设计存在。改名旧路径在依据列标注 `旧路径：<方法> <路径>`，退役后移除标注。

提交前全绿。文档检查失败与测试失败同等对待，不允许「文档下次再说」。

用 `npm test` 而不是直接写 `node --test tests/*.test.js`：测试同时有 `.test.js`（CommonJS）
和 `.test.mjs`（ESM，文档一致性检查需要 `import` 工具模块），单个 glob 会静默漏掉一类。

依赖：Node 侧 `npm ci`（`ajv` 用于契约校验），后端 `uv sync`。
两侧都必须从仓库内解析，不依赖开发机全局安装（`DEV-DEP-001`）。

## 9. 语言

文档、注释和提交信息使用中文。既有英文文件不作为语言依据 —— 新增和修改内容用中文。
