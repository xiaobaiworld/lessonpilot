# v1 跨语言契约真源

按 `ARCH-DEC-02`（[设计 03 第 14 节](../../doc/design/v1/03-system-architecture.md#arch-dec-02跨语言契约真源)）：

| 契约 | 真源 | 位置 |
| --- | --- | --- |
| HTTP API | FastAPI/Pydantic 生成的 OpenAPI | 后端运行时导出，不在本目录 |
| 课程发布包 | 版本化 JSON Schema | `schemas/course-package.v1.schema.json` |
| 插件内部消息 | 版本化 JSON Schema | `schemas/extension-message.v1.schema.json` |

本目录只放 Schema 和版本清单。Python 与 TypeScript/JavaScript 侧都据此校验，
不再各自维护一份手写校验器 —— `DEV-STRUCT-001` 要求同一契约只有一个权威实现。

## 为什么课程包和插件消息用 JSON Schema，而 HTTP 用 OpenAPI

课程包同时被后端生成、插件校验、测试夹具构造；插件消息在 popup/content/background
三方之间流动，其中没有一方是天然的定义方。这两个契约需要一份与语言无关的定义。

HTTP 请求响应有明确的定义方（FastAPI 路由和 Pydantic 模型），再单独维护一份 JSON Schema
会产生第二真源。OpenAPI 由代码导出，与实现同步是结构性保证而非约定。

## 版本规则

见[设计 06 第 10.1 节](../../doc/design/v1/06-interface-contracts.md#101-版本规则)。要点：

- 主版本变化表示字段语义、身份或安全边界不兼容，接收方**安全拒绝**并提示升级；
- 次版本只增加可选字段，接收方忽略已声明可忽略的字段；
- 删除字段、改变单位、改变 ID 语义、把可选字段改为必填，都必须升主版本；
- 协议版本与内容版本分开：插件升级不改变已安装课程的 `releaseId`。

文件名带主版本号（`.v1.`）。升主版本时**新增文件**，不原地改写 —— 旧版本 Schema
必须保留，否则无法验证「未知/旧版本被安全拒绝」这条行为。

## 版本清单

`versions.json` 是各契约当前主版本的单一记录，供后端 `/api/v1/meta/contracts`
端点和插件兼容判定读取。它不重复 Schema 内容，只登记版本号和文件位置。

## 检查

```bash
node tools/contract-check.mjs              # 四项
node tools/contract-check.mjs --no-python   # 跳过双端比对（无 uv 环境时）
```

四项分别是：Schema 自身合法且能在 strict 模式编译、版本清单与文件一致、
夹具行为与文件名一致、Python 与 Node 对同一夹具给出一致结论。

已进入 `npm test`。CI 有独立的 `contract-check` job 同时装 Node 和 Python ——
`node-test` job 没有 Python，双端比对在那里会静默跳过。

夹具见 [`tests/fixtures/v1/`](../../tests/fixtures/v1/README.md)：31 个，
每个反例只违反一条约束。

## 当前状态

已完成：

- 两份 Schema 与 `versions.json`；
- 双端校验器依赖（`ajv` 8.17.1 锁定 / 后端 `jsonschema>=4.23,<5`），两侧 lockfile 入库；
- 31 个匿名夹具，正例覆盖重复课节、同视频多课节、四类节点、三种授权范围、空节点课节；
- `tools/contract-check.mjs` 四项检查，进入 `npm test` 与 CI。

待完成：

- **删除手写双真源**：`src/shared/course-contract.js`（485 行）与后端 Pydantic 中
  重复的相同规则（`DEV-STRUCT-001`）。在此之前，本目录的 Schema
  **尚未被任何运行代码使用** —— 它只被检查工具读取。
  这一步要等阶段 1 建立 v1 服务端领域后再做：现在删掉手写校验器会让 v0.9.1 原型停摆，
  而 v1 实现还不存在。

## Schema 与当前实现的已知差异

`course-package.v1` 要求每个节点带 `stateCompatibilityKey`（设计 04 第 7.2 节：
完成语义改变时必须改变，不能只凭节点 ID 迁移）。该字段在 `src/` 和 `backend/app/`
中都不存在 —— v0.9.1 没有实现它。

因此本 Schema 是 **v1 目标契约，不能用来校验现有 v0.9.1 数据**。
按 `D-V1-012`，v1 从干净初始化开始，不迁移旧业务数据，所以这不构成迁移障碍；
但任何拿现有课程包对本 Schema 做校验的尝试都会失败，这是预期结果而非缺陷。

## 跨字段约束不由 Schema 表达的部分

JSON Schema 无法表达跨字段引用完整性和排序约束。以下由插件校验流程
（设计 06 第 5.3 节第 2–4 步）保证，不要误以为 Schema 通过就等于包有效：

- `evaluation.correctOptionId` 必须是同节点 `display.options` 中某个 `optionId`；
- `authorizedScope.lessonIds` / `nodeIds` 必须指向包内实际存在的课节和节点；
- `lessons[].order` 必须无重复、无缺口；
- `nodes` 必须按 `trigger.timeSeconds` 升序、同时刻按 `nodeId` 升序；
- `packageDigest` 必须与包内容实际摘要一致。
