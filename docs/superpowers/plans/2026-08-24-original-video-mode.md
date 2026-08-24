# 原视频模式与暂停确认提示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在学生端小人入口旁加入紧凑的“原视频 / 课程”模式切换，优化 2 秒重点提示窗口，并发布新的 legacy 与 v1 插件版本。

**Architecture:** 继续使用 legacy 学生插件的 `MascotWidget`、`bili-player` 和 `createNodeTimeline`，由 `src/content/index.js` 负责把模式状态接到播放器和时间线。模式偏好使用当前 B 站页面的 `localStorage` 保存；时间线增加可暂停/恢复的启用状态，原视频模式下不触发课程节点。发布仍由 `tools/teacher-platform-release.sh` 的 `v1-apps` profile 从精确 Git 提交构建，同时产出 `knownmapplugin.zip` 与 `knownmap-v1.zip`。

**Tech Stack:** Chrome MV3 content script, vanilla DOM/CSS, Node built-in test runner, Vite/TypeScript v1 extension build, GitHub Actions, SSH production release scripts.

---

### Task 1: Lock the user-visible course copy and version targets

**Files:**
- Modify: `src/content/config/example-course.js`
- Modify: `src/manifest.json`
- Modify: `v1/extension/manifest/targets.ts`
- Test: `tests/example-course.test.js`
- Test: `tests/access-code-panel.test.js`

- [ ] **Step 1: Write failing assertions for copy and versions**

Add assertions that the bundled first node title is exactly `重点提示`, its body contains `4 道题` and `加油`, and neither the legacy manifest nor the production v1 manifest builder keeps the previous version.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
node --test tests/example-course.test.js tests/access-code-panel.test.js
```

Expected: failure because the example node title/body and version values still contain the old state.

- [ ] **Step 3: Make the minimal content and version changes**

Change the first bundled node title to `重点提示`, append a concise four-question route and the final `加油`, set `src/manifest.json` to `0.9.2`, and set `EXTENSION_VERSION` in `v1/extension/manifest/targets.ts` to `1.0.1`.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run the same command. Expected: all focused tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/config/example-course.js src/manifest.json \
  v1/extension/manifest/targets.ts tests/example-course.test.js \
  tests/access-code-panel.test.js
git commit -m "feat: version student plugins for original video mode"
```

### Task 2: Add pure video-mode and timeline suspension behavior

**Files:**
- Modify: `src/content/course-runtime.js`
- Test: `tests/course-runtime.test.js`

- [ ] **Step 1: Write failing tests**

Add tests covering:

```js
test('video mode store defaults to course and persists original mode', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  const store = createVideoModeStore(storage);

  assert.equal(store.read(), 'course');
  store.write('original');
  assert.equal(store.read(), 'original');
});

test('timeline does not trigger nodes while disabled and can resume at the current time', () => {
  const seen = [];
  const timeline = createNodeTimeline({
    nodes: [{ id: 'notice', enabled: true, interaction: 'notice', trigger: { timeSeconds: 2 } }]
  }, (node) => seen.push(node.id));

  timeline.setEnabled(false);
  timeline.update(3);
  assert.deepEqual(seen, []);

  timeline.setEnabled(true);
  timeline.reset();
  timeline.update(3);
  assert.deepEqual(seen, ['notice']);
});
```

- [ ] **Step 2: Run the focused test file and verify the new tests fail**

Run:

```bash
node --test tests/course-runtime.test.js
```

Expected: `createVideoModeStore` and `timeline.setEnabled` are missing.

- [ ] **Step 3: Implement the minimal pure helpers**

Add `createVideoModeStore(storage)` with a fixed storage key and fail-closed behavior (`course` for malformed or unavailable storage). Add `enabled` state to `createNodeTimeline`, make `update` return while disabled, and expose `setEnabled(enabled)` while preserving existing completion and rewind semantics.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run:

```bash
node --test tests/course-runtime.test.js
```

Expected: all timeline and mode-store tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/course-runtime.js tests/course-runtime.test.js
git commit -m "feat: add persisted course playback mode state"
```

### Task 3: Add the compact mode control and confirm-to-continue notice

**Files:**
- Modify: `src/content/mascot/mascot.js`
- Modify: `src/content/mascot/mascot.css`
- Modify: `src/content/index.js`
- Test: `tests/access-code-panel.test.js`

- [ ] **Step 1: Add failing source-level regression assertions**

Extend the existing content integration test to require:

```js
assert.match(mascot, /lessonpilot:video-mode-toggle/);
assert.match(mascot, /确认并继续/);
assert.match(mascot, /setVideoMode/);
assert.match(mascotCss, /lessonpilot-mascot-mode-btn/);
assert.match(contentEntry, /createVideoModeStore/);
assert.match(contentEntry, /timeline\.setEnabled/);
assert.match(contentEntry, /原视频/);
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node --test tests/access-code-panel.test.js
```

Expected: failure because the compact mode button, event, and confirm copy do not exist.

- [ ] **Step 3: Implement the mascot control**

In `MascotWidget`:

- Add a compact mode button beside the pause control.
- Render `原视频` in course mode and `课程` in original mode.
- Dispatch `lessonpilot:video-mode-toggle` on click.
- Add `setVideoMode(mode)` to update the label and `data-mode`.
- For notice nodes, use a single `确认并继续` action. After the existing submit callback succeeds, hide the dialog and call `onContinue()` immediately, so playback resumes only after that click.

In `mascot.css`:

- Keep the mode button compact, with the existing pill shape and small text.
- Increase only the dialog card to `min(520px, calc(100vw - 32px))`.
- Add `max-height` and overflow handling for long course copy.
- Use readable body line height and spacing without covering the whole video.

In `src/content/index.js`:

- Read the mode store before wiring the timeline.
- Initialize the mascot with the stored mode.
- On mode toggle, persist the new mode and call `timeline.setEnabled(mode === 'course')`.
- When entering original mode, cancel/hide any visible course dialog and resume the player.
- When returning to course mode, reset the timeline against the current video time so due course nodes can be shown.

- [ ] **Step 4: Run the focused regression tests**

Run:

```bash
node --test tests/access-code-panel.test.js tests/course-runtime.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/mascot/mascot.js src/content/mascot/mascot.css \
  src/content/index.js tests/access-code-panel.test.js
git commit -m "feat: add compact original video mode toggle"
```

### Task 4: Verify the full repository and release documentation

**Files:**
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/superpowers/specs/2026-08-24-original-video-mode-design.md`

- [ ] **Step 1: Add the verified change to the changelog**

Record the learner-visible behavior, legacy version `0.9.2`, v1 extension version `1.0.1`, and the test/release verification requirement. Do not claim production success before deployment completes.

- [ ] **Step 2: Run local verification**

Run:

```bash
npm run test:legacy
npm run test:v1
npm run check
npm run traceability:check
```

Expected: every command exits with status 0.

- [ ] **Step 3: Inspect the diff and commit documentation**

```bash
git diff --check
git status --short
git add docs/CHANGELOG.md docs/superpowers/specs/2026-08-24-original-video-mode-design.md
git commit -m "docs: record original video mode release scope"
```

### Task 5: Push, wait for CI, deploy and verify both plugin packages

**Files:**
- Create: `deploy/releases/<release-id>.json`

- [ ] **Step 1: Push the implementation commits to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Wait for required GitHub checks**

```bash
gh run list --branch main --limit 5
gh run watch <test-run-id> --exit-status --interval 5
```

Required checks: `node-test`, `backend-test`, and `contract-check`.

- [ ] **Step 3: Deploy the exact successful commit**

```bash
KNOWNMAP_SSH_HOST=aliyun \
KNOWNMAP_PUBLISH_PROFILE=v1-apps \
tools/teacher-platform-release.sh deploy <full-commit-sha>
```

Expected: a verified production release ID and a generated release record.

- [ ] **Step 4: Verify the live legacy plugin**

```bash
curl -fsSL --retry 2 -o /tmp/knownmapplugin-live-check.zip \
  "https://knownmap.com/downloads/student-plugin/knownmapplugin.zip?release=<release-id>"
unzip -p /tmp/knownmapplugin-live-check.zip content/mascot/mascot.js | \
  rg -n "lessonpilot:video-mode-toggle|确认并继续"
unzip -p /tmp/knownmapplugin-live-check.zip manifest.json | \
  rg -n '"version": "0.9.2"'
```

- [ ] **Step 5: Verify the live v1 plugin**

```bash
curl -fsSL --retry 2 -o /tmp/knownmap-v1-live-check.zip \
  "https://knownmap.com/downloads/student-plugin/knownmap-v1.zip?release=<release-id>"
unzip -p /tmp/knownmap-v1-live-check.zip manifest.json | \
  rg -n '"version": "1.0.1"'
```

- [ ] **Step 6: Commit and push the generated production record**

```bash
git add deploy/releases/<release-id>.json
git commit -m "docs: record production release for original video mode"
git push origin main
```

- [ ] **Step 7: Check final repository and production state**

```bash
git status --short --branch
KNOWNMAP_SSH_HOST=aliyun \
KNOWNMAP_PUBLISH_PROFILE=v1-apps \
tools/teacher-platform-release.sh status
```

Expected: clean `main`, verified release, and both plugin download URLs serving the new packages.
