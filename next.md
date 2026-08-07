# next.md — LessonPilot

## Current Goal

Complete the first verified Phase 1 slice: turn the existing 35-second playback spike into one reusable deterministic interaction node after confirming the matching video content.

## Current Step

1. [x] Confirm the buyer pays for course differentiation, learning evidence, and lower delivery work rather than abstract video quality.
2. [x] Replace the side-panel-first requirements with the teacher-edit -> student-interaction -> teacher-report loop.
3. [x] Write the Chinese requirements with detailed P0 flows, errors, data, and acceptance criteria.
4. [ ] Manually verify mascot mount, pause, seek, automatic trigger, and SPA teardown on `BV1WW4y1e7GL`.
5. [ ] Inspect the source video around the candidate trigger and author one content-matched multiple-choice node.
6. [ ] Define the node-trigger state transitions and focused automated tests.
7. [ ] Implement one reusable pause -> answer -> feedback -> continue loop.
8. [ ] Re-run automated and manual acceptance, then synchronize docs and changelog.

## Decisions Locked

- Use a DOM-injected interaction card as the primary student experience.
- Keep the lightweight avatar as facilitator, not the product core.
- Use static lesson metadata before subtitle extraction or automatic authoring.
- Evaluate multiple choice and fill-in deterministically.
- Reserve AI for free-answer review and session reports.
- Build a minimal local teacher editor and preview before a full dashboard.

## Decisions Still Open

- AI backend and credential flow for Phase 4.
- Final three content-matched timestamps and activity prompts.
- Preview-session reset behavior.
