# Requirements — LessonPilot

Version: 0.1  
Last updated: 2026-08-07

## 1. Product Goal

Build a Chrome extension demo that upgrades one English teacher's Bilibili video lesson into an interactive AI-assisted lesson.

The demo must prove one business hypothesis:

> An English teacher can see, within 3 minutes, that LessonPilot can make an existing video lesson feel more valuable by adding AI questions, personalized practice, feedback, and a learning report.

This is not a general AI learning app, not a general Bilibili assistant, and not a Duolingo/Speak competitor.

## 2. Target Users

### Buyer

The first buyer is an English teacher, course creator, or small English training operator who already has paid or semi-paid video lessons.

Buyer pain:

- Students watch videos passively.
- Students ask repetitive questions.
- Students struggle to adapt sample sentences to their own situations.
- Teachers want their recorded lessons to feel more interactive and more premium.

### End User

The first end user is an adult English learner preparing for interviews, especially interviews that require English self-introduction, strengths/weaknesses, experience explanation, or skill explanation.

Learner pain:

- They understand the sample sentence but cannot adapt it to themselves.
- They do not know whether their answer is natural.
- They need concrete correction, not generic encouragement.
- They forget expressions after watching the video.

## 3. First Demo Video

Primary demo video:

- Title: `英文面试问答流程（超全！）｜自我介绍 矛盾处理 优缺点 技能`
- URL: `https://www.bilibili.com/video/BV1WW4y1e7GL/`
- Creator: `每日英语Xixi学以致用`
- Duration: about 8 minutes 33 seconds

Why this video:

- It looks closer to a real teacher lesson than a batch-generated content account.
- It covers several interview subtopics, not only one sentence.
- It is short enough for a demo.
- It has strong public engagement signals.
- It naturally supports practice, rewriting, and feedback.

## 4. First Demo Scope

The first demo only needs to work on the fixed primary Bilibili video above.

Required behavior:

1. User opens the primary Bilibili video in Chrome.
2. LessonPilot detects the video URL.
3. A right-side learning assistant panel appears.
4. The panel shows lesson segments and current segment content.
5. The learner can ask about the lesson.
6. The learner can adapt a sample answer to their own background.
7. The learner can submit their own answer for AI feedback.
8. The learner can generate a short learning report.

The first demo may use pre-authored lesson metadata for this one video. It does not need to automatically parse every Bilibili video.

## 5. Core Features

### 5.1 Video Detection

The extension must detect the primary Bilibili video URL.

Acceptance:

- On the primary video page, the assistant panel is shown.
- On unrelated pages, the assistant panel is hidden or shows a clear unsupported state.

### 5.2 Assistant Side Panel

The extension must render a fixed right-side panel on the video page.

Panel sections:

- Lesson title
- Current segment
- Key sentences
- Ask AI
- Personalize answer
- Practice feedback
- Learning report

Acceptance:

- The panel does not block the video controls.
- The user can open and collapse the panel.
- Text remains readable on a typical laptop viewport.

### 5.3 Lesson Segments

The extension must provide a simple segment list for the primary video.

Example segments:

- Self-introduction
- Handling conflict questions
- Strengths and weaknesses
- Skills and experience

Acceptance:

- Clicking a segment seeks the video to the segment start time if feasible.
- The panel displays the selected segment's key sentences and practice task.
- If video seek integration is not stable in the first demo, segment selection must still update the panel content.

### 5.4 Sentence Explanation

The learner can click or select a key sentence and ask for an explanation.

Explanation must include:

- Chinese meaning
- Natural usage context
- Why the expression works in an interview
- One common Chinese-English mistake to avoid

Acceptance:

- Output is specific to the selected sentence.
- Output is not just a translation.

### 5.5 Personalized Rewrite

The learner can enter profile fields:

- Target role
- Years of experience
- Current background
- Interview goal

The assistant generates a personalized English answer based on the lesson example.

Acceptance:

- The generated answer reflects the learner's role and background.
- The answer remains interview-appropriate.
- The answer includes at least one reusable sentence pattern from the lesson.

### 5.6 Practice Feedback

The learner can submit a written answer to an interview prompt.

The assistant gives feedback on:

- Naturalness
- Specificity
- Grammar or phrasing
- Chinese-English expression risk
- A revised version

Acceptance:

- Feedback points to concrete phrases or sentences.
- Feedback gives an improved version.
- Feedback avoids vague comments such as "make it more natural" without examples.

### 5.7 Learning Report

The learner can generate a short report after practicing.

Report content:

- Lesson segment practiced
- Key expressions learned
- User's submitted answer summary
- Main correction points
- Next review task

Acceptance:

- The report can be copied as text.
- The report is useful to both the learner and the teacher.

## 6. AI Behavior Requirements

The AI assistant must behave like a lesson assistant, not a general chatbot.

It should:

- Stay within the current lesson context.
- Explain the teacher's content before adding outside material.
- Ask for missing learner background when needed.
- Give concrete corrections.
- Avoid overclaiming test scores, hiring outcomes, or guaranteed results.

It must not:

- Pretend to be the original teacher.
- Claim access to private course data.
- Generate unrelated English learning plans.
- Give generic motivational coaching.

## 7. Data and Content Requirements

For the first demo, the project may maintain a local lesson data file for the primary video.

Lesson data should include:

- Video URL and title
- Segment start times
- Segment titles
- Key sentences
- Practice prompts
- Prompt templates for AI tasks

The demo should not store real learner private data unless explicitly added in a later phase.

## 8. Non-Goals

The first demo will not include:

- General support for all Bilibili videos
- YouTube support
- User accounts
- Payment
- Teacher dashboard
- Student history across lessons
- Speech recognition
- Pronunciation scoring
- Automatic subtitle extraction
- Chrome Web Store publishing
- Public marketing website
- Full course hosting

## 9. Success Metrics

The first demo is successful if:

1. A viewer can open the primary Bilibili video and use the assistant panel.
2. The viewer can complete one full flow: segment -> explanation -> personalized rewrite -> practice feedback -> learning report.
3. An English teacher can understand the product value in 3 minutes.
4. At least one teacher is willing to provide a real lesson video for a custom demo, or expresses willingness to pay for a trial course upgrade.

## 10. Demo Review Checklist

A demo pass requires:

- The extension loads on the primary Bilibili video.
- The side panel renders without breaking the page layout.
- Lesson segment selection works.
- AI explanation is sentence-specific.
- Personalized rewrite uses user profile fields.
- Practice feedback is concrete and actionable.
- Learning report is copyable.
- No private keys or real learner data are committed.

## 11. Later Candidate Features

Only after the first teacher demo validates demand:

- Teacher course import workflow
- Teacher-facing lesson editor
- Multi-video lesson pack
- Student practice history
- Voice input
- Pronunciation feedback
- YouTube support
- VOA/BBC-style standard material mode
- LMS or course platform embedding
