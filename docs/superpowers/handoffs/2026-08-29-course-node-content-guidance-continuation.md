# 课程互动节点课程化编辑引导：续做说明

更新日期：2026-08-29

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
- `doc/INDEX.md` 已登记设计和开发计划；设计状态已更新为“设计已确认，待实现验证”。
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

当前 HEAD：`d9a6601`。

## 已验证结果

在 Task 5 实现完成时：

- NodeForm/RichTextEditor/nodes/copy 相关测试：14/14 通过。
- v1 全量 Vitest：38 个文件、308 个测试通过。
- `npm --prefix v1 run type-check` 通过。
- `npm --prefix v1 run build` 通过。
- `git diff --check` 通过。
- worktree 在最后一次实现提交后干净。

根目录基线在开始实现前已通过：根测试 130 个、v1 测试 295 个；依赖环境已安装。

## 当前停在什么位置

Task 5 的实现已完成，但 Task 5 的规格符合性审查在本次对话中被用户中断，尚未得到最终结论。上一次审查调用使用了 `functions.wait`，不是代码失败；实现代码没有因此回滚或产生未提交修改。

Task 5 后续还必须完成：

1. 对 `0252b16..d9a6601` 做规格符合性审查。
2. 规格有问题时，让 Task 5 原实现子代理修复，再重新审查。
3. 规格通过后做代码质量审查；若发现问题，修复并重新审查。

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

## 尚未执行的 Task 6

规格/质量双审查通过后，继续按开发计划执行：

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

然后启动真实本地栈：

```bash
./dev-up.sh
```

在 `http://localhost:5174` 的真实课节中人工验证：四种节点字段、placeholder、实时预览、保存节点/保存草稿两步边界、旧节点标题不被静默改写、4–6 个选项全部预览、窄屏 375px 不横向溢出。结束后：

```bash
./dev-up.sh --stop
```

不要在日志或截图中记录密码、授权码、字幕正文、课程正文或学生回答。

最后更新 `next.md`、`changelog.md`、必要的人工验收记录和 `doc/INDEX.md`，运行：

```bash
npm test
npm run check
node tools/secret-scan.mjs
node tools/dependency-check.mjs
cd v1/backend && uv run ruff check . && uv run ruff format --check . && uv run pytest
node tools/doc-check.mjs
git diff --check
git status --short --branch
```

## 重要约束

- 不新增节点字段、API、数据库字段、migration、课程包 schema、插件消息或学生数据流。
- 不把课程化 copy、placeholder、hint 复制到插件或课程包。
- 不修改 `v1/extension/content/window.ts`、`v1/extension/background/validate.ts` 和 `v1/contracts/`。
- 不修改 `LessonPage.tsx` 的弹窗、保存、删除和预览设置边界。
- 主工作区已有并行修改属于其他任务，不能清理、覆盖、reset、checkout 或混入提交。
- 继续使用子代理逐任务执行：每个任务都要先规格审查，再质量审查；审查发现问题必须由原实现子代理修复并重新审查。
