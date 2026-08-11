# Lessons — LessonPilot

Version: 0.3
Last updated: 2026-08-11

## 2026-08-07 — Chrome Extension Is Delivery Shape, Not Product Positioning

Chrome extension is only the fastest first demo format. The product is a course upgrade layer for English teachers.

If the project is described as "an AI English Chrome plugin for students", it competes with large language learning apps. If it is described as "AI assistant layer for a teacher's existing video lesson", it sells to course creators and small training operators.

## 2026-08-07 — Use Real Teacher Video for Sales Demo

VOA/BBC/slow English materials are useful for standard learning flows, but the first sales demo should use a real teacher-style video.

Reason:

- The buyer is a teacher.
- The buyer must imagine their own course being upgraded.
- Public standard materials prove AI learning capability, but teacher videos prove course upgrade value.

## 2026-08-07 — Do Not Treat Copyable UI as the Asset

The side panel, video Q&A, and learning report can be copied quickly.

The durable asset should be:

- Course structuring SOP
- Vertical prompt templates
- Teacher delivery workflow
- Student practice data
- Case studies from real course upgrades

## 2026-08-07 — Course Sellers Buy Commercial Outcomes, Not Video Quality

A teacher who already sells a course does not primarily buy "better video quality." The buying reasons are stronger product differentiation, higher perceived course value, learning evidence, and lower repetitive delivery work.

The product promise should therefore be "upgrade an existing recorded course without re-recording it," not "improve an English video."

Traffic-only creators and batch-generated accounts are weak first buyers because they may have no paid delivery problem or budget to solve.

## 2026-08-07 — Interaction Must Produce a Closed Delivery Loop

Avatar, pause control, and question cards are visible demo elements, but none is sufficient alone.

The minimum defensible loop is:

- Teacher authors a timed node.
- Learner answers when the video pauses.
- The system gives specific feedback and resumes playback.
- The same session data produces learner guidance and teacher evidence.

Teacher preview is required because it proves that course conversion is repeatable rather than a one-off custom animation.

## 2026-08-11 — Expand Platforms After Proof, Not Before

Bilibili and YouTube look similar as "video sites," but each platform is a separate player-adapter problem: DOM, SPA navigation, subtitles, and fullscreen behavior all differ.

Confirmed order:

- D0/D1: Bilibili only.
- After D1: YouTube as the second adapter, to prove the player abstraction is real.
- Later platforms: rank only from real teacher course sources.
- Multilingual and multi-region: redesign only when a real overseas customer appears; do not reserve schema fields now.

The durable preparation is isolating Bilibili selectors behind a player adapter. Building multi-platform registries, locale systems, or regional billing before the first teacher closes a loop is premature expansion.

## 2026-08-11 — Small-B-First B2B2C, Not a Consumer Extension

LessonPilot may share a browser-extension shape with consumer products, but the business model is different:

- The teacher buys, configures, distributes, and delivers the course.
- The learner uses the runtime but is not the primary acquisition target.
- Teacher accountability and service reduce dependence on learner self-discipline.
- Learning behavior becomes evidence inside the teacher's delivery workflow.

Consumer capabilities such as cross-course AI credits, review queues, and vocabulary tools may be reserved in the architecture, but they do not justify a separate free/Pro product line before real retention and willingness-to-pay evidence exists.

## 2026-08-11 — Instrument Decisions, Not Users

Behavior data is valuable only when it answers a product or teaching decision.

Keep platform telemetry separate from learner evidence. Record only authorized lesson sessions, never unrelated browsing history. Raw answers belong to the learning session rather than the generic event stream.

Start with local structured events and voluntary export. Anonymous remote telemetry requires explicit notice and consent; identity-linked analytics should wait until automatic teacher reporting or cross-device learner records make identity necessary.

The defensible asset is not a large event warehouse. It is the accumulated link between course structure, learner behavior, teacher delivery, and verified outcomes.
