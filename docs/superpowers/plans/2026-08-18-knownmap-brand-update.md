# KnownMap Brand Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the user-visible LessonPilot brand with KnownMap, generate the approved map-window logo assets, and synchronize current documentation without changing protocol compatibility identifiers.

**Architecture:** Keep one canonical SVG in `src/assets/knownmap-logo.svg`, export PNG resources for the extension and web, and reference those generated files from the manifest and pages. Treat user-visible copy separately from compatibility identifiers: page text, manifest metadata, and current docs change to KnownMap; channels, storage keys, globals, repository paths, and archived documents remain unchanged.

**Tech Stack:** Static HTML/CSS/JavaScript, Chrome Manifest V3, SVG/PNG assets, Node.js test runner, macOS image tooling or ImageMagick for raster export.

---

### Task 1: Lock the brand contract with tests

**Files:**
- Create: `tests/knownmap-brand.test.js`
- Modify: `next.md`

- [x] **Step 1: Add assertions for the canonical brand assets**

The test must require `src/assets/knownmap-logo.svg`, PNG files at 16/24/48/128 pixels, the approved color values, two weakened same-color vertical fold lines, and no old LP icon text.

- [x] **Step 2: Add assertions for user-visible page and manifest branding**

Require `KnownMap` in `src/manifest.json` and the four teacher pages, require the logo image in their headers, and reject user-visible `LessonPilot` / `LP` brand text.

- [x] **Step 3: Add compatibility assertions**

Require `lessonpilot.workspace.v1`, `lessonpilot.extension.v1`, `lessonpilot.workspaceDraft.v1`, and the existing JavaScript globals to remain unchanged.

- [x] **Step 4: Run the focused test and verify RED**

Run: `node --test tests/knownmap-brand.test.js`

Expected: FAIL because the canonical SVG and KnownMap page branding do not exist yet.

### Task 2: Generate the approved logo resources

**Files:**
- Create: `src/assets/knownmap-logo.svg`
- Create: `src/assets/icon-24.png`
- Replace: `src/assets/icon-16.png`
- Replace: `src/assets/icon-48.png`
- Replace: `src/assets/icon-128.png`
- Create: `teacher-web/assets/knownmap-icon.png`

- [x] **Step 1: Create the canonical SVG**

Use the approved deep-green circular background, pale-green map outline, white main route, two white vertical fold lines at 48% opacity, and gold/clay nodes. The vertical lines remain inside the map boundary.

- [x] **Step 2: Export the four exact PNG sizes**

Generate 16px, 24px, 48px, and 128px square RGBA PNG files from the same SVG geometry. Copy the 48px export to `teacher-web/assets/knownmap-icon.png` for web use.

- [x] **Step 3: Run the focused test**

Run: `node --test tests/knownmap-brand.test.js`

Expected: Asset assertions pass; manifest/page assertions still fail.

### Task 3: Update the extension and user-visible pages

**Files:**
- Modify: `src/manifest.json`
- Modify: `src/content/mascot/mascot.js`
- Modify: `src/background/service-worker.js`
- Modify: `teacher-web/index.html`
- Modify: `teacher-web/editor.html`
- Modify: `teacher-web/forsales.html`
- Modify: `teacher-web/workspace.html`
- Modify: `teacher-web/styles.css`
- Modify: `teacher-web/app.js`
- Modify: `.github/workflows/pages.yml`

- [x] **Step 1: Update manifest metadata and icon declarations**

Set the extension name to `KnownMap`, update its user-visible description, and declare the 16/24/48/128 icon files without changing match patterns or permissions.

- [x] **Step 2: Replace page branding**

Change titles, descriptions, visible product names, accessibility labels, and the old LP mark. Use `assets/knownmap-icon.png` in each page header or diagnostic identity area.

- [x] **Step 3: Keep internal compatibility identifiers**

Do not rename `LessonPilot*` JavaScript globals, `lessonpilot.*` channels, DOM IDs, CSS class names, storage keys, GitHub Pages paths, or repository names.

- [x] **Step 4: Publish the web icon**

Add `teacher-web/assets/knownmap-icon.png` to the Pages allowlist and update the publish-set test expectation if needed.

- [x] **Step 5: Run focused page and brand tests**

Run: `node --test tests/knownmap-brand.test.js tests/page-information-architecture.test.js tests/sales-page-copy.test.js`

Expected: PASS.

### Task 4: Synchronize current documentation

**Files:**
- Modify: `README.md`
- Modify: `next.md`
- Modify: `doc/INDEX.md`
- Modify: `doc/DECISIONS.md`
- Modify: `doc/requirements.md`
- Modify: `doc/requirements/stage-1b.md`
- Modify: `doc/dev-plan.md`
- Modify: `doc/data-spec.md`
- Modify: `doc/stage-one-validation-loop-design.md`
- Modify: `doc/ui-design.md`
- Modify: `doc/teacher-sales-page-design.md`
- Modify: `doc/teacher-course-workspace-design.md`
- Modify: `doc/plans/stage-1b-sales-page-revision.md`
- Modify: `tests/manual/stage-1a-bridge/README.md`
- Modify: `changelog.md`
- Modify: `AI_Brand_Domain_Selection_Report_v0.1.md`
- Modify: `AI_Brand_Naming_Project.md`

- [x] **Step 1: Update current authoritative titles and prose**

Use `KnownMap` for the product and `knownmap.com` for the domain. Add the logo design spec and D-014 to the document index.

- [x] **Step 2: Mark historical documents instead of rewriting history**

Where an older report or filename intentionally records LessonPilot-era analysis, add a short status note and a link to D-014 instead of mechanically rewriting historical evidence.

- [x] **Step 3: Preserve technical identifiers in data documentation**

Keep `lessonpilot.workspace.v1`, `lessonpilot.extension.v1`, and `lessonpilot.workspaceDraft.v1` as compatibility identifiers, explicitly noting that they retain the legacy prefix.

- [x] **Step 4: Record verified change scope**

Update the changelog only after tests and visual checks pass.

### Task 5: Verify behavior and visual integration

**Files:**
- Test: `tests/*.test.js`
- Inspect: `teacher-web/index.html`
- Inspect: `teacher-web/editor.html`
- Inspect: `teacher-web/forsales.html`
- Inspect: `teacher-web/workspace.html`

- [x] **Step 1: Run the full automated suite**

Run: `node --test tests/*.test.js`

Expected: 0 failures.

- [x] **Step 2: Verify asset metadata**

Run: `file src/assets/knownmap-logo.svg src/assets/icon-16.png src/assets/icon-24.png src/assets/icon-48.png src/assets/icon-128.png teacher-web/assets/knownmap-icon.png`

Expected: exact PNG dimensions and valid SVG/XML.

- [x] **Step 3: Search for unintended legacy branding**

Run an `rg` search over current pages, manifest, README, and current authoritative docs. Every remaining `LessonPilot` occurrence must be an internal compatibility identifier, historical note, repository path, or archived material.

- [x] **Step 4: Start the local server and inspect desktop/mobile pages**

Run: `python3 -m http.server 4173`

Check the sales page, sample workspace, editor, and diagnostics page at desktop and 375px mobile widths. Verify the logo loads, header text fits, no horizontal overflow appears, and the console has no project errors.

- [x] **Step 5: Update D-014 status and changelog**

After verification, mark D-014 as implemented and verified, record the exact test result, and summarize any retained legacy identifiers.
