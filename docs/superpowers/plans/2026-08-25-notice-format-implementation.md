# Structured Notice Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the V1 example course's long single-paragraph notice with a safe, structured C-style summary while preserving legacy notice rendering and existing playback behavior.

**Architecture:** Extend the notice display contract with optional text-only summary fields. Keep the runtime model unchanged and render the fields in `LearningWindow` through DOM text nodes, with the existing `body` path as fallback. Add only the teacher fields needed to author the same layout; no global redesign.

**Tech Stack:** TypeScript, Vitest, Vite, Chrome MV3 content script, Shadow DOM CSS.

---

### Task 1: Lock the display contract with tests

**Files:**
- Create: `v1/extension/content/notice.test.ts`
- Create: `v1/extension/content/notice.ts`
- Test: `v1/extension/content/notice.test.ts`

- [x] **Step 1: Write failing renderer tests**

Add pure tests for the notice normalizer: structured fields are preferred, the current long body becomes three sections, ordinary legacy body returns no structured model, and incomplete structured data is rejected.

- [x] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm --prefix v1 test -- extension/content/notice.test.ts
```

Expected: the test fails because the normalizer does not exist yet.

### Task 2: Add the optional notice display schema

**Files:**
- Modify: `backend/app/schemas/script.py`
- Test: `backend/tests/unit/test_script_schema.py`

- [x] **Step 1: Add optional text-only fields**

Allow `eyebrow`, `intro`, three `sections`, and `summary` under `noticeNode.display`, with required non-empty text for every declared label/body and no HTML field. Require all structured fields together so the teacher cannot publish a partial layout.

- [x] **Step 2: Run the relevant contract test**

Run `backend/.venv/bin/pytest -q backend/tests/unit/test_script_schema.py`. Expected: existing notice fixtures remain valid and structured notice fixtures pass.

### Task 3: Implement C-style structured notice rendering

**Files:**
- Modify: `v1/extension/content/window.ts`
- Modify: `v1/extension/content/window.css`
- Modify: `v1/extension/content/notice.ts`
- Test: `v1/extension/content/notice.test.ts`

- [x] **Step 1: Add minimal DOM helpers**

Add private helpers for text blocks, summary sections, and the summary callout. Use `textContent` only. In the notice branch, render the structured fields when all three sections are valid; otherwise render the existing `body` paragraph.

- [x] **Step 2: Add layout styles**

Add compact header metadata, intro styling, vertical summary rows, summary callout, fixed footer behavior, responsive width/height limits, and internal scrolling. Keep the current button label and Shadow DOM boundary.

- [x] **Step 3: Run focused tests**

Run:

```bash
npm --prefix v1 test -- extension/content/window.test.ts extension/content/index.regression.test.ts
```

Expected: structured and legacy notice tests pass, and the confirmation label regression remains green.

### Task 4: Add teacher authoring support

**Files:**
- Modify: `v1/web/teacher/src/components/NodeForm.tsx`
- Modify: `v1/web/teacher/src/nodes.ts`
- Test: `v1/web/teacher/src/nodes.test.ts`

- [x] **Step 1: Add optional C-layout fields**

Keep the existing body field as the old-runtime fallback. Add an opt-in editor section for the eyebrow, intro, three sections, and summary; require all fields when the structured editor is enabled.

- [x] **Step 2: Verify teacher validation**

Run `npm --prefix v1 test -- web/teacher/src/nodes.test.ts`. Expected: complete structured notices pass and partial ones are rejected.

### Task 5: Verify the V1 plugin scope

**Files:**
- No additional source files.

- [x] **Step 1: Run V1 extension tests**

```bash
npm --prefix v1 test -- extension/content/window.test.ts extension/content/index.regression.test.ts
```

- [x] **Step 2: Run type-check and production build**

```bash
npm --prefix v1/extension run type-check
npm --prefix v1/extension run build:production
```

Expected: both commands pass and the build contains the updated content script and window CSS.

- [x] **Step 3: Inspect the final extension artifact**

Check `v1/extension/dist/production/manifest.json` and the final ZIP only for the updated V1 extension. Confirm the version is incremented from `1.0.2` to `1.0.3`, and the package contains the content script, CSS, and icons.

- [x] **Step 4: Commit the V1 change**

```bash
git add v1/extension/content/window.ts v1/extension/content/window.css v1/extension/content/window.test.ts archive/legacy-v0.9.1/extension-src/content/config/example-course.js archive/legacy-v0.9.1/extension-src/contracts/schemas/course-package.v1.schema.json archive/legacy-v0.9.1/tests/example-course.test.js
git commit -m "feat: structure V1 notice summaries"
```
