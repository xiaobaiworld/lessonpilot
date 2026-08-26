# Compact Node Dialog Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将教师端节点属性弹窗改为桌面双栏紧凑布局，让编辑区、学生端预览、显示设置和主要操作在首屏内可见，并让窗口位置设置从教师端保存到插件运行时。

**Architecture:** 保留 `LessonPage` 作为节点草稿和保存边界，将弹窗内部拆成头部、左侧编辑区、右侧预览设置区和底部操作区。新增的 `windowPosition` 作为可选 `presentationHints` 字段，默认右下，贯通共享类型、课程契约、后端校验、教师端预览和插件渲染；缺失字段的旧课程继续按右下兼容。

**Tech Stack:** React 18, TypeScript, Vite, FastAPI, Pydantic/SQLAlchemy, JSON Schema, Vitest, pytest, Shadow DOM CSS.

---

## 文件清单

### 共享类型、契约和版本

- Modify: `v1/web/shared/src/portableContent.ts`，增加 `WindowPosition` 和 `PresentationHints.windowPosition`。
- Modify: `v1/contracts/schemas/course-package.schema.json`，允许三个位置值。
- Modify: `v1/contracts/schemas/extension-storage.schema.json`，允许已安装节点保存位置值。
- Modify: `v1/contracts/versions.json`，将 `course_package` 版本从 `3.0.0` 更新到 `3.1.0`。
- Modify: `v1/contracts/version-manifest.ts`，同步课程包版本和说明。
- Modify: `v1/contracts/release-gate.test.ts`、`v1/backend/tests/test_runtime.py` 及受版本变更影响的夹具。

### 后端

- Modify: `v1/backend/app/modules/authoring_release/application_service.py`，接受并保留 `windowPosition`，缺省按右下兼容，发布课程包版本改为 `3.1.0`。
- Modify: `v1/backend/tests/test_authoring_release_api.py`、`v1/backend/tests/test_draft_window_display.py`，覆盖合法、缺省和非法位置值。

### 教师端

- Modify: `v1/web/teacher/src/nodes.ts`，为新节点提供默认 `windowPosition: 'bottom-right'`。
- Modify: `v1/web/teacher/src/components/NodeForm.tsx`，拆出左侧内容区、右侧预览设置区，增加位置控制和“预览确认”。
- Modify: `v1/web/teacher/src/pages/LessonPage.tsx`，调整 `NodeDialog` 头部、主体双栏和底部操作结构。
- Modify: `v1/web/teacher/src/index.css`，收紧间距、边界、字体层级，建立桌面双栏和窄屏单栏规则。
- Modify: `v1/web/teacher/src/components/NodeForm.test.tsx` 或现有教师端组件测试入口，覆盖控件更新和按钮职责。

### 插件

- Modify: `v1/extension/background/validate.ts`，校验位置枚举并对缺省值兼容。
- Modify: `v1/extension/storage/index.ts`，校验已安装节点位置字段。
- Modify: `v1/extension/content/richText.ts`，解析位置并返回默认右下。
- Modify: `v1/extension/content/window.ts`，把位置加入窗口 class。
- Modify: `v1/extension/content/window.css`，实现左下、右下、居中位置，不破坏 `overlay` 和全屏模式。
- Modify: `v1/extension/content/richText.test.ts`、`v1/extension/content/window.test.ts`、相关存储和校验测试。

### 文档和验收

- Modify: `docs/CHANGELOG.md`，只记录验证通过的用户可见变化。
- Modify: `next.md`，记录本轮实施状态和验证入口。

---

### Task 1: Freeze the presentation contract

**Files:**
- Modify: `v1/web/shared/src/portableContent.ts`
- Modify: `v1/contracts/schemas/course-package.schema.json`
- Modify: `v1/contracts/schemas/extension-storage.schema.json`
- Modify: `v1/contracts/versions.json`
- Modify: `v1/contracts/version-manifest.ts`
- Test: `v1/contracts/release-gate.test.ts`
- Test: `v1/backend/tests/test_runtime.py`

- [ ] **Step 1: Add the failing contract assertions**

Add assertions that `windowPosition` accepts exactly `bottom-left`, `bottom-right`, and `center`, and that the course package version is `3.1.0`.

Run:

```bash
cd v1
npm test -- contracts/release-gate.test.ts
```

Expected: FAIL because the current schema and manifest only describe `3.0.0` and do not allow `windowPosition`.

- [ ] **Step 2: Add the shared type and JSON Schema field**

Define:

```ts
export type WindowPosition = 'bottom-left' | 'bottom-right' | 'center';

export interface PresentationHints {
  windowSize?: 's' | 'm' | 'l' | 'overlay';
  windowStyle?: 'card' | 'document';
  windowPosition?: WindowPosition;
}
```

Add the same optional enum to both node schemas, preserving `additionalProperties: false`.

- [ ] **Step 3: Update contract versions**

Change only `course_package` from `3.0.0` to `3.1.0` in `versions.json`, the TypeScript manifest, release-gate fixtures, and runtime expectations. Keep `extension_storage` at `2.0.0` because its root shape and version field do not change.

- [ ] **Step 4: Run contract tests**

Run:

```bash
cd v1
npm test -- contracts/release-gate.test.ts contracts/storage-schema.test.ts
cd backend
uv run pytest tests/test_runtime.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add v1/web/shared/src/portableContent.ts v1/contracts v1/backend/tests/test_runtime.py
git commit -m "feat: add node window position contract"
```

### Task 2: Make backend draft and release validation preserve position

**Files:**
- Modify: `v1/backend/app/modules/authoring_release/application_service.py`
- Test: `v1/backend/tests/test_draft_window_display.py`
- Test: `v1/backend/tests/test_authoring_release_api.py`
- Test: `v1/backend/tests/test_runtime.py`

- [ ] **Step 1: Add backend tests for the three positions**

Extend the draft/release fixtures so a node with each allowed position is accepted and returned unchanged. Add a case with no `windowPosition` and assert it remains readable as the default-right behavior. Add an unknown value such as `top-right` and assert the request is rejected with the existing node validation error.

- [ ] **Step 2: Run the focused backend tests**

Run:

```bash
cd v1/backend
uv run pytest tests/test_draft_window_display.py tests/test_authoring_release_api.py -q
```

Expected: FAIL for the new position cases.

- [ ] **Step 3: Update the canonical node validation**

Extend the allowed presentation hint keys and enum set in `application_service.py` with `windowPosition`. Keep it optional. When serializing the published package, preserve a supplied value and omit no unrelated fields. Update the emitted `contract_version` to `3.1.0`.

- [ ] **Step 4: Run backend tests and migration checks**

Run:

```bash
uv run pytest tests/test_draft_window_display.py tests/test_authoring_release_api.py tests/test_runtime.py -q
uv run ruff check app tests
uv run ruff format --check app tests
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add v1/backend/app/modules/authoring_release/application_service.py v1/backend/tests
git commit -m "feat: preserve node window position in releases"
```

### Task 3: Update extension validation and runtime positioning

**Files:**
- Modify: `v1/extension/background/validate.ts`
- Modify: `v1/extension/storage/index.ts`
- Modify: `v1/extension/content/richText.ts`
- Modify: `v1/extension/content/window.ts`
- Modify: `v1/extension/content/window.css`
- Test: `v1/extension/content/richText.test.ts`
- Test: `v1/extension/content/window.test.ts`
- Test: existing extension validation/storage tests that cover node schemas

- [ ] **Step 1: Add failing runtime tests**

Add tests asserting:

```ts
expect(resolveWindowPresentation({}).position).toBe('bottom-right');
expect(resolveWindowPresentation({ windowPosition: 'bottom-left' }).position).toBe('bottom-left');
expect(resolveWindowPresentation({ windowPosition: 'center' }).position).toBe('center');
expect(resolveWindowPresentation({ windowPosition: 'top-right' }).position).toBe('bottom-right');
```

Render a node with each position and assert the panel class includes `km-position-bottom-left`, `km-position-bottom-right`, or `km-position-center`.

- [ ] **Step 2: Run focused extension tests**

Run:

```bash
cd v1
npm test -- extension/content/richText.test.ts extension/content/window.test.ts
```

Expected: FAIL because the resolver returns only size/style and the panel has no position class.

- [ ] **Step 3: Implement position resolution and class output**

Add `WINDOW_POSITIONS`, `WindowPosition`, and a defaulting resolver in `richText.ts`. Extend the returned presentation object with `position`. Add the position class in `window.ts`. Extend all strict key checks in background validation and storage validation.

- [ ] **Step 4: Implement CSS position rules**

Keep the current right/bottom values as `km-position-bottom-right`. Add:

```css
.km-position-bottom-left { right: auto; left: 24px; }
.km-position-bottom-right { right: 24px; left: auto; }
.km-position-center { top: 50%; right: auto; bottom: auto; left: 50%; transform: translate(-50%, -50%); }
```

Ensure `km-size-overlay` owns the size/overlay behavior while position classes only own anchoring. Centered overlay must not receive a conflicting transform. Add media rules so left/right margins remain inside the viewport.

- [ ] **Step 5: Run extension tests and build**

Run:

```bash
npm test -- extension/content/richText.test.ts extension/content/window.test.ts extension/background/validate.test.ts extension/storage/storage.test.ts
npm --prefix extension run build:local
```

Expected: PASS and a local extension build in `v1/extension/dist/local`.

- [ ] **Step 6: Commit**

```bash
git add v1/extension
git commit -m "feat: position learning windows"
```

### Task 4: Refactor the teacher node dialog into the approved two-column layout

**Files:**
- Modify: `v1/web/teacher/src/pages/LessonPage.tsx`
- Modify: `v1/web/teacher/src/components/NodeForm.tsx`
- Modify: `v1/web/teacher/src/nodes.ts`
- Test: `v1/web/teacher/src/nodes.test.ts` for defaults and pure presentation helpers; browser acceptance covers rendered controls because this workspace has no React component test harness

- [ ] **Step 1: Add pure behavior tests and browser assertions**

Cover the approved behavior:

- a new node starts with `windowPosition: 'bottom-right'`;
- changing size, position, or style calls `onChange` with the updated `presentationHints`;
- the control is labeled `预览确认`;
- clicking `预览确认` does not call the parent node save handler;
- the existing bottom `保存节点` action remains the final node save action.

- [ ] **Step 2: Run the focused teacher tests**

Run:

```bash
cd v1
npm test -- web/teacher/src/nodes.test.ts
```

Expected: FAIL for the new default/helper assertions because the current node model has no position value. Rendered button and layout behavior is verified in Task 6's browser pass.

- [ ] **Step 3: Split the NodeForm responsibilities**

Keep the public `NodeForm` props unchanged. Move the existing field groups into internal components:

```tsx
const NodeContentEditor = ...
const StudentPreviewPanel = ...
const PreviewSettings = ...
```

Render the content editor and preview panel as siblings under a desktop grid. Put size, position, style, and `预览确认` below the preview stage. Use the existing `setHints` path so the preview always reads the same `node` object as the form.

- [ ] **Step 4: Tighten NodeDialog structure**

In `LessonPage.tsx`, make the header compact and avoid duplicating type and time as large independent blocks. Keep accessible names and the existing delete confirmation. Use a dialog body grid with the editor on the left and preview on the right, and retain the bottom action bar with `取消`, `删除节点`, and `保存节点`.

- [ ] **Step 5: Run teacher tests and type-check**

Run:

```bash
npm test -- web/teacher/src/components/NodeForm.test.tsx web/teacher/src/nodes.test.ts
npm run type-check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add v1/web/teacher/src/pages/LessonPage.tsx v1/web/teacher/src/components/NodeForm.tsx v1/web/teacher/src/nodes.ts v1/web/teacher/src/components
git commit -m "feat: compact teacher node dialog"
```

### Task 5: Apply visual density and responsive behavior

**Files:**
- Modify: `v1/web/teacher/src/index.css`
- Test: `v1/web/teacher/src/components/NodeForm.test.tsx` if selectors or labels change

- [ ] **Step 1: Define layout constraints**

Set the desktop dialog to a viewport-constrained layout with a stable two-column body, a minimum preview width, compact header padding, reduced section gaps, and a bottom action bar. Remove the large presentation card treatment and repeated explanatory labels.

- [ ] **Step 2: Style display settings as compact controls**

Use grouped segmented controls or compact selects for window size, position, and style. Keep the selected state visible and ensure `预览确认` reads as a local preview action, while `保存节点` remains the primary final action.

- [ ] **Step 3: Add responsive rules**

At the desktop breakpoint, keep both columns visible. At the narrow breakpoint, stack the editor above the preview, keep controls full width, and allow only the dialog body to scroll. Do not use viewport-scaled font sizes.

- [ ] **Step 4: Run the build**

Run:

```bash
npm run type-check
npm run build
```

Expected: PASS with no layout-related build errors.

- [ ] **Step 5: Commit**

```bash
git add v1/web/teacher/src/index.css
git commit -m "style: tighten node dialog layout"
```

### Task 6: Run end-to-end verification and browser inspection

**Files:**
- Test: all affected frontend, backend, contract, and extension tests
- Modify: `docs/CHANGELOG.md`
- Modify: `next.md`

- [ ] **Step 1: Run the full relevant test set**

Run:

```bash
cd v1/backend
uv run pytest
uv run ruff check .
uv run ruff format --check .
cd ..
npm test
npm run check
npm run type-check
npm run build
```

Expected: PASS. Any pre-existing warning must be reported separately from failures.

- [ ] **Step 2: Start the local stack**

Run from the repository root:

```bash
./dev-up.sh
```

Verify:

```bash
curl -fsS http://127.0.0.1:8000/health
curl -fsS http://localhost:5174/
```

- [ ] **Step 3: Inspect the dialog in a real browser**

Open the teacher page, enter the existing teacher account, open a lesson node, and verify at 1440 x 900:

- editor and preview are visible together;
- display settings are below the preview;
- `预览确认` is visible;
- `保存节点` remains in the bottom action bar;
- changing position changes the preview anchor;
- changing size/style changes preview classes without losing content.

Repeat at 1024 width and 375 x 900. Confirm narrow screens stack without overlap or clipped controls.

- [ ] **Step 4: Update documentation**

Record only verified behavior in `docs/CHANGELOG.md`. Update `next.md` with the implementation status, affected contract version `course_package 3.1.0`, and the exact verification commands.

- [ ] **Step 5: Commit documentation**

```bash
git add docs/CHANGELOG.md next.md
git commit -m "docs: record compact node dialog delivery"
```

### Task 7: Final review and repository state

**Files:**
- Review: all commits in this implementation
- Review: `git diff origin/main...HEAD`

- [ ] **Step 1: Check the diff for scope and secrets**

Run:

```bash
git diff --check origin/main...HEAD
git status --short --branch
rg -n 'SESSION_SECRET|ACCESS_CODE_SECRET|password_hash|temporary_password' docs v1 --glob '!*.lock'
```

Expected: no whitespace errors, no tracked local secrets, and no unrelated files.

- [ ] **Step 2: Perform the contract/runtime consistency review**

Confirm that the same allowed values and default appear in:

- shared TypeScript;
- both JSON Schemas;
- backend validation;
- extension validation/storage;
- teacher defaults;
- extension resolver and CSS.

- [ ] **Step 3: Report residual risk**

Report any browser-only limitation, especially if the full node form is too tall for a specific desktop viewport or if the existing account cannot be used for live verification.
