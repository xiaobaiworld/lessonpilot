# LessonPilot

LessonPilot is an early-stage course-runtime project for upgrading an English teacher's existing recorded course into an interactive course product. The Chrome extension remains a Bilibili overlay spike; the first student validation entry is now a web page so students do not need to install a plugin.

The first demo targets a real teacher-style Bilibili English interview lesson. Its job is to show that a teacher can add timed practice, feedback, and learning evidence without re-recording the video. The current teacher sales sample is grounded in the checked-in Chinese AI-translated subtitle source at `doc/英文面试问答流程（超全！）｜自我介绍 矛盾处理 优缺点 技能.srt`.

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

## Delivery Standards

Everything a learner sees lives in one first-class learning window. A new client — browser extension, web page, local-video app, or someone else's app — becomes compatible by implementing that one contract, not by copying a page.

```text
学习窗口   一级容器：尺寸、呈现方式、生命周期、键盘、习题本、AI 问答、证据
  └─ 节点   一个时间点、一个教学点、一次窗口；边界与播放意图
       └─ 内容  提醒 / 补充 / 练习 / 追问 的结构化字段
```

Two kinds of requirement, never mixed:

- **Mandatory and identical everywhere.** The window's display and interaction. The same lesson pack must produce the same title, prompt, options, explanation, buttons, and evidence on every client.
- **Advisory, platform-dependent.** Pause, seek, on-picture highlight, caption covering, audio ducking. A client that cannot do these is still fully conformant.

What keeps the advisory half safe is window self-sufficiency: turn off everything outside the window, and a learner must still be able to complete the node.

| Layer | Document | Owns |
|---|---|---|
| Window | [Learning Window Standard](doc/learning-window-standard.md) | Skeleton, size tiers, mounting, queueing, lifecycle, keyboard, drafts, notebook, AI ask, evidence, host onboarding checklist |
| Node | [Node Standard](doc/node-content-standard.md) | Node boundaries, independence, playback intents, recap, and the content fields of each node family |
| Scope split | [Design](doc/design.md) section 7 | Which half is mandatory and which is advisory |

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

The teacher sales sample is a finished-course picture for conversations with teachers. Change it in `teacher-web/index.html`, `teacher-web/sample.css`, and `teacher-web/sample.js`. The timeline is a continuous pale blue-gray bar aligned with the video, and the add-node rail summarizes adding interaction in the video. Its header is intentionally minimal: `LessonPilot Studio`, then `英语职业课 / 英文面试表达`, then the course title. It does not show save, preview, unsaved, or sample-status controls. The functional subtitle-import and classroom-action prototype remains a separate page at `teacher-web/editor.html`.

The current sales sample uses three subtitle-grounded teaching points from the 08:33 lesson: `00:39` evidence after capability words, `02:16` ordering a coworker-conflict response, and `05:45` practicing the four-step stress response. The source file contains Chinese AI translation rather than original English captions, so the English display copy remains teacher-review material.

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

| Document | What it decides |
|---|---|
| [Requirements](doc/requirements.md) | Formal features and acceptance for the current single-video demo. Authoritative for shipped behavior |
| [Learning Window Standard](doc/learning-window-standard.md) | The one contract a new client implements to display and interact identically |
| [Node Standard](doc/node-content-standard.md) | What a node may do, and the content fields a teacher fills |
| [Design](doc/design.md) | Runtime components, data contracts, and the mandatory/advisory scope split |
| [Development Plan](doc/dev-plan.md) | Phase order and validation gates |
| [Student Runtime Summary](doc/student-runtime.md) | Navigation across student-side scope, plus personal review space and data ownership |
| [Teacher Course Workspace](doc/teacher-course-workspace-design.md) | The teacher-facing sales sample shape |
| [Teacher Demo Design](doc/teacher-demo.md) | Teacher demo entries and D0/D1 narrative |
| [UI Design](doc/ui-design.md) | Color system and two-page information architecture |
| [Teacher Promotion Video](doc/promo-video.md) | Promotion script |
| [Multi-Creator Platform Plan](doc/multi-creator-platform.md) | Deferred productization: tenancy, distribution, authorization, AI billing |
| [Bilibili Mascot Spike](doc/bili-mascot-spike.md) | Extension spike findings |
| [Lessons](doc/lessons.md) | Decisions learned the hard way |
| [Changelog](changelog.md) | Verified changes only |
| [Next Step](next.md) | The current slice and its checklist |

When documents disagree: shipped demo behavior follows Requirements; how a client displays and interacts follows the Learning Window Standard; what a node contains follows the Node Standard; productization ideas in the platform plan are not implementation instructions.
