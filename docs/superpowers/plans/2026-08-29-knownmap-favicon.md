# KnownMap Web favicon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the existing KnownMap square SVG as the browser favicon for both web applications.

**Architecture:** Keep the existing SVG as the single source of truth. Add a relative `<link rel="icon">` to each Vite HTML entry so Vite resolves the shared asset during each app build; no React or route changes are needed.

**Tech Stack:** Vite, static HTML, SVG.

---

### Task 1: Add favicon declarations to both web entries

**Files:**
- Modify: `v1/web/teacher/index.html`
- Modify: `v1/web/admin/index.html`
- Reuse: `v1/extension/assets/knownmap/knownmap-square.svg`

- [x] **Step 1: Add the teacher entry declaration**

Add this line inside the teacher page `<head>`:

```html
<link rel="icon" type="image/svg+xml" href="../../extension/assets/knownmap/knownmap-square.svg" />
```

- [x] **Step 2: Add the admin entry declaration**

Add the same line inside the admin page `<head>` so both apps use the identical source asset.

- [x] **Step 3: Build both applications**

Run:

```bash
npm --prefix v1 run build
```

Expected: both `@v1/web-admin` and `@v1/web-teacher` Vite builds complete successfully.

- [x] **Step 4: Verify built HTML and assets**

Confirm each build output contains a favicon link and a copied SVG asset, and that no favicon reference points to a missing file.

- [x] **Step 5: Review the final diff**

Run:

```bash
git diff -- v1/web/teacher/index.html v1/web/admin/index.html
```

Expected: only the two favicon `<link>` declarations are changed.
