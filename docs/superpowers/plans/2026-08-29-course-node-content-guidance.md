# 课程互动节点课程化编辑引导 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 在不改变节点数据契约和学生插件行为的前提下，让教师快速理解并正确填写重点提示、选择题、填空题和问答题。

**Architecture:** 教师端增加一个类型安全的 copy 注册表，集中保存字段名称、课程化提示、占位示例和预览标签。nodes.ts 继续负责节点结构、默认值和最小校验；NodeForm.tsx 消费注册表，仍写入现有 title、content、interactionData、presentationHints；RichTextEditor 只增加 UI-only 的 placeholder/hint props。后端、课程包和插件不变。

**Tech Stack:** React 18、TypeScript、Vite、Vitest、happy-dom、RichPageDocument、现有课程包与插件校验。

> **执行状态（2026-08-30）：** Task 1–5 已完成并通过规格/质量审查；Task 6 的契约、插件、v1、根目录、后端 pytest 和隔离浏览器人工验收已完成。后端 `ruff format --check .` 仍报告 3 个未被本功能修改的既有文件，未混入本功能提交；详情见 `next.md` 与 `tests/manual/v1/course-node-content-guidance-20260830.md`。

---

## 1. 当前事实、环境和不变量

- 节点弹窗外壳在 v1/web/teacher/src/pages/LessonPage.tsx：类型、触发时间、NodeForm、保存节点和保存草稿的两步边界已经成立。
- v1/web/teacher/src/components/NodeForm.tsx 已有标题、富文本、选择题选项/答案/解析、填空题答案/解析、问答题参考答案和学生端预览。
- v1/web/teacher/src/components/RichTextEditor.tsx 的可视化编辑和 HTML 编辑都经过 sanitizeRichTextHtml；新增提示不得修改 sanitizer、媒体上传、资源 ID 回显或 HTML 真源规则。
- v1/web/teacher/src/nodes.ts 的四种 interaction 组合、类型切换、空值检查和默认 presentationHints 已经是教师端模型事实。
- 后端 v1/backend/app/modules/authoring_release/application_service.py 对节点执行封闭字段校验。notice 的 interactionData 必须为 null；choice、blank、free_text 只能使用现有题型字段。
- 插件 v1/extension/background/validate.ts 会再次校验课程包；v1/extension/content/window.ts 负责学生端打开、作答、判断、反馈和播放恢复。
- 当前插件是 Chrome MV3，`v1/extension/package.json` 要求 Chrome `>=120`；本轮只消费已有课程包节点，不改插件源码、构建目标或消息方向。
- 当前契约基线是 course package `3.2.0`、extension messages `2.2.0`、extension storage `2.3.0`；教师端 copy 不得触发这些版本升级。
- 插件本地/生产产物分别由 `npm --prefix v1/extension run build:local` 和 `npm --prefix v1/extension run build:production` 生成；本轮需用 `build:all` 做无改动回归，而不是把教师端文案复制进插件。
- 本轮不新增 API、数据库字段、migration、课程包 schema、插件消息字段、插件版本、学生数据上传或教师学习统计。
- 任何 copy、placeholder、hint 都必须留在教师端 UI，不得写入节点 value、课程包或插件共享代码。
- 规划时已核对：Node v22.22.1、npm 10.9.4、uv 0.11.12；根目录和 v1 node_modules、v1/backend/.env、v1/backend/.venv 已存在；`./dev-up.sh --status` 显示后端 8000、管理端 5173、教师端 5174 均可启动且当前空闲。
- 工作区已有 docs/superpowers/assets/companion/ 和 v1/extension/assets/companion/ 未跟踪资源，不属于本计划，不得加入、移动或删除。

## 2. 文件边界

创建：

- v1/web/teacher/src/nodeFormCopy.ts：教师端 copy 注册表和访问函数。
- v1/web/teacher/src/nodeFormCopy.test.ts：copy 完整性、关键文案和行为边界测试。
- v1/web/teacher/src/components/RichTextEditor.test.tsx：类型化占位/引导的 happy-dom 测试。
- v1/web/teacher/src/components/NodeForm.test.tsx：四种节点字段和全部选项预览的 happy-dom 测试。

修改：

- v1/web/teacher/src/nodes.ts、v1/web/teacher/src/nodes.test.ts：默认标题、节点标签、提示和错误字段名称。
- v1/web/teacher/src/components/NodeForm.tsx：课程化区块、字段、预览和选项展示。
- v1/web/teacher/src/components/RichTextEditor.tsx：可选 placeholder、hint 和 aria-label。
- v1/web/teacher/src/index.css：只补充区块提示、选项编号的最小样式。
- next.md：实现期间的当前步骤和验证证据。
- doc/INDEX.md：登记本开发计划。
- changelog.md、tests/manual/teacher-visual-node-editor/README.md：仅在实现和验证通过后更新。

明确不修改：

- v1/backend/app/modules/authoring_release/application_service.py
- v1/contracts/
- v1/extension/content/window.ts
- v1/extension/background/validate.ts
- v1/web/teacher/src/pages/LessonPage.tsx
- v1/site/

## 3. 任务顺序

### Task 1: 建立执行切片

**Files:** Modify `/Users/bai/code/lessonpilot/next.md`

- [ ] 写入本轮依据、当前步骤和不变量：

~~~markdown
## 当前执行切片：课程互动节点课程化编辑引导

依据：D-V1-025；设计：docs/superpowers/specs/2026-08-29-course-node-content-guidance-design.md；计划：docs/superpowers/plans/2026-08-29-course-node-content-guidance.md。

当前步骤：锁定教师端 copy、默认标题和错误字段的失败测试。
验证：npm --prefix v1 test -- web/teacher/src/nodeFormCopy.test.ts web/teacher/src/nodes.test.ts

不变量：不增加节点字段，不修改课程包 schema，不修改插件行为；companion 资源不纳入本轮。
~~~

- [ ] 检查边界：

~~~bash
git status --short --branch
git diff --name-only
~~~

预期：只看到既有用户修改和 companion 未跟踪资源；不覆盖任何 v1/web/teacher 计划外修改。

### Task 2: 先写 copy 和模型失败测试

**Files:** Create `/Users/bai/code/lessonpilot/v1/web/teacher/src/nodeFormCopy.test.ts`; Modify `/Users/bai/code/lessonpilot/v1/web/teacher/src/nodes.test.ts`

- [ ] 创建 copy 测试，先引用尚不存在的 NODE_FORM_COPY 和 nodeFormCopy：

~~~ts
const kinds = ['notice', 'choice', 'blank', 'free_text'] as const;

it('四种节点都有完整课程任务 copy', () => {
  expect(Object.keys(NODE_FORM_COPY).sort()).toEqual([...kinds].sort());
  for (const kind of kinds) {
    const copy = nodeFormCopy(kind);
    expect(copy.contentHeading).toBeTruthy();
    expect(copy.contentLabel).toBeTruthy();
    expect(copy.contentHint).toBeTruthy();
    expect(copy.contentPlaceholder).toBeTruthy();
    expect(copy.titleLabel).toBeTruthy();
    expect(copy.titlePlaceholder).toBeTruthy();
    expect(copy.previewBadge).toBeTruthy();
    expect(copy.previewEmptyText).toBeTruthy();
  }
});

it('选择题文案完整表达填写路径', () => {
  expect(nodeFormCopy('choice')).toMatchObject({
    contentLabel: '题目主干',
    detailHeading: '请手工填写选项',
    optionHint: '标记为正确答案',
    feedbackLabel: '学生作答后的解释',
  });
});
~~~

运行：
~~~bash
npm --prefix v1 test -- web/teacher/src/nodeFormCopy.test.ts
~~~
预期：FAIL，copy 模块不存在。

- [ ] 在 nodes.test.ts 增加默认标题和错误字段失败断言：

~~~ts
expect(createNode('notice', 0).title).toBe('本节重点');
expect(createNode('choice', 0).title).toBe('想一想');
expect(createNode('blank', 0).title).toBe('补全关键词');
expect(createNode('free_text', 0).title).toBe('说说你的理解');
expect(metaOf('notice')).toMatchObject({
  label: '重点提示',
  hint: '暂停视频，提醒学生记住一个关键点',
});

const notice = createNode('notice', 0);
expect(findEmptyField(notice)).toBe('重点内容');
const choice = createNode('choice', 0);
choice.content = richDocumentFromText('题目');
expect(findEmptyField(choice)).toBe('选项文字');
~~~

同时增加 choice 反馈、blank 答案/反馈和 free_text 反馈为空时的课程化错误字段断言。运行：
~~~bash
npm --prefix v1 test -- web/teacher/src/nodes.test.ts
~~~
预期：FAIL，现有代码仍返回旧标题和旧错误字段。

### Task 3: 实现 copy 注册表和节点默认值

**Files:** Create `/Users/bai/code/lessonpilot/v1/web/teacher/src/nodeFormCopy.ts`; Modify `/Users/bai/code/lessonpilot/v1/web/teacher/src/nodes.ts`

- [ ] 创建 NodeFormCopy 类型。必须支持：contentHeading、contentAside、titleLabel、titleHint、titlePlaceholder、contentLabel、contentHint、contentPlaceholder、detailHeading、detailAside、optionHint、optionPlaceholder、answerLabel、answerHint、answerPlaceholder、feedbackLabel、feedbackHint、feedbackPlaceholder、previewBadge、previewEmptyText、previewInputPlaceholder。
- [ ] 使用 satisfies Record<NodeKind, NodeFormCopy> 定义 notice、choice、blank、free_text 四项，具体文案按已批准设计第 4 节逐项实现。关键值必须是：
  - notice：重点主题、重点内容、本节重点、告诉学生这一刻要记住什么。
  - choice：题目名称、题目主干、请手工填写选项、标记为正确答案、学生作答后的解释、想一想。
  - blank：题目名称、题目主干、标准答案 / 可接受说法、学生提交后的解释、补全关键词。
  - free_text：问题名称、问题、学生提交后的参考反馈、不自动判分、说说你的理解。
- [ ] 导出 nodeFormCopy(kind)，返回静态 copy，不接收节点值，不修改节点。
- [ ] 给 NodeMeta 增加 defaultTitle；四种 defaultTitle 分别为本节重点、想一想、补全关键词、说说你的理解；notice 的 label 改为重点提示；四种 hint 使用课程任务语言。
- [ ] 让 createNode 使用 meta.defaultTitle，保留现有 interactionData 的字段形状、effects、content 和 presentationHints。
- [ ] 让 findEmptyField 只改变教师可见错误名称：标题→节点标题，notice 正文→重点内容，其它正文→题目主干，choice 解析→学生作答后的解释，blank 答案/解析→标准答案 / 可接受说法、学生提交后的解释，free_text 参考答案→学生提交后的参考反馈。空值判断顺序和后端校验权不变。
- [ ] 运行并确认通过：

~~~bash
npm --prefix v1 test -- web/teacher/src/nodeFormCopy.test.ts web/teacher/src/nodes.test.ts
~~~

- [ ] 提交：

~~~bash
git add v1/web/teacher/src/nodeFormCopy.ts v1/web/teacher/src/nodeFormCopy.test.ts v1/web/teacher/src/nodes.ts v1/web/teacher/src/nodes.test.ts next.md
git commit -m "feat: define course-focused node copy"
~~~

### Task 4: 让 RichTextEditor 支持类型化提示

**Files:** Modify `/Users/bai/code/lessonpilot/v1/web/teacher/src/components/RichTextEditor.tsx`; Create `/Users/bai/code/lessonpilot/v1/web/teacher/src/components/RichTextEditor.test.tsx`

- [ ] 先写 happy-dom 测试，渲染：

~~~tsx
<RichTextEditor
  label="题目主干"
  value=""
  disabled={false}
  onChange={() => undefined}
  placeholder="例如：面对同事冲突，第一步应该做什么？"
  hint="题干只提出一个需要判断的问题。"
/>
~~~

断言 contenteditable 的 data-placeholder、文本提示和“保存前会去掉脚本、危险链接和未允许的标签。”均存在。运行测试，预期因 Props 不支持新参数而 FAIL。
- [ ] 在 Props 增加 placeholder?: string、hint?: string；contenteditable 使用 data-placeholder={placeholder ?? '在这里编辑内容'}、aria-label={label}；在现有安全说明前按条件渲染 hint。
- [ ] 不改 sanitizeRichTextHtml、媒体上传/导入、HTML/可视化切换和 data-asset-id 处理。
- [ ] 运行：

~~~bash
npm --prefix v1 test -- web/teacher/src/components/RichTextEditor.test.tsx
npm --prefix v1 run type-check
~~~

预期：PASS。

### Task 5: 接入 NodeForm 和教师预览

**Files:** Modify `/Users/bai/code/lessonpilot/v1/web/teacher/src/components/NodeForm.tsx`, `/Users/bai/code/lessonpilot/v1/web/teacher/src/index.css`; Create `/Users/bai/code/lessonpilot/v1/web/teacher/src/components/NodeForm.test.tsx`

- [ ] 先写 happy-dom 测试，使用 createNode(kind, 39) 渲染四种节点，断言分别包含“告诉学生这一刻要理解或记住什么”“题目主干”“请手工填写选项”“标准答案 / 可接受说法”“学生提交后的参考反馈”。使用一个含 a/b/c/d 四项的 choice 节点，断言预览包含“选项四”。运行测试，预期因旧文案和前三项截断而 FAIL。
- [ ] 导入 nodeFormCopy，在 NodeForm 内按 node.interaction 取得 copy。核心区块使用 copy.contentHeading/contentAside、copy.titleLabel/titleHint/titlePlaceholder 和 copy.contentLabel/contentHint/contentPlaceholder。
- [ ] 扩展 Field/Area 的 placeholder?: string，继续使用受控 value、onChange、disabled 和 rows；示例只能出现在 placeholder，不能写入 value。
- [ ] 将 RichTextEditor 的 label、placeholder、hint 接到 copy。重点提示仍只用 title + RichPageDocument；不新增提醒字段。
- [ ] 选择题区块标题使用 copy.detailHeading/detailAside；每行显示“选项 1”“选项 2”等人类可读编号，单选控件 aria-label 使用“标记为正确答案：选项 N”，输入 placeholder 使用选项编号，选中行显示“✓ 标记为正确答案”。保留当前增加/移除选项、删除正确答案时迁移到保留选项和最多 6 项逻辑。
- [ ] 选择题反馈使用 copy.feedbackLabel/feedbackHint/feedbackPlaceholder；填空题使用 copy.answer* 与 copy.feedback*；问答题使用 copy.feedback*；不新增 interactionData 字段。
- [ ] 学生端教师预览使用 copy.previewBadge/previewEmptyText/previewInputPlaceholder。把 options.slice(0, 3).map 改为 options.map，保留空标签回退但不写回节点。
- [ ] 只补区块提示、选项编号的样式，复用现有 node-section、node-section-heading、field-group、choice-row 和预览样式，不改弹窗宽度、窗口设置或响应式溢出规则。
- [ ] 运行：

~~~bash
npm --prefix v1 test -- web/teacher/src/components/NodeForm.test.tsx web/teacher/src/components/RichTextEditor.test.tsx web/teacher/src/nodes.test.ts
npm --prefix v1 run type-check
npm --prefix v1 run build
~~~

预期：测试、类型检查和教师端构建 PASS。

- [ ] 提交：

~~~bash
git add v1/web/teacher/src/components/NodeForm.tsx v1/web/teacher/src/components/NodeForm.test.tsx v1/web/teacher/src/components/RichTextEditor.tsx v1/web/teacher/src/components/RichTextEditor.test.tsx v1/web/teacher/src/index.css
git commit -m "feat: guide teachers through course node fields"
~~~

### Task 6: 插件边界、真实环境和文档收口

**Files:** Modify `/Users/bai/code/lessonpilot/next.md`, `/Users/bai/code/lessonpilot/doc/INDEX.md`, `/Users/bai/code/lessonpilot/changelog.md`; optionally modify `/Users/bai/code/lessonpilot/tests/manual/teacher-visual-node-editor/README.md`

- [ ] 确认插件和契约没有变化：

~~~bash
git diff --name-only HEAD~2..HEAD -- v1/contracts v1/extension
npm run check:contract
~~~

预期：本计划 Task 3 与 Task 5 的实现提交不包含 v1/contracts 和 v1/extension；课程包版本、插件消息版本和学生端行为不变。若实现拆分了提交，按本轮实现首个提交的父提交到当前 HEAD 核对同一范围。
- [ ] 运行插件自身的兼容性门禁：

~~~bash
npm --prefix v1/extension run type-check
npm --prefix v1/extension run build:all
~~~

预期：Chrome MV3 的 local/production 两套产物均构建成功；没有因为教师端 copy 变化而修改插件产物输入或运行时逻辑。
- [ ] 运行完整 v1 门禁：

~~~bash
npm --prefix v1 test
npm --prefix v1 run type-check
npm --prefix v1 run build
~~~

- [ ] 启动真实本地栈：

~~~bash
./dev-up.sh
~~~

在 http://localhost:5174 的真实课节中创建/编辑四种节点，验证课程化字段、占位、预览、保存节点/保存草稿两步边界、旧节点标题不被静默改写、4–6 个选项全部预览、375px 弹窗不溢出。不要把密码、授权码、字幕正文、课程正文或学生回答写入截图和日志。结束后运行 ./dev-up.sh --stop。
- [ ] 只有真实验收和自动化均通过后，更新 tests/manual/teacher-visual-node-editor/README.md 和 changelog.md；记录实际测试命令和结果，写明保留节点契约与插件行为。
- [ ] 完成项目门禁：

~~~bash
npm test
npm run check
node tools/secret-scan.mjs
node tools/dependency-check.mjs
cd v1/backend && uv run ruff check . && uv run ruff format --check . && uv run pytest
~~~

- [ ] 在 next.md 写入结果，更新 doc/INDEX.md 计划链接，运行：

~~~bash
node tools/doc-check.mjs
git diff --check
git status --short --branch
~~~

预期：文档检查四项全绿，companion 资源仍未跟踪且未进入提交。

## 4. 关键风险与处理

| 风险 | 处理 |
| --- | --- |
| placeholder 被误存为课程内容 | 只使用 placeholder/data-placeholder；测试断言初始 value 仍为空，空值保存仍被阻止 |
| 教师预览与插件不一致 | 继续消费 content/interactionData；预览不截断选项；不把 copy 引入插件 |
| 旧课程标题被静默改写 | defaultTitle 只用于 createNode；加载和类型切换保留已有非空 title |
| 后端拒绝草稿 | 不增加 interactionData 字段；按后端白名单对照并跑保存/契约回归 |
| 富文本安全回归 | RichTextEditor 只增加 UI props；保持 sanitizer、安全说明和媒体资源测试 |
| 未保存状态被伪装成已保存 | 不改 LessonPage 的 dialogNode、页面 nodes 和保存草稿边界 |
| 范围扩散到销售页 | 不修改 v1/site；“重点标注”销售页测试保持原样 |

## 5. 完成定义

- 真实教师弹窗中的四种节点都能用课程化字段、提示和占位示例完成配置。
- 选择题路径清晰表达题目主干、手工选项、正确答案和作答后解释；4–6 项预览不截断。
- 旧节点不被迁移或静默重命名；节点类型切换仍保留稳定 id、正文和展示提示。
- 没有新增节点字段、API、课程包 schema、插件消息或学生数据流。
- v1 测试、类型检查、构建、根测试、工程门禁、后端检查和文档检查全部通过。
- next.md、changelog.md、人工验收记录、doc/INDEX.md 与实际提交一致；companion 未跟踪资源不在提交中。
