# Design — LessonPilot

> 文档状态（2026-08-15）：部分已替代，仅作旧整体架构和历史数据契约参考。第一阶段当前行为以 `doc/requirements.md`、`doc/data-spec.md` 和 `doc/stage-one-validation-loop-design.md` 为准；本文中的 D0/D1、固定视频和页面职责不是当前实施指令。

Version: 0.7
Last updated: 2026-08-14

## 1. Architecture Decision

2026-08-14 交付更新，取代 2026-08-12 的「学生端网页优先」决定：学生宿主是**装了插件的 B 站原页面，仅 PC 浏览器**。定时自动打断是五类节点的共同前提，不是其中一项能力，而它要求与 `<video>` 在同一个文档里读取播放时间——跨源嵌入永远做不到。因此只要课程视频留在 B 站，手机端就不可能。逐条排查见 `doc/lessons.md` 2026-08-14 条目。

原 `student-web/` 学生网页壳已删除，不做改造保留：既然学生路径定在插件上，再留一个网页学生入口只能演示产品不出售的那个版本。老师要看真实学生效果，装插件、打开 B 站原页面，和学生走同一条路径——所以老师自己也要装插件，教师端网页是编辑界面，不是免安装产品。

教师端网页仍从固定 B 站课程链接加老师提供的 SRT/VTT 字幕文件开始，在浏览器本地解析。它不抓取 B 站字幕，也不把跨源 iframe 当作可控的 `PlayerAdapter`；嵌入播放器只是确认内容的取景器，节点定位的时间真源是字幕文件而不是播放器。不提供本地视频、上传、托管或替代播放器路径。

The first demo uses a DOM-injected video interaction layer rather than making a Chrome side panel the primary experience.

Reason:

- The product must pause the lesson and place an activity next to the learner's current focus.
- Timed interaction, feedback, retry, and playback resume are the core experience.
- A side panel can be added later for navigation or history, but it must not become a general chat surface.

```text
Bundled or locally saved lesson configuration
  -> content script resolves VideoRef via PlayerAdapter
  -> timeline engine watches playback time through the adapter
  -> player adapter pauses at the next unfinished node
  -> avatar and activity card collect the answer
  -> evaluator returns deterministic or AI feedback
  -> session store records attempts and completion
  -> player resumes
  -> report presenter renders student and teacher views
```

教师编辑器是一个 localhost 网站，通过白名单桥写入本地课程配置。它不启动网页学生运行时；预览指的是装好插件后打开 B 站原页面。

### 1.1 本地服务边界

W0 只有一个本地静态服务，从仓库根目录启动：

```text
http://127.0.0.1:4173/
  -> /teacher-web/            teacher workspace sample page
  -> /teacher-web/editor.html teacher W0 editor
```

在仓库根目录下运行 `python3 -m http.server 4173`。即使现在只剩一个页面目录，也必须从仓库根启动：路径和测试用例都是相对这个根解析的，而以子目录为根的服务会让页面看起来能打开，却改变了导航和配置的解析结果。不要把 `teacher-web/` 当作独立服务根，也不要引入 `4174` 这样的第二个端口。

Minimum adapter surface for D0/D1 (Bilibili implementation only):

```text
VideoRef = { platform, videoId, partId? }

PlayerAdapter
  detect(location) -> VideoRef | null
  getVideoElement()
  getCurrentTime()
  pause()
  play()
  seek(seconds)
  subscribeNavigation(callback)
  teardown()
```

## 2. Student Runtime Components

### 2.0 学生宿主

学生宿主只有一个：装了插件的 B 站原页面，PC 浏览器。content script 解析出 `VideoRef`，从同文档的 `<video>` 读取播放时间，在下一个未完成节点处暂停，并把学习窗口挂到页面上。

- 对平台播放器的干预保持最小：只做暂停加自己的 DOM 层。不改倍速、不阻止跳过、不降原声、不改播放器 UI。这是合规底线，不是偏好。
- 没有网页学生入口。不要以「更轻」或「免安装」为理由重新引入——没有定时触发，五类节点一个都交付不了。
- 不提供本地文件、Object URL、上传或托管路径。
- 学生用开发者模式加载已解压插件即可安装。D0/D1 阶段由老师逐个带装；上架商店打包属于规模期决策。

### 2.0.1 W0 Link and Subtitle Intake

The W0 teacher workspace has one source path:

```text
fixed Bilibili page URL
  -> teacher obtains subtitle file through an authorized/manual route
  -> teacher imports .srt or .vtt
  -> browser parses timestamps and text locally
  -> caption timeline anchors teacher-authored classroom actions
```

- Accept only the fixed Bilibili BV id in this slice.
- Accept UTF-8 SRT/VTT files, ignore VTT metadata blocks, normalize comma/dot timestamps, and preserve multi-line caption text.
- Reject empty or unparsable files with a field-level error; do not replace the current working timeline on failure.
- Imported captions and action edits are page-local prototype state in W0. Persistence, source scraping, and AI analysis are later work.

### 2.0.2 W0 Teacher Home

The `/teacher-web/editor.html` page remains the W0 functional prototype: confirm the fixed Bilibili course, import authorized subtitles, and author a classroom action on a caption. The separate `/teacher-web/` entry is the teacher workspace sample page used in sales conversations.

The **teacher workspace sample page** is specified in `doc/teacher-course-workspace-design.md`; its production location is the separate `/teacher-web/` page built from `teacher-web/index.html`, `teacher-web/sample.css`, and `teacher-web/sample.js`. It is a pre-populated workspace used during sales conversations, not a marketing landing page and not the real-data workspace itself. The real teacher workspace remains a separate page at `teacher-web/editor.html`. Both pages must share information architecture, node semantics, and visual rules; only sample versus real data, persistence, publishing, and session connectivity may differ.

The online first-contact sales page is a third, independent surface at `/teacher-web/forsales.html`, specified in `doc/teacher-sales-page-design.md`. It owns target-buyer recognition, the no-re-recording promise, value translation, evidence ordering, and the request to transform one real course. It may present workspace evidence, but its sales narrative must not become the header or information architecture of either teacher workspace page.

The approved target state uses eight interaction nodes and five teacher-facing components (`重点标注`, `老师补充`, `选择题`, `填空题`, `问答题`). Course-video selection and within-video timeline paging are separate controls; videos longer than 15 minutes page in 15-minute segments. The timeline header keeps only the segment label and previous/next buttons on its right side; it does not duplicate player elapsed/total time or add zoom-minus/zoom-plus controls. Player time, timeline progress, active node, inspector, node row, preview, and completion evidence all reference the same node identity and current time. The timeline does not add a separate vertical playhead through the active marker. This target has been approved in the design preview but is not yet fully implemented in `/teacher-web/`.

The component bar is deliberately minimal: its heading is `交互节点`, followed only by the five components. Timeline summaries alternate above and below the axis and connect to markers with type-colored lines. Segment boundaries are explicit (`开始 / 结束` for one segment; previous/next labels for paged video). Creating a node first persists a stable-id draft. A checked-by-default `自动保存` checkbox below the centered save button controls whether later field edits use debounced autosave; when disabled, edits remain local until manual save. Save attempts use `saving`, `saved`, and `save_failed`; failures retain the local edit and expose manual retry.

The current functional home is still a classroom-design workspace, not a current-course dashboard and not a marketing landing page. Its first-use flow is:

```text
confirm the fixed Bilibili course and import authorized subtitles
  -> enter classroom design
  -> select a caption and author a classroom action
  -> understand the small learning-evidence trace that later sessions will fill
```

- Classroom design is the only dominant home task. Course link confirmation and SRT/VTT import are compact setup inputs for that task, not peer modules.
- The home links directly into the caption timeline. Student preview remains reachable from the editor where it supports a design decision; it is not a home-page task.
- A small learning-process/evidence note explains the eventual outcome of authored actions. W0 records no session, report, analytics, or AI interpretation.
- The page links into the timeline rather than duplicating the timeline editor on the home surface.

### 2.1 Demo Scope Controller

- Resolve the current page to a `VideoRef` through the active `PlayerAdapter`.
- Mount the runtime only for the demo Bilibili id `BV1WW4y1e7GL`.
- Handle SPA navigation by mounting and unmounting cleanly via `subscribeNavigation` / `teardown`.

### 2.2 Player Adapter

Current implementation: `BilibiliPlayerAdapter` only.

- Find the active video element.
- Read current time and playback state.
- Pause, play, and seek.
- Observe playback without leaking host-page selectors into activity components.
- Identify videos as `VideoRef = { platform, videoId, partId? }`. In D0/D1, `platform` is always `bilibili` and the demo `videoId` remains `BV1WW4y1e7GL`.

Activity cards, timeline engine, and session store must call the adapter interface rather than Bilibili DOM selectors. After D1, add `YouTubePlayerAdapter` behind the same interface without rewriting activity or session code. Do not add multi-platform registries, locale fields, or region fields now.

### 2.3 Timeline Interaction Engine

- Load enabled nodes ordered by timestamp.
- Detect crossing an unfinished node.
- Pause once and activate the node.
- Track completed, skipped, and retryable states.
- Resume only after an explicit learner action.

### 2.4 Avatar Facilitator

- Render lightweight visual states: watching, asking, waiting, feedback, complete.
- Open the current activity card.
- Avoid covering native video controls.

The existing canvas mascot is sufficient for the demo unless manual testing proves otherwise.

### 2.5 Activity Cards

Use one stable activity container with three renderers:

- `multiple_choice`
- `fill_blank`
- `free_answer`

All renderers share submit, feedback, retry, skip, and continue actions so layout does not shift between activity types.

### 2.6 Evaluators

Deterministic evaluator:

- Multiple choice: exact option id match.
- Fill in the blank: normalized authored-answer match.

AI evaluator:

- Free answer: structured feedback against the lesson context and teacher rubric.
- Reports: summarize only recorded session facts and AI feedback.

### 2.7 Session Store

Use `chrome.storage.local` for the local demo so the teacher report can read the same completed session.

The runtime must not require an account or remote database.

### 2.8 Timed Overlay

Subtitle covers and similar effects are enhancements around the learning window, not a second student surface. The window standard's mounting rules apply to them too: the current implementation attaches to `document.documentElement` with viewport coordinates, so it stops rendering once the learner goes fullscreen. Fix that when the window lands.

- Render one reusable overlay element relative to the active video rectangle.
- Select the first configured half-open time range matching the current playback time.
- Recalculate layout while visible after window resize or page scroll.
- Hide safely when the video is unavailable and remove the overlay and listeners on SPA teardown.
- Keep the overlay independent from activity completion and session scoring.

The current S09 subtitle blocker is the first implemented use of this more general timed-overlay capability.

## 3. Teacher Demo Components

The teacher demo is a localhost website opened from an extension link. It has two primary entries:

- Open the finished interactive lesson.
- Modify the fixed lesson template.

This avoids a remote backend while preserving the productized teacher workflow. Saving a lesson never requires reinstalling the extension.

### 3.1 Local Node Editor

Implement a dedicated static teacher website for the fixed video. It shows extension connection status, a compact ordered node list, and an edit form.

Required fields:

- Node id and enabled state.
- Timestamp in seconds.
- Activity type as a read-only label.
- Prompt.
- Options and correct answer for multiple choice.
- Accepted answer for fill in the blank.
- Explanation or rubric.
- Continue behavior.

The page exposes only reset, save, save-and-preview, and latest-report actions. Node creation, deletion, sorting, and type switching remain unavailable.

### 3.2 Preview Bridge

- Enable the bridge only when `location.origin` exactly matches the configured localhost teacher origin, including its port.
- Accept only versioned `GET_BRIDGE_STATUS`, `GET_LESSON`, `SAVE_LESSON`, `RESET_LESSON`, and `OPEN_PREVIEW` messages.
- Forward requests to the service worker, which validates the lesson schema before writing `chrome.storage.local`.
- Return a response tied to the request id so the website never reports an unconfirmed save.
- Open the supported Bilibili URL with preview context after a confirmed save.
- Let the student runtime prefer locally edited configuration over bundled defaults.
- Create a new preview session on every save-and-preview action.
- Keep preview sessions separate from formal learner sessions.

The bridge must not expose generic storage access, arbitrary extension commands, credentials, tokens, or Bilibili page data.

### 3.3 Teacher Report View

Read the latest local session and show facts useful for delivery:

- Completion and attempts by node.
- Original answers.
- Deterministic outcomes.
- Free-answer feedback and revision.
- Follow-up recommendation.

Do not display aggregate charts until real multi-learner data exists.

### 3.4 Demo Milestones

`D0` ends after the localhost teacher website can use the secure bridge to edit, save, preview, answer, and locally record one deterministic activity.

`D1` adds all three activity types, real AI feedback, learner summary, teacher report, and the complete three-minute sales narrative.

The implementation sequence may expose D0 early, but only D1 is the complete sales demo.

## 4. Data Contracts

The student-facing surface is one first-class learning window, specified in `doc/learning-window-standard.md`. Every host implements that one contract to get consistent display and interaction; it also owns the notebook, node-bound AI ask, window lifecycle, and window-layer evidence.

What goes inside the window is `doc/node-content-standard.md`. It separates pedagogical `family`, student `interaction`, portable `display` content, and host playback `effects`, so the same node can render in the extension overlay, the web shell, or a local-video app.

D0/D1 may keep the subset below until that schema replaces the demo runtime. New teacher-authoring UI and new hosts must not grow this older shape.

### Lesson Configuration

```js
{
  id: 'english-interview-demo',
  videoId: 'BV1WW4y1e7GL',
  title: '...',
  nodes: [
    {
      id: 'node-1',
      enabled: true,
      timeSeconds: 0,
      type: 'multiple_choice',
      prompt: '...',
      options: [{ id: 'a', label: '...' }],
      answer: 'a',
      explanation: '...',
      rubric: null,
      continueBehavior: 'manual'
    }
  ]
}
```

Final timestamps and content are authored only after manually checking the source video.

D0 and D1 may continue to author the bundled demo with a Bilibili `videoId`, but runtime and storage should treat the video as `VideoRef` with `platform: 'bilibili'`. After D1, add `YouTubePlayerAdapter` and allow `platform: 'youtube'` without rewriting activity or report contracts. Do not add locale, translation, or region fields until a real overseas customer forces that design.

### Learning Session

```js
{
  id: 'local-session-id',
  lessonId: 'english-interview-demo',
  sessionType: 'student', // or 'preview'
  videoRef: {
    platform: 'bilibili',
    videoId: 'BV1WW4y1e7GL'
  },
  startedAt: 'ISO-8601 timestamp',
  completedAt: null,
  answers: [
    {
      nodeId: 'node-1',
      attempts: 1,
      response: '...',
      correct: true,
      feedback: '...',
      revisedAnswer: null,
      submittedAt: 'ISO-8601 timestamp'
    }
  ]
}
```

## 5. AI Integration

First task types:

- `review_free_answer`
- `generate_session_reports`

Every request includes only:

- Lesson and current node identifiers.
- Relevant lesson excerpt or sentence pattern.
- Teacher rubric.
- Learner response.
- Recorded deterministic results when generating reports.

The response must use a validated structured shape before rendering. API credentials stay outside page context and are never committed.

## 6. UI Shape

- Keep the video as the primary surface.
- Place the avatar near the lower-right edge without covering native controls.
- Display one activity card at a time when playback pauses.
- Show compact progress such as `1 / 3`.
- Use the teacher surface as a quiet operational workspace: lead with classroom design, keep source intake compact and adjacent, and show only a small learning-evidence outcome note. Do not imply that a current course or a latest report already exists.
- Do not expose provider, iframe, adapter, local-file, or compatibility choices in the normal student flow. W0 uses one concise “在 B 站打开原课” fallback instead of a technical testing panel.
- Do not build a general AI chat panel in the first demo.

## 7. Scope Split: Mandatory Window vs Advisory Platform Capability

Two kinds of requirement must never be mixed. Full detail in `doc/learning-window-standard.md` section 2.

**Mandatory and identical on every host — the learning window.** Skeleton and regions, size tiers with authored-content limits, singleton queueing, open-source and close-reason semantics, node states, keyboard and accessibility, drafts, window applications and their content blocks, notebook and ownership, AI-ask boundary, evidence shape, unknown-type degradation. The same lesson pack must produce the same title, prompt, options, explanation, rubric, buttons, and evidence everywhere. A host that does not match this is not an implementation of the standard.

**Advisory only — platform playback and picture enhancement.** Pause and resume, seek and range replay, on-picture highlight, caption covering, ducking the original audio, playing teacher audio, host-side timeline marks. These depend on what the platform allows. A host that cannot do them is still fully conformant, owes no explanation, and must not present the gap to learners as a broken feature.

`effects` in a lesson pack is the teacher's intent, not a requirement on the host. Hosts implement what their platform supports and record the rest in `unsupportedEffects`; node completion is unaffected.

What makes the advisory half safe is window self-sufficiency: a node's content must be fully expressible inside the window, so highlight, cover, and ducking never carry irreplaceable content. Turn everything outside the window off, and the learner must still be able to complete the node.

Practical consequence for the current codebase: a cross-origin web shell that can neither read time nor pause is a conformant host as long as it renders the same window and content, with the learner opening nodes manually.

## 8. Platform Expansion Boundary

Confirmed product order:

```text
Now / D0 / D1: Bilibili only, Chinese teacher UI, current English lesson scenario
After D1: add YouTubePlayerAdapter as the second platform
After a real overseas customer: redesign multilingual and multi-region needs from evidence
```

YouTube 被列入的理由在 2026-08-14 变了。它不只是用来验证 `PlayerAdapter` 抽象是否成立；它是唯一提供官方 IFrame Player API（`getCurrentTime`、`pauseVideo`、`seekTo`、`onStateChange`）、允许普通网页做定时触发的平台，因此也是通往免安装、可上手机的学生形态的唯一路线。把它当作产品形态的备用出口。B 站是唯一逼我们用插件的平台——其它选择要么有官方控制 API，要么是自己托管。D0/D1 只做 B 站的排期不变。

它的政策限制比初看时窄：禁止的是在播放器**前方**叠加，不是禁止并排。合规的布局是把播放器固定在一个区域，节点触发时缩小播放器、在旁边渲染学习窗口——任何时候都没有东西盖住播放器。剩下的限制只是尺寸：缩小后视口不低于 200×200，若显示控制栏则要能完整显示（16:9 官方建议至少 480×270）。这修正了两处早先的判断：`dark-player` 覆盖主题是不再需要，而不是被禁止；S09 不用遮挡带，改为通过 IFrame API 关闭字幕轨——这属于文档描述的行为，不是擅自修改播放器，但具体参数与 captions 模块调用仍需实测确认。并排布局完全不触碰播放器画面，比在 B 站页面上盖一层更干净。

由此带出两个待办。`doc/learning-window-standard.md` 假设窗口挂在播放器之上，需要增加一档并排挂载方式。另外，当前买方的课程和学生都在 B 站，这个 API 优势可能触及不到他们。

Other sites are not ranked until real teacher courses require them.

Multilingual UI, course-language systems, regional payments, data residency, and international store distribution are fully deferred. Do not add locale or region schema work now. The only reserved expansion seam is `VideoRef` + `PlayerAdapter`.

## 9. Open Technical Questions

- Which AI backend will handle free-answer review for the local demo?
- Should the API be reached through a local proxy or a separately configured backend?
- Which three source-video timestamps best match comprehension, recall, and application activities?

Resolved and locked:

- Every save-and-preview creates a new preview session.
- Platform order is Bilibili now, YouTube after D1.
- Multilingual and multi-region work stay deferred.

These remaining questions do not block deterministic interaction-node development.
