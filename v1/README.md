# v1 Directory Structure - Stage 0 Scaffold (0A)

建立日期：2026-08-23

## 目录职责（设计 03 第 7.0 节）

### 后端模块 (`v1/backend/app/modules/`)

- **identity**: 管理员与教师认证、会话、工作空间（stage 1）
- **workspace_course**: 课程、课节、草稿、revision（stage 1）
- **authoring_release**: 课程级原子发布、快照、可见性（stage 2）
- **entitlement_delivery**: 授权码、权利、兑换、学生凭证（stage 2）
- **admin_support**: 审计、诊断、运维端点（stage 6）
- **runtime_audit**: 学生会话（只读）、学习结果（stage 5）

### 基础设施 (`v1/backend/app/infrastructure/`)

- **database**: Alembic 迁移、空库初始化、旧 schema 拒绝
- **security**: Argon2、HMAC、密钥管理、环境校验
- **logging**: 结构化日志、PII 清洗、审计日志

### 前端应用 (`v1/web/`)

- **teacher**: 课程制作、编辑、预览、发布工作台（stage 3）
- **admin**: 教师管理、授权审计、诊断（stage 6 集成到 stage 3）
- **shared**: 通用组件、API 客户端、表单处理

### 扩展 (`v1/extension/`)

- **background**: 网络与存储唯一边界、消息中继（stage 4）
- **popup**: 课程库 UI、授权输入（stage 4）
- **content**: B 站页面 content script（stage 5）
- **host/bilibili**: 学习窗口渲染、节点状态机（stage 5）
- **storage**: 本机存储 schema v2（stage 4）

### 跨平台契约 (`v1/contracts/`)

- **course-package.schema.json**: 课程交付格式 v2
- **extension-messages.schema.json**: 插件消息格式 v2
- **extension-storage.schema.json**: 本机存储格式 v2
- **openapi.schema.json**: HTTP API 规范（设计文档 06）
- **versions.json**: 版本支持矩阵

## 当前状态

- ✅ 目录骨架建立
- ✅ 工作空间 package.json 配置
- ✅ 各模块初始 docstring 和职责说明
- ✅ 旧系统 (`backend/`, `teacher-web/`, `src/`) 保持未改动
- ⏳ 下一步：`0B` 建立空库初始化和旧 schema 拒绝门禁

## 验证命令

```bash
# 检查旧系统是否仍然完整
git diff HEAD -- backend teacher-web src | wc -l  # 应返回 0

# 检查 v1 目录未被 git 追踪（待提交）
git status --short | grep "^??"

# 列出所有 v1 Python 模块
find v1/backend -name '__init__.py' | sort
```

## 设计基线

- 需求：[../doc/requirements/v1/README.md](../doc/requirements/v1/README.md)
- 设计：[../doc/design/v1/README.md](../doc/design/v1/README.md)
- 模块边界：[../doc/design/v1/03-system-architecture.md](../doc/design/v1/03-system-architecture.md) 第 7.0 节
- 代码执行计划：[../doc/plans/v1-code-refactor-execution-plan.md](../doc/plans/v1-code-refactor-execution-plan.md) 工作包 0A
