# 13 旧资料来源登记

文档版本：`1.0.0-draft.8`

状态：已于 2026-08-21 通过人工审核；本轮只登记，不移动、删除或改写旧资料

上级文档：[需求说明书索引](README.md)

## 1. 目的与边界

本文件登记 v1 重构前可能包含产品事实、需求、决策、设计、实施计划或验收证据的资料，防止旧资料在权威切换时被遗漏、误当成 v1 指令或过早删除。

登记状态只说明提取进度，不认可旧内容继续有效。每个来源完成处理前，必须逐项区分：当前需求、未来候选、设计或实现证据、历史事实、已否决内容以及无法确认的冲突。

以下持续维护文件不作为待归档来源：`AGENTS.md`、`CLAUDE.md`、`changelog.md`、`next.md`、`doc/INDEX.md` 和 `doc/lessons.md`。它们仍需在后续权威切换时同步更新。

## 2. 状态与处理规则

| 状态 | 含义 | 是否可归档 |
| --- | --- | --- |
| 待核对 | 尚未逐项确认独有信息与冲突 | 否 |
| 部分提取 | 已有内容进入 v1，但未证明全文处理完成 | 否 |
| 已提取待归档 | 独有信息、冲突和去向均已记录 | 人工确认后可以 |
| 已提取待切换 | 独有信息已处理，但源文件仍是当前运行入口 | 否；新入口可用后原位更新 |
| 已提取待决策 | 事实与冲突已提取，但最终去向取决于产品决定 | 否；决策完成后更新 |
| 已归档待核对 | 文件已在归档目录，但独有信息仍需核对 | 已归档，不得删除 |
| 保留为证据 | 属于测试、发布、研究或运行证据，不转成当前需求 | 保留原位或进入证据归档 |

任何来源只有同时满足以下条件才能从活跃文档区移走：逐项提取完成、冲突有结论、新权威有回链、现有链接已更新、Git 历史可恢复，并经人工确认。删除不属于本阶段默认动作。

## 3. 来源登记

### 3.1 产品、需求、决策与研究

| ID | 来源 | 状态 | 已知去向或待核对事项 |
| --- | --- | --- | --- |
| SRC-001 | [`README.md`](../../../README.md) | 已提取待切换 | [提取记录](legacy-source-extractions/SRC-001-root-readme.md)；无新增需求，待 v1 可用后原位更新入口 |
| SRC-002 | [`doc/requirements.md`](../../requirements.md) | 已提取待归档 | [提取记录](legacy-source-extractions/SRC-002-first-stage-requirements.md)；无新增需求，旧原型限制已分类 |
| SRC-003 | [`doc/requirements/teacher-platform-local-stage.md`](../../requirements/teacher-platform-local-stage.md) | 已提取待归档 | [提取记录](legacy-source-extractions/SRC-003-teacher-platform-local-stage.md)；旧实施规则与迁移证据已分类 |
| SRC-004 | [`doc/requirements/stage-1a.md`](../../requirements/stage-1a.md) | 已提取待归档 | [提取记录](legacy-source-extractions/SRC-004-stage-1a.md)；旧单课程契约与消息桥证据已分类 |
| SRC-005 | [`doc/requirements/stage-1b.md`](../../requirements/stage-1b.md) | 已提取待归档 | [提取记录](legacy-source-extractions/SRC-005-stage-1b.md)；公开销售与试用申请已按 `D-V1-001` 纳入 v1 P0 |
| SRC-006 | `doc/requirements/stage-1c.md` | 待核对 | B 站运行时、四类节点和端到端预览进入 03、04、06 核对 |
| SRC-007 | `doc/AI_Learning_Companion_Product_Function_Spec_v0.1.md` | 待核对 | 被 v0.2 替代的产品基线；只保留独有历史与未被否决候选 |
| SRC-008 | `doc/AI_Learning_Companion_Product_Function_Spec_v0.2.md` | 部分提取 | 教师中心、多课程、授权和学习方向进入 01–06；远期内容待分类 |
| SRC-009 | `doc/DECISIONS.md` | 部分提取 | 已接受决策被 01、02、04、05 引用；逐条状态和替代链待登记 |
| SRC-010 | `doc/decisions/2026-08-18-teacher-centered-product-v0.2.md` | 部分提取 | 教师、工作空间、本地课程和授权决策待与 v1 编号逐条回链 |
| SRC-011 | `doc/decisions/2026-08-18-teacher-platform-local-slice.md` | 待核对 | 仅代表旧最小切片，不自动限制 v1 完整范围 |
| SRC-012 | `doc/decisions/2026-08-18-student-plugin-single-course-delivery.md` | 待核对 | 单课程决策已被 v1 多课程方向替代；保留迁移源事实 |
| SRC-013 | `doc/Digital_Learning_Platforms_竞争情报与定价研究_v0.1.md` | 保留为证据 | 研究资料不直接形成已接受需求，商业假设需重新验证 |
| SRC-014 | `AI_Brand_Naming_Project.md` | 保留为证据 | KnownMap 命名研究过程，不定义产品行为 |
| SRC-015 | `AI_Brand_Domain_Selection_Report_v0.1.md` | 保留为证据 | 域名研究不预设 v1 部署拓扑或正式域名 |
| SRC-016 | `LessonPilot_Creator_Studio_设计建议_v0.1.md` | 待核对 | 旧品牌和早期工作台建议；视觉事实进入后续设计核对 |
| SRC-017 | `doc/multi-creator-platform.md` | 部分提取 | B2B2C 定位进入 01；计费、多创作者和平台化内容仍为未来候选 |
| SRC-018 | `doc/student-runtime.md` | 部分提取 | 角色与本机数据边界进入 01、04、05；广义能力待分类 |
| SRC-019 | `doc/promo-video.md` | 待核对 | 营销脚本不作为需求真源；只提取已验证产品承诺或风险 |

### 3.2 架构、数据、接口、安全与运行设计

| ID | 来源 | 状态 | 已知去向或待核对事项 |
| --- | --- | --- | --- |
| SRC-020 | `doc/design.md` | 待核对 | 旧整体架构和数据契约仅作现状及迁移证据，不能覆盖 v1 需求 |
| SRC-021 | `doc/teacher-platform-architecture.md` | 部分提取 | 当前 FastAPI、SQLite、Web 与插件边界进入 06、10、11；目标架构待重建 |
| SRC-022 | `doc/data-spec.md` | 部分提取 | 当前数据现状被 02、05、11 引用；字段级映射留给数据设计 |
| SRC-023 | `doc/data/model.md` | 部分提取 | 当前与目标模型混合，后续必须分开标记实现事实和未实现设计 |
| SRC-024 | `doc/data/dictionary.md` | 待核对 | 数据库、API、插件字段进入字段映射和迁移清单 |
| SRC-025 | `doc/data/flow.md` | 待核对 | 现有创建、发布、授权、学习及发布血缘进入数据流设计核对 |
| SRC-026 | `doc/data/quality.md` | 待核对 | 现有校验、漂移和门禁与 05、09、12 对照，避免重复权威 |
| SRC-027 | `doc/teacher-platform-data-spec.md` | 待核对 | 旧数据入口和兼容指针；确认无独有内容后再归档 |
| SRC-028 | `doc/teacher-platform-api-spec.md` | 部分提取 | 当前 API 是迁移源，不是 v1 契约；进入接口设计与兼容映射 |
| SRC-029 | `doc/security/2026-08-20-production-security-audit.md` | 保留为证据 | 只证明特定版本和环境；风险项与 08、10 对照后重新验证 |
| SRC-030 | `doc/web-production-release-design.md` | 待核对 | 现有静态站发布、记录和回滚进入部署设计现状清单 |
| SRC-031 | `deploy/releases/README.md` | 保留为证据 | 保留旧 Web 发布记录格式和恢复入口，不声明 v1 已发布 |
| SRC-032 | `deploy/teacher-platform/README.md` | 保留为证据 | 保留当前生产运维事实，进入 10、11 的环境与迁移核查 |
| SRC-033 | `doc/student-plugin-release-design.md` | 待核对 | 固定 ZIP、手动更新和回滚是旧发布方案，进入插件分发开放项 |
| SRC-034 | `doc/student-plugin-course-delivery-design.md` | 部分提取 | v0.9.1 单课程交付为兼容基线；多课程 v1 重新设计 |
| SRC-035 | `docs/superpowers/specs/2026-08-20-course-identity-and-storage-design.md` | 部分提取 | UUID、多课节和本机存储决策进入 02、04、05；实现证据待确认 |
| SRC-036 | `docs/superpowers/specs/2026-08-20-teacher-account-admin-design.md` | 部分提取 | 管理员与教师边界进入 03、04、08；旧页面和 API 留作迁移源 |

### 3.3 产品体验、内容、品牌和技术参考

| ID | 来源 | 状态 | 已知去向或待核对事项 |
| --- | --- | --- | --- |
| SRC-037 | `doc/stage-one-validation-loop-design.md` | 待核对 | 原型架构和理由作为历史设计，不能证明 v1 完成 |
| SRC-038 | `doc/teacher-course-workspace-design.md` | 待核对 | 工作台信息结构进入 v1 体验设计，旧页面职责已被需求替代 |
| SRC-039 | `doc/teacher-demo.md` | 待核对 | D0/D1 Demo 已被当前产品方向替代，只保留历史验证事实 |
| SRC-040 | `doc/teacher-sales-page-design.md` | 保留为证据 | 已验证销售叙事可作内容参考，不定义 v1 业务规则 |
| SRC-041 | `doc/trial-intake-form-design.md` | 待核对 | 飞书试用表单为旧业务入口；隐私、范围和继续保留性待确认 |
| SRC-042 | `doc/ui-design.md` | 待核对 | 颜色与基础 UI 规则进入后续设计，不提前冻结 |
| SRC-043 | `doc/learning-window-standard.md` | 待核对 | 展示与交互标准和四类基线节点逐项对照，超出范围作为候选 |
| SRC-044 | `doc/node-content-standard.md` | 待核对 | 内容完整性规则进入节点设计；不自动扩大第一阶段节点类型 |
| SRC-045 | `doc/subtitle-pipeline.md` | 保留为证据 | 字幕来源与本地解析研究进入制作设计和不可信输入核对 |
| SRC-046 | `doc/bili-mascot-spike.md` | 保留为证据 | 只证明播放器技术探索，不代表正式运行时或兼容承诺 |
| SRC-047 | `doc/teacher-visual-node-editor-design.md` | 待核对 | 已实现旧编辑器设计；行为与 v1 制作需求逐项映射 |
| SRC-048 | `doc/teacher-platform-experience-polish-design.md` | 待核对 | 旧体验校正和命名进入 UI 设计参考 |
| SRC-049 | `doc/teacher-editor-completion-design.md` | 待核对 | 时间线、快捷操作和授权码历史进入设计证据核对 |
| SRC-050 | `doc/teacher-timeline-reference-parity-design.md` | 待核对 | 样例时间线视觉对齐不等于 v1 验收完成 |
| SRC-051 | `doc/knownmap-brand-lockup-refinement-design.md` | 待核对 | 品牌组合标识进入品牌资产设计，不定义业务需求 |
| SRC-052 | `docs/superpowers/specs/2026-08-18-knownmap-brand-update-design.md` | 待核对 | 名称、域名和 Logo 决策与现行品牌资产核对 |
| SRC-053 | `docs/knownmap-logo-resources.md` | 保留为证据 | 当前 Logo 资源说明；后续由品牌资产入口承接 |
| SRC-054 | `doc/英文面试问答流程（超全！）｜自我介绍 矛盾处理 优缺点 技能.srt` | 保留为证据 | 演示字幕和测试数据，不是产品需求；发布使用需复核内容权利 |

### 3.4 实施计划与人工验收记录

| ID | 来源 | 状态 | 已知去向或待核对事项 |
| --- | --- | --- | --- |
| SRC-055 | `doc/teacher-platform-dev-plan.md` | 待核对 | 节点 8–9 旧收口计划；未完成项进入迁移或新计划重新判断 |
| SRC-056 | `doc/plans/stage-1a-contract-bridge-deploy.md` | 保留为证据 | 历史实施计划与实际结果分开登记 |
| SRC-057 | `doc/plans/stage-1b-sales-page-revision.md` | 保留为证据 | 已完成销售页修订计划，残余人工项由对应记录说明 |
| SRC-058 | `doc/plans/stage-1b-sales-workspace.md` | 待核对 | 部分交付计划，未完成项不能直接带入 v1 |
| SRC-059 | `doc/plans/stage-1c-runtime-e2e.md` | 待核对 | 部分交付计划，真实 B 站边界进入新测试计划 |
| SRC-060 | `doc/plans/teacher-visual-node-editor.md` | 保留为证据 | 旧编辑器实施记录，与 SRC-047 配对保留 |
| SRC-061 | `doc/plans/teacher-platform-experience-polish.md` | 保留为证据 | 旧体验实施记录，与 SRC-048 配对保留 |
| SRC-062 | `doc/plans/knownmap-brand-lockup-refinement.md` | 保留为证据 | 品牌修正实施记录，与 SRC-051 配对保留 |
| SRC-063 | `doc/plans/web-production-release-traceability.md` | 保留为证据 | 旧 Web 发布工具实施记录，不证明 v1 门禁通过 |
| SRC-064 | `docs/superpowers/plans/2026-08-18-knownmap-brand-update.md` | 保留为证据 | 品牌更新实施记录 |
| SRC-065 | `docs/superpowers/plans/2026-08-20-multi-course-authorization-and-example-course.md` | 待核对 | 当前旧分支计划与 v1 多课程需求对照后决定重用或替代 |
| SRC-066 | `docs/superpowers/plans/2026-08-20-teacher-account-admin.md` | 保留为证据 | 管理员功能实施与生产记录；仅作为迁移源和历史证据 |
| SRC-067 | `setup-gbrain-smoke-test-1786897219.md` | 保留为证据 | 独立工具冒烟记录；确认与产品无关后移出产品文档导航 |
| SRC-068 | `tests/manual/bilibili-iframe-current-time/README.md` | 保留为证据 | 特定播放器时间读取探针，不作为全面兼容结论 |
| SRC-069 | `tests/manual/sales-page-revision-20260816.md` | 保留为证据 | 销售页特定版本验收，未完成项继续如实保留 |
| SRC-070 | `tests/manual/stage-1a-bridge/README.md` | 保留为证据 | 1A Chrome 与公网记录，未执行项不能标记通过 |
| SRC-071 | `tests/manual/teacher-editor-completion/README.md` | 保留为证据 | 旧教师编辑器验收记录 |
| SRC-072 | `tests/manual/teacher-platform-experience-polish/README.md` | 保留为证据 | 旧教师平台体验验收记录 |
| SRC-073 | `tests/manual/teacher-platform-local/README.md` | 保留为证据 | v0.9.1 本地与真实 Chrome 证据，进入迁移基线核查 |
| SRC-074 | `tests/manual/teacher-visual-node-editor/README.md` | 保留为证据 | 旧可视化编辑器验收记录 |

### 3.5 已在归档目录的快照

| ID | 来源 | 状态 | 已知去向或待核对事项 |
| --- | --- | --- | --- |
| SRC-075 | `doc/archive/2026-08-15-pre-stage-one/requirements.md` | 已归档待核对 | 保留整理前完整需求快照，独有事实待与 SRC-002 对照 |
| SRC-076 | `doc/archive/2026-08-15-pre-stage-one/dev-plan.md` | 已归档待核对 | 保留整理前计划，不恢复为当前指令 |
| SRC-077 | `doc/archive/2026-08-15-pre-stage-one/next.md` | 已归档待核对 | 保留当时执行状态，不覆盖当前 `next.md` |
| SRC-078 | `doc/archive/2026-08-18-stage-one-demo/dev-plan.md` | 已归档待核对 | 保留第一阶段 Demo 计划与历史结果 |
| SRC-079 | `doc/archive/2026-08-18-stage-one-demo/next.md` | 已归档待核对 | 保留第一阶段最后执行状态 |
| SRC-080 | `doc/archive/2026-08-18-teacher-platform-nodes-1-7/README.md` | 已归档待核对 | 保留节点 1–7 当时入口和状态 |
| SRC-081 | `doc/archive/2026-08-18-teacher-platform-nodes-1-7/dev-plan.md` | 已归档待核对 | 保留节点 1–7 完整开发计划 |
| SRC-082 | `doc/archive/2026-08-18-teacher-platform-nodes-1-7/next.md` | 已归档待核对 | 保留节点 1–7 执行和验证记录 |

## 4. 已知跨来源冲突

| 冲突域 | 旧资料中的不同表述 | v1 当前处理 |
| --- | --- | --- |
| 产品与品牌 | LessonPilot、AI 学习伴侣、插件、教师平台和 KnownMap 等定位并存 | 以 01 的 KnownMap 互动课程产品边界为需求真源；品牌表达后续设计确认 |
| 课程结构 | 单课程、单视频、多课程、多课节和范围授权并存 | v1 使用课程—课节—视频引用和课程级发布；旧单课程结构只作迁移源 |
| 学生数据 | 服务端学习记录、教师报告和纯本机状态并存 | 第一阶段以本机课程及学习状态为边界，上传与报告留作后续候选 |
| 发布状态 | 文档中的计划、已实现、已上线和待验收口径混合 | 12 要求按代码版本、环境和证据重新确认，不继承旧完成标签 |
| 技术方案 | GitHub Pages、阿里云 ECS、SQLite、固定 ZIP 等具体方案并存 | 作为现状或迁移证据，不预设 v1 目标架构和分发渠道 |
| 需求与设计 | 旧文件常把业务要求、页面方案、字段和实现步骤写在一起 | 分别迁入需求、设计、计划和证据，不整段复制为新权威 |

## 5. 后续处理顺序与完成条件

后续按以下顺序处理，不并行删除来源：

1. 先核对 SRC-001 至 SRC-019 的产品、需求和决策，建立每项独有信息的 v1 去向；
2. 再用 SRC-020 至 SRC-036 建立现状架构、数据、接口、安全、部署和迁移证据；
3. 设计阶段按需核对 SRC-037 至 SRC-054，不让旧页面方案反向改变已接受需求；
4. SRC-055 至 SRC-074 只作为计划和证据审计，旧“已完成”状态必须按 12 重新验证；
5. SRC-075 至 SRC-082 保持只读归档，核对完成后补充回链，不再次搬移。

本登记只有在 82 个来源均有最终状态、独有信息去向、冲突结论和回链，且活跃区无孤立旧权威后才能完成。任何归档或删除另行提交并接受人工审核。

本文件通过后，v1 需求目录骨架完成；下一步是逐来源提取、解决开放项并冻结需求版本，不直接进入产品代码重写。
