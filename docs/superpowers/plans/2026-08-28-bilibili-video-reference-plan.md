# B 站课程视频引用与分 P 精确匹配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让教师、后端、课程包和学生插件使用同一个包含 BVID、分 P 和可选 CID 的视频引用，并保证只有精确匹配的课程页面显示 UI。

**Architecture:** 先冻结参数分类和匹配规则，再以失败测试锁定共享语义。后端 API 与数据库保存完整引用，课程包和插件存储保持同字段，B 站宿主从 URL 规范化完整引用，运行时只比较规范化引用；追踪参数永不进入业务匹配。

**Tech Stack:** FastAPI/Pydantic/SQLAlchemy/Alembic；TypeScript/Vitest；JSON Schema；现有 npm、pytest、Ruff 和生产构建门禁。

---

## 文件责任地图

- `docs/superpowers/specs/2026-08-28-bilibili-video-reference-design.md`：参数分类、业务匹配规则和本轮边界。
- `doc/decisions/2026-08-28-bilibili-video-reference.md`：已接受的数据模型与兼容决策。
- `v1/backend/app/modules/workspace_course/schemas.py`、`models.py`、课程应用服务和路由：教师输入与持久化引用。
- `v1/backend/app/modules/authoring_release/portable.py`、`release_models.py`：发布快照和课程包映射。
- `v1/contracts/schemas/course-package.schema.json`、`extension-storage.schema.json`：跨端契约。
- `v1/extension/host/bilibili/index.ts`：从当前 URL 产生完整视频引用并感知 SPA 变化。
- `v1/extension/shared/library-view.ts`、`storage/types.ts`、安装/校验链路：课程候选精确匹配与本地结构。
- `v1/extension/content/index.ts`、`content/companion.ts`：无候选时不显示、路由变化时清理 UI。
- `v1/web/teacher/src/pages/CoursePage.tsx`、`api.ts`：教师端输入和提交完整引用。
- `v1/backend/alembic/versions/`：旧数据补 `page = 1`，新字段可回滚且不丢历史数据。
- `v1/extension/**.test.ts`、`v1/backend/tests/`、契约检查：正反例和跨层回归证据。

## Task 1: 用失败测试锁定 URL 规范化和精确匹配

- [x] 为 BVID URL、`p`、`cid`、追踪参数、非法页码和 SPA 路由变化写宿主适配失败测试。
- [x] 为同 BVID 不同 `page`、CID 优先、一方有 CID 不降级和追踪参数忽略写课程库失败测试。
- [x] 运行对应 Vitest，确认失败原因是缺少完整引用解析/匹配，而不是测试环境错误。

## Task 2: 修改共享课程引用结构和课程包契约

- [x] 在后端、前端和插件存储中加入 `page` 与可选 `cid`，保持旧数据读取时 `page = 1`。
- [x] 更新课程包、插件存储 JSON Schema 和发布快照映射，拒绝缺失/非法 page 与非法 cid。
- [x] 更新教师表单解析：只保存规范化的 BVID、page、cid，不保存 `vd_source` 等追踪参数。
- [x] 运行共享契约、教师端和后端 schema 测试。

## Task 3: 完成后端持久化、迁移和发布链路

- [x] 新增 Alembic 迁移，为视频引用增加 page/CID 字段，旧行 page 填 1。
- [x] 更新课程创建、编辑、详情、发布快照和课程包导出/导入的字段映射。
- [x] 添加后端 API 和迁移闭环测试，验证保存后读取仍保持精确引用。

## Task 4: 修复插件候选、显示和 SPA 生命周期

- [x] 宿主从 `location.href` 返回完整视频引用；查询参数变化也触发重新检查。
- [x] 候选查询使用精确引用；无候选时先隐藏/销毁陪伴 UI，再停止学习运行时。
- [x] 有候选时才挂载陪伴 UI；BVID 相同但 page/CID 不同不得显示。
- [x] 加入宿主和内容入口负向回归测试，覆盖非视频页、其它分 P 和 SPA 显示条件。

## Task 5: 文档、复盘和完整验证

- [x] 更新 `next.md`、`changelog.md`、`doc/lessons.md` 和 `doc/INDEX.md`，登记本次根因及防漏检流程。
- [x] 运行后端 Ruff/pytest、Node 测试、类型检查、契约检查、生产构建和文档检查。
- [x] 检查 git diff、精确提交边界、本地与远程同步状态；只有所有证据齐全后才报告完成。
