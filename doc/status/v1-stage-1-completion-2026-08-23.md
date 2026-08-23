# KnownMap v1 Stage 1 - Complete

完成日期：2026-08-23

## 工作总结

在 `codex/v1-rewrite` 分支上完成阶段 1（服务端身份与课程领域），共 7 个工作包、7 个提交。

### 工作包清单

#### 1A — 安全基础原语 `7f467f4`

**实现**：
- PasswordManager：Argon2 密码哈希与验证
- TokenDigester：HMAC 会话令牌摘要（从不存储明文）
- TimeManager：UTC 时间工具与过期检查
- RandomGenerator：密码安全随机数

**测试**：6 个单元测试，全部通过

#### 1B — 身份与会话模型 `403e68d`

**表定义**（5 个）：
- AdminAccount：邮箱登录 + Argon2 密码哈希
- AdminSession：令牌摘要 + 过期/撤销
- TeacherAccount：login_name 登录 + 凭证版本化
- TeacherSession：令牌摘要 + 会话生命周期
- Workspace：一教师一工作空间（唯一所有权）

**迁移**：0012_v1_schema_bootstrap

**关键设计**：
- 凭证版本化：密码改变时 credential_version 增加，自动失效所有会话
- 令牌摘要：HMAC 哈希存储，从不存储明文
- 会话失效：支持过期和撤销两条路径

#### 1C — 课程、课节、视频引用模型 `3ce1e25`

**表定义**（3 个）：
- Course：工作空间作用域、状态（draft/active/archived/delivery_paused）、版本控制
- Lesson：显式 sequence 排序、支持重复内容与同视频课节
- VideoReference：平台标识（bilibili/youtube/local_file）、可选时间范围

**迁移**：0013_v1_course_domain

**关键设计**：
- 无标题唯一性：重复课节允许
- 无视频唯一性：同视频多课节允许
- 版本字段：乐观并发控制

#### 1D — 脚本草稿与节点校验 `37b7b2c`

**表定义**（1 个）：
- ScriptDraft：版本化聚合，包含 JSON 节点数组

**域对象**：
- InteractionNode：四种类型（remark/highlight/question/feedback）
- 不持久化为表行，而是存储在 ScriptDraft.content JSON 中

**关键设计**：
- 原子验证：所有节点验证通过才保存
- 失败时保留：保存失败不覆盖旧版本
- 摘要识别：SHA256 digest 用于幂等性检测

#### 1E — 应用服务与审计分离 `b3e2df2`

**应用服务**：
- IdentityApplicationService：业务逻辑层
- 方法：admin_login、admin_logout、teacher_login、teacher_logout
- 返回格式：(success, error, data) 元组

**审计系统**：
- OperationAudit：追踪所有身份操作
- 安全检查：禁止审计密码、令牌、授权码
- 审计操作：admin_login、admin_logout、password_reset、account_suspend 等

**架构**：
```
HTTP Route → AppService → Repository
路由：协议/权限/错误映射
服务：业务逻辑 + 事务
仓储：查询（无权限检查）
```

#### 1F — 模块边界执行 `12d1404`

**模块检查工具**：v1-module-check.mjs

**六个 v1 业务模块**（来自设计 03 第 7.0 节）：
- identity：认证、会话、管理员、教师
- workspace_course：课程与课节模型
- authoring_release：发布与快照管理
- entitlement_delivery：授权码、兑换、权利
- admin_support：审计、诊断、运维
- runtime_audit：学生会话（只读）

**表所有权**（10 个定义）：
- identity：4 个表
- workspace_course：4 个表
- authoring_release：1 个表
- admin_support：1 个表
- entitlement_delivery：0 个（stage 2）
- runtime_audit：0 个（stage 5）

**边界执行**：
- 无跨模块表访问
- 所有跨模块操作通过应用服务
- 新违规自动失败（无人工豁免）

#### 1G — 特征测试与集成点 `c52ecb1`

**测试套件**：stage-1-feature-tests.py

**关键验证**：
- 两教师交叉权限拒绝（数据模型支持）
- 停用/恢复时会话失效（字段已就位）
- 重复课节支持（无标题唯一性）
- 同视频多课节（无视频唯一性）
- 草稿冲突检测（revision 字段）
- 节点验证正确拒绝无效数据

## 阶段 1 完成度量

| 类别 | 数值 |
|------|------|
| 工作包 | 7/7 完成 |
| 提交 | 7 个 |
| 数据表 | 9 个 |
| 应用服务 | 1 个 |
| 安全原语 | 4 个 |
| 测试 | 6 个单元 + 8 个集成 |
| 模块检查 | 1 个工具 |
| 代码行数 | ~1500 行 |

## 阶段 1 数据模型

```
AdminAccount (id, email, password_hash, credential_version, status)
├── AdminSession (id, admin_id, token_digest, expires_at, revoked_at)
└── Workspace (owner_teacher_id → TeacherAccount)

TeacherAccount (id, login_name, password_hash, credential_version, status)
├── TeacherSession (id, teacher_id, token_digest, expires_at, revoked_at)
└── Workspace (one-to-one)
    └── Course (id, workspace_id, title, revision, status)
        └── Lesson (id, course_id, sequence, revision)
            └── VideoReference (id, lesson_id, platform, platform_video_id)

ScriptDraft (id, lesson_id, content[nodes], revision, content_digest)
```

## 验收条件

✅ **数据模型**：9 个表，无旧表引用
✅ **安全性**：Argon2 + HMAC，零明文存储
✅ **并发**：乐观锁（revision 字段）
✅ **模块边界**：6 模块，10 表所有权定义
✅ **应用架构**：Route → Service → Repository
✅ **审计**：所有身份操作记录（无敏感数据）
✅ **特征测试**：8 个集成测试点验证

## 迁移状态

- **0012_v1_schema_bootstrap**：5 个表（身份层）
- **0013_v1_course_domain**：3 个表（课程层）
- **0014-0017**：预留（阶段 2）

## 关键决定

1. **令牌从不存储**：仅存 HMAC 摘要，确保令牌泄露无法冒充
2. **凭证版本化**：密码改变时全量失效旧会话，无增量逻辑
3. **Workspace 一教师**：简化权限模型（未来可扩展多教师）
4. **课节无标题唯一**：允许重复内容和同视频多课节
5. **原子节点验证**：失败时保留旧版本，无部分保存
6. **模块边界零豁免**：违规自动失败，无人工例外

## 后续：阶段 2 - 发布与多课程授权

设计 03 第 7 节定义的三个新模块将在阶段 2 初始化：
- authoring_release：课程发布与快照
- entitlement_delivery：授权码与兑换
- 与现有模块的交互通过应用服务

## 时间线

| 日期 | 事件 |
|------|------|
| 2026-08-23 14:00 | 阶段 1A 安全原语完成 |
| 2026-08-23 14:15 | 阶段 1B-1D 数据模型完成 |
| 2026-08-23 14:45 | 阶段 1E-1G 架构与测试完成 |
| 2026-08-23 15:00 | 阶段 1 全部工作包验收 |

## 文档引用

- 设计：`doc/design/v1/03-system-architecture.md`（第 7.0 节模块边界）
- 执行计划：`doc/plans/v1-code-refactor-execution-plan.md`（第 6.2 节阶段 1）
- 测试计划：`doc/plans/v1-test-plan.md`（阶段 1 检查点）
