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

## Demo Milestones

### D0 — Configurable Interaction Demo

Reached after Phase 3:

- One content-matched deterministic activity runs end to end.
- The teacher changes a fixed node in the localhost teacher website.
- The website saves through an allowlisted, schema-validated extension bridge.
- Save-and-preview shows the changed result without reinstalling the extension.
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
- Replace the spike dialog with a reusable timed-node state machine.
- Mount and unmount safely across Bilibili SPA navigation.

Validation:

- Supported-video detection is exact.
- One authored test node pauses once, opens an activity shell, and resumes explicitly.
- Leaving the supported page removes all LessonPilot UI and watchers.
- Automated tests cover URL matching and node-trigger state transitions.

## Phase 2 — Deterministic Student Activities

Goal:

- Add the multiple-choice and fill-in renderers.
- Add feedback, retry, continue, progress, and local session recording.
- Author node content only after checking the matching source-video segments.

Validation:

- Both node types run end to end without AI or network access.
- Submitted answers and attempts persist locally.
- Rewatching or seeking does not accidentally duplicate completed responses.

## Phase 3 — Teacher Node Editor and Preview

Goal:

- Add a localhost teacher website for the fixed video's nodes.
- Add a minimal allowlisted website-to-extension configuration bridge.
- Persist edits and preview them in the student runtime.

Validation:

- Teacher can change at least one timestamp or prompt.
- The changed node appears in preview.
- Preview works without reinstalling the extension.
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

- The full teacher-edit -> preview -> student-practice -> report loop works.
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
