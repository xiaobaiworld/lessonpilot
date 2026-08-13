# LessonPilot

LessonPilot is an early-stage course-runtime project for upgrading an English teacher's existing recorded course into an interactive course product. The Chrome extension remains a Bilibili overlay spike; the first student validation entry is now a web page so students do not need to install a plugin.

The first demo targets a real teacher-style Bilibili English interview lesson. Its job is to show that a teacher can add timed practice, feedback, and learning evidence without re-recording the video.

## Product Positioning

For English teachers and course creators:

> Upgrade an already-recorded course into an interactive course product without re-recording it.

For learners:

> Watch the lesson, pause for active practice, apply the teacher's examples, and receive concrete feedback.

The first buyer is a teacher or small training operator who already sells recorded courses. The project is not positioned as a video quality tool or a general student chatbot.

## Current Phase

Technical spike is roughly done. Next delivery target is **D0** (configurable interaction demo), then **D1** (complete sales demo).

Continue from [`next.md`](next.md) on any machine:

1. `git pull`
2. Load `src/` in Chrome and verify the demo video still works
3. Follow the unchecked D0 steps in `next.md`

Scope locks:

- Bilibili only through D0/D1
- YouTube only after D1, as a second player adapter
- No multilingual UI or multi-region commercial/compliance work now
- Keep only the `VideoRef` / `PlayerAdapter` seam needed for Bilibili stability and a future YouTube adapter

The first implementation supports one fixed Bilibili video before expanding to other videos or platforms. The web sample embeds it for source verification, while locally selected HTML5 video is used to validate reliable timed interaction without uploading or hosting video.

## Local Web Service

The teacher and student pages are two paths served by **one static server started from the repository root**. The directories are page boundaries, not separate services.

```bash
cd /Users/bai/code/lessonpilot
python3 -m http.server 4173
```

Open:

- Teacher sales sample: [http://localhost:4173/teacher-web/](http://localhost:4173/teacher-web/)
- Teacher W0 editor: [http://localhost:4173/teacher-web/editor.html](http://localhost:4173/teacher-web/editor.html)
- Student course: [http://localhost:4173/student-web/](http://localhost:4173/student-web/)

Do not start `teacher-web/` or `student-web/` as separate server roots, and do not use a second port such as `4174`. The teacher preview link is relative (`../student-web/`), and the student page must fetch `student-web/course.json` from the same repository-root service. The configured student sample embeds Bilibili video `BV1WW4y1e7GL` and keeps a direct original-page fallback.

## Load Extension (Spike)

1. Open `chrome://extensions/` and enable Developer mode.
2. Click **Load unpacked** and select the `src/` directory.
3. Open the demo video: `https://www.bilibili.com/video/BV1WW4y1e7GL/`
4. Click the mascot in the bottom-right corner to pause or resume playback.
5. Use the three buttons above the mascot: **暂停**, **30秒**, **35秒**.
6. When playback reaches 35 seconds, a dialog appears automatically.
7. Between configured time ranges, a customizable bar covers the subtitle area on the video.

Customize subtitle blockers in `src/content/config/demo-lesson.js`.

See [Bilibili mascot spike notes](doc/bili-mascot-spike.md) for open-source research and technical decisions.

## Documents

- [Requirements](doc/requirements.md)
- [Design](doc/design.md)
- [Development Plan](doc/dev-plan.md)
- [Student Runtime Summary](doc/student-runtime.md)
- [Teacher Demo Design](doc/teacher-demo.md)
- [Teacher Promotion Video](doc/promo-video.md)
- [Multi-Creator Platform Plan](doc/multi-creator-platform.md)
- [Bilibili Mascot Spike](doc/bili-mascot-spike.md)
- [Lessons](doc/lessons.md)
- [Changelog](changelog.md)
- [Next Step](next.md)
