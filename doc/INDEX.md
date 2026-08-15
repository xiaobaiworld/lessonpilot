# LessonPilot 文档索引

最近审计：2026-08-15

当前阶段：第一阶段真实验证闭环。其它 Agent 开始工作时，先读本文件，再按“当前权威”顺序阅读。

## 当前权威

| 文档 | 职责 | 状态 |
| --- | --- | --- |
| `README.md` | 项目入口、当前状态、运行命令 | 当前 |
| `doc/requirements.md` | 第一阶段功能、边界和验收 | 当前需求权威 |
| `doc/data-spec.md` | 数据结构、消息协议和本地存储 | 当前数据权威 |
| `doc/stage-one-validation-loop-design.md` | 第一阶段设计、架构与理由 | 已确认设计 |
| `doc/DECISIONS.md` | 方案比较、假设、重开条件和替代关系 | 当前决策权威 |
| `doc/dev-plan.md` | 三个实施计划的顺序和门禁 | 当前计划入口 |
| `next.md` | 唯一当前执行步骤 | 当前任务权威 |

解释冲突时按：需求 -> 数据规范 -> 已确认设计 -> 内容/窗口标准 -> 计划。计划不得覆盖需求。

## 当前标准与参考

| 文档 | 职责 | 状态 |
| --- | --- | --- |
| `doc/node-content-standard.md` | 节点内容完整标准 | 当前参考；第一阶段只实现四种节点子集 |
| `doc/learning-window-standard.md` | 学习窗口展示和交互标准 | 当前参考；第一阶段只实现必要子集 |
| `doc/teacher-sales-page-design.md` | 已验证销售叙事和 CTA | 当前视觉/内容参考；页面路径由新需求覆盖 |
| `doc/teacher-course-workspace-design.md` | 已确认工作台视觉和信息结构 | 当前视觉参考；示例/真实页面职责已被新需求替代 |
| `doc/ui-design.md` | 颜色和基础 UI 规则 | 当前视觉参考；旧页面职责已被新需求替代 |
| `doc/subtitle-pipeline.md` | 字幕来源与本地解析研究 | 当前参考 |
| `doc/bili-mascot-spike.md` | B 站播放器技术 spike | 已验证技术参考，不代表完整运行时 |
| `doc/lessons.md` | 历史问题和方法经验 | 历史参考，部分旧 D0/D1 名称需结合决策解释 |
| `doc/英文面试问答流程（超全！）｜自我介绍 矛盾处理 优缺点 技能.srt` | 当前样例课程的中文 AI 翻译字幕 | 测试/演示数据；英文文案仍需老师复核 |

## 详细实施计划

| 文档 | 可独立验收结果 | 前置 |
| --- | --- | --- |
| `doc/plans/stage-1a-contract-bridge-deploy.md` | 数据契约、存储、消息桥和公网部署可验证 | 当前需求/数据规范 |
| `doc/plans/stage-1b-sales-workspace.md` | 默认销售首页和真实教师工作台可保存课程 | 1A |
| `doc/plans/stage-1c-runtime-e2e.md` | 四种节点在真实 B 站完成端到端预览 | 1A、1B |

## 未来或已部分替代

以下文件保留数据和远期思考，不得作为第一阶段实现指令：

| 文档 | 用途 | 当前状态 |
| --- | --- | --- |
| `doc/design.md` | 旧整体架构和历史数据契约 | 部分替代 |
| `doc/teacher-demo.md` | 旧 D0/D1 老师 Demo 设计 | 已替代为未来参考 |
| `doc/student-runtime.md` | 广义学生工具和数据归属 | 第一阶段外参考 |
| `doc/multi-creator-platform.md` | 多创作者、授权、计费预案 | 远期预案 |
| `doc/promo-video.md` | 完整产品推广视频脚本 | 第二阶段以后 |
| `doc/Digital_Learning_Platforms_竞争情报与定价研究_v0.1.md` | 竞品与定价研究 | 研究资料 |
| `LessonPilot_Creator_Studio_设计建议_v0.1.md` | 早期设计建议 | 历史参考 |

## 完整历史归档

`doc/archive/2026-08-15-pre-stage-one/` 完整保留整理前的：

- `requirements.md`
- `dev-plan.md`
- `next.md`

归档文件只用于追溯。若需恢复其中的独有信息，应先判断它是当前需求、未来候选还是历史事实，再写入对应权威文件，不能直接恢复为当前指令。

## 代码与验证入口

| 路径 | 内容 |
| --- | --- |
| `teacher-web/` | 静态销售页、工作台示例和旧编辑器 |
| `src/` | Chrome MV3 插件 spike 和后续第一阶段实现 |
| `tests/` | Node 自动化测试 |
| `tests/manual/` | 依赖真实浏览器和 B 站的人工探针 |
| `changelog.md` | 仅记录已验证交付的变化 |

## 文档维护规则

- 形成重要决策时更新 `doc/DECISIONS.md`；
- 数据字段或消息变化时先更新 `doc/data-spec.md`；
- 当前范围变化时更新 `doc/requirements.md`，并建立替代关系；
- 每个计划步骤完成后更新 `next.md`、相关权威文档和 changelog；
- 大阶段收口时重新检查长度、重复、孤立文档、失效链接和权威状态，并更新本页审计日期。

## 本次健康审计

2026-08-15 已按“先记录、再整理、最后优化使用”的顺序完成：

- 原 `requirements.md` 约 1009 行且混合当前、历史和未来，已完整归档，并拆为需求、数据规范、决策和三份阶段计划；
- 当前 README、INDEX、next、需求、数据、决策和计划均低于对应软阈值；
- `node-content-standard.md` 为 606 行、`learning-window-standard.md` 为 519 行，处于“关注”级；二者职责仍单一，当前通过索引和第一阶段子集说明保留，下一次实质扩写时复查拆分；
- `multi-creator-platform.md` 为 872 行，处于“整理”级；已评估为远期且非当前权威，本轮先加状态和索引，避免在第一阶段整理中重写未启用方案；启用平台阶段或下次实质修改前必须拆成概览入口、架构和商业化子文档；
- 历史快照保留全部独有内容，归档内旧相对链接按原位置理解，不作为当前导航；
- 新增或移动文档不得只依赖目录猜测，必须同步本索引。
