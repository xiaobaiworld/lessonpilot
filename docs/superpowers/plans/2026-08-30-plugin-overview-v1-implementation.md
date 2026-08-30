# 学生插件功能总览 V1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将已经确认的功能总览 V1 从设计草稿真正接入学生插件，并保证版本只在插件代码/资源实际变更时升级。

**Architecture:** 以现有 MV3 popup 为唯一高频入口，新增“首页 / 插件设置”两个紧凑视图；background 继续作为本地存储、课程升级和角色资源的唯一边界。复用已有课程升级接口与本地 `StudentSettings`，不伪造不存在的学生账号认证或推荐数据，缺失的后端域保留为明确的不可用入口。

**Tech Stack:** TypeScript、Vite、Chrome MV3、Vitest、Chrome storage、现有课程升级 API。

---

### Task 1: 固定总览数据边界与版本门禁

**Files:**
- Modify: `v1/extension/shared/library-view.ts`
- Modify: `v1/extension/storage/index.ts`
- Modify: `v1/extension/background/service-worker.ts`
- Modify: `v1/contracts/schemas/extension-messages.schema.json`
- Test: `v1/extension/shared/library-view.test.ts`
- Test: `v1/extension/storage/storage.test.ts`
- Test: `v1/extension/background/messages.test.ts`

- [x] **Step 1: Write failing tests** for settings read/write and course release fields exposed to the popup.
- [x] **Step 2: Run the focused tests** and confirm they fail because no settings messages/release view contract exists.
- [x] **Step 3: Implement minimal message and storage APIs**: add `getStudentSettings`, `setStudentSettings`, expose installed release metadata, and preserve the existing serialized write queue.
- [x] **Step 4: Run focused tests** and confirm they pass.

### Task 2: Implement the popup V1 home view

**Files:**
- Modify: `v1/extension/popup/index.ts`
- Modify: `v1/extension/popup/popup.css`
- Modify: `v1/extension/popup/popup.test.ts`

- [x] **Step 1: Write failing source-contract tests** for the account row, upgrade notice, “领取新课程”, “需要升级”, “全部课程”, “为你推荐”, and settings navigation.
- [x] **Step 2: Run the popup tests** and confirm the V1 sections are absent.
- [x] **Step 3: Implement the compact home view** using real library/settings/update responses, with empty states for unavailable account/recommendation data and working course upgrade actions.
- [x] **Step 4: Replace the old gear behavior** so it opens the in-popup settings view and can return to home without losing state.
- [x] **Step 5: Run popup tests and the extension type-check.**

### Task 3: Implement the popup V1 settings view

**Files:**
- Modify: `v1/extension/popup/index.ts`
- Modify: `v1/extension/popup/popup.css`
- The existing `v1/extension/settings/` companion editor remains unchanged and is opened from the new popup settings hub.

- [x] **Step 1: Write failing tests** for settings navigation, persisted homepage toggles, upgrade check action, companion entry, sound switch, maintenance version, and future-feature labels.
- [x] **Step 2: Run settings tests** and confirm the current companion-only page cannot satisfy them.
- [x] **Step 3: Implement the compact settings hub** in the popup and wire its controls to background storage/messages; retain the existing companion editor as the selected companion subpage.
- [x] **Step 4: Ensure close/back controls return to the previous popup view where the browser permits it, and safely fall back to opening the companion editor in a tab.**
- [x] **Step 5: Run all extension tests and build local/production packages.**

### Task 4: Release only the actual plugin implementation

**Files:**
- Modify: `v1/extension/manifest/targets.ts`
- Modify: `docs/CHANGELOG.md`
- Modify: `doc/SYSTEM-OVERVIEW.md`
- Modify: `doc/插件文件资源管理.md`

- [x] **Step 1: Bump `EXTENSION_VERSION` from `1.1.1` to `1.2.0` only after Tasks 1–3 change the plugin package.**
- [x] **Step 2: Document the actual delivered V1 scope and explicitly list student auth/recommendations as backend-blocked, not completed.**
- [x] **Step 3: Build both targets and verify manifest, artifact list, ZIP contents, and no localhost permission in production.**
- [x] **Step 4: Commit plugin code/docs together, push, publish using the existing release workflow, and verify the remote package reports `1.2.0`.**

### Scope gap recorded for the next backend plan

The repository currently has no student account table, registration/login/session endpoints, account binding model, or recommendation directory API. The V1 plugin will show this as an unavailable account/recommendation entry rather than pretending it works. A later backend plan must define those contracts before implementation and must trigger its own plugin version bump when the extension consumes them.
