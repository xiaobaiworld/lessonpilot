# 互动节点暂停视频 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the student extension resume video after a node only when the extension paused a previously playing video, then build the local extension as version `1.0.8`.

**Architecture:** Keep `LearningSession` responsible for node lifecycle actions. Add one playback-state observation to the `PlayerHandle` host adapter and keep pause ownership in `CourseRuntime`, which coordinates the session and player. The local MV3 build remains the source of truth for `dist/local`.

**Tech Stack:** TypeScript, Vitest, Vite MV3 extension build, Chrome unpacked extension.

---

### Task 1: Add the failing playback-ownership regression test

**Files:**
- Modify: `v1/extension/content/runtime.test.ts`
- Modify: `v1/extension/host/bilibili/index.ts`

- [ ] **Step 1: Extend the fake player with observable playback state**

Add `isPlaying()` to `FakePlayer`, returning `!this.paused`, so the runtime test can model the host adapter contract.

- [ ] **Step 2: Add the red test**

Add a test in the runtime behavior section:

```ts
it('节点触发前视频已暂停时，关闭节点不自动恢复播放', async () => {
  const h = harness();
  h.player.paused = true;
  await h.runtime.start('BV1Ac41187Lm');

  h.player.advanceTo(30);
  expect(h.player.pauseCalls).toBe(0);
  expect((h.runtime.snapshot()!.window as any).kind).toBe('open');

  callbacksOf(h).onSubmit();
  callbacksOf(h).onClose();

  expect(h.player.playCalls).toBe(0);
});
```

The existing normal-playback test must continue to prove that a playing video is paused at the node and played after close.

- [ ] **Step 3: Run the focused test and verify the expected failure**

Run:

```bash
cd v1
npm exec vitest run extension/content/runtime.test.ts
```

Expected: the new test fails because the current `close()` path calls `play()` unconditionally.

### Task 2: Implement pause ownership in the runtime

**Files:**
- Modify: `v1/extension/host/bilibili/index.ts`
- Modify: `v1/extension/content/runtime.ts`

- [ ] **Step 1: Add the smallest host adapter read**

Add `isPlaying(): boolean` to `PlayerHandle`. In `attachPlayer`, return `!video.paused && !video.ended`.

- [ ] **Step 2: Track ownership in `CourseRuntime`**

Add a private `pausedByRuntime = false` field. When `session.advance()` returns `pause`, read `player.isPlaying()`, call `pause()` only for a playing player, and set the field to that boolean. The session window still renders in both cases.

- [ ] **Step 3: Resume only owned pauses**

In `close()`, capture and clear `pausedByRuntime`; call `player.play()` only when the captured value is true. Clear the field in `stop()` and when switching to original-video mode so state cannot leak across modes or page lifecycles.

- [ ] **Step 4: Run the focused tests and verify green**

Run:

```bash
cd v1
npm exec vitest run extension/content/runtime.test.ts extension/host/bilibili/host.test.ts
```

Expected: all focused runtime and host adapter tests pass, including both normal playback and originally-paused playback.

### Task 3: Bump the extension version and update verified change records

**Files:**
- Modify: `v1/extension/manifest/targets.ts`
- Modify: `v1/extension/manifest/targets.test.ts`
- Modify: `changelog.md`
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Update the manifest version assertion and source**

Change `EXTENSION_VERSION` and its test expectation from `1.0.7` to `1.0.8`.

- [ ] **Step 2: Record the verified behavior change**

Add a 2026-08-25 entry explaining that interactive nodes pause the video and only restore playback when the extension caused the pause, with focused tests and local build as verification evidence.

- [ ] **Step 3: Run manifest tests**

Run:

```bash
cd v1
npm exec vitest run extension/manifest/targets.test.ts
```

Expected: the version and manifest target tests pass.

### Task 4: Run the full checks and build the local plugin

**Files:**
- Generated/ignored: `v1/extension/dist/local/**`

- [ ] **Step 1: Run extension tests and type-check**

Run:

```bash
cd v1
npm test -- extension
npm run type-check
```

Expected: extension Vitest tests pass and TypeScript exits with code 0.

- [ ] **Step 2: Build the local target**

Run:

```bash
cd v1/extension
npm run build:local
```

Expected: `v1/extension/dist/local/manifest.json` exists and reports version `1.0.8`.

- [ ] **Step 3: Verify the local artifact**

Run:

```bash
node -e "const fs=require('node:fs'); const m=JSON.parse(fs.readFileSync('v1/extension/dist/local/manifest.json','utf8')); if(m.version!=='1.0.8') process.exit(1); console.log(m.version)"
```

Expected: prints `1.0.8`.

- [ ] **Step 4: Run the repository verification required by the change**

Run:

```bash
npm test
npm run check
npm --prefix v1 run type-check
```

Expected: all commands exit 0. Do not claim the local package is ready until the fresh build and manifest check pass.

### Task 5: Review the diff and create a focused commit

**Files:**
- All files changed by Tasks 1-4, excluding unrelated pre-existing teacher editor changes.

- [ ] **Step 1: Inspect the final diff and status**

Run:

```bash
git status --short
git diff --check
git diff -- v1/extension/content/runtime.ts v1/extension/content/runtime.test.ts v1/extension/host/bilibili/index.ts v1/extension/host/bilibili/host.test.ts v1/extension/manifest/targets.ts v1/extension/manifest/targets.test.ts changelog.md docs/CHANGELOG.md
```

Confirm no unrelated files are staged.

- [ ] **Step 2: Commit the focused implementation**

```bash
git add v1/extension/content/runtime.ts v1/extension/content/runtime.test.ts v1/extension/host/bilibili/index.ts v1/extension/manifest/targets.ts v1/extension/manifest/targets.test.ts changelog.md docs/CHANGELOG.md
git commit -m "fix: resume video only after plugin pauses node"
```

- [ ] **Step 3: Report the local reload path**

Tell the user to reload the unpacked extension directory:

```text
/Users/bai/code/lessonpilot/v1/extension/dist/local
```

Then refresh the Bilibili page to load the new content script.

## Plan Self-Review

- Spec coverage: node-trigger pause, close-to-resume, originally-paused preservation, lifecycle cleanup, focused regression tests, version bump, local build, and reload path are covered.
- Placeholder scan: no `TBD`, `TODO`, or deferred implementation steps.
- Type consistency: `PlayerHandle.isPlaying()` is added in the host adapter and implemented by the test fake before `CourseRuntime` consumes it.
