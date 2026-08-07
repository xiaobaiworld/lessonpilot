# Design — LessonPilot

Version: 0.2
Last updated: 2026-08-07

## 1. Architecture Decision

The first demo uses a DOM-injected video interaction layer rather than making a Chrome side panel the primary experience.

Reason:

- The product must pause the lesson and place an activity next to the learner's current focus.
- Timed interaction, feedback, retry, and playback resume are the core experience.
- A side panel can be added later for navigation or history, but it must not become a general chat surface.

```text
Bundled lesson configuration
  -> content script matches the fixed Bilibili video
  -> timeline engine watches playback time
  -> player adapter pauses at the next unfinished node
  -> avatar and activity card collect the answer
  -> evaluator returns deterministic or AI feedback
  -> session store records attempts and completion
  -> player resumes
  -> report presenter renders student and teacher views
```

The teacher editor writes local lesson configuration and launches the same student runtime in preview mode.

## 2. Student Runtime Components

### 2.1 Demo Scope Controller

- Extract the exact BV id from the current location.
- Mount the runtime only for `BV1WW4y1e7GL`.
- Handle Bilibili SPA navigation by mounting and unmounting cleanly.

### 2.2 Bilibili Player Adapter

- Find the active video element.
- Read current time and playback state.
- Pause, play, and seek.
- Expose playback observation without leaking Bilibili-specific selectors into activity components.

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

## 3. Teacher Demo Components

### 3.1 Local Node Editor

Implement a dedicated extension page for the fixed video. It shows a compact ordered node list and an edit form.

Required fields:

- Node id and enabled state.
- Timestamp in seconds.
- Activity type.
- Prompt.
- Options and correct answer for multiple choice.
- Accepted answer for fill in the blank.
- Explanation or rubric.
- Continue behavior.

### 3.2 Preview Bridge

- Persist the edited configuration in `chrome.storage.local`.
- Open the supported Bilibili URL with preview context.
- Let the student runtime prefer locally edited configuration over bundled defaults.

### 3.3 Teacher Report View

Read the latest local session and show facts useful for delivery:

- Completion and attempts by node.
- Original answers.
- Deterministic outcomes.
- Free-answer feedback and revision.
- Follow-up recommendation.

Do not display aggregate charts until real multi-learner data exists.

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

### Learning Session

```js
{
  id: 'local-session-id',
  lessonId: 'english-interview-demo',
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
- Use the teacher editor as a quiet operational tool: node list, edit form, preview command, and latest report.
- Do not build a general AI chat panel in the first demo.

## 7. Open Technical Questions

- Which AI backend will handle free-answer review for the local demo?
- Should the API be reached through a local proxy or a separately configured backend?
- Which three source-video timestamps best match comprehension, recall, and application activities?
- How should preview mode reset or preserve the latest local session?

These questions do not block deterministic interaction-node development.
