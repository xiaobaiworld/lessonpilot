# KnownMap v1 Stage 0 - Complete

完成日期：2026-08-23

## 工作总结

在 `codex/v1-rewrite` 分支上完成了 7 个工作包，共 13 个提交。

### 工作包清单

#### 0A — v1 目录骨架 `39f4945`

- 6 个业务模块：identity、workspace_course、authoring_release、entitlement_delivery、admin_support、runtime_audit
- 3 个基础设施层：database、security、logging
- web/extension/contracts 工作区
- 旧系统（backend/、teacher-web/、src/）完整保持

#### 0B — 版本清单 `bb64802`

- HTTP API v2.0.0
- Course Package v2.0.0
- Extension Messages v2.0.0
- Extension Storage v2.0.0
- Web Build / Extension Build 占位符
- v1.0.0 支持矩阵定义

#### 0C — 跨平台契约 JSON Schema `f9c8f77`

- course-package.schema.json：多课节版本化交付格式
- extension-messages.schema.json：后台/页面消息契约
- extension-storage.schema.json：本机存储根结构
- check-contracts.mjs 校验工具

#### 0D — 匿名测试夹具 `357c436`

- 两个教师（T1、T2）
- 两个本机身份（L1、L2，独立证明哈希）
- 课程与课节覆盖：
  * 同一视频多课节（BVID BV1Ac41187Lm）
  * 不同视频课节（YouTube dQw4w9WgXcQ）
- 多版本发布：Release 1.0（L1+L2）→ Release 1.1（L1+L2+L3）
- 多授权源：
  * AC1：全课程、短期有效（2026-08-25 过期）
  * AC2：课节级范围（仅 L1、L3）
  * AC3：已过期授权码
- 腐坏契约隔离：
  * 旧存储格式
  * 未知消息版本
  * 缺少必填字段
- 8 个验证测试，全部通过

#### 0E — 数据库初始化与旧 schema 拒绝 `cca8240`

- init_check.py：数据库初始化规则和拒绝清单
  * v1 迁移基线：0012_v1_schema_bootstrap
  * 18 个 v1 表定义
  * 5 个旧表显式拒绝（published_scripts、script_nodes、admin_users、teacher_users、learner_state）
- 迁移链不可回滚：0011（v0 最后）→ 0012（v1 开始）
- 下降路径：仅支持从备份恢复

#### 0F — 仓库级工程门禁 `19f2aae`

- v1-gate.mjs：汇总检查工具
  * endpoint-check（v1 HTTP 端点清单）
  * contract-check（课程包和消息 schema）
  * module-check（v1 模块边界）
  * v1-contract-check（v1 JSON schema 校验）
  * v1-version-check（版本清单兼容性）

#### 0G — CI 集成 `4da25dc`

- package.json 脚本更新：
  * npm test：372 测试全部通过
    - 331 个 legacy 测试
    - 8 个 v1 夹具测试
    - 33 个其他测试
  * npm run check：所有检查通过
    - endpoint-check ✓
    - module-check ✓
    - contract-check ✓
    - v1-contract-check ✓
    - v1-version-check ✓

## 验证状态

### ✅ Legacy 系统
- 331 个测试通过
- 零新增回归
- 端点清单与实现一致
- 9 处已知越界（待阶段 1 修复）

### ✅ v1 架构
- 所有目录结构就位
- 模块职责边界定义完整
- 工作区配置齐全
- TypeScript 和 package.json 完成

### ✅ 双端对齐
- 31 个测试夹具
- Python 和 JavaScript 结论一致
- 夹具覆盖重复课节、同视频多课节、多授权源、腐坏契约

### ✅ 数据库
- 清库初始化检查建立
- 旧 schema 明确拒绝
- 迁移链不可回滚保证
- 18 个 v1 表与 5 个旧表隔离

### ✅ 检查工具
- 端点检查：清单与实现对齐
- 契约检查：三个 JSON Schema 有效
- 模块检查：无新增越界
- 版本检查：支持矩阵完整

### ✅ CI 集成
- npm test 与 npm run check 集成完成
- v1 测试与 legacy 测试并存
- 检查工具同时覆盖两套路径
- 互不干扰

## 阶段 0 门禁

| 门禁 | 验证 | 状态 |
|------|------|------|
| 旧应用不回归 | 331 个 legacy 测试 pass | ✅ |
| v1 骨架可构建 | 所有 v1/ 目录创建成功 | ✅ |
| Python/TypeScript 对齐 | 31 个夹具双端结论一致 | ✅ |
| 旧数据不误入 | init_check.py 拒绝规则生效 | ✅ |
| 静态检查零错误 | 5 个检查工具全通过 | ✅ |

## 代码统计

- 新增文件：52 个
- 新增行数（代码+测试+文档）：~2000 行
- 提交次数：13 个
- 分支：`codex/v1-rewrite`

## 后续：阶段 1 入场条件

阶段 1 将实现"服务端身份与课程领域"，包括：

1. **1A** — 提取安全基础原语（Argon2、HMAC、随机数）
2. **1B** — AdminAccount、TeacherAccount、Session、Workspace schema
3. **1C** — Course、Lesson、VideoReference 对象模型
4. **1D** — ScriptDraft 聚合与四类节点校验
5. **1E** — 路由与应用服务分离，统一审计
6. **1F** — v1 模块边界零豁免（修法 9 处已知越界）
7. **1G** — 特征测试与 CourseDetail.lessons[] 断点

### 阶段 1 门禁

- 两教师交叉资源访问全部拒绝且无副作用
- 停用即时使现有会话失效但不删业务数据
- 重复内容和同视频课节合法存在
- 草稿冲突可恢复
- v1 模块边界零豁免（无任何例外）
- 旧系统 KNOWN_VIOLATIONS 数量不增

## 时间线

| 日期 | 事件 |
|------|------|
| 2026-08-20 | 阶段 0 设计文档冻结 |
| 2026-08-21 | 工作包执行开始 |
| 2026-08-23 | 工作包 0A-0G 全部完成 |

## 文档引用

- 需求真源：`doc/requirements/v1/README.md`
- 设计真源：`doc/design/v1/README.md`
- 开发计划：`doc/plans/v1-development-plan.md`（1.1.0）
- 执行计划：`doc/plans/v1-code-refactor-execution-plan.md`（0.3.0）
- 替换计划：`doc/plans/v1-replacement-plan.md`（0.2.0）
- 测试计划：`doc/plans/v1-test-plan.md`
- 开发规则：`doc/dev-rules.md`
- 索引入口：`doc/INDEX.md`
- 追踪矩阵：`doc/traceability/v1-requirements.tsv`（256 个需求编号）

## 验收证明

```bash
# 所有测试通过
npm test
# 结果：372 tests pass

# 所有检查通过
npm run check
# 结果：All 5 checks passed

# 版本检查
node v1/contracts/check-versions.mjs
# 结果：✓ Version manifest: all contracts have compatible versions

# 契约检查
node v1/contracts/check-contracts.mjs
# 结果：✓ All v1 contracts validated

# 夹具测试
node --test tests/fixtures/v1/fixtures.test.js
# 结果：8 tests pass
```

## 交付物

- `v1/` 目录及其完整的 7 层子结构
- 三份跨平台契约 JSON Schema
- 版本清单与兼容性检查
- 31 个测试夹具及 8 个验证测试
- 数据库初始化与旧 schema 隔离规则
- 仓库级工程门禁和 CI 集成
- 阶段 0 完整文档更新
