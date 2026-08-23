# KnownMap 当前下一步

更新时间：2026-08-23

## ✅ 阶段 0 完成：工程基线与干净初始化

7 个工作包全部通过：

1. ✅ **0A**（`39f4945`）：v1 目录骨架
   - 六模块结构（identity、workspace_course、authoring_release、entitlement_delivery、admin_support、runtime_audit）
   - web/extension/contracts 工作区
   - 旧系统完整保持

2. ✅ **0B**（`bb64802`）：版本清单
   - HTTP API、course package、extension messages、storage、builds 版本定义
   - v1.0.0 支持矩阵
   - 版本兼容性规则和检查工具

3. ✅ **0C**（`f9c8f77`）：跨平台契约 JSON Schema
   - course-package.schema.json v2.0.0
   - extension-messages.schema.json v2.0.0
   - extension-storage.schema.json v2.0.0
   - check-contracts.mjs 校验

4. ✅ **0D**（`357c436`）：匿名测试夹具
   - 两教师、两本机身份
   - 重复课节、同视频多课节、多版本发布、多授权源
   - 腐坏契约隔离
   - 8 个夹具验证测试

5. ✅ **0E**（`cca8240`）：数据库初始化与旧 schema 拒绝
   - init_check.py：18 个 v1 表、5 个旧表拒绝清单
   - 迁移链不可回滚（0011 → 0012）
   - 数据库启动门禁

6. ✅ **0F**（`19f2aae`）：仓库级工程门禁
   - v1-gate.mjs 汇总检查
   - 端点、契约、模块、版本一致性

7. ✅ **0G**（`4da25dc`）：CI 集成
   - npm test: 372 测试全部通过
   - npm run check: 所有检查通过
   - v1 与 legacy 互不干扰

## 阶段 0 门禁状态

| 门禁 | 状态 |
|------|------|
| ✅ 旧应用不回归 | 331 个 legacy 测试 pass |
| ✅ v1 骨架可构建 | 所有 v1/ 目录创建成功 |
| ✅ 双端结论一致 | 31 个夹具双端对齐 |
| ✅ 旧数据隔离 | init_check.py 建立拒绝规则 |
| ✅ 静态检查零错误 | endpoint/module/contract/v1 checks pass |

## 正在进行：阶段 1 - 服务端身份与课程领域

进度（7 个工作包，已完成 2 个）：

1. ✅ **1A 完成**（`7f467f4`）：安全基础原语
   - PasswordManager（Argon2）、TokenDigester（HMAC）
   - TimeManager（UTC）、RandomGenerator（secrets）
   - 6 个测试通过

2. ✅ **1B 完成**（`403e68d`）：身份与会话模型
   - AdminAccount、TeacherAccount（密码哈希）
   - AdminSession、TeacherSession（令牌摘要）
   - Workspace（一教师一工作空间）
   - 0012_v1_schema_bootstrap 迁移

待执行：

3. **1C**：课程、课节、视频引用模型
4. **1D**：脚本草稿与节点校验
5. **1E**：路由、应用服务、审计分离
6. **1F**：v1 模块边界零豁免
7. **1G**：特征测试与断点修正

## 之前完成：阶段 0 - 工程基线与干净初始化

设计基线：
- 需求：`doc/requirements/v1/README.md`
- 设计：`doc/design/v1/README.md`
- 执行计划：`doc/plans/v1-code-refactor-execution-plan.md`

阶段 1 工作包（1A-1G）：

1. **1A** — 提取安全基础原语（Argon2、HMAC、随机数）
2. **1B** — AdminAccount、TeacherAccount、Session、Workspace schema
3. **1C** — Course、Lesson、VideoReference 对象模型
4. **1D** — ScriptDraft 聚合与四类节点校验
5. **1E** — 路由与应用服务分离，统一审计
6. **1F** — v1 模块边界零豁免（修法 9 处已知越界）
7. **1G** — 特征测试与 CourseDetail.lessons[] 断点

门禁：两教师交叉权限全拒；停用即时失效会话；重复/同视频课节合法

## 文档与追踪

- 需求追踪矩阵：`doc/traceability/v1-requirements.tsv`（256 个编号）
- 开发规则：`doc/dev-rules.md`
- 索引入口：`doc/INDEX.md`

## 阶段 0 六组工程任务的真实状态

| 任务 | 状态 |
| --- | --- |
| ✅ 目录、职责边界、版本清单 | 完成：工作包 0A、0B；v1/ 子目录、六模块边界、web/extension/contracts workspace、JSON Schema 版本清单 |
| ✅ 课程包、插件消息、HTTP 契约 | 完成：工作包 0C；三份 JSON Schema 真源建立、version manifest 整合、check-contracts.mjs 校验 |
| ✅ 匿名课程测试夹具 | 完成：工作包 0D；31 个场景覆盖、两教师两身份、重复课节、同视频多课节、多授权源、腐坏契约 |
| ✅ 空库 migration、seed、初始化检查 | 完成：工作包 0E；init_check.py 定义 18 个 v1 表、5 个旧表拒绝、迁移链不可回滚 |
| 插件本机存储 Schema、身份和证明接口 | 部分完成：工作包 0C 定义 extension-storage.schema.json；本机证明接口待工作包 4B |
| 秘密、依赖、契约版本和文档检查 | 待执行：工作包 0F/0G（端点、模块、检查工具集成） |

阶段 0 总门禁尚未通过。

## 当前工作顺序

阶段 0 进度（8 个工作包，已完成 5 个）：

1. ✅ **0A 完成**（`39f4945`）：v1 目录骨架与职责边界（web/extension/contracts/backend/app/modules）
2. ✅ **0B 完成**（`bb64802`）：版本清单与支持矩阵（HTTP、course package、extension messages、storage、build versions）
3. ✅ **0C 完成**（`f9c8f77`）：跨平台契约 JSON Schema 真源
   - course-package.schema.json v2.0.0（多课节版本化交付）
   - extension-messages.schema.json v2.0.0（后台/页面消息）
   - extension-storage.schema.json v2.0.0（本机存储结构）
4. ✅ **0D 完成**（`357c436`）：匿名课程测试夹具
   - 两教师、两本机身份、重复课节、同视频多课节
   - 多版本发布、多授权来源、损坏/旧契约
   - 8 个夹具验证测试通过
5. ✅ **0E 完成**（`cca8240`）：v1 数据库入口和旧 schema 拒绝门禁
   - init_check.py 定义数据库初始化规则
   - 18 个 v1 表、5 个旧表拒绝清单
   - 迁移链不可回滚（0011 → 0012）

待执行：

6. **0F**：仓库级工程门禁改造（endpoint/contract/module/dependency 检查工具）
7. **0G**：CI 集成（Ruff、TypeScript、pytest、Node 测试）

之后通过阶段 0 门禁，进入阶段 1：服务端身份、工作空间和课程领域。
阶段 1 需同时清偿 9 处已登记跨模块越界（工作包 `1F`）和修 `CourseDetail.lessons[]`
与 `app.js` 读 `course.lesson` 的断点（工作包 `1G`）。

每个阶段完成后同步需求、设计、代码、测试、追踪矩阵、lessons、changelog，提交并推送。
实现中发现与冻结需求/设计的真实冲突时，先暂停实现并回写决策或设计，不用代码偷偷改范围。

## 当前人工决策边界

- 阶段 0 当前没有待确认的产品或范围决策。`v1/` 目录隔离替换、版本清单、契约骨架、空库检查、匿名夹具和
  自动化检查均按已冻结需求/设计直接执行；阶段 0 结束时只汇总结果，不逐文件请求人工审核；
- 只有实现发现会改变冻结需求/设计的真实冲突，或需要新增兼容承诺、改变用户可见流程时，
  才集中提交人工决策；
- 不需要逐项确认：失效链接、状态漂移、重复说明、命名和编号一致性、已被需求或代码事实
  唯一决定的内容；
- 每次最多集中提交 5 项真正的产品或工程取舍。

## 待处理的遗留事项

- `doc/英文面试问答流程...srt`（`SRC-054`）权利未核验。按 `D-V1-008`，取得权利证据或
  替换为可证明授权/自制的匿名素材前，不得进入任何发布物；建立课程夹具时不要引用它。
- `backend/app/` 是冻结旧系统，仍按技术分层平铺，与设计 03 第 7 节的六个业务模块边界不一致。
  表归属已在 03 第 7.0 节定义，9 处已知越界登记在 `tools/module-check.mjs` 的
  `KNOWN_VIOLATIONS` 并附修法，只作现状反例，不在旧目录重构。新增越界会导致测试失败。
  v1 从 `v1/backend/app/modules/<domain>/` 零豁免建立，时机见代码重构执行计划。

## 阶段入口与历史

- 文档总索引：`doc/INDEX.md`；
- 项目开发规则：`doc/dev-rules.md`；
- 需求真源：`doc/requirements/v1/README.md`；
- 设计真源：`doc/design/v1/README.md`；
- 上一阶段完整执行记录：`doc/archive/2026-08-22-pre-v1-design/next.md`。
