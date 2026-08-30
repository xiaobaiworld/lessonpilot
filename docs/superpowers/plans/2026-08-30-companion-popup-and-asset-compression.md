# 学习伙伴弹窗与资源压缩 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the current environment's stepwise implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在学生插件 `1.2.1` 中，以同一紧凑 popup 完成学习伙伴选择、状态图预览和五段声音试听，并把默认猫咪包转换为更小的 WebP/Ogg 运行时资源。

**Architecture:** popup 增加 `companion` 第三层视图，常规入口不再打开独立浏览器标签。角色包仍由现有 background 白名单消息提供；图片和音频文件名完全来自角色包 JSON 清单。运行时只打包压缩后的 WebP/Ogg，源 PNG/WAV 保留在 `docs/superpowers/assets/companion/cat-v1/`；未来线上角色包是已接受但未实现的独立阶段。

**Tech Stack:** Chrome Manifest V3、TypeScript、Vite、Vitest、WebP (`cwebp`)、Ogg/Opus (`ffmpeg`)、Chrome popup `<audio>`。

**Relevant decisions and scope:** `D-V1-023` defines the first cat pack; this plan records a new replacement decision for online pack delivery. `D-V1-013` keeps release at `tools/release.sh`. `docs/VERSION_SCOPE_CHECKLIST.md` requires an automatic patch bump because popup code and bundled resources change. The global development workflow and `TESTING_STANDARD.md` apply; backend/data-model/auth/security special standards do not apply to this local bundled-resource change. The online-download security boundary is documented only; it is not implemented by this plan.

---

### Task 1: Record the new resource-delivery decision and isolate this work slice

**Files:**
- Create: `doc/decisions/2026-08-30-companion-pack-online-delivery.md`
- Modify: `doc/decisions/2026-08-29-student-companion-avatar-pack.md`
- Modify: `doc/INDEX.md`
- Modify: `README.md`
- Modify: `next.md`
- Modify: `docs/superpowers/specs/2026-08-29-student-companion-plugin-integration-design.md`

- [ ] **Step 1: Write the decision-record acceptance checks before changing documents.**

  The new decision must explicitly state all of the following:

  ```text
  D-V1-026 is accepted on 2026-08-30.
  It supersedes only D-V1-023 decision item 7.
  Default cat-v1 remains bundled for first use and offline use.
  Future packs are listed by KnownMap and downloaded on demand as data/assets only.
  Extension JS/WASM/permissions never update through a resource pack.
  Remote packs must be limited to KnownMap HTTPS, JSON/image/audio allowlists,
  size/MIME/duration/SHA-256 validation, and local binary caching outside chrome.storage.
  Website selection, accounts, progress, download UI, cache eviction and remote updates are not implemented now.
  Re-open the decision when the first remote pack or account-linked selection is approved.
  ```

- [ ] **Step 2: Create the decision and update document entry points.**

  Create `D-V1-026` with the required background, confirmed facts, considered alternatives, why the website-directory/on-demand-download option was selected, risks, assumptions, re-open trigger, and affected documents. Preserve `D-V1-023` history; only add a dated pointer after its item 7:

  ```markdown
  > 2026-08-30：本条的“后续再评估”已由
  > [`D-V1-026`](2026-08-30-companion-pack-online-delivery.md) 具体化；
  > D-V1-023 其余结论不变。
  ```

  Add `D-V1-026` to the accepted-decision table in `doc/INDEX.md`. Replace runtime-format claims in the integration design from PNG/WAV to WebP/Ogg and point its later-online-delivery note to `D-V1-026`. Update `README.md` to say that only the default cat pack is bundled and future packs are planned as on-demand resources. Add a new topmost `next.md` execution slice that names this plan, lists the exact initial test command from Task 2, and states the invariant: do not alter teacher-node files or course-package schema.

- [ ] **Step 3: Verify the documentation slice and commit it.**

  Run:

  ```bash
  git diff --check
  rg -n 'D-V1-026|WebP|Ogg|按需下载|1\.2\.1' \
    doc/decisions doc/INDEX.md README.md next.md \
    docs/superpowers/specs/2026-08-29-student-companion-plugin-integration-design.md
  git status --short
  ```

  Expected: all new decision links resolve as repository-relative Markdown, no unrelated `v1/web/teacher` file is staged, and no existing decision is overwritten.

- [ ] **Step 4: Commit the documentation boundary.**

  ```bash
  git add \
    doc/decisions/2026-08-30-companion-pack-online-delivery.md \
    doc/decisions/2026-08-29-student-companion-avatar-pack.md \
    doc/INDEX.md README.md next.md \
    docs/superpowers/specs/2026-08-29-student-companion-plugin-integration-design.md
  git commit -m "docs: define online companion pack delivery"
  git push origin main
  ```

### Task 2: Lock compressed resource paths and popup flow with failing tests

**Files:**
- Modify: `v1/extension/content/companion-assets.test.ts`
- Modify: `v1/extension/manifest/targets.test.ts`
- Modify: `v1/extension/popup/popup.test.ts`
- Modify: `v1/extension/settings/settings.test.ts`

- [ ] **Step 1: Add failing asset-contract expectations.**

  Replace the PNG/WAV path expectations with these exact assertions in `companion-assets.test.ts`:

  ```ts
  expect(getCompanionStateAsset('idle')).toMatchObject({
    image: 'assets/companion/cat/v1/idle.webp',
    audio: null,
  });
  expect(getCompanionStateAsset('complete')).toMatchObject({
    image: 'assets/companion/cat/v1/complete.webp',
    audio: 'assets/companion/cat/v1/complete.ogg',
    overlay: 'assets/companion/cat/v1/fish-treat.webp',
    message: COMPANION_COMPLETE_MESSAGE,
  });
  ```

  Add a filesystem contract that reads `assets/companion/cat/v1/manifest.json`, verifies every state image ends in `.webp`, every non-null audio ends in `.ogg`, and verifies no `*.png` or `*.wav` exists in that runtime directory.

- [ ] **Step 2: Add failing manifest and UI source contracts.**

  In `targets.test.ts`, assert that `BUILD_ARTIFACTS` contains `idle.webp`, `fish-treat.webp`, and `complete.ogg`, and contains no companion `*.png` or `*.wav` path. In `popup.test.ts`, add a test named `学习伙伴设置在同一弹窗内展示角色包和试听声音` that asserts:

  ```ts
  expect(source).toContain("type View = 'home' | 'settings' | 'companion'");
  expect(source).toContain('renderCompanionSettings');
  expect(source).toContain('神秘猫精灵声音组');
  expect(source).toContain('开始注意');
  expect(source).toContain('提示与等待');
  expect(source).toContain('答对反馈');
  expect(source).toContain('答错反馈');
  expect(source).toContain('完成庆祝');
  expect(source).toContain("type: 'setCompanionSound'");
  expect(source).not.toContain("chrome.tabs.create({ url: chrome.runtime.getURL('settings/index.html') })");
  ```

  In `settings.test.ts`, replace assertions that audio controls do not exist with assertions for `data-audio-preview`, `sound-switch`, `type: 'companionSound'`, and `type: 'setCompanionSound'`; retain six state previews and the three unavailable category cards.

- [ ] **Step 3: Run the focused tests and record the intentional failures.**

  Run:

  ```bash
  npm --prefix v1 test -- \
    extension/content/companion-assets.test.ts \
    extension/manifest/targets.test.ts \
    extension/popup/popup.test.ts \
    extension/settings/settings.test.ts
  ```

  Expected: FAIL because runtime files and source still use PNG/WAV, `View` excludes `companion`, no `renderCompanionSettings` exists, and no audio-preview controls exist.

### Task 3: Generate compact runtime resources and update their manifest boundary

**Files:**
- Create: `tools/build-companion-cat-v1-assets.sh`
- Modify: `v1/extension/assets/companion/cat/v1/manifest.json`
- Delete: `v1/extension/assets/companion/cat/v1/{idle,focus,prompt,correct,wrong,complete,fish-treat}.png`
- Delete: `v1/extension/assets/companion/cat/v1/{focus,prompt,correct,wrong,complete}.wav`
- Create: `v1/extension/assets/companion/cat/v1/{idle,focus,prompt,correct,wrong,complete,fish-treat}.webp`
- Create: `v1/extension/assets/companion/cat/v1/{focus,prompt,correct,wrong,complete}.ogg`
- Modify: `v1/extension/content/companion-assets.test.ts`
- Modify: `v1/extension/manifest/targets.ts`
- Modify: `v1/extension/manifest/targets.test.ts`

- [ ] **Step 1: Create the reproducible conversion script.**

  The script must use `git rev-parse --show-toplevel`, resolve all paths relative to that root, fail if `cwebp` or `ffmpeg` is unavailable, and use only explicit source/output file mappings:

  ```bash
  image_states=(idle focus prompt correct wrong complete)
  for state in "${image_states[@]}"; do
    cwebp -quiet -q 88 \
      "$source_dir/${state}-master.png" \
      -o "$runtime_dir/${state}.webp"
  done
  cwebp -quiet -q 88 "$source_dir/fish-treat-master.png" \
    -o "$runtime_dir/fish-treat.webp"

  encode_audio() {
    ffmpeg -hide_banner -loglevel error -y -i "$1" -map_metadata -1 \
      -ac 1 -ar 48000 -c:a libopus -b:a 48k -vbr on \
      -compression_level 10 "$2"
  }
  ```

  Call `encode_audio` with this exact mapping: `real-meow-happy-short.wav` → `focus.ogg` and `correct.ogg`; `real-meow-natural-short.wav` → `prompt.ogg`; `wrong-soft.wav` → `wrong.ogg`; `real-tiger-roar-first-3s.wav` → `complete.ogg`. Delete only the explicitly named obsolete runtime PNG/WAV files after successful conversion, never the source assets.

- [ ] **Step 2: Run the script and measure the result.**

  Run:

  ```bash
  tools/build-companion-cat-v1-assets.sh
  find v1/extension/assets/companion/cat/v1 -type f -print0 \
    | xargs -0 stat -f '%z %N'
  ffprobe -v error -show_entries format=duration -of csv=p=0 \
    v1/extension/assets/companion/cat/v1/{focus,prompt,correct,wrong,complete}.ogg
  ```

  Expected: exactly seven WebP files, five Ogg files and one JSON manifest; all five Ogg files decode; image/audio runtime total is at most `838860` bytes (0.8 MB); source `docs/superpowers/assets/companion/cat-v1/source/*.png` and `processed/*.wav` remain unchanged.

- [ ] **Step 3: Update manifest and source/target contracts.**

  In the role-pack manifest, replace every image and overlay filename with its `.webp` counterpart and every non-null audio filename with `.ogg`. Recalculate and replace every `imageSha256`/`audioSha256` using `shasum -a 256`; preserve the semantic state order, durations, CC0 source facts, and complete-state message.

  Update `BUILD_ARTIFACTS` to list the seven `.webp` and five `.ogg` files. Do not change `web_accessible_resources`: `assets/companion/**` already covers the new files. Update the new tests from Task 2 only enough to verify the produced resource set and manifest paths.

- [ ] **Step 4: Run focused contracts and build artifacts.**

  Run:

  ```bash
  npm --prefix v1 test -- \
    extension/content/companion-assets.test.ts \
    extension/manifest/targets.test.ts \
    extension/background/messages.test.ts
  npm --prefix v1 run build --workspace @v1/extension
  find v1/extension/dist/local/assets/companion/cat/v1 -type f | sort
  find v1/extension/dist/local/assets/companion/cat/v1 \( -name '*.png' -o -name '*.wav' \) -print
  ```

  Expected: tests pass; local output includes only WebP/Ogg/JSON for companion assets; the last `find` produces no output.

- [ ] **Step 5: Commit the self-contained resource conversion.**

  ```bash
  git add tools/build-companion-cat-v1-assets.sh \
    v1/extension/assets/companion/cat/v1 \
    v1/extension/content/companion-assets.test.ts \
    v1/extension/manifest/targets.ts \
    v1/extension/manifest/targets.test.ts
  git commit -m "feat: compress bundled companion assets"
  git push origin main
  ```

### Task 4: Render the complete partner package inside the popup

**Files:**
- Modify: `v1/extension/popup/index.ts`
- Modify: `v1/extension/popup/popup.css`
- Modify: `v1/extension/popup/popup.test.ts`

- [ ] **Step 1: Extend the view model and write the companion-state loader.**

  Change the view union and add these typed records next to the existing popup state:

  ```ts
  type View = 'home' | 'settings' | 'companion';
  type CompanionAsset = {
    state: string;
    image: string;
    audio: string | null;
    durationMs: number | null;
    message?: string;
  };
  const companionStates = ['idle', 'focus', 'prompt', 'correct', 'wrong', 'complete'] as const;
  const companionSounds = [
    ['focus', '开始注意'],
    ['prompt', '提示与等待'],
    ['correct', '答对反馈'],
    ['wrong', '答错反馈'],
    ['complete', '完成庆祝'],
  ] as const;
  ```

  Load every state through the existing `ask` helper using `{ type: 'companionAsset', packId: 'cat-v1', state }`. If an asset reply fails, show the existing popup error and omit its broken visual/audio control instead of constructing a path in the DOM.

- [ ] **Step 2: Replace the external-tab action with `renderCompanionSettings()`.**

  Replace the learning-partner settings-row click handler with:

  ```ts
  companionButton.addEventListener('click', () => void renderCompanionSettings());
  ```

  `renderCompanionSettings()` must render the current brand header with a left back button that calls `renderSettings()` and a close button that calls `window.close()`. Render the selected cat hero using the loaded idle image, the exact completed cat description, six state-thumbnail buttons, four category cards, and the existing "下一版本完成" labels for the three unavailable cards. Unavailable cards are `disabled`, never dispatch a pack-selection action.

- [ ] **Step 3: Add safe thumbnail enlargement and five audio previews.**

  For each loaded state thumbnail, set the main hero image on `mouseenter` and keyboard `focus`, and restore `idle` on `mouseleave` and `blur`. The main image is therefore the single larger preview rather than six duplicated large images.

  For every `companionSounds` entry with a non-null audio URL, render a `button[data-audio-preview]`. On click, pause and reset a module-level `HTMLAudioElement | null`, create a fresh `Audio(asset.audio)`, call `play()`, and handle a rejected promise by showing `声音暂时无法试听。`. Previewing does not write settings. Render the duration from `durationMs` as `0.6 秒`, `1.1 秒`, or `3 秒`.

  Render a `sound-switch` button wired to existing `{ type: 'setCompanionSound', enabled: next }`; update local `soundEnabled` only after an `ok` reply. Its label must be `学习时播放声音`/`学习时静音`; it controls all learning-time character sounds, not the preview buttons.

- [ ] **Step 4: Add compact, matching styles.**

  Add popup-only styles that keep `body` at `width: 380px`, use a `max-height: 600px; overflow-y: auto` content container, reuse `#f6f7f8`, white cards, `#00aeec`, `#008ac5`, `#e8b428` and `#c56e52`, and define:

  ```css
  .companion-hero { display:grid; grid-template-columns:86px 1fr; gap:10px; }
  .companion-state-grid { display:flex; gap:6px; }
  .companion-thumb { width:34px; height:34px; }
  .companion-categories { display:grid; grid-template-columns:repeat(2, 1fr); gap:7px; }
  .sound-row { display:flex; align-items:center; gap:8px; }
  ```

  The cat hero uses only one large image and text. Do not introduce a green full-page theme, a 720px layout, a full-screen tab, or a fictitious image/audio resource for unavailable categories.

- [ ] **Step 5: Run popup tests before committing.**

  Run:

  ```bash
  npm --prefix v1 test -- extension/popup/popup.test.ts
  npm --prefix v1 run type-check
  ```

  Expected: popup source contracts pass; TypeScript accepts DOM/audio types; no `chrome.tabs.create` call remains in the learning-partner flow.

- [ ] **Step 6: Commit the popup flow.**

  ```bash
  git add v1/extension/popup/index.ts v1/extension/popup/popup.css \
    v1/extension/popup/popup.test.ts
  git commit -m "feat: show companion package settings in popup"
  git push origin main
  ```

### Task 5: Keep the independent settings entry visually and functionally compatible

**Files:**
- Modify: `v1/extension/settings/index.html`
- Modify: `v1/extension/settings/index.ts`
- Modify: `v1/extension/settings/settings.css`
- Modify: `v1/extension/settings/settings.test.ts`

- [ ] **Step 1: Add failing compatibility checks.**

  Before implementation, extend the existing settings test to require a visible `返回插件` control, `data-audio-preview` buttons for the five sound states, a `sound-switch` control, and `#00aeec` in `settings.css`; assert the stylesheet does not contain `min-width: 520px` or `width: min(720px`.

- [ ] **Step 2: Implement the standalone fallback page.**

  Keep the manifest `options_page` as `settings/index.html` for Chrome's direct-options entry, but make normal popup navigation avoid it. Restyle the page to the same compact 380px KnownMap palette. Its `返回插件` and close controls both call `window.close()`; the label tells the student to reopen the toolbar popup because a browser options tab cannot recreate an already-dismissed Chrome popup.

  In `settings/index.ts`, expand `StateAsset` with `audio` and `durationMs`, call `companionSound` on initialization, render the five preview buttons and group toggle, and use the same one-at-a-time `Audio` playback behavior/error text as the popup. It must use `companionAsset` URLs only, never static `../assets/companion/...` paths in HTML.

- [ ] **Step 3: Run compatibility tests and build.**

  Run:

  ```bash
  npm --prefix v1 test -- extension/settings/settings.test.ts
  npm --prefix v1 run type-check
  npm --prefix v1 run build --workspace @v1/extension
  ```

  Expected: direct settings page remains functional with WebP/Ogg, differs from the prior wide green page, and the extension build contains the compact settings entry.

- [ ] **Step 4: Commit the compatible direct entry.**

  ```bash
  git add v1/extension/settings/index.html v1/extension/settings/index.ts \
    v1/extension/settings/settings.css v1/extension/settings/settings.test.ts
  git commit -m "feat: align companion settings fallback page"
  git push origin main
  ```

### Task 6: Bump, verify, document, and release `1.2.1`

**Files:**
- Modify: `v1/extension/manifest/targets.ts`
- Modify: `v1/extension/manifest/targets.test.ts`
- Modify: `docs/CHANGELOG.md`
- Modify: `next.md`
- Modify: `README.md` if final local-build instructions or current version text changed

- [ ] **Step 1: Update the version test first.**

  Change the current assertion to:

  ```ts
  expect(EXTENSION_VERSION).toBe('1.2.1');
  ```

  Run `npm --prefix v1 test -- extension/manifest/targets.test.ts`; it must fail while `EXTENSION_VERSION` is `1.2.0`.

- [ ] **Step 2: Bump the unique version source and rebuild both targets.**

  Set `EXTENSION_VERSION = '1.2.1'` in `v1/extension/manifest/targets.ts`, then run:

  ```bash
  npm --prefix v1 test -- extension
  npm --prefix v1 run type-check
  npm --prefix v1 run build --workspace @v1/extension
  KNOWNMAP_TARGET=production npm --prefix v1 run build --workspace @v1/extension
  node -e "for (const p of ['v1/extension/dist/local/manifest.json','v1/extension/dist/production/manifest.json']) { const m=require('./'+p); if (m.version !== '1.2.1') throw new Error(p + ' version ' + m.version); console.log(p, m.version); }"
  ```

  Expected: all extension tests pass; both manifests report `1.2.1`; production manifest contains neither localhost nor `127.0.0.1` permission; both package asset directories contain no companion PNG/WAV duplicates.

- [ ] **Step 3: Perform focused manual extension verification.**

  Load `v1/extension/dist/local` through Chrome's unpacked-extension page, reload it, then verify and capture a screenshot/checklist for:

  ```text
  1. Home → gear → 学习伙伴 → 设置 stays in one 380px popup.
  2. Back returns to plugin settings; × closes the popup.
  3. Idle, focus, prompt, correct, wrong and complete thumbnails each replace the larger cat image on hover/focus.
  4. Five audio buttons each play only their own short clip; starting another stops the previous preview.
  5. The group switch persists after closing/reopening the popup and does not prevent settings-page audition.
  6. 元气伙伴、森林伙伴、未知伙伴 are visible but unavailable and say 下一版本完成.
  ```

- [ ] **Step 4: Synchronize verified documentation and commit release input.**

  Add a `1.2.1` entry to `docs/CHANGELOG.md` only after the tests above pass. State: compact in-popup partner settings, five real cat-sound auditions, WebP/Ogg conversion, `cat-v1` measured package size, and the browser verification status. Update the current `next.md` slice with commands and actual passing evidence; do not touch unrelated teacher task text.

  ```bash
  git add v1/extension/manifest/targets.ts v1/extension/manifest/targets.test.ts \
    docs/CHANGELOG.md next.md README.md
  git diff --cached --check
  git commit -m "feat: release companion settings 1.2.1"
  git push origin main
  ```

- [ ] **Step 5: Create and verify the production release.**

  From the exact pushed commit, run the existing release entry point:

  ```bash
  KNOWNMAP_SSH_HOST=aliyun-us tools/release.sh deploy HEAD
  ```

  Record the returned release ID and tag under `deploy/releases/` using the release script's normal record flow. Download the published `knownmapplugin.zip`, inspect its manifest and companion asset directory, and verify:

  ```text
  manifest.json version is 1.2.1
  the ZIP contains WebP/Ogg cat-v1 resources and no cat-v1 PNG/WAV runtime duplicates
  production package has no local host permission
  ```

  Commit and push only the generated release record after the deploy verification succeeds.

### Task 7: Independent post-implementation review

**Files:**
- Review: the final `git diff HEAD~N..HEAD`, `v1/extension/dist/{local,production}`, test output, and release ZIP

- [ ] **Step 1: Run a reverse checklist.**

  Verify each product statement has evidence: selected cat package drives all six images and five sounds; unavailable packages do not pretend to work; normal navigation has no new tab; direct options page has a clear close/return message; original source assets stay out of runtime; built package is within target; version changed because plugin inputs changed; online packs are documented but no network fetch was silently introduced.

- [ ] **Step 2: Run final repository checks.**

  ```bash
  git status --short
  git log --oneline -8
  npm --prefix v1 test -- extension
  npm --prefix v1 run type-check
  npm --prefix v1 run build --workspace @v1/extension
  ```

  Expected: no task-owned unstaged change, all extension tests/type-check/build pass, and only previously-existing user changes remain outside the commits for this task.
