# Design — LessonPilot

Version: 0.4
Last updated: 2026-08-12

## 1. Architecture Decision

2026-08-12 delivery update: student first use is web-first. The extension remains the Bilibili page-overlay and PC enhancement adapter, while `student-web/` provides a no-install W0 entry point across desktop and mobile browsers. W0 begins with a fixed Bilibili course link plus a teacher-provided SRT/VTT subtitle file. The browser parses the subtitle file locally into the teacher timeline; it does not scrape Bilibili subtitles or treat the cross-origin iframe as a controllable `PlayerAdapter`. W0 has no local video, upload, hosting, or replacement-player path. The learner shell presents the lesson, learning goals, an intentionally dominant source video, and honest learning-result expectations; timed interaction remains a Bilibili original-page/extension concern until separately proven for the web.

The first demo uses a DOM-injected video interaction layer rather than making a Chrome side panel the primary experience.

Reason:

- The product must pause the lesson and place an activity next to the learner's current focus.
- Timed interaction, feedback, retry, and playback resume are the core experience.
- A side panel can be added later for navigation or history, but it must not become a general chat surface.

```text
Bundled or locally saved lesson configuration
  -> content script resolves VideoRef via PlayerAdapter
  -> timeline engine watches playback time through the adapter
  -> player adapter pauses at the next unfinished node
  -> avatar and activity card collect the answer
  -> evaluator returns deterministic or AI feedback
  -> session store records attempts and completion
  -> player resumes
  -> report presenter renders student and teacher views
```

The teacher editor is a localhost website that writes local lesson configuration through an allowlisted bridge and launches the same student runtime in preview mode.

### 1.1 Local Service Boundary

W0 has one local static service, started from the repository root:

```text
http://127.0.0.1:4173/
  -> /teacher-web/   Creator Studio
  -> /student-web/   student course shell
```

Start it with `python3 -m http.server 4173` while the working directory is the repository root. `teacher-web/` and `student-web/` are route/resource boundaries inside the same origin, not independently hosted applications. This is required because the teacher preview opens `../student-web/` and the student shell fetches `./course.json` relative to its route.

Do not run a second student-only service on port `4174`. A directory-root server can make a page appear to load while changing navigation and configuration resolution, which no longer matches the verified W0 topology.

Minimum adapter surface for D0/D1 (Bilibili implementation only):

```text
VideoRef = { platform, videoId, partId? }

PlayerAdapter
  detect(location) -> VideoRef | null
  getVideoElement()
  getCurrentTime()
  pause()
  play()
  seek(seconds)
  subscribeNavigation(callback)
  teardown()
```

## 2. Student Runtime Components

### 2.0 W0 Web Course Shell

`student-web/` is not yet a second video runtime. It is a course-delivery shell that reads the fixed course reference, renders its title and learning context, embeds the source video where the host permits it, and always exposes a direct Bilibili fallback.

- Do not call iframe playback APIs or infer playback state from the cross-origin player.
- Do not offer a local-file, Object URL, upload, or hosting fallback in W0.
- Show learning goals above the video. Below it, show the learning results the course is designed to produce and label them as pending until a controllable interaction/session path exists; never fabricate completion.
- Keep technical source inspection out of the ordinary learner flow; the direct original-page link is the only necessary fallback.

### 2.0.1 W0 Link and Subtitle Intake

The W0 teacher workspace has one source path:

```text
fixed Bilibili page URL
  -> teacher obtains subtitle file through an authorized/manual route
  -> teacher imports .srt or .vtt
  -> browser parses timestamps and text locally
  -> caption timeline anchors teacher-authored classroom actions
```

- Accept only the fixed Bilibili BV id in this slice.
- Accept UTF-8 SRT/VTT files, ignore VTT metadata blocks, normalize comma/dot timestamps, and preserve multi-line caption text.
- Reject empty or unparsable files with a field-level error; do not replace the current working timeline on failure.
- Imported captions and action edits are page-local prototype state in W0. Persistence, source scraping, and AI analysis are later work.

### 2.1 Demo Scope Controller

- Resolve the current page to a `VideoRef` through the active `PlayerAdapter`.
- Mount the runtime only for the demo Bilibili id `BV1WW4y1e7GL`.
- Handle SPA navigation by mounting and unmounting cleanly via `subscribeNavigation` / `teardown`.

### 2.2 Player Adapter

Current implementation: `BilibiliPlayerAdapter` only.

- Find the active video element.
- Read current time and playback state.
- Pause, play, and seek.
- Observe playback without leaking host-page selectors into activity components.
- Identify videos as `VideoRef = { platform, videoId, partId? }`. In D0/D1, `platform` is always `bilibili` and the demo `videoId` remains `BV1WW4y1e7GL`.

Activity cards, timeline engine, and session store must call the adapter interface rather than Bilibili DOM selectors. After D1, add `YouTubePlayerAdapter` behind the same interface without rewriting activity or session code. Do not add multi-platform registries, locale fields, or region fields now.

### 2.3 Timeline Interaction Engine

- Load enabled nodes ordered by timestamp.
- Detect crossing an unfinished node.
- Pause once and activate the node.
- Track completed, skipped, and retryable states.
- Resume only after an explicit learner action.

### 2.4 Avatar Facilitator

- Render lightweight visual states: watching, asking, waiting, feedback, complete.
- Open the current activity card.
- Avoid covering native video controls.

The existing canvas mascot is sufficient for the demo unless manual testing proves otherwise.

### 2.5 Activity Cards

Use one stable activity container with three renderers:

- `multiple_choice`
- `fill_blank`
- `free_answer`

All renderers share submit, feedback, retry, skip, and continue actions so layout does not shift between activity types.

### 2.6 Evaluators

Deterministic evaluator:

- Multiple choice: exact option id match.
- Fill in the blank: normalized authored-answer match.

AI evaluator:

- Free answer: structured feedback against the lesson context and teacher rubric.
- Reports: summarize only recorded session facts and AI feedback.

### 2.7 Session Store

Use `chrome.storage.local` for the local demo so the teacher report can read the same completed session.

The runtime must not require an account or remote database.

### 2.8 Timed Overlay

- Render one reusable overlay element relative to the active video rectangle.
- Select the first configured half-open time range matching the current playback time.
- Recalculate layout while visible after window resize or page scroll.
- Hide safely when the video is unavailable and remove the overlay and listeners on SPA teardown.
- Keep the overlay independent from activity completion and session scoring.

The current S09 subtitle blocker is the first implemented use of this more general timed-overlay capability.

## 3. Teacher Demo Components

The teacher demo is a localhost website opened from an extension link. It has two primary entries:

- Open the finished interactive lesson.
- Modify the fixed lesson template.

This avoids a remote backend while preserving the productized teacher workflow. Saving a lesson never requires reinstalling the extension.

### 3.1 Local Node Editor

Implement a dedicated static teacher website for the fixed video. It shows extension connection status, a compact ordered node list, and an edit form.

Required fields:

- Node id and enabled state.
- Timestamp in seconds.
- Activity type as a read-only label.
- Prompt.
- Options and correct answer for multiple choice.
- Accepted answer for fill in the blank.
- Explanation or rubric.
- Continue behavior.

The page exposes only reset, save, save-and-preview, and latest-report actions. Node creation, deletion, sorting, and type switching remain unavailable.

### 3.2 Preview Bridge

- Enable the bridge only when `location.origin` exactly matches the configured localhost teacher origin, including its port.
- Accept only versioned `GET_BRIDGE_STATUS`, `GET_LESSON`, `SAVE_LESSON`, `RESET_LESSON`, and `OPEN_PREVIEW` messages.
- Forward requests to the service worker, which validates the lesson schema before writing `chrome.storage.local`.
- Return a response tied to the request id so the website never reports an unconfirmed save.
- Open the supported Bilibili URL with preview context after a confirmed save.
- Let the student runtime prefer locally edited configuration over bundled defaults.
- Create a new preview session on every save-and-preview action.
- Keep preview sessions separate from formal learner sessions.

The bridge must not expose generic storage access, arbitrary extension commands, credentials, tokens, or Bilibili page data.

### 3.3 Teacher Report View

Read the latest local session and show facts useful for delivery:

- Completion and attempts by node.
- Original answers.
- Deterministic outcomes.
- Free-answer feedback and revision.
- Follow-up recommendation.

Do not display aggregate charts until real multi-learner data exists.

### 3.4 Demo Milestones

`D0` ends after the localhost teacher website can use the secure bridge to edit, save, preview, answer, and locally record one deterministic activity.

`D1` adds all three activity types, real AI feedback, learner summary, teacher report, and the complete three-minute sales narrative.

The implementation sequence may expose D0 early, but only D1 is the complete sales demo.

## 4. Data Contracts

### Lesson Configuration

```js
{
  id: 'english-interview-demo',
  videoId: 'BV1WW4y1e7GL',
  title: '...',
  nodes: [
    {
      id: 'node-1',
      enabled: true,
      timeSeconds: 0,
      type: 'multiple_choice',
      prompt: '...',
      options: [{ id: 'a', label: '...' }],
      answer: 'a',
      explanation: '...',
      rubric: null,
      continueBehavior: 'manual'
    }
  ]
}
```

Final timestamps and content are authored only after manually checking the source video.

D0 and D1 may continue to author the bundled demo with a Bilibili `videoId`, but runtime and storage should treat the video as `VideoRef` with `platform: 'bilibili'`. After D1, add `YouTubePlayerAdapter` and allow `platform: 'youtube'` without rewriting activity or report contracts. Do not add locale, translation, or region fields until a real overseas customer forces that design.

### Learning Session

```js
{
  id: 'local-session-id',
  lessonId: 'english-interview-demo',
  sessionType: 'student', // or 'preview'
  videoRef: {
    platform: 'bilibili',
    videoId: 'BV1WW4y1e7GL'
  },
  startedAt: 'ISO-8601 timestamp',
  completedAt: null,
  answers: [
    {
      nodeId: 'node-1',
      attempts: 1,
      response: '...',
      correct: true,
      feedback: '...',
      revisedAnswer: null,
      submittedAt: 'ISO-8601 timestamp'
    }
  ]
}
```

## 5. AI Integration

First task types:

- `review_free_answer`
- `generate_session_reports`

Every request includes only:

- Lesson and current node identifiers.
- Relevant lesson excerpt or sentence pattern.
- Teacher rubric.
- Learner response.
- Recorded deterministic results when generating reports.

The response must use a validated structured shape before rendering. API credentials stay outside page context and are never committed.

## 6. UI Shape

- Keep the video as the primary surface.
- Place the avatar near the lower-right edge without covering native controls.
- Display one activity card at a time when playback pauses.
- Show compact progress such as `1 / 3`.
- Use the teacher surface as a quiet operational workspace: the course in progress, pending teaching decisions, course health, then the timeline editor, preview command, and latest report.
- Do not expose provider, iframe, adapter, local-file, or compatibility choices in the normal student flow. W0 uses one concise “在 B 站打开原课” fallback instead of a technical testing panel.
- Do not build a general AI chat panel in the first demo.

## 7. Platform Expansion Boundary

Confirmed product order:

```text
Now / D0 / D1: Bilibili only, Chinese teacher UI, current English lesson scenario
After D1: add YouTubePlayerAdapter as the second platform
After a real overseas customer: redesign multilingual and multi-region needs from evidence
```

YouTube is the right second platform because it tests a different video ID model, player behavior, and SPA navigation. Other sites are not ranked until real teacher courses require them.

Multilingual UI, course-language systems, regional payments, data residency, and international store distribution are fully deferred. Do not add locale or region schema work now. The only reserved expansion seam is `VideoRef` + `PlayerAdapter`.

## 8. Open Technical Questions

- Which AI backend will handle free-answer review for the local demo?
- Should the API be reached through a local proxy or a separately configured backend?
- Which three source-video timestamps best match comprehension, recall, and application activities?

Resolved and locked:

- Every save-and-preview creates a new preview session.
- Platform order is Bilibili now, YouTube after D1.
- Multilingual and multi-region work stay deferred.

These remaining questions do not block deterministic interaction-node development.
