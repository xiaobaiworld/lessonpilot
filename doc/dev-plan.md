# Development Plan — LessonPilot

Version: 0.2
Last updated: 2026-08-07

## Phase 0 — Product and Demo Definition

Goal:

- Define the buyer as an English teacher with an existing paid recorded course.
- Define the demo as a course-upgrade loop rather than a general AI side panel.
- Lock the student interaction, teacher authoring, preview, and report boundaries.

Validation:

- Requirements, design, README, lessons, and plan describe the same product.
- Demo scope remains limited to one Bilibili video and three interaction nodes.

Status: complete

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

- Add a local editor for the fixed video's nodes.
- Persist edits and preview them in the student runtime.

Validation:

- Teacher can change at least one timestamp or prompt.
- The changed node appears in preview.
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
- Show it to qualified teachers who already sell recorded courses.

Validation:

- The full teacher-edit -> preview -> student-practice -> report loop works.
- At least three qualified teacher conversations are recorded.
- Success is measured by a concrete next commitment, not compliments.

## Deferred

- General video import and subtitle parsing.
- Automatic interaction-node generation.
- Accounts, payments, classes, and cohort analytics.
- Voice and pronunciation features.
- Chrome Web Store publishing.
- Full teacher course management.

## Delivery Workflow

Each phase uses `next.md` for one verified step at a time. After tests and manual acceptance pass, synchronize docs and changelog, record any new lesson, create a small Git commit, and push only when a remote is configured and the target is confirmed. A larger release or merge requires a full branch diff and documentation review before user-authorized merge.
