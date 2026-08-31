# 学生插件内容脚本单文件构建 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复学生插件内容脚本的模块加载错误，发布可在 B 站页面运行的 1.2.2 插件。

**Architecture:** 将 content script 从现有多入口构建中分离为独立单入口构建，并内联其全部依赖；background、popup、settings 保持各自现有模块入口。发布门禁检查 content script 不能含顶层静态 import。

**Tech Stack:** Vite 6、Rollup、Chrome MV3、TypeScript、Vitest、`tools/release.sh`。

---

### Task 1: 添加内容脚本产物回归检查

**Files:**
- Modify: `v1/extension/manifest/targets.test.ts`

- [ ] **Step 1: Write the failing test**

新增一个测试，读取 local/production 构建产物的内容脚本，并断言它不存在顶层静态模块导入。测试先在当前坏产物上失败，证明门禁能捕获现有问题。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix v1 test -- extension/manifest/targets.test.ts`

Expected: FAIL，失败原因是 `content/index.js` 仍以 `import` 开头或包含静态模块入口。

- [ ] **Step 3: Keep the test focused**

测试只检查内容脚本的可执行产物，不检查 background、popup 或 settings，因为它们允许模块化入口。

### Task 2: 分离内容脚本构建并升级版本

**Files:**
- Modify: `v1/extension/vite.config.ts`
- Modify: `v1/extension/manifest/targets.ts`
- Modify: `tools/release.sh`

- [ ] **Step 1: Implement the smallest build change**

为 content entry 使用独立的单入口 Rollup 构建，设置 `inlineDynamicImports: true`，输出固定为 `content/index.js`；保留其余入口的多入口构建和资源复制逻辑。

- [ ] **Step 2: Bump the extension version**

将 `EXTENSION_VERSION` 从 `1.2.1` 改为 `1.2.2`，不修改 manifest 的其他权限或 host 范围。

- [ ] **Step 3: Add release protection**

在 `tools/release.sh` 生成生产 ZIP 前检查 `dist/production/content/index.js` 不以静态 `import` 开头；失败时停止发布并给出明确错误。

- [ ] **Step 4: Run the focused test**

Run: `npm --prefix v1 test -- extension/manifest/targets.test.ts`

Expected: PASS。

### Task 3: 构建和静态验证

**Files:**
- No new files

- [ ] **Step 1: Run extension type-check and tests**

Run: `npm --prefix v1/extension run type-check` and `npm --prefix v1 test -- extension`

Expected: type-check succeeds and all extension tests pass。

- [ ] **Step 2: Build both targets**

Run: `npm --prefix v1/extension run build:all`

Expected: local/production builds succeed; both manifests report `1.2.2`。

- [ ] **Step 3: Inspect content outputs**

Run: `sed -n '1p' v1/extension/dist/local/content/index.js; sed -n '1p' v1/extension/dist/production/content/index.js; find v1/extension/dist/production -type f | sort`

Expected: both content entries start with executable bundled code rather than `import`。

### Task 4: Commit, publish, and verify production

**Files:**
- No source changes beyond Tasks 1–2

- [ ] **Step 1: Review and commit source changes**

Run: `git diff --check; git status --short; git diff -- v1/extension/vite.config.ts v1/extension/manifest/targets.ts tools/release.sh v1/extension/manifest/targets.test.ts`

Then commit with: `git add ... && git commit -m "fix: bundle student content script for chrome"`。

- [ ] **Step 2: Push the commit to GitHub**

Run: `git push origin main`。

- [ ] **Step 3: Publish the exact commit to Aliyun**

Run: `KNOWNMAP_SSH_HOST=aliyun-us tools/release.sh deploy <commit-sha>`。

- [ ] **Step 4: Verify the online package**

Download `https://knownmap.com/downloads/student-plugin/knownmapplugin.zip`, check manifest version `1.2.2`, and verify `content/index.js` has no static import entry.

- [ ] **Step 5: Verify the live Bilibili flow**

Reload the Bilibili page for `BV1xihA6PE6g`, confirm no content-script syntax error, confirm the companion host is mounted, and verify the 10.007-second node triggers after the course is available locally.
