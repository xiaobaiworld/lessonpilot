# Development Plan — LessonPilot

Version: 0.1  
Last updated: 2026-08-07

## Phase 0 — Requirements and Demo Definition

Goal:

- Create the independent project.
- Define the first buyer, first user, first demo video, required features, and non-goals.

Validation:

- Requirements document exists.
- First demo scope is limited to one Bilibili teacher video.
- Success metrics are explicit.

Status: in progress

## Phase 1 — Static Extension Shell

Goal:

- Build a Chrome extension that loads on the primary Bilibili video page.
- Inject a right-side panel with static lesson data.

Validation:

- Manual load as unpacked extension in Chrome.
- Open the primary Bilibili video and confirm the panel appears.
- Open unrelated pages and confirm unsupported behavior.

## Phase 2 — Lesson Interaction Without AI

Goal:

- Add segment list, key sentences, learner profile form, practice answer form, and report area.

Validation:

- User can click segments.
- User can fill profile and practice answer.
- UI remains usable on laptop viewport.

## Phase 3 — AI Task Integration

Goal:

- Add four AI tasks: sentence explanation, personalized rewrite, practice feedback, learning report.

Validation:

- Each task returns lesson-specific output.
- No API key is committed.
- AI payload excludes unnecessary page data.

## Phase 4 — Demo Polish and Teacher Review

Goal:

- Prepare the demo for showing to English teachers.

Validation:

- Complete one flow in under 5 minutes.
- Teacher can understand product value in 3 minutes.
- Record at least 3 teacher feedback notes.

## Not Yet Planned

- General video import
- Teacher dashboard
- Student accounts
- Speech recognition
- Payment
- Chrome Web Store publishing
