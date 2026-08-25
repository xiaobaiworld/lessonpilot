# V1.0.5 Popup Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the 0.9.2 student popup entry points in V1 and release the extension as version 1.0.5.

**Architecture:** Keep the V1 popup renderer and background message boundary. Add target-derived navigation/update configuration and a small popup footer for trial, teacher login, and plugin update. Do not reintroduce legacy source files or legacy storage.

**Tech Stack:** TypeScript, Vite, Chrome MV3, Vitest.

---

### Task 1: Lock the version and target URLs

**Files:**
- Modify: `v1/extension/manifest/targets.ts`
- Modify: `v1/extension/manifest/targets.test.ts`

- [ ] **Step 1: Write failing assertions** for version `1.0.5`, production URLs, and local teacher URL.
- [ ] **Step 2: Run `npm --prefix v1 test -- extension/manifest/targets.test.ts` and confirm the new assertions fail.
- [ ] **Step 3: Add target fields for `teacherOrigin`, `trialUrl`, and `studentPluginDownloadUrl`; set the version to `1.0.5`.
- [ ] **Step 4: Run the manifest test and type-check.
- [ ] **Step 5: Keep the generated manifest contract aligned with the new URLs.

### Task 2: Restore popup links and online update

**Files:**
- Modify: `v1/extension/popup/index.ts`
- Modify: `v1/extension/popup/popup.css`
- Modify: `v1/extension/vite.config.ts`
- Modify: `v1/extension/manifest/targets.ts`
- Test: `v1/extension/popup/popup.test.ts`

- [ ] **Step 1: Write a source-level popup regression test** asserting trial link, teacher link, update URL, and preserved V1 actions.
- [ ] **Step 2: Run the popup test and confirm it fails because the new controls do not exist.
- [ ] **Step 3: Add compile-time `__TEACHER_ORIGIN__`, `__TRIAL_URL__`, and `__STUDENT_PLUGIN_DOWNLOAD_URL__` values.
- [ ] **Step 4: Render a parity footer with trial link, teacher-login link, and update button.
- [ ] **Step 5: Implement the update click through `chrome.downloads.download` with visible status and failure handling.
- [ ] **Step 6: Add the minimum `downloads` permission and include the popup CSS.
- [ ] **Step 7: Run the popup test, type-check, and both local/production extension builds.

### Task 3: Refresh the local test directory

**Files:**
- Modify: `tools/refresh-local-plugin.sh`

- [ ] **Step 1: Run `tools/refresh-local-plugin.sh`.
- [ ] **Step 2: Verify `/Users/bai/Downloads/knownmapplugin (1)/manifest.json` reports `1.0.5`.
- [ ] **Step 3: Verify the copied popup artifact contains the three restored controls and no legacy popup entrypoint.

### Task 4: Focused verification

**Files:**
- No source changes.

- [ ] **Step 1: Run `npm --prefix v1 test -- extension/manifest/targets.test.ts extension/popup/popup.test.ts`.
- [ ] **Step 2: Run `npm --prefix v1 run type-check`.
- [ ] **Step 3: Run the local and production extension builds.
- [ ] **Step 4: Inspect the generated manifest and popup HTML for version, permissions, popup entrypoint, and URLs.
