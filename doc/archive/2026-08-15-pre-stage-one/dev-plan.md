# Development Plan — LessonPilot

> 归档快照（2026-08-15）：记录整理前的开发排期，不再作为实施指令。当前计划入口为 `doc/dev-plan.md`。本文相对链接按归档前 `doc/dev-plan.md` 的位置理解。

Version: 0.4
Last updated: 2026-08-11

## Phase 0 — Product and Demo Definition

Goal:

- Define the buyer as an English teacher with an existing paid recorded course.
- Define the demo as a course-upgrade loop rather than a general AI side panel.
- Lock the student interaction, teacher authoring, preview, and report boundaries.
- Lock expansion order: Bilibili through D1, YouTube after D1, multilingual/region fully deferred.

Validation:

- Requirements, design, README, lessons, teacher-demo, student-runtime, and plan describe the same product.
- Demo scope remains limited to one Bilibili video and three interaction nodes.
- `VideoRef` / `PlayerAdapter` are the only reserved multi-platform seams.

Status: complete

Display contract: everything a student sees belongs to one first-class learning window. `doc/learning-window-standard.md` is what a new client implements; `doc/node-content-standard.md` is what a node may contain. Phases below build the Bilibili path only, but no phase may introduce a second student information architecture, and no phase may make a node depend on pause, seek, caption covering, or audio ducking being available.

Technical spike status: roughly complete for mount, pause/seek, timed dialog, SPA teardown, and timed subtitle overlay. Remaining work is product delivery toward D0, then D1. Follow `next.md`.

2026-08-14 更新，取代 2026-08-12 的「学生端网页优先」结论：学生宿主只有装了插件的 B 站原页面，仅 PC 浏览器。定时自动打断是五类节点的共同前提，而它要求与 `<video>` 同文档读取播放时间，跨源嵌入做不到。原计划中的 `student-web/` 学生网页壳已删除。老师预览真实效果同样装插件、打开 B 站原页面，与学生同一条路径。完整排查见 `doc/lessons.md` 2026-08-14 条目。

W0 仍以固定 B 站课程为来源样例。老师先确认固定页面 URL，再导入已取得的 SRT/VTT 文件；本地解析把字幕转成可编辑时间线。W0 不抓取平台字幕。教师端可以嵌入原课并链回 B 站，但不得承诺能通过跨源 iframe 稳定读时、暂停、seek 或定时互动；节点定位的时间真源是字幕文件。W0 明确排除本地 HTML5 视频选择、上传、托管和任何替代播放器。下一个技术问题是 B 站原页面适配器能否支撑第一个真实教学节点，不是如何绕过它。

### W0 — 课程链接与字幕时间线验证

目标：

- 打通「固定 B 站 URL → 手动取得的字幕文件 → 字幕锚点上的课堂动作」这条路径。
- 让教师工作台完整描述一门课，示例页与真实工作台共用同一信息架构。
- B 站来源与控制边界写在工程文档里，不出现在教师界面上。

验收：

- 教师端接受有效的固定 B 站 URL 和有效 SRT/VTT 文件；解析出的字幕替换示例时间线，并能承载课堂动作。
- 教师端桌面与窄屏宽度下无横向溢出或关键操作遮挡。
- 任何文案或界面都不得暗示网页能控制跨源 B 站播放器。
- 学生侧验证移至 B 站原页面插件路径，不在本阶段用网页页面代替。

状态：进行中

## Demo Milestones

### D0 — Configurable Interaction Demo

Reached after Phase 3:

- One content-matched deterministic activity runs end to end.
- The teacher changes or creates one fixed node in the localhost teacher website.
- Save-and-preview opens a student web runtime link first; the extension bridge can follow after the web loop is proven.
- The student web runtime shows the changed result without plugin installation.
- Preview attempts persist in a separate local session.

D0 is suitable for internal validation and early conversations, but it is not the complete sales demo.

### D1 — Complete Sales Demo

Reached after Phase 5:

- Three activity types run against the real source video.
- Free-answer review uses a real AI backend with honest fallback.
- One session produces both learner summary and teacher report.
- The full teacher-edit -> preview -> practice -> report story fits in three minutes.

## Phase 1 — Video Interaction Engine

Goal:

- Validate the existing mascot and playback-control spike manually.
- Add a student web runtime with a reusable timed-node state machine.
- Mount and unmount safely across Bilibili SPA navigation.

Validation:

- Student opens a web course link and reaches the fixed Bilibili source through the student shell.
- The student shell does not claim cross-origin playback control; interaction behavior is verified on the supported Bilibili original-page plugin path.
- Mobile and desktop layouts keep the course context, source area, and original-page action usable.
- The existing Bilibili plugin spike remains gated to the supported video and passes current regression tests.

## Phase 2 — Deterministic Student Activities

Goal:

- Add the multiple-choice and fill-in renderers on the supported controllable player path.
- Add feedback, retry, continue, progress, and local session recording there.
- Author node content only after checking the matching source-video segments.

Validation:

- Both node types run end to end without AI or network access.
- Submitted answers and attempts persist locally.
- Rewatching or seeking does not accidentally duplicate completed responses.
- Each node stays inside its own window opening: no node requires another node to have been answered first.

## Phase 3 — Teacher Node Editor and Preview

Goal:

- Add a localhost teacher website for the fixed video's nodes.
- Persist edits and preview them in the student web runtime.
- Add a minimal allowlisted website-to-extension configuration bridge only after the web runtime loop is proven.

Validation:

- Teacher can change at least one timestamp or prompt.
- The changed node appears in the student web preview.
- Preview works without installing or reinstalling an extension.
- Invalid timestamps and incomplete activity definitions are rejected clearly.

## Phase 4 — Free Answer and Reports

Goal:

- Add AI review for the free-answer node.
- Generate student and teacher views from one recorded session.

Validation:

- Feedback cites the learner's actual answer and teacher rubric.
- Reports never invent activity or results.
- No API key or real learner data is committed.
- A defined fallback state handles unavailable AI service.

## Phase 5 — Sales Demo Validation

Goal:

- Polish the three-minute teacher demonstration.
- Record a 60–90 second teacher-facing sales video from the verified D1 product.
- Show it to qualified teachers who already sell recorded courses.

Validation:

- The full teacher-edit -> web preview -> student-practice -> report loop works.
- The promotion video shows only verified behavior and ends with one real-course submission action.
- At least three qualified teacher conversations are recorded.
- Success is measured by a concrete next commitment, not compliments.

## Deferred

- YouTube as a second player adapter after D1 validation.
- General video import and subtitle parsing.
- Automatic interaction-node generation.
- Accounts, payments, classes, and cohort analytics.
- Voice and pronunciation features.
- Chrome Web Store publishing.
- Full teacher course management.
- Multilingual UI, course-language systems, multi-region commercial/compliance design, and any locale/region schema work.
- Independent consumer free/Pro product line.

## Delivery Workflow

Each phase uses `next.md` for one verified step at a time. After tests and manual acceptance pass, synchronize docs and changelog, record any new lesson, create a small Git commit, and push only when a remote is configured and the target is confirmed. A larger release or merge requires a full branch diff and documentation review before user-authorized merge.
