# Development Plan — LessonPilot

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

Technical spike status: roughly complete for mount, pause/seek, timed dialog, SPA teardown, and timed subtitle overlay. Remaining work is product delivery toward D0, then D1. Follow `next.md`.

2026-08-12 update: the first commercial validation path is now web-first. The Chrome extension remains useful for Bilibili overlay demos and PC learning enhancement, but student first-use must not require plugin installation. Before D0, run a W0 student web course shell that proves the teacher/student page relationship using the fixed Bilibili course.

W0 keeps the fixed Bilibili lesson as its source sample. A teacher first confirms the fixed page URL, then imports an already obtained SRT/VTT file; local parsing converts captions into the editable timeline. W0 does not scrape platform subtitles. It can embed the original course and link back to Bilibili, but it must not promise reliable time observation, pause, seek, or timed interaction through a cross-origin iframe. W0 explicitly excludes local HTML5 video selection, uploading, hosting, and any substitute-player path. The next technical question is whether the Bilibili original-page adapter can support the first real teaching node, not how to bypass it.

### W0 — Web Course Shell and Two-Page Validation

Goal:

- Make the teacher workspace and student course page describe one coherent course.
- Prove the path from fixed Bilibili URL to manually obtained subtitle file to caption-anchored classroom action.
- Validate that a teacher can enter student preview and a student can reach the fixed Bilibili lesson from desktop and mobile browsers.
- Keep the Bilibili source/control boundary visible in engineering documents but invisible to ordinary learners.

Validation:

- Teacher preview opens `student-web/` for the fixed course.
- Teacher page accepts a valid fixed Bilibili URL and a valid SRT/VTT file; the resulting captions replace the example timeline and can receive a classroom action.
- Student page renders course title, learning goals, a dominant source video, intended learning results, and original-page fallback without local-video controls.
- Desktop and 375px widths have no horizontal overflow or critical action overlap.
- No claim or UI implies that the webpage controls a cross-origin Bilibili player.

Status: in progress

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
