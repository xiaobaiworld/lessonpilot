# LessonPilot

LessonPilot is an early-stage Chrome extension project for upgrading an existing English video lesson into an interactive AI-assisted lesson.

The first demo targets a real teacher-style Bilibili English interview lesson. The goal is not to build a general AI language learning app. The goal is to prove that an English teacher can turn an existing video course into a lesson with questions, practice, feedback, and a learning report.

## Product Positioning

For English teachers and course creators:

> Turn an already-recorded English lesson into an AI interactive lesson.

For learners:

> Watch the lesson, ask about the current segment, rewrite examples for your own situation, practice answers, and get feedback.

## Current Phase

Phase 0 → Phase 1 transition: requirements are defined; a technical spike validates Bilibili playback control with a 2D mascot overlay.

The first implementation should support one fixed Bilibili video before expanding to other videos or platforms.

## Load Extension (Spike)

1. Open `chrome://extensions/` and enable Developer mode.
2. Click **Load unpacked** and select the `src/` directory.
3. Open the demo video: `https://www.bilibili.com/video/BV1WW4y1e7GL/`
4. Click the mascot in the bottom-right corner to pause or resume playback.

See [Bilibili mascot spike notes](doc/bili-mascot-spike.md) for open-source research and technical decisions.

## Documents

- [Requirements](doc/requirements.md)
- [Design](doc/design.md)
- [Development Plan](doc/dev-plan.md)
- [Bilibili Mascot Spike](doc/bili-mascot-spike.md)
- [Lessons](doc/lessons.md)
- [Changelog](changelog.md)
- [Next Step](next.md)
