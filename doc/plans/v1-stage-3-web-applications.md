# KnownMap v1 Stage 3 — 教师和管理员 Web 应用

文档版本：`0.1.0`

状态：阶段 3 执行计划草稿

执行基线：`worktree-system-refactor` @ 合并后（阶段 0-2 完成）

## 目标

从 `codex/v1-rewrite` 的已完成架构出发，实施教师和管理员 Web 应用的迁移重构。

### 前置条件（已完成）

- ✅ 阶段 0：工程、契约、干净初始化（13 提交）
- ✅ 阶段 1：身份、工作空间、课程（7 提交）
- ✅ 阶段 2：发布、快照、授权（7 提交）
- ✅ 总计：27 提交，15 张表，6 个模块

### 工作包清单

#### 3A — 共享 HTTP 基础设施

**职责**：
- HTTP transport：request ID 注入、超时、重试
- Error classification：4xx/5xx/network 错误分类
- Common components：loading、error、toast UI
- **不共享**：admin/teacher session、permission logic

#### 3B — 管理员应用迁移

**页面**：登录 → 教师列表 → 创建/重置/停用操作

**行为对照**：与旧 `admin.html` 功能完全一致

#### 3C — 教师应用外壳

**关键改进**：
- 不再默认读第一门课程
- 多课程列表
- 多课节 CRUD + 排序
- 显式路由（不丢失当前课程）

#### 3D — 编辑器领域模块迁移

**提取**：
- TimelineModel（无 DOM、无状态）
- NodeRegistry（纯 TypeScript + React hook）
- SubtitleParser
- NodeValidator

#### 3E — 发布与授权集成

**流程**：
- 自动保存草稿 → 冲突检测 → 原子发布 → 授权码生成

#### 3F — 迁移完成

**验收**：旧新应用行为对照后停用

---

## 当前步骤

**下一步：实施 3A — 共享 HTTP 基础设施**

目标：建立 React 应用共用的 HTTP 客户端、错误处理和通用组件

文件清单：
- `v1/web/shared/src/api/client.ts` — HTTP 客户端
- `v1/web/shared/src/api/errors.ts` — 错误分类
- `v1/web/shared/src/api/types.ts` — 类型
- `v1/web/shared/src/hooks/useApiRequest.ts` — API hook
- `v1/web/shared/src/components/LoadingSpinner.tsx`
- `v1/web/shared/src/components/ErrorBanner.tsx`
- `v1/web/shared/src/components/SuccessToast.tsx`

验收条件：
- HTTP 客户端正确注入 request ID
- 错误分类覆盖 4xx/5xx/network
- 组件可正确导入和使用
