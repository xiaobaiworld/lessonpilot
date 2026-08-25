# KnownMap v1 需求说明书

文档版本：`1.0.5`

状态：已于 2026-08-22 完成人工审核并冻结；随后按 `D-V1-010` 修订课节内容重复与同视频多课节规则并重新冻结；
迁移范围按 `D-V1-012` 同步；2026-08-24 经产品负责人确认增补并扩展 `FR-LIB-014`；
2026-08-25 按 `D-V1-013` 建立新增节点统一生命周期标准

重构基线：`main@0e503a4`；已发布插件基线：`v0.9.1`

## 1. 需求文档体系与版本边界

KnownMap v1 是一次面向完整项目重构的新主版本。现有代码和文档只作为事实来源与历史证据，
不默认视为 v1 必须保留的需求。v1 的需求、设计和实现必须重新建立可追溯关系，并按以下顺序推进：

```text
需求逐段审核
  -> 需求版本冻结
  -> 设计逐段审核
  -> 设计版本冻结
  -> 代码与测试重构
  -> 部署验收
  -> 发布 v1.0.0
```

`README.md` 保留为目录的固定入口，不参与业务顺序编号；其余需求文件统一使用两位数字前缀。
数字只表示建议阅读和审核顺序，不表示需求优先级。

### 1.1 文件索引

| 序号 | 文件 | 单一职责 | 审核状态 |
| ---: | --- | --- | --- |
| 00 | `README.md` | 需求版本、文件索引、权威关系、编号规则和审核状态 | 已接受并冻结 |
| 01 | [`01-product-scope.md`](01-product-scope.md) | 产品目标、成功标准、利益相关者、范围、边界、非目标、约束和假设 | 已接受；`D-V1-001` 至 `D-V1-010` 均已同步 |
| 02 | [`02-domain-glossary.md`](02-domain-glossary.md) | 统一角色、课程、课节、节点、授权、学习记录等领域术语 | 已接受；已同步单机术语和课程级发布版本 |
| 03 | [`03-user-scenarios.md`](03-user-scenarios.md) | 用户角色、前置条件、主流程、异常流程和可观察结果 | 已接受；同视频多课节场景已同步 |
| 04 | [`04-functional-requirements.md`](04-functional-requirements.md) | 按业务能力编号的功能性需求、业务规则和单项验收条件 | 已接受；课节内容重复、同视频多课节、运行选择、学生插件安装说明入口和节点统一生命周期已同步；`FR-REPORT` 保留为后续候选 |
| 05 | [`05-data-requirements.md`](05-data-requirements.md) | 数据归属、分类、生命周期、质量、保留、导入导出和删除要求 | 已接受；`D-V1-006` 与 `D-V1-010` 已同步，不对课节内容做语义去重 |
| 06 | [`06-interface-integration-requirements.md`](06-interface-integration-requirements.md) | Web、插件、B 站、课程包和文件之间的项目特有接口边界 | 已接受；多课节匹配边界已同步 |
| 07 | [`07-non-functional-requirements.md`](07-non-functional-requirements.md) | 第一阶段非功能指标结论及后续重开范围 | 已接受；第一阶段不单独制定 `NFR-*` |
| 08 | [`08-security-privacy-compliance-requirements.md`](08-security-privacy-compliance-requirements.md) | 测试原型阶段的访问、秘密、输入和本机数据安全底线 | 已接受 |
| 09 | [`09-development-quality-requirements.md`](09-development-quality-requirements.md) | 工程结构、依赖、编码、测试、日志、配置和文档同步门禁 | 已接受 |
| 10 | [`10-deployment-operations-requirements.md`](10-deployment-operations-requirements.md) | 环境、发布、迁移、回滚、监控、告警、备份、恢复和运行维护 | 已接受 |
| 11 | [`11-migration-compatibility-requirements.md`](11-migration-compatibility-requirements.md) | v0.9.1 到 v1 的数据、配置、接口、用户路径兼容与弃用策略 | 已接受；迁移范围按 `D-V1-012` 同步 |
| 12 | [`12-acceptance-traceability.md`](12-acceptance-traceability.md) | 需求到场景、设计、代码、测试和发布证据的追踪矩阵及发布门禁 | 已接受 |
| 13 | [`13-legacy-source-register.md`](13-legacy-source-register.md) | 旧文档逐文件提取状态、独有信息去向、冲突和最终归档位置 | 已接受 |

### 1.2 需求编号规则

本目录使用的全部编号前缀如下。`tools/lib/requirement-ids.mjs` 保存同一份清单，
`tools/doc-check.mjs` 据此校验每个编号引用都能解析到定义。

**需求编号**（计入需求库存和追踪矩阵）：

| 前缀 | 含义 | 定义文件 |
| --- | --- | --- |
| `GOAL-*` | 产品目标 | `01-product-scope.md` |
| `SUCCESS-*` | 产品成功标准 | `01-product-scope.md` |
| `SCOPE-*` | v1 功能范围 | `01-product-scope.md` |
| `CONSTRAINT-*` | 已知约束 | `01-product-scope.md` |
| `SCN-*` | 用户场景 | `03-user-scenarios.md` |
| `FR-*` | 功能需求 | `04-functional-requirements.md` |
| `DATA-*` | 数据需求 | `05-data-requirements.md` |
| `INT-*` | 接口与集成需求 | `06-interface-integration-requirements.md` |
| `SEC-*` | 安全、隐私与合规需求 | `08-security-privacy-compliance-requirements.md` |
| `DEV-*` | 开发质量需求 | `09-development-quality-requirements.md` |
| `OPS-*` | 部署运维需求 | `10-deployment-operations-requirements.md` |
| `MIG-*` | 迁移兼容需求 | `11-migration-compatibility-requirements.md` |
| `ACC-*` | 验收追踪需求 | `12-acceptance-traceability.md` |

**引用编号**（可被引用，不计入需求数）：`TERM-*`（术语，`02-domain-glossary.md`）、
`OPEN-*`（需求审核开放项，`01-product-scope.md` 第 8 节）、`D-V1-*`（v1 产品与范围决策，
`doc/decisions/`）、`D-*`（v1 之前的历史决策，只作来源追溯）、`SRC-*`（旧资料来源，
`13-legacy-source-register.md`）。设计目录另有 `ARCH-DEC-*` 和 `DATA-DEC-*` 记录工程取舍。

**已保留未签发**：

- `NFR-*`：`07-non-functional-requirements.md` 已决定第一阶段不制定量化非功能指标。
  重开量化指标前不签发该前缀下的任何编号。
- `FR-REPORT-*`：教师学习反馈与导出，第 1.1 节声明为后续阶段候选。

编号一旦进入已接受状态便不复用；需求被替代时保留原编号和替代关系。
需求之间的上下游关系不写进条目，统一由
[`doc/traceability/v1-requirements.tsv`](../../traceability/v1-requirements.tsv) 单向维护。

### 1.3 需求目录之外的工程文档

以下内容属于后续软件工程阶段，不写进需求文件形成需求与设计混杂：

- 系统架构、模块边界、运行时数据流和部署拓扑；
- 数据模型、字段字典、数据库迁移和 API 契约设计；
- 安全设计、威胁模型和风险处置方案；
- 开发计划、测试计划、测试报告和人工验收记录；
- 发布手册、回滚手册、备份恢复手册、故障响应和维护手册；
- ADR/决策记录、版本记录、变更日志和归档目录。

这些文档只有在相应需求通过审核后才能定稿，并必须回链到稳定需求编号。

人工审核和权威切换遵守以下规则：

1. 每次只提交一个文件中的一个完整段落供人工审核；未审核段落不提前扩写。
2. 审核结论只分为“待审核”“已接受”“需修改”“已否决”，不得把讨论中的内容写成已确认事实。
3. 既有需求文档在其独有事实被提取、分类并审核前继续保留，不直接删除或覆盖。
4. 已提取完毕的旧文档按日期和来源版本移入 `doc/archive/`，并保留 Git 历史与新文档回链。
5. 全部 v1 需求审核并冻结前，不开始架构定稿或产品代码重写；必要的只读审计和验证不受此限制。
6. v1 文档只有在索引、需求、设计、代码、测试和发布记录一致后，才能标记为正式版本。

下一阶段从 v1 设计文档体系开始；旧实现与旧设计只作为迁移证据，不反向覆盖本目录。
