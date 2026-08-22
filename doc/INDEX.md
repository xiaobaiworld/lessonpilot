# KnownMap 文档索引

最近审计：2026-08-22

当前阶段：v1 需求已按 `D-V1-010` 修订并重新冻结为 `1.0.2`，正在根据冻结需求、实际程序和旧资料证据建立 v1 设计文档体系。
现有教师平台、插件和部署文档继续用于说明当前实现与迁移事实，但不再反向覆盖 v1 需求；在 v1 设计
通过审核前，不开始产品代码重写。其它 Agent 开始工作时，先读本文件，再按“当前权威”顺序阅读。

## 当前权威

| 文档 | 职责 | 状态 |
| --- | --- | --- |
| `README.md` | 项目入口、当前状态、运行命令 | 当前 |
| `doc/requirements/v1/README.md` | v1 已冻结需求目录、审核状态和旧资料提取入口 | v1 需求真源；版本 `1.0.2` |
| `doc/design/v1/README.md` | v1 设计文件编号、权威顺序、审核与归档门禁 | 当前设计入口；持续维护 |
| `doc/design/v1/01-current-system-assessment.md` | 当前代码、验证证据、可继承经验和原型负担评估 | 已接受；版本 `1.0.1`；不定义目标架构 |
| `doc/design/v1/02-legacy-document-register.md` | 82 个旧来源的演化、价值、冲突和最终去向 | 已接受；旧文件待新真源承接后归档 |
| `doc/design/v1/03-system-architecture.md` | v1 模块化单体、多个客户端、信任边界和部署拓扑 | 已接受；版本 `1.0.1` |
| `doc/design/v1/04-domain-data-model.md` | v1 领域对象、身份、关系、数据位置和约束 | 已接受；版本 `1.0.0` |
| `doc/design/v1/05-data-flow-lifecycle.md` | v1 课程发布、授权兑换、安装、更新、离线、保留和恢复数据流 | 已接受；版本 `1.0.0` |
| `doc/design/v1/06-interface-contracts.md` | v1 HTTP API、插件消息、课程包、文件、宿主和外部表单契约 | 已接受；版本 `1.0.0` |
| `doc/design/v1/07-product-interaction-state.md` | v1 页面职责、教师/学生流程、交互状态和失败恢复 | 已接受；版本 `1.0.0` |
| `doc/decisions/2026-08-21-v1-public-trial-intake.md` | 公开销售页与飞书试用申请纳入 v1 P0 的范围决定 | 已接受 |
| `doc/decisions/2026-08-21-v1-no-ai-authoring.md` | v1 完全排除 AI 辅助制作 | 已接受 |
| `doc/decisions/2026-08-21-v1-basic-student-runtime.md` | v1 学生端保持基础运行闭环 | 已接受 |
| `doc/decisions/2026-08-21-v1-plugin-distribution.md` | v1 固定 ZIP 手动分发与更新 | 已接受 |
| `doc/decisions/2026-08-22-v1-success-gates.md` | v1 产品闭环与市场价值观察门槛 | 已接受 |
| `doc/decisions/2026-08-22-v1-data-retention.md` | v1 数据保留、导出与删除 | 已接受 |
| `doc/decisions/2026-08-22-v1-infrastructure-target.md` | v1 基础设施目标 | 已接受 |
| `doc/decisions/2026-08-22-v1-content-rights.md` | v1 课程内容权利与争议处置 | 已接受 |
| `doc/decisions/2026-08-22-v1-compatibility-scope.md` | v1 Chrome/B 站兼容范围 | 已接受 |
| `doc/decisions/2026-08-22-v1-repeated-video-lessons.md` | v1 课节内容重复安排与同视频多课节边界 | 已接受 |
| `doc/decisions/2026-08-22-v1-data-persistence-strategy.md` | v1 脚本/发布聚合 JSON 与本机学习记录策略 | 已接受，待 v1 实施验证 |
| `doc/requirements/teacher-platform-local-stage.md` | 当前教师平台、学生插件和生产闭环的范围、验收和非目标 | 当前实施需求权威 |
| `doc/AI_Learning_Companion_Product_Function_Spec_v0.2.md` | 教师中心平台化产品功能、授权码下载/更新语义和验收方向 | 长期产品规格；本地最小切片已部分实现 |
| `doc/decisions/2026-08-18-teacher-centered-product-v0.2.md` | v0.2 教师账号、工作空间、本地课程和授权码决策过程 | 已接受；当前只实现本地最小切片 |
| `doc/decisions/2026-08-18-teacher-platform-local-slice.md` | 当前本地教师发布、授权码下载切片的范围决策 | 已接受；教师侧已验证，插件侧待完整人工验收 |
| `doc/teacher-platform-architecture.md` | FastAPI、SQLite、管理员、教师端、插件和数据边界 | 当前架构 |
| `doc/data-spec.md` | 数据规范总入口、权威顺序、结构摘要和当前/目标边界 | v0.9.1 当前实现与迁移证据；不定义 v1 目标 |
| `doc/data/model.md` | 数据库 ER 模型、约束、课程包及目标模型 | v0.9.1 当前实现与迁移证据；不定义 v1 目标 |
| `doc/data/dictionary.md` | 数据库、API、插件存储和结构化文件字段字典 | v0.9.1 当前实现与迁移证据；不定义 v1 目标 |
| `doc/data/flow.md` | 创建、发布、授权下载、学习状态、日志和发布血缘 | 当前实现 + 迁移路径 |
| `doc/data/quality.md` | 校验矩阵、数据质量、已知漂移和变更门禁 | v0.9.1 当前实现与迁移证据；不定义 v1 目标 |
| `doc/teacher-platform-data-spec.md` | 旧教师数据规范入口 | 兼容指针 |
| `doc/teacher-platform-api-spec.md` | 管理员/教师认证、教师账号管理、课程发布、授权码和插件下载 API | 当前 API 与插件客户端实现 |
| `doc/student-plugin-course-delivery-design.md` | 单课程授权领取、工具栏首页、本地学习状态和打开 B 站课程页 | `0.9.1` 已实现核心路径；边界验收待收口 |
| `doc/student-plugin-release-design.md` | 学生插件固定 ZIP 下载地址、发布、手动更新和回滚 | 已接受；代码已实现，生产部署待验证 |
| `doc/decisions/2026-08-18-student-plugin-single-course-delivery.md` | 学生插件单课程、可重复授权码和本地学习数据决策过程 | 已接受；核心实现完成 |
| `doc/teacher-platform-dev-plan.md` | 单课程节点 8–9 的剩余验收和生产闭环门禁 | 未完成的兼容收口计划 |
| `docs/superpowers/plans/2026-08-20-multi-course-authorization-and-example-course.md` | UUID、多课节、范围授权、多课程存储和示例课程 | 当前实施计划 |
| `doc/teacher-visual-node-editor-design.md` | 教师组件注册、横向时间轴、点击/拖放添加和字幕上下文设计 | 已实现并完成本地验证 |
| `doc/plans/teacher-visual-node-editor.md` | 节点 7 可视化编辑器修正的任务、测试、日志和收口步骤 | 已完成 |
| `doc/teacher-platform-experience-polish-design.md` | “KnownMap 互动课程工具”命名、登录、课程首页和编辑工作面体验校正 | 已实现并完成本地验证 |
| `doc/teacher-editor-completion-design.md` | 真实 08:33 时间线、右下快捷操作和授权码分类历史 | 已实现并完成本地验证 |
| `doc/teacher-timeline-reference-parity-design.md` | 官网示例时间线、固定课程字幕、节点连线与 SVG 小图标对齐 | 已实现；自动化通过，浏览器刷新后视觉复核待完成 |
| `doc/plans/teacher-platform-experience-polish.md` | 教师应用体验校正的测试、实现、浏览器验收和提交步骤 | 已完成 |
| `doc/knownmap-brand-lockup-refinement-design.md` | Logo 内部留白、互动课程工具称呼和 K/M 字标配色 | 已实现并完成本地验证 |
| `doc/plans/knownmap-brand-lockup-refinement.md` | 品牌组合标识修正的资源、页面、测试和验收步骤 | 已完成 |
| `doc/security/2026-08-20-production-security-audit.md` | 仓库、发布链路、阿里云 ECS 与残余风险审计 | 已完成并部署验证 |
| `doc/web-production-release-design.md` | `knownmap.com` 的 GitHub SHA 固定、发布记录和回滚规则 | 已实现并完成生产验证 |
| `doc/plans/web-production-release-traceability.md` | Web 生产发布工具、记录、标签和回滚验收步骤 | 已完成 |
| `doc/requirements/stage-1a.md` | 公网路径、共享契约、插件存储和安全消息桥 | 历史原型阶段；代码已合并 |
| `doc/requirements/stage-1b.md` | 销售首页、真实工作台、字幕和节点制作 | 历史原型阶段；部分已交付 |
| `doc/requirements/stage-1c.md` | B 站运行时、四种节点和端到端预览 | 历史原型阶段；部分已交付 |
| `doc/stage-one-validation-loop-design.md` | 第一阶段原型设计、架构与理由 | 历史设计参考 |
| `doc/DECISIONS.md` | 方案比较、假设、重开条件和替代关系 | 当前决策权威 |
| `docs/superpowers/specs/2026-08-20-course-identity-and-storage-design.md` | 课程 UUID 身份、未来本地课程包和资源存储边界 | 已接受；待实施 |
| `docs/superpowers/specs/2026-08-20-teacher-account-admin-design.md` | 超级管理员、教师账号创建/重置、课程统计和 `admin.html` 工作台 | 已接受；后端已实现，界面与部署待完成 |
| `doc/archive/2026-08-18-stage-one-demo/dev-plan.md` | 第一阶段销售页和原型 Demo 计划 | 已归档；只用于追溯 |
| `doc/archive/2026-08-18-stage-one-demo/next.md` | 第一阶段最后执行步骤 | 已归档；不作为当前任务 |
| `doc/archive/2026-08-18-teacher-platform-nodes-1-7/dev-plan.md` | 教师平台节点 1–7 完整开发计划 | 已归档；只用于追溯 |
| `doc/archive/2026-08-18-teacher-platform-nodes-1-7/next.md` | 教师平台节点 1–7 执行与验证记录 | 已归档；不作为当前任务 |
| `next.md` | v1 设计文档准备、人工决策边界和执行顺序 | 当前任务权威 |
| `docs/superpowers/specs/2026-08-18-knownmap-brand-update-design.md` | KnownMap 名称、域名、Logo 几何、颜色和迁移边界 | 当前品牌设计权威 |
| `docs/knownmap-logo-resources.md` | Logo 形态、颜色含义、使用场景和资源落点 | 当前 Logo 资源说明 |
| `docs/superpowers/plans/2026-08-18-knownmap-brand-update.md` | KnownMap 品牌资源、页面、文档和验证实施计划 | 当前品牌实施计划 |

本表仍保留旧系统在重构切换前需要使用的运行入口，但它们不再与 v1 需求和已接受设计并列为
目标真源。精确权威顺序见 `doc/design/v1/README.md`；旧文件最终动作见
`doc/design/v1/02-legacy-document-register.md`。

## 当前标准与参考

| 文档 | 职责 | 状态 |
| --- | --- | --- |
| `doc/node-content-standard.md` | 节点内容完整标准 | 当前参考；第一阶段只实现四种节点子集 |
| `doc/learning-window-standard.md` | 学习窗口展示和交互标准 | 当前参考；第一阶段只实现必要子集 |
| `doc/teacher-sales-page-design.md` | 已验证销售叙事和 CTA | 当前视觉/内容参考；页面路径由新需求覆盖 |
| `doc/trial-intake-form-design.md` | 飞书真实课程试用表单的字段、权限、网页模块和验收 | 当前表单设计权威；已发布并验收匿名访问 |
| `doc/teacher-course-workspace-design.md` | 已确认工作台视觉和信息结构 | 当前视觉参考；示例/真实页面职责已被新需求替代 |
| `doc/ui-design.md` | 颜色和基础 UI 规则 | 当前视觉参考；旧页面职责已被新需求替代 |
| `doc/subtitle-pipeline.md` | 字幕来源与本地解析研究 | 当前参考 |
| `doc/bili-mascot-spike.md` | B 站播放器技术 spike | 已验证技术参考，不代表完整运行时 |
| `doc/lessons.md` | 历史问题和方法经验 | 历史参考，部分旧 D0/D1 名称需结合决策解释 |
| `doc/英文面试问答流程（超全！）｜自我介绍 矛盾处理 优缺点 技能.srt` | 当前样例课程的中文 AI 翻译字幕 | 测试/演示数据；英文文案仍需老师复核 |

## 当前实施计划

| 文档 | 可独立验收结果 | 前置 |
| --- | --- | --- |
| `docs/superpowers/plans/2026-08-20-multi-course-authorization-and-example-course.md` | UUID 课程包、多课节、范围授权、多课程存储和示例课程 | 当前执行计划 |
| `docs/superpowers/plans/2026-08-20-teacher-account-admin.md` | 超级管理员、教师账号管理、文档、页面和生产部署 | 当前执行计划 |
| `doc/teacher-platform-dev-plan.md` | 单课程插件授权下载、运行和公网闭环 | 兼容路径仍需收口 |
| `doc/student-plugin-course-delivery-design.md` | 单课程插件领取、覆盖、工具栏首页和本地状态 | `0.9.1` 兼容基线 |
| `next.md` | 超级管理员与教师账号管理步骤及遗留验收门禁 | 当前执行入口 |

## 已完成阶段计划

| 文档 | 可独立验收结果 | 前置 |
| --- | --- | --- |
| `doc/plans/stage-1a-contract-bridge-deploy.md` | 数据契约、存储、消息桥和公网部署可验证 | 已实施；历史阶段 |
| `tests/manual/stage-1a-bridge/README.md` | 1A 真实 Chrome 与公网人工验证记录 | V1 与 V7 发布/路径已通过；V2–V6 待执行，是 1A 完成门禁 |
| `doc/plans/stage-1b-sales-page-revision.md` | 销售页私信 CTA、飞书表单和真实试用承诺 | 已完成二次交付；公开表单与入口模块已验收 |
| `tests/manual/sales-page-revision-20260816.md` | 销售页修订的自动化与浏览器验证记录 | 剩剪贴板与 CTA 两项待本机确认 |
| `doc/plans/stage-1b-sales-workspace.md` | 默认销售首页和真实教师工作台可保存课程 | 历史原型阶段；部分已交付 |
| `doc/plans/stage-1c-runtime-e2e.md` | 四种节点在真实 B 站完成端到端预览 | 历史原型阶段；部分已交付 |

## 未来或已部分替代

以下文件保留历史数据和远期思考，不得作为当前教师平台本地阶段实现指令：

| 文档 | 用途 | 当前状态 |
| --- | --- | --- |
| `doc/design.md` | 旧整体架构和历史数据契约 | 部分替代 |
| `doc/teacher-demo.md` | 旧 D0/D1 老师 Demo 设计 | 已替代为未来参考 |
| `doc/student-runtime.md` | 广义学生工具和数据归属 | 第一阶段外参考 |
| `doc/multi-creator-platform.md` | 多创作者、授权、计费预案 | 远期预案 |
| `doc/promo-video.md` | 完整产品推广视频脚本 | 第二阶段以后 |
| `doc/AI_Learning_Companion_Product_Function_Spec_v0.1.md` | 教师中心调整前的产品功能规格 | 历史基线；已由 v0.2 替代 |
| `doc/Digital_Learning_Platforms_竞争情报与定价研究_v0.1.md` | 竞品与定价研究 | 研究资料 |
| `AI_Brand_Naming_Project.md` | KnownMap 命名研究过程 | 历史品牌研究 |
| `AI_Brand_Domain_Selection_Report_v0.1.md` | 品牌域名筛选报告 | 历史品牌研究 |
| `LessonPilot_Creator_Studio_设计建议_v0.1.md` | 旧文件名保留的早期设计建议 | 历史参考；品牌已由 D-014 替代 |

## 完整历史归档

`doc/archive/2026-08-15-pre-stage-one/` 完整保留整理前的：

- `requirements.md`
- `dev-plan.md`
- `next.md`

`doc/archive/2026-08-18-stage-one-demo/` 保留第一阶段收尾时的：

- `dev-plan.md`
- `next.md`

`doc/archive/2026-08-18-teacher-platform-nodes-1-7/` 保留当前阶段教师侧收口时的：

- `dev-plan.md`
- `next.md`
- `README.md`

归档文件只用于追溯，不得覆盖当前教师平台需求、架构和开发计划。

归档文件只用于追溯。若需恢复其中的独有信息，应先判断它是当前需求、未来候选还是历史事实，再写入对应权威文件，不能直接恢复为当前指令。

## 代码与验证入口

| 路径 | 内容 |
| --- | --- |
| `teacher-web/` | 静态销售页和当前教师工作台 |
| `backend/` | 当前 FastAPI、SQLite、migration 和教师平台 API |
| `src/shared/` | 网页与插件共用的课程契约、消息协议和来源白名单（唯一事实源） |
| `src/background/` | 插件后台存储与五个操作处理器 |
| `src/content/` | 工作台消息桥内容脚本，以及 B 站运行时 spike |
| `tools/assemble-workspace.js` | 把 `src/shared/` 复制到 `teacher-web/shared/`，本地与公网加载同一路径 |
| `tools/web-release.sh` | 从精确 GitHub 提交发布静态销售页/教师工作台，查询历史并原子回滚 |
| `tools/teacher-platform-release.sh` | 从同一精确 GitHub 提交发布教师工作台和 FastAPI 到阿里云 ECS |
| `deploy/teacher-platform/` | 教师 API systemd、Nginx、SQLite 备份 timer 和生产部署说明 |
| `deploy/releases/` | 每次成功 Web 生产发布的一文件一记录 |
| `deploy/releases/README.md` | 生产发布记录的字段、命名和维护说明 |
| `tests/` | Node 自动化测试 |
| `tests/manual/` | 依赖真实浏览器和 B 站的人工探针 |
| `tests/manual/teacher-platform-experience-polish/README.md` | 互动课程工具登录、状态隔离、键盘、字幕、发布锁和三档响应式验收 |
| `changelog.md` | 仅记录已验证交付的变化 |

## 文档维护规则

- 形成重要决策时更新 `doc/DECISIONS.md`；
- 数据字段、文件、消息、存储键或迁移变化时先更新 `doc/data-spec.md` 及对应 `doc/data/` 子文档；
- 当前教师平台范围变化时更新 `doc/requirements/teacher-platform-local-stage.md`，历史第一阶段文档只做追溯；
- API 变化时同步 `doc/teacher-platform-api-spec.md`；
- 每个计划步骤完成后更新 `next.md`、相关权威文档和 changelog；
- 大阶段收口时重新检查长度、重复、孤立文档、失效链接和权威状态，并更新本页审计日期。

## 2026-08-18 教师平台节点 1–7 收口

- 根 `next.md` 从 225 行已完成历史压缩为节点 8 的当前交接单；
- 节点 1–7 的完整 `next.md` 和开发计划已移入 `doc/archive/2026-08-18-teacher-platform-nodes-1-7/`；
- 当前开发计划只保留节点 8、节点 9、测试和阶段收口门禁；
- 旧 `doc/requirements.md` 的“当前实施 1A”状态已校正为历史入口；
- 架构、API 和当前需求已明确教师端已验证、插件客户端和完整本地闭环未完成；
- 当前未完成事项没有被清空，下一步仍由根 `next.md` 指向节点 8。
- `doc/AI_Learning_Companion_Product_Function_Spec_v0.2.md` 为 1121 行，超过 600 行软阈值并进入重构审计级别。本次保留单文件，因为它是 2026-08-18 已确认的连续产品基线，当前开发只读取其实现切片，临近节点 8 时拆分会增加引用迁移和遗漏风险。当前权威入口仍是该文件，推荐按“教师账号”“课程”“授权码”“学习记录”“教师后台”等二级标题检索。进入学生身份/学习数据阶段或下一次实质扩写前，必须拆为概览、教师课程、授权和学习数据子文档，并保留 v0.2 原文归档。
- `doc/DECISIONS.md` 当前 385 行，已超过决策总表软阈值。本轮只同步既有决策状态，不拆历史；
  下一条新决策应优先写入 `doc/decisions/` 独立文件，并在总表保留摘要和链接。

## 2026-08-18 事实同步

本轮只校正文档与已合并代码、已发布公网之间的漂移，不新增文档、不改产品代码：

- 自动化测试数由 135 更新为 200（`node --test tests/*.test.js` 实测 200 pass / 0 fail）；
- PR #1 已于 2026-08-15 合并，`next.md` 里「等你确认后再合并」和「合并后才能验证公网」的前置条件均已解除；
- `pages` 工作流 2026-08-16 首次发布成功；实测销售页、工作台页和两个共享契约返回 200，`/doc/`、`/src/` 返回 404，站点根返回 404；
- 1A 人工验证记录的扩展版本由 0.7.0 更正为 0.8.0，分支由 `stage-1a-contract-bridge-deploy` 更正为 `main`，V7 的发布与路径部分填入实测结果；
- 发布集实际为 8 个文件（销售页及其两个脚本在 1B 修订时加入），原「只含 5 个文件」的预期已按事实修正而非当作缺陷；
- 1B 状态由「未开始」细化为「销售页修订已交付、工作台未开始」，并把销售页修订计划与其人工验证记录纳入索引。

## 2026-08-15 健康审计

2026-08-15 已按“先记录、再整理、最后优化使用”的顺序完成：

- 原 `requirements.md` 约 1009 行且混合当前、历史和未来，已完整归档，并拆为需求、数据规范、决策和三份阶段计划；
- 当前 README、INDEX、next、需求总览、三个阶段需求、数据、决策和计划均低于对应软阈值；
- `node-content-standard.md` 为 606 行、`learning-window-standard.md` 为 519 行，处于“关注”级；二者职责仍单一，当前通过索引和第一阶段子集说明保留，下一次实质扩写时复查拆分；
- `multi-creator-platform.md` 为 872 行，处于“整理”级；已评估为远期且非当前权威，本轮先加状态和索引，避免在第一阶段整理中重写未启用方案；启用平台阶段或下次实质修改前必须拆成概览入口、架构和商业化子文档；
- 历史快照保留全部独有内容，归档内旧相对链接按原位置理解，不作为当前导航；
- 新增或移动文档不得只依赖目录猜测，必须同步本索引。
