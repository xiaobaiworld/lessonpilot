# 课程互动节点课程化编辑引导：续做说明

更新日期：2026-08-30

## 目标

继续完成 D-V1-025：让教师在编辑重点提示、选择题、填空题和问答题时，看到清晰的课程化填写引导；不新增节点字段，不改变课程包契约和学生插件行为。

## 必须使用的工作目录

后续工作必须在以下隔离 worktree 中进行：

`/Users/bai/code/lessonpilot/.worktrees/course-node-content-guidance`

分支：`codex/course-node-content-guidance`

主工作区 `/Users/bai/code/lessonpilot` 当前有其他并行任务的修改，不要在主工作区执行 reset、checkout、清理或合并操作，也不要把那些修改加入本功能提交。

## 已完成内容

### 文档与流程

- 已完成并确认设计：[课程互动节点课程化编辑引导设计](../specs/2026-08-29-course-node-content-guidance-design.md)。方案 A：只改善教师端编辑引导，保留现有数据结构。
- 已完成开发计划：[课程互动节点课程化编辑引导 Implementation Plan](../plans/2026-08-29-course-node-content-guidance.md)。
- `doc/INDEX.md` 已登记设计、开发计划和本轮 v1 人工验收记录；设计与 D-V1-025 状态已更新为实现与人工验收完成。
- 当前 worktree 的文案基准已与设计统一：重点提示说明为“告诉学生这一刻要理解或记住什么”。

### 已实现代码

- `v1/web/teacher/src/nodeFormCopy.ts`
  - 四种节点的类型安全 copy 注册表。
  - `satisfies Record<NodeKind, NodeFormCopy>`。
  - 21 个字段：标题、正文、题型区块、选项/答案/反馈、预览和占位提示。
- `v1/web/teacher/src/nodes.ts`
  - 默认标题：本节重点、想一想、补全关键词、说说你的理解。
  - notice 标签改为重点提示。
  - 保存前错误字段改为课程化文案；free_text 正文错误为“问题”。
  - 保留原有 interactionData、effects、content、presentationHints 和类型切换逻辑。
- `v1/web/teacher/src/components/RichTextEditor.tsx`
  - 增加 UI-only 的 placeholder、hint、aria-label。
  - 未改 sanitizer、媒体、资源 ID、HTML 真源和受控 value/onChange。
- `v1/web/teacher/src/components/NodeForm.tsx`
  - 接入四种节点 copy。
  - 接入课程化区块、字段提示、占位、正确答案说明和学生端预览。
  - 选择题预览从前三项改为完整展示 4–6 项。
  - 保留增加/移除选项、至少 2 项、最多 6 项和正确答案迁移逻辑。
- `v1/web/teacher/src/index.css`
  - 只增加课程区块提示和选项编号所需的最小样式。
- `v1/vitest.config.ts`
  - 正式收集 web 下的 `.test.tsx`，同时保留原有 `.test.ts`、extension 和 contracts 测试范围。
- 测试：已新增 copy、nodes、RichTextEditor、NodeForm 测试。

## 提交记录

从旧到新：

1. `52995d4`：建立 next.md 执行切片。
2. `863f2a1`、`f9a8181`、`784000a`：Task 2 红灯测试及断言修订。
3. `a6633ca`、`e533417`：copy 注册表、nodes 实现和完整 copy 测试。
4. `dbe3e75`、`d016dfa`、`39e6682`：RichTextEditor 提示、tsx 测试收集、React root 清理。
5. `0252b16`：同步开发计划的重点提示文案基准。
6. `d9a6601`：NodeForm、NodeForm 测试和最小 CSS 接入。
7. `9d454be`：修复选择题选项删除时的状态覆盖和选项 ID 复用。
8. `e372a26`：补充本轮续做交接说明。
9. 文档收口：更新 `next.md`、`changelog.md`、`doc/INDEX.md`、设计/决策状态，并新增 `tests/manual/v1/course-node-content-guidance-20260830.md`。

当前 HEAD：`9d454be` 加上本次文档收口提交。

## 已验证结果

在 Task 6 收口时：

- NodeForm/RichTextEditor/nodes/copy 相关测试：16/16 通过。
- v1 全量 Vitest：38 个文件、310 个测试通过。
- `npm --prefix v1 run type-check` 通过。
- `npm --prefix v1 run build` 通过。
- 插件 type-check 与 `npm --prefix v1/extension run build:all` 通过；local/production 均成功。
- `npm run check:contract` 通过；以本轮实现基线 `e533417..9d454be` 核对，契约和 `v1/extension` 范围无差异；更早的 D-V1-024 插件测试变更不属于本轮。
- 根 `npm test` 通过（130 根测试 + 310 个 v1 测试）；`npm run check`、secret scan、dependency check 通过。
- 后端 pytest 42 项、`ruff check .` 通过。
- `git diff --check` 通过。
- worktree 在文档收口后干净。

根目录基线在开始实现前已通过：根测试 130 个、v1 测试 295 个；依赖环境已安装。

### 浏览器人工验收（2026-08-30）

- 在隔离端口启动本分支 Vite 教师端和本分支 FastAPI 临时 SQLite 数据库，未触碰主工作区 8000/5173/5174 服务。
- 四种节点均打开并检查课程化字段、提示、占位和学生端预览；选择题增加到 4 项，四项均完整显示。
- 四种节点均先“保存节点”，再“保存草稿”；保存后刷新页面，4 个节点和字幕定位状态恢复。
- 375px × 900px 页面检查 `scrollWidth === innerWidth`，未发现页面级横向溢出。
- 详细记录：`tests/manual/v1/course-node-content-guidance-20260830.md`。

## 当前停在什么位置

功能实现、Task 5 规格/质量双审查、Task 6 自动化门禁和隔离浏览器人工验收均已完成。Task 5 审查发现的两个问题（删除正确答案后的旧状态覆盖、删除中间选项后 ID 复用）已由修复提交 `9d454be` 解决并重新通过审查。

Task 6 的全库 Ruff 格式门禁仍不能宣称全绿：`uv run ruff format --check .` 报告 `app/modules/authoring_release/asset_storage.py`、`app/modules/entitlement_delivery/routes.py`、`app/modules/entitlement_delivery/schemas.py` 需要格式化。这 3 个文件在本功能分支没有变更，属于已有基线问题；pytest 已单独执行并通过 42 项。若要消除该阻塞，应另立独立维护提交，不要把无关格式化混入本功能。

## 建议的下一步命令与顺序

先进入隔离目录并确认状态：

```bash
cd /Users/bai/code/lessonpilot/.worktrees/course-node-content-guidance
git status --short --branch
git log --oneline --decorate -12
```

Task 5 正确审查范围：

```bash
git diff --stat 0252b16..d9a6601
git diff 0252b16..d9a6601
```

Task 5 规格审查重点：

- 四种节点是否都消费 nodeFormCopy。
- notice 是否使用“告诉学生这一刻要理解或记住什么”。
- placeholder/hint 是否没有写入受控 value、节点或保存 payload。
- 选择题是否完整显示第 4 项，且仍保留 2–6 项、增删和正确答案迁移。
- 是否未修改 LessonPage、后端、contracts、extension、site。
- 是否没有改变保存节点/保存草稿边界和响应式布局。

Task 5 质量审查正确范围同样是 `0252b16..d9a6601`。不要用更早的 `a6633ca` 作为基线，否则会把 Task 3 文件误算到 Task 5。

## Task 6 收口结果

已完成以下检查：

```bash
cd /Users/bai/code/lessonpilot/.worktrees/course-node-content-guidance
git diff --name-only HEAD~2..HEAD -- v1/contracts v1/extension
npm run check:contract
npm --prefix v1/extension run type-check
npm --prefix v1/extension run build:all
npm --prefix v1 test
npm --prefix v1 run type-check
npm --prefix v1 run build
```

注意：如果审查修复增加了提交数量，不要机械使用 `HEAD~2`；应以 Task 3/4/5 实现开始前的准确基线计算范围。核心验收是本功能没有变更 `v1/contracts` 和 `v1/extension`。

人工验收使用隔离端口和临时数据库完成，记录见 `tests/manual/v1/course-node-content-guidance-20260830.md`。主工作区已有服务未被重启或停止。

已更新 `next.md`、`changelog.md`、人工验收记录、`doc/INDEX.md`、设计状态和决策状态。

最终复核命令：

```bash
npm test
npm run check
node tools/secret-scan.mjs
node tools/dependency-check.mjs
cd v1/backend && uv run ruff check . && uv run pytest
node tools/doc-check.mjs
git diff --check
git status --short --branch
```

结果：文档检查、差异检查和工作树检查通过；companion 资源仍未跟踪且未进入提交。唯一未全绿的是上述 3 个既有 Ruff 格式文件。

## 重要约束

- 不新增节点字段、API、数据库字段、migration、课程包 schema、插件消息或学生数据流。
- 不把课程化 copy、placeholder、hint 复制到插件或课程包。
- 不修改 `v1/extension/content/window.ts`、`v1/extension/background/validate.ts` 和 `v1/contracts/`。
- 不修改 `LessonPage.tsx` 的弹窗、保存、删除和预览设置边界。
- 主工作区已有并行修改属于其他任务，不能清理、覆盖、reset、checkout 或混入提交。
- 继续使用子代理逐任务执行：每个任务都要先规格审查，再质量审查；审查发现问题必须由原实现子代理修复并重新审查。
