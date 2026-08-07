# Design — LessonPilot

Version: 0.1  
Last updated: 2026-08-07

## 1. First Architecture

The first version is a Chrome extension that injects a side panel into one supported Bilibili video page.

```text
Bilibili video page
  -> content script detects supported URL
  -> side panel renders lesson assistant UI
  -> lesson data loaded from bundled JSON
  -> AI requests sent through extension background/service worker
  -> response displayed in the side panel
```

## 2. Main Components

### Extension Manifest

Defines:

- Supported host permissions for `https://www.bilibili.com/video/*`
- Content script entry
- Background service worker
- Extension assets

### Content Script

Responsibilities:

- Detect whether the current page matches the supported demo video.
- Inject and manage the side panel.
- Read or control the video element when feasible.
- Send AI task requests to the background service worker.

### Side Panel UI

Responsibilities:

- Show lesson segments.
- Show selected/current segment details.
- Provide forms for learner profile and practice answer.
- Display AI responses and learning report.

### Background Service Worker

Responsibilities:

- Keep API credentials out of page context.
- Send requests to the configured AI backend.
- Return sanitized responses to the content script.

### Lesson Data

Bundled structured data for the first demo video.

Fields:

- `videoId`
- `url`
- `title`
- `creator`
- `segments`
- `keySentences`
- `practicePrompts`
- `promptTemplates`

## 3. AI Task Types

First version task types:

- `explain_sentence`
- `personalize_answer`
- `review_practice_answer`
- `generate_learning_report`

Every AI task should include:

- Current lesson id
- Current segment id
- Selected sentence or user answer
- User profile fields when relevant
- A strict instruction to stay inside lesson context

## 4. Security and Privacy Notes

- Do not commit API keys.
- Store local API config outside Git or use Chrome extension local settings in a later phase.
- Do not collect learner data in the first demo.
- Do not send full page HTML to the AI backend.
- Send only the lesson segment, selected sentence, user profile fields, and user practice answer.

## 5. Demo Constraint

The first version is allowed to hard-code support for one video.

This is intentional. The first milestone validates sales value, not universal video parsing.

## 6. Open Technical Questions

- Which AI backend will be used for the first local demo?
- Should the first demo use a user-provided API key or a local proxy?
- How stable is Bilibili video element seeking from a content script?
- Should the UI be a DOM-injected panel or Chrome sidePanel API in the first build?
