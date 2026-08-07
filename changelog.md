# Changelog — LessonPilot

Only record verified changes.

## [Unreleased]

- Fix demo-only scope so mascot disappears when navigating away on Bilibili SPA pages.
- Match demo video by exact BV id instead of pathname substring.

### Product Requirements v0.2 — 2026-08-07

- Reposition the demo around upgrading an existing paid recorded course rather than improving video quality.
- Define a three-node student flow: comprehension choice, recall fill-in, and applied free answer.
- Add minimum teacher-side requirements for node editing, preview, and an evidence-based individual report.
- Replace the general side-panel-first design with a timed interaction engine and shared local session data.

### Bilibili Mascot Controls — 2026-08-07

- Restrict mascot and playback control to demo video `BV1WW4y1e7GL` only.
- Add three mascot controls: pause, seek to 30s, seek to 35s with dialog.
- Auto-show interaction dialog when playback reaches 35 seconds.
- Add `tests/demo-config.test.js` for URL gating checks.

### Bilibili Mascot Spike — 2026-08-07

- Researched open-source Bilibili playback extensions and 2D mascot overlay projects.
- Added technical spike notes in `doc/bili-mascot-spike.md`.
- Scaffolded MV3 extension under `src/` with Bilibili video play/pause control and a canvas-based 2D mascot.

### Project Scaffold — 2026-08-07

- Created independent project structure for the English video course AI assistant Chrome extension.
- Added first requirements document, design note, development plan, lessons, and current next step.
