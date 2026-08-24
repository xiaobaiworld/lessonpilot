# KnownMap 文档索引

最近审计：2026-08-24

当前阶段：v1 已完成生产切换并进入新功能开发；v1 需求现为 `1.0.3`，设计 07 已按
`FR-LIB-014` 增补学生插件使用说明页。

其它 Agent 开始工作时先读本文件，再按「当前权威」顺序阅读。**只有「当前权威」段的文档指导开发。**
「当前证据」只证明 v0.9.1 现状，不定义 v1 目标；「历史归档」只用于追溯。

`node tools/doc-check.mjs` 会检查本文件的「当前权威」段不含归档或已退出指导链的旧文档。

## 当前权威

| 文档 | 职责 |
| --- | --- |
| [`SYSTEM-OVERVIEW.md`](SYSTEM-OVERVIEW.md) | 系统总说明：四个部分、数据流、关键设计决定、目录、运行与验证。跨文件动代码前先读 |
| [`requirements/v1/README.md`](requirements/v1/README.md) | v1 需求入口：文件索引、编号规则、审核状态 |
| [`design/v1/README.md`](design/v1/README.md) | v1 设计入口：文件编号、权威顺序、审核与归档门禁 |
| [`plans/v1-development-plan.md`](plans/v1-development-plan.md) | 阶段 0–8 目标、交付和产品门禁（`1.1.0`） |
| [`plans/v1-replacement-plan.md`](plans/v1-replacement-plan.md) | 已接受的同仓库 `v1/` 目录隔离替换决策与资产处置依据（`0.2.0`，非工作包真源） |
| [`plans/v1-code-refactor-execution-plan.md`](plans/v1-code-refactor-execution-plan.md) | 唯一逐工作包实施真源：目录、工具、测试、切换、退役、失败模式和提交边界（`0.3.0`） |
| [`plans/v1-test-plan.md`](plans/v1-test-plan.md) | 需求级测试矩阵、自动化/人工证据和发布门禁 |
| [`老版新版切换计划.md`](老版新版切换计划.md) | v1 生产切换、观察期、消费者清零和老版独立退役的执行台账与追加式日志 |
| [`dev-rules.md`](dev-rules.md) | 项目专有开发规则：权威顺序、编号、契约与模块边界 |
| [`traceability/v1-requirements.tsv`](traceability/v1-requirements.tsv) | 257 个稳定编号的需求级追踪矩阵 |
| [`../next.md`](../next.md) | 当前执行切片和人工决策边界 |
| [`../README.md`](../README.md) | 项目入口、当前状态、运行命令 |

### v1 设计文件

| 编号 | 文档 | 职责 |
| ---: | --- | --- |
| 01 | [`design/v1/01-current-system-assessment.md`](design/v1/01-current-system-assessment.md) | 当前代码、验证证据、可继承经验和原型负担 |
| 02 | [`design/v1/02-legacy-document-register.md`](design/v1/02-legacy-document-register.md) | 82 个旧来源的演化、价值、冲突和最终去向 |
| 03 | [`design/v1/03-system-architecture.md`](design/v1/03-system-architecture.md) | 模块化单体、多客户端、信任边界和部署拓扑 |
| 04 | [`design/v1/04-domain-data-model.md`](design/v1/04-domain-data-model.md) | 领域对象、身份、关系、数据位置和约束 |
| 05 | [`design/v1/05-data-flow-lifecycle.md`](design/v1/05-data-flow-lifecycle.md) | 发布、兑换、安装、更新、离线、保留和恢复数据流 |
| 06 | [`design/v1/06-interface-contracts.md`](design/v1/06-interface-contracts.md) | HTTP API、插件消息、课程包、文件和外部集成契约 |
| 07 | [`design/v1/07-product-interaction-state.md`](design/v1/07-product-interaction-state.md) | 页面职责、教师/学生流程、交互状态和失败恢复 |
| 08 | [`design/v1/08-security-operations-design.md`](design/v1/08-security-operations-design.md) | 权限、秘密、输入、隐私、发布、备份和恢复边界 |
| 09 | [`design/v1/09-migration-cutover-design.md`](design/v1/09-migration-cutover-design.md) | 旧数据处理、干净初始化、切换、回滚和旧入口退役 |

### v1 已接受决策

`D-V1-001` 至 `D-V1-012`，全部在 [`decisions/`](decisions/)：

| 编号 | 决策 |
| --- | --- |
| `D-V1-001` | [公开销售页与飞书试用申请纳入 v1 P0](decisions/2026-08-21-v1-public-trial-intake.md) |
| `D-V1-002` | [v1 完全排除 AI 辅助制作](decisions/2026-08-21-v1-no-ai-authoring.md) |
| `D-V1-003` | [学生端保持基础运行闭环](decisions/2026-08-21-v1-basic-student-runtime.md) |
| `D-V1-004` | [固定 ZIP 手动分发与更新](decisions/2026-08-21-v1-plugin-distribution.md) |
| `D-V1-005` | [产品闭环与市场价值观察门槛](decisions/2026-08-22-v1-success-gates.md) |
| `D-V1-006` | [数据保留、导出与删除](decisions/2026-08-22-v1-data-retention.md) |
| `D-V1-007` | [基础设施目标](decisions/2026-08-22-v1-infrastructure-target.md) |
| `D-V1-008` | [课程内容权利与争议处置](decisions/2026-08-22-v1-content-rights.md) |
| `D-V1-009` | [Chrome/B 站兼容范围](decisions/2026-08-22-v1-compatibility-scope.md) |
| `D-V1-010` | [课节内容重复安排与同视频多课节边界](decisions/2026-08-22-v1-repeated-video-lessons.md) |
| `D-V1-011` | 脚本/发布聚合 JSON 与本机学习记录策略，见 [数据持久化策略](decisions/2026-08-22-v1-data-persistence-strategy.md) |
| `D-V1-012` | [不迁移无价值旧服务端数据与学生本机数据](decisions/2026-08-22-v1-no-legacy-data-migration.md) |

### 经验与状态

| 文档 | 职责 |
| --- | --- |
| [`lessons.md`](lessons.md) | 已踩的坑和已验证的做法；开始新功能前先读 |
| [`../changelog.md`](../changelog.md) | 版本变更记录 |
| [`status/v1-stage-0-progress-summary-2026-08-22.md`](status/v1-stage-0-progress-summary-2026-08-22.md) | 阶段 0 进度快照；临时记录，不替代真源 |

## 当前证据

以下 29 份文档按 [`design/v1/02-legacy-document-register.md` 第 10 节](design/v1/02-legacy-document-register.md#10-全量审计结果)
保留在原位，只证明 v0.9.1 现状、生产记录或人工验收结果。

**它们都不定义 v1 目标。** 与 v1 需求或设计冲突时以 v1 真源为准，不反向修改冻结文档。

### 安全、发布与部署记录

| 文档 | 证明什么 |
| --- | --- |
| [`security/2026-08-20-production-security-audit.md`](security/2026-08-20-production-security-audit.md) | 仓库、发布链路、阿里云 ECS 与残余风险审计结果 |
| [`../deploy/releases/README.md`](../deploy/releases/README.md) | Web 生产发布记录与回滚目标 |
| [`../deploy/teacher-platform/README.md`](../deploy/teacher-platform/README.md) | 教师平台部署步骤与环境事实 |

### 内容、品牌与技术探针

| 文档 | 证明什么 |
| --- | --- |
| [`teacher-sales-page-design.md`](teacher-sales-page-design.md) | 当前销售页文案与受众定位 |
| [`../docs/knownmap-logo-resources.md`](../docs/knownmap-logo-resources.md) | 品牌资源清单与用法 |
| [`subtitle-pipeline.md`](subtitle-pipeline.md) | 字幕导入与解析的已验证路径 |
| [`bili-mascot-spike.md`](bili-mascot-spike.md) | B 站页面挂载探针结论 |
| [`../tests/manual/bilibili-iframe-current-time/README.md`](../tests/manual/bilibili-iframe-current-time/README.md) | 跨源 iframe 无法可靠读取播放时刻 |
| [`promo-video.md`](promo-video.md) | 宣传视频素材说明 |

### 研究资料

| 文档 | 证明什么 |
| --- | --- |
| [`Digital_Learning_Platforms_竞争情报与定价研究_v0.1.md`](Digital_Learning_Platforms_竞争情报与定价研究_v0.1.md) | 竞品与定价调研；不构成 v1 定价决定 |
| [`evidence/brand-research/AI_Brand_Naming_Project.md`](evidence/brand-research/AI_Brand_Naming_Project.md) | 品牌命名过程 |
| [`evidence/brand-research/AI_Brand_Domain_Selection_Report_v0.1.md`](evidence/brand-research/AI_Brand_Domain_Selection_Report_v0.1.md) | 域名选择过程 |
| [`evidence/tooling/`](evidence/tooling/) | Agent 工具冒烟记录；与产品行为无关 |

### 已完成计划

以下计划已执行完毕，只用于追溯当时的任务拆解与验收步骤，不作为当前任务：

[`teacher-platform-dev-plan.md`](teacher-platform-dev-plan.md)、
[`plans/stage-1a-contract-bridge-deploy.md`](plans/stage-1a-contract-bridge-deploy.md)、
[`plans/stage-1b-sales-page-revision.md`](plans/stage-1b-sales-page-revision.md)、
[`plans/teacher-visual-node-editor.md`](plans/teacher-visual-node-editor.md)、
[`plans/teacher-platform-experience-polish.md`](plans/teacher-platform-experience-polish.md)、
[`plans/knownmap-brand-lockup-refinement.md`](plans/knownmap-brand-lockup-refinement.md)、
[`plans/web-production-release-traceability.md`](plans/web-production-release-traceability.md)、
[`plans/student-plugin-usage-guide-development-plan.md`](plans/student-plugin-usage-guide-development-plan.md)、
[`../docs/superpowers/plans/2026-08-18-knownmap-brand-update.md`](../docs/superpowers/plans/2026-08-18-knownmap-brand-update.md)、
[`../docs/superpowers/plans/2026-08-20-teacher-account-admin.md`](../docs/superpowers/plans/2026-08-20-teacher-account-admin.md)。

`docs/superpowers/specs/` 下的三份 spec 内容已由 v1 设计 04 与 06 承接，同样只作历史参考。

### 人工验收记录

[`../tests/manual/`](../tests/manual/) 下的 `sales-page-revision-20260816.md`、
`stage-1a-bridge/`、`teacher-editor-completion/`、`teacher-platform-experience-polish/`、
`teacher-platform-local/`、`teacher-visual-node-editor/`。

这些记录属于 v0.9.1 原型，不能冒充 v1 验收证据。v1 人工验收写入 `tests/manual/v1/`。

### 受限素材

`doc/英文面试问答流程...srt` 权利未核验。按 `D-V1-008`，在取得权利证据或替换为可证明授权/
自制的匿名素材之前，不得进入任何发布物。它不是测试夹具，也不应被课程夹具引用。

## 历史归档

[`archive/`](archive/) 只用于追溯，不指导开发：

| 目录 | 内容 |
| --- | --- |
| [`archive/2026-08-22-pre-v1-rewrite/`](archive/2026-08-22-pre-v1-rewrite/) | 44 份内容已由 v1 真源承接的旧需求、旧设计、旧规格和旧决策 |
| [`archive/2026-08-22-pre-v1-design/`](archive/2026-08-22-pre-v1-design/) | v1 设计前的 `next.md` 快照 |
| [`archive/2026-08-18-teacher-platform-nodes-1-7/`](archive/2026-08-18-teacher-platform-nodes-1-7/) | 教师平台节点 1–7 的计划与执行记录 |
| [`archive/2026-08-18-stage-one-demo/`](archive/2026-08-18-stage-one-demo/) | 第一阶段销售页与原型 Demo 计划 |
| [`archive/2026-08-15-pre-stage-one/`](archive/2026-08-15-pre-stage-one/) | 第一阶段前的需求与计划 |

旧文档的逐文件去向见
[`requirements/v1/13-legacy-source-register.md`](requirements/v1/13-legacy-source-register.md)（`SRC-001`–`SRC-082`）。

## 代码与验证入口

| 位置 | 内容 |
| --- | --- |
| `backend/app/` | FastAPI 服务端 |
| `src/` | 学生 Chrome MV3 插件 |
| `teacher-web/` | 教师与管理员 Web 应用 |
| `tools/` | 构建、发布、文档检查与追踪矩阵工具 |
| `tests/` | Node 自动化测试；`tests/manual/` 为人工验收记录 |
| `backend/tests/` | 后端 pytest |

检查与测试命令见 [`dev-rules.md` 第 8 节](dev-rules.md#8-检查与测试命令)。

## 文档维护规则

1. 新增或修改文档后，把它归入「当前权威」「当前证据」或「历史归档」中的一段，不留悬空文件；
2. 需求、设计、计划变化时同步追踪矩阵；编号引用必须能解析到定义；
3. 每个阶段完成后更新 `next.md`、`changelog.md` 和必要索引；
4. 大阶段收口时重新检查长度、重复、孤立文档和权威状态，并更新本页审计日期；
5. 提交前运行 `node tools/doc-check.mjs`，四项全绿。

变更历史不写在本页，见 [`../changelog.md`](../changelog.md) 和
[`archive/`](archive/) 中的阶段收口记录。
