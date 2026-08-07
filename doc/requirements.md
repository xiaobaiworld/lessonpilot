# Requirements — LessonPilot

Version: 0.2
Last updated: 2026-08-07

## 1. Product Goal

Build a Chrome extension demo that turns one existing English teacher's Bilibili recording into an interactive lesson without requiring the teacher to re-record it.

The demo must prove one business hypothesis:

> Within 3 minutes, a teacher who already sells recorded courses understands that LessonPilot can make an old lesson easier to package, differentiate, and deliver by adding timed practice, feedback, and learning evidence.

The demo does not claim that interaction automatically increases sales. Its job is to earn the next commercial commitment: the teacher provides a real course video for a custom trial or agrees to discuss a paid course upgrade.

This is not a general AI learning app, a general Bilibili assistant, a video quality tool, or a Duolingo/Speak competitor.

## 2. Target Users

### 2.1 Buyer

The first buyer is an English teacher, course creator, or small training operator who:

- Already sells a paid or semi-paid recorded course.
- Uses homework, community support, or manual feedback as part of delivery.
- Wants stronger course differentiation, higher perceived value, or lower service cost.
- Has enough course revenue to pay for course conversion or software.

Buyer problems:

- Recorded lessons are passive and difficult to distinguish from free videos.
- Teachers cannot see whether a learner understood or practiced the lesson.
- Repetitive answering and homework correction consume delivery time.
- Re-recording an entire course is expensive and slow.

Traffic-only creators, advertising-led accounts, and batch-generated video accounts are not the first customers.

### 2.2 Learner

The first learner is an adult preparing for an English interview.

Learner problems:

- They recognize an example while watching but cannot recall it later.
- They understand a model answer but cannot adapt it to their background.
- They do not know whether their own answer is natural or specific.
- Passive watching produces no concrete record of what they learned.

## 3. First Demo Video

Primary demo video:

- Title: `英文面试问答流程（超全！）｜自我介绍 矛盾处理 优缺点 技能`
- URL: `https://www.bilibili.com/video/BV1WW4y1e7GL/`
- Creator: `每日英语Xixi学以致用`
- Duration: about 8 minutes 33 seconds

The first demo only supports this video. Interaction timestamps and teaching content must be authored after manually checking the matching video segment. The existing 35-second trigger is a playback-control spike, not yet an approved teaching node.

## 4. Demo Promise

The demo must show one complete loop:

```text
Teacher edits one interaction node
  -> teacher previews the existing video
  -> video pauses at authored timestamps
  -> learner completes three types of practice
  -> learner receives feedback and resumes playback
  -> learner and teacher receive reports from the same session data
```

The value proposition is:

> Upgrade an existing recorded course into an interactive course product without re-recording it.

## 5. Student Experience

### 5.1 Supported Video Detection

- Detect the exact primary Bilibili video id.
- Show the learning experience only on the supported video.
- Remove the experience when Bilibili SPA navigation leaves the supported video.

### 5.2 Avatar Facilitator

- Show a lightweight avatar as the interaction host.
- Use clear states: watching, asking, waiting, feedback, and complete.
- Let the avatar introduce an activity and return focus to the video.

The demo does not require Live2D, voice synthesis, clothing, or character customization.

### 5.3 Timed Pause Engine

- Watch the current video time.
- Pause once when playback crosses an unfinished interaction node.
- Open the matching activity card.
- Resume playback after the learner completes or explicitly skips the activity.
- Avoid repeatedly reopening a completed node unless the learner seeks back and chooses to retry it.

### 5.4 Three Authored Activities

The primary lesson must contain exactly three representative nodes for the sales demo:

1. **Multiple choice — comprehension**
   - Check whether the learner understood a point the teacher just explained.
   - Evaluate locally with a pre-authored answer and explanation.

2. **Fill in the blank — recall**
   - Remove a key phrase from a sentence used in the lesson.
   - Evaluate locally with normalized answer matching and an authored explanation.

3. **Free answer — application**
   - Ask the learner to use the lesson pattern in a personal interview answer.
   - Use AI to evaluate naturalness, specificity, lesson-pattern use, and language risk.
   - Return concrete feedback and a revised answer.

### 5.5 Feedback, Retry, and Resume

Every activity must produce a closed interaction loop:

- Preserve the learner's submitted answer.
- Show specific feedback rather than only correct/incorrect.
- Allow one-click retry or revision.
- Make the continue action explicit.
- Update lesson progress without shifting the video layout.

### 5.6 Student Summary

At the end of the three-node demo, show:

- Activities completed.
- Multiple-choice and fill-in results.
- Original and revised free answer.
- Key expression practiced.
- Main correction point.
- One next review task.

The summary must be generated from the learner's actual session data, not from a fixed template pretending to be personalized.

## 6. Teacher Experience

### 6.1 Minimal Node Editor

The demo needs a functional editor for the fixed video, not a full teacher dashboard.

For each node, the teacher can edit:

- Timestamp.
- Activity type.
- Prompt.
- Options and correct answer when applicable.
- Explanation or evaluation rubric.
- Continue behavior.

The teacher can edit and enable or disable the three seeded demo nodes. Adding, reordering, and deleting arbitrary nodes are deferred until a teacher validates the authoring workflow.

### 6.2 Preview

- Save node configuration locally.
- Open or return to the supported video in preview mode.
- Demonstrate that at least one changed prompt or timestamp appears in the student experience.

Preview is required because it connects teacher configuration to learner delivery.

### 6.3 Teacher Learning Report

Show an individual report generated from the same session data as the student summary:

- Completion status and node results.
- Number of attempts.
- Learner's original free answer.
- AI feedback and revised version.
- Main weak point and suggested follow-up.

The first demo does not need cohort analytics, fabricated pass rates, or a class dashboard.

## 7. AI Boundaries

AI is used only where open-ended judgment creates visible value:

- Review the free answer.
- Produce the student summary and teacher-facing interpretation.

Multiple-choice and fill-in evaluation must remain deterministic for speed and reliability.

AI must:

- Stay inside the current lesson context and teacher rubric.
- Point to concrete words or sentences.
- Separate the learner's original answer from the proposed revision.
- Avoid guaranteed score, hiring, or sales claims.

AI must not:

- Pretend to be the original teacher.
- Invent learner activity or course data.
- Turn into a general chatbot.
- Send full Bilibili page content to the backend.

## 8. Data Requirements

The demo may use pre-authored local lesson data and local session storage.

Lesson data includes:

- Video id, URL, title, and creator.
- Ordered interaction nodes.
- Timestamp and activity type.
- Prompt, options, answer, explanation, and rubric.

Session data includes:

- Lesson id and session timestamps.
- Node completion state.
- Submitted answers and attempts.
- Deterministic result or AI feedback.
- Revised free answer.

Do not commit API keys or real learner personal data.

## 9. Non-Goals

The first demo will not include:

- General support for all Bilibili or YouTube videos.
- Automatic subtitle extraction or automatic node generation.
- A general lesson chatbot or side-panel knowledge assistant.
- User accounts, payments, classes, or organization management.
- Aggregate cohort analytics.
- Speech recognition or pronunciation scoring.
- Full teacher course management.
- Chrome Web Store publishing or a marketing website.
- Live2D or advanced avatar production.

## 10. Success Criteria

### Product Demonstration

1. The exact Bilibili video loads the extension without breaking video controls.
2. Three authored nodes pause, collect answers, show feedback, and resume playback.
3. The teacher can change at least one node and see the change in preview.
4. Student and teacher reports contain the learner's actual submitted answers.
5. The complete sales demonstration can be understood within 3 minutes.

### Commercial Validation

The strongest first success signal is one qualified teacher doing at least one of the following:

- Provides a real paid-course video for conversion.
- Agrees to a custom trial with a defined next meeting.
- Expresses willingness to pay for converting a lesson or course.

Compliments, feature suggestions, and generic statements such as "this is interesting" do not count as validation.
