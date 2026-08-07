# next.md — LessonPilot

## Current Goal

Validate the Bilibili video control spike on the primary demo video, then continue Phase 1 static extension shell with the side panel.

## Current Step

1. [x] Create independent project directory.
2. [x] Write first requirements document.
3. [x] Write first design note.
4. [x] Write first development plan.
5. [x] Research open-source Bilibili playback and 2D mascot projects.
6. [x] Scaffold MV3 extension spike with mascot play/pause control.
7. [ ] Manually verify mascot control on `BV1WW4y1e7GL`.
8. [ ] Confirm AI backend and extension UI approach before Phase 1 side panel work.

## Candidate Decisions To Confirm

- Use DOM-injected side panel or Chrome sidePanel API for the first build.
- Use user-provided API key, local proxy, or local model gateway for AI calls.
- Implement only static lesson metadata first, before any subtitle parsing.
