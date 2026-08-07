# LessonPilot

LessonPilot is an early-stage Chrome extension project for upgrading an English teacher's existing recorded course into an interactive course product.

The first demo targets a real teacher-style Bilibili English interview lesson. Its job is to show that a teacher can add timed practice, feedback, and learning evidence without re-recording the video.

## Product Positioning

For English teachers and course creators:

> Upgrade an already-recorded course into an interactive course product without re-recording it.

For learners:

> Watch the lesson, pause for active practice, apply the teacher's examples, and receive concrete feedback.

The first buyer is a teacher or small training operator who already sells recorded courses. The project is not positioned as a video quality tool or a general student chatbot.

## Current Phase

Phase 1: validate the existing playback-control spike and turn it into a reusable timed interaction engine.

The first implementation should support one fixed Bilibili video before expanding to other videos or platforms.

## Load Extension (Spike)

1. Open `chrome://extensions/` and enable Developer mode.
2. Click **Load unpacked** and select the `src/` directory.
3. Open the demo video: `https://www.bilibili.com/video/BV1WW4y1e7GL/`
4. Click the mascot in the bottom-right corner to pause or resume playback.
5. Use the three buttons above the mascot: **暂停**, **30秒**, **35秒**.
6. When playback reaches 35 seconds, a dialog appears automatically.

See [Bilibili mascot spike notes](doc/bili-mascot-spike.md) for open-source research and technical decisions.

## Documents

- [Requirements](doc/requirements.md)
- [Design](doc/design.md)
- [Development Plan](doc/dev-plan.md)
- [Bilibili Mascot Spike](doc/bili-mascot-spike.md)
- [Lessons](doc/lessons.md)
- [Changelog](changelog.md)
- [Next Step](next.md)
