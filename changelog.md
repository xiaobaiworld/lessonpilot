# Changelog — LessonPilot

Only record verified changes.

## [Unreleased]

### Teacher Sales Sample Course Header — 2026-08-13

- Replace prototype status text with the course directory `英语职业课 / 英文面试表达`.
- Remove preview, save, unsaved, and duplicated sample-course controls from the sales-sample header.
- Keep example-data disclosure in the student completion section, where it applies to the displayed records.

### Teacher Editor Static Reload Fix — 2026-08-13

- Make the shared teacher editor script tolerate controls that exist only on earlier page variants.
- Version the editor script URL so a browser does not keep executing the pre-split cached bundle after pulling the sales-sample changes.
- Add a page contract check covering the optional control binding and cache-busted editor script.

### Teacher Workspace Sales Sample Page — 2026-08-13

- Implement the confirmed sales sample at `teacher-web/index.html`: video 3/4 + intro 1/4, full-width timeline with typed icons, node rows, and labeled sample completion.
- Keep the previous subtitle-driven W0 prototype at `teacher-web/editor.html`.

### Teacher Workspace Timeline Stack — 2026-08-13

- Stack video above a full-width timeline instead of placing them side by side.
- Give a small video about three-quarters of the row width, with course intro in the remaining quarter.
- Mark timeline interaction points with distinct icons and visible labels.

### Teacher Workspace Sales Sample — 2026-08-13

- Define `doc/teacher-course-workspace-design.md` as the teacher-facing sales sample, not the shipped workspace.
- Keep the four-layer picture (course, timeline, node rows with student-effect preview, sample completion) as the target shape of the later real workspace.
- Leave `teacher-web/` functional code unchanged in this round.

### Classroom-Design Teacher Home — 2026-08-13

- Reduce the teacher home from a four-module capability map to one dominant classroom-design task.
- Keep the fixed Bilibili course and manual subtitle import as compact setup inputs beside the design entry.
- Replace home-page student preview and result modules with a small, honest note about the learning process and future evidence.

### Teacher Capability-Guided Home — 2026-08-13

- Replace the assumed current-course dashboard with a first-use workspace that explains existing-course intake, caption-anchored classroom design, student preview, and learning results.
- Keep the fixed Bilibili link confirmation, manual SRT/VTT import, timeline editor, and student preview as direct commands from the new workflow.
- State clearly that W0 displays an expected learning-result structure but does not yet record learning sessions or generate reports.
- Verify desktop and 375px layouts, source import, action editing, and teacher-to-student preview without horizontal overflow.

### Local Web Service Contract — 2026-08-12

- Document one repository-root local server for both teacher and student web pages.
- Establish `/teacher-web/` and `/student-web/` on port `4173` as the canonical local URLs.
- Record that `4174` and per-directory server roots are unsupported because they break the verified relative preview and course-configuration topology.
- Add troubleshooting guidance to distinguish a wrong server root from stale or missing synchronized code.

### W0 Subtitle-Driven Course Authoring — 2026-08-12

- Define W0 as a fixed Bilibili URL plus teacher-provided SRT/VTT subtitle intake, a locally parsed caption timeline, and caption-anchored classroom actions.
- Explicitly exclude Bilibili subtitle scraping, local video, upload, hosting, and fabricated learning-completion data.
- Refocus the learner shell around learning goals, the source video, and expected learning results.
- Add local SRT/VTT parser coverage and browser verification that imported captions replace the teacher timeline and accept a classroom action.

### W0 Bilibili Course Shell — 2026-08-12

- Re-scope the first web slice to a fixed Bilibili course presentation and teacher/student page validation.
- Remove local-video selection, browser-controlled timed activities, local-session flow, tester playback controls, and their W0 configuration/runtime artifacts from the student webpage.
- Keep timed interaction validation on the Bilibili original-page extension spike until a web-controllable player path is separately specified and proven.
- Verify teacher-to-student preview, direct original-course fallback, and desktop/375px layout behavior without horizontal overflow.

### Role-Specific Course Pages — 2026-08-12

- Rework the teacher home into a task-first workspace with the current course, pending teaching decision, course health, and direct design/preview actions.
- Reframe the student page as a single-course learning shell with lesson context, progress, video, interaction, feedback, and summary.
- Keep Bilibili source and compatibility details outside the ordinary student flow.
- Add page information-architecture checks and verify the teacher design route plus student-preview route in a headless browser.

### Web Runtime First — 2026-08-12

- Shift the next validation slice from plugin-required preview to a student web runtime.
- Keep the Chrome extension as a Bilibili/YouTube overlay adapter and PC enhancement path, not the required first-use path for students.
- Update the D0 plan so save-and-preview first opens a web course link that works across iPad, iPhone, Android, tablets, and desktop browsers.
- Preserve the existing plugin spike for Bilibili demonstration while avoiding plugin installation as a blocker for first teacher tests.

### Bilibili Source Sample and Local Control Proof — 2026-08-12

- Add `student-web/course.json` and a shared runtime contract so the student page validates and loads the single configured Bilibili sample instead of hardcoding course nodes in the UI.
- Render the specified Bilibili lesson as a source iframe with a direct original-page fallback; explicitly limit it to source presentation rather than cross-origin playback control.
- Add a browser-only local HTML5 video path: students can select MP4, WebM, or MOV files without upload or hosting, then complete two timed deterministic interactions and a locally stored summary.
- Add course-config contract tests and browser verification for the full local interaction flow plus desktop and 375px mobile layouts. The Bilibili iframe emits one third-party fingerprint-report console message, but the LessonPilot page has no own console errors.

### Creator Studio Direction — 2026-08-11

- Reframe the teacher prototype from a subtitle/video editor into LessonPilot Studio, an AI-assisted interactive-course workspace.
- Add the five-step course flow: upload, AI analysis, teaching design, student simulation, and publish.
- Promote AI from one event option to a persistent Copilot that explains suggestions and lets teachers accept or ignore them.
- Extend timeline rows with knowledge points, likely mistakes, and visible AI suggestions while keeping teacher approval final.
- Replace event-title entry with natural-language teaching intent and rename preview as classroom simulation.
- Keep real course analysis and simulated student behavior explicitly outside this prototype slice.
- Replace remaining editor-first copy with teacher-first language: AI备课草案、课堂设计、教学重点、互动建议与老师最终决定。
- Keep runtime event types as implementation details while presenting their teaching meaning in the interface.

### Teacher UI Color System — 2026-08-11

- Consolidate the teacher prototype around warm paper surfaces and a forest-green brand hierarchy.
- Add semantic tokens for attention, teacher voice, interaction activity, constrained AI, and connection status.
- Replace the isolated purple AI treatment with muted blue-green so AI remains a secondary teacher-controlled tool.
- Separate focus, status, and attention colors and verify main text/event contrast ratios against a 4.5:1 target.
- Record the shared teacher/student color rules in `doc/ui-design.md`.

### Teacher Timeline Visual Refinement — 2026-08-11

- Refine the teacher timeline against the supplied visual references.
- Add a single course overview block with video preview, course metadata, subtitle count, event count, and event legend.
- Remove duplicated course metadata from the timeline sidebar so the working area focuses on caption selection and event editing.
- Preserve the three-layer information hierarchy: course context → subtitle list → event action panel.

### Student Utility and B2B2C Boundary — 2026-08-11

- Record a productized student-tool direction: manual phrase-range replay, keyboard shortcuts, bookmarks, review notebooks, personal study plans, and optional badges.
- Separate student-owned learning history from teacher-facing evidence; teacher reports only receive explicitly submitted or course-generated evidence.
- Confirm the commercial boundary: student utility remains free, while teachers pay for course authoring, publishing, classroom events, reports, and constrained AI templates.
- Reject dark-pattern lock-in as a product strategy; retention should come from accumulated learning value and a shared cross-course tool.

### Subtitle Timeline Teacher Workspace — 2026-08-11

- Redesign the teacher surface around the actual workflow: choose a recorded video, import timestamped subtitles, and turn them into a course timeline.
- Replace the generic fixed-node editor as the primary story with subtitle paragraphs and four configurable event families: attention burst, teacher voice, interaction activity, and constrained AI template.
- Add a clickable timeline prototype with caption selection, event detail editing, teacher-voice insertion, and honest local-demo states.
- Record the subtitle pipeline decision and open-source evaluation in `doc/subtitle-pipeline.md`.
- Keep video understanding, remote upload, speech recording, extension bridge, and AI generation out of this slice.

### Teacher Web Prototype — 2026-08-11

- Add a zero-dependency `teacher-web/` high-fidelity prototype for the D0 teacher home and restricted node editor.
- Show the two intended teacher scenes: experience the finished lesson, then edit a fixed node template and preview it.
- Add prototype interactions for node switching, type-specific fields, enabled state, dirty state, reset, save, and save-and-preview feedback.
- Keep the extension bridge, local storage, and real Bilibili preview explicitly marked as the next implementation slice.
- Verify desktop and 375px mobile layouts in the in-app browser with no console errors; existing demo and subtitle regression tests pass.

### Doc Sync for Cross-Machine D0 Continuity — 2026-08-11

- Raise requirements to v0.5 with a locked-decision summary covering B2B2C positioning, student-scope freeze, teacher demo shape, D0/D1 milestones, promo video, platform expansion, and AI billing consistency.
- Rewrite `next.md` as an actionable D0 checklist for continuing development on another machine after the technical spike.
- Record the approved expansion order: Bilibili through D1, YouTube as the second `PlayerAdapter` after D1, multilingual and multi-region fully deferred with no locale/region schema work now.
- Keep only the `VideoRef` / `PlayerAdapter` structural boundary in design and platform docs.
- Synchronize teacher-demo, student-runtime, multi-creator plan, development plan, lessons, promo-video references, README, and changelog with the same decisions.

### Teacher Demo Design — 2026-08-11

- Add `doc/teacher-demo.md` as the single entry point for the teacher-facing demonstration.
- Define two consecutive scenes: experience the finished lesson, then modify the fixed template and preview the change.
- Choose a localhost teacher website opened from the extension, while keeping D0 free of accounts, remote backend, and extension reinstallation.
- Define an allowlisted, versioned website-to-extension bridge with double schema validation and five fixed operations.
- Reserve future website modules for auth, lessons, licenses, billing, AI credits, and reports without creating premature APIs or tables.
- Limit editing to three fixed nodes and their authored fields; defer node creation, deletion, sorting, type switching, and multi-video management.
- Split delivery into D0 configurable interaction and D1 complete sales demo, without presenting D0 as AI-complete.
- Resolve preview behavior: every save-and-preview action creates an isolated preview session.
- Add `doc/promo-video.md` with the approved 60–90 second screen-recording script, shot list, claims boundary, and real-course submission call to action.
- Delay public promotion editing until D1 so AI feedback and reports are recorded from verified behavior rather than simulated.
- Lock platform expansion: Bilibili only through D1, YouTube as the next player adapter after D1, and no multilingual or multi-region work in the current phase.
- Keep the Bilibili player adapter isolated so a later YouTube adapter does not rewrite activity cards or session logic.
- Synchronize requirements, design, development plan, next step, and README with the approved teacher-demo boundary.

### Student Runtime Summary — 2026-08-11

- Add `doc/student-runtime.md` as the single entry point for student-side scope before teacher-platform design begins.
- Separate teacher-configured content components from learner-owned study tools, a category that was missing from the earlier component-family list.
- Rank learner tool candidates by whether they produce learning evidence, since that is what teachers actually buy.
- Record why consumer-app retention mechanics transfer poorly to a B2B2C product, to pre-empt copying streaks and leaderboards.
- Add a three-question framework and a priority order for competitor research, so the output is a decision rather than a feature list.
- Define what freezing the student scope does and does not cover.
- Audit the summary against the full decision history and separate current Demo requirements, P2 productization decisions, and research candidates.
- Correct the first-phase boundary: network authorization, remote updates, and report delivery remain P2 rather than joining the local Demo.
- Correct implementation status: activity cards and the reusable timed-node engine are specified but not yet implemented.
- Add the omitted productized learner flow: multi-teacher authorization, indexed delivery, version locking, AI credit types, honest degradation, evidence ownership, and compatibility behavior.
- Freeze the first-phase student scope without making future competitor research a blocker for teacher-platform design.
- Add the implemented timed overlay to `doc/design.md` and reconcile stale role, billing, index, and authorization language in the platform plan.
- Fix the commercial position as small-B-first B2B2C: reserve shared learner capabilities without opening a separate consumer free/Pro product line.
- Separate platform telemetry from teacher-facing learning evidence and adopt staged collection: local voluntary export first, consented anonymous events during productized trials, identity only when later features require it.
- Define a minimal lesson-only event vocabulary and explicitly forbid collecting unrelated viewing history or raw answers in generic analytics.

### Requirements v0.4 — Subtitle Blocker Definition — 2026-08-11

- Add S09 to the P0 function table and write its full definition from the shipped behavior in `src/content/subtitle/`.
- Record the half-open time range, first-match-wins overlap rule, invalid-layout fallback, and teardown requirements.
- Move teacher-side editing of blocker ranges to P1, since the first version only supports editing the config file.
- Inventory the component families in `doc/multi-creator-platform.md` 1.5 and show that most candidate features are attribute differences, not new components.

### Multi-Creator Platform Plan — 2026-08-11

- Add `doc/multi-creator-platform.md` describing how one learner receives customized content from multiple creators.
- Choose server-indexed lesson-pack ownership over page-derived creator identity, and fetch-with-cache over push updates on MV3.
- Define draft/published separation, session-level version locking, and silent degradation when the network fails.
- Record feature tiers, pricing options, deployment shape, open decisions, and unverified technical facts.
- Split video ownership from lesson authorship so one video can carry several interpretations, with self-authored packs as the `ownerId == authorId` special case.
- Add a local video index ahead of the cache and network layers so videos without a lesson pack never reach the server.
- Add revocation behavior, owner takedown control, revenue-split stance, and the limits of selling overlay rights.
- Add the license-code design: exchange a one-time code for an install-bound token instead of validating a static code per request.
- Rule out local content encryption, obfuscation, and self-built DRM as ineffective, and record the four lightweight anti-leak measures used instead.
- Judge identity binding by whether the server can verify it, and reject reading the Chrome account email as an unverifiable client self-report.
- Prefer teacher-issued per-student codes so the platform never stores learner personal data, and require a rebinding path before any anti-sharing measure ships.
- Support several concurrent creator authorizations per learner, keep tokens hidden from the learner, and send only the token for the current video.
- Separate "silent, not our video" from "expired authorization", which must be stated explicitly instead of looking like a failure.
- Require every session to record the pack, author, and version it used so reports reach the correct teacher.
- Add a performance section: the multi-creator fetch path is cheap, but injection into every Bilibili video page, the high-frequency time watcher, and unbounded local storage are the real risks.
- List the performance items that still need measurement, since no baseline exists yet.
- Establish that lesson packs carry data only while the extension owns all behavior, so every creator shares one component implementation.
- Close the component type set to the platform and forbid custom markup, styles, or scripts in lesson packs at any price point.
- Define the downgrade path for unknown node types on older extension versions, which must never be recorded as completed or learner-skipped.
- Group student-side capabilities into local, networked, and AI tiers so the cost boundary matches the pricing boundary.
- Tie AI usage to the free-answer node type so a teacher can estimate cost, and require the student summary and teacher report to share one call.
- Keep prompt templates on the server alongside credentials, and check quota before calling the model rather than after.
- Price AI separately with prepaid credit packs, and degrade honestly when credits run out instead of faking personalized feedback.
- Identify and close the missing numbered requirement for the shipped subtitle blocker.
- Settle on teachers paying only a subscription while AI credits belong to the learner and work across every teacher, which removes credit fragmentation once a learner has several courses.
- Reduce the teacher's barrier to zero: no float, no AI cost, no unsold stock, and the AI decision becomes pedagogical rather than financial.
- Introduce a gift-card style credit account code as the lightest learner-level identity, with recovery binding left optional.
- Grant trial credits on first license-code redemption so the existing code mechanism doubles as abuse protection.
- Let teachers optionally buy course-scoped credits so they can advertise included AI feedback, since course pricing power motivates promotion far more than a top-up commission would.
- Order credit spending as trial, then course-scoped, then learner-purchased, so nobody's paid credits are consumed while free ones sit idle.
- Bar teachers from earning on learner top-ups, and keep a first-top-up referral bonus as an unused fallback tied to conversion rather than consumption.
- Call upstream models through a compatibility layer so providers can be switched or priced against each other.
- Keep the teacher-wholesale and bring-your-own-key models as evaluated alternatives, recording why wholesale was superseded and why BYOK stays outside the quality commitment.
- Plan only. Phase 1 scope, P0 requirements, and the current local-only demo are unchanged.

### Subtitle Blocker — 2026-08-11

- Add a timed horizontal bar that covers the subtitle area between 15–20 seconds on the demo video.
- Move subtitle blocker time, size, position, and style into `src/content/config/demo-lesson.js`.
- Add `tests/subtitle-blocker.test.js` for range timing and layout checks.

- Fix demo-only scope so mascot disappears when navigating away on Bilibili SPA pages.
- Match demo video by exact BV id instead of pathname substring.

### Chinese Requirements v0.3 — 2026-08-07

- Rewrite the complete sales-demo requirements in Chinese.
- Add detailed definitions for 13 P0 student, teacher, and data functions.
- Define triggers, inputs, flows, stored data, exceptions, and acceptance criteria for each function.
- Add one end-to-end acceptance script and separate product-completion and commercial-validation standards.
- Clarify that AI failures must not fabricate personalized feedback and keep teacher previews separate from student sessions.

### Product Requirements v0.2 — 2026-08-07

- Reposition the demo around upgrading an existing paid recorded course rather than improving video quality.
- Define a three-node student flow: comprehension choice, recall fill-in, and applied free answer.
- Add minimum teacher-side requirements for node editing, preview, and an evidence-based individual report.
- Replace the general side-panel-first design with a timed interaction engine and shared local session data.

### Bilibili Mascot Controls — 2026-08-07

- Restrict mascot and playback control to demo video `BV1WW4y1e7GL` only.
- Add three mascot controls: pause, seek to 30s, seek to 35s with dialog.
- Auto-show interaction dialog when playback reaches 35 seconds.
- Add `tests/demo-config.test.js` for URL gating checks.

### Bilibili Mascot Spike — 2026-08-07

- Researched open-source Bilibili playback extensions and 2D mascot overlay projects.
- Added technical spike notes in `doc/bili-mascot-spike.md`.
- Scaffolded MV3 extension under `src/` with Bilibili video play/pause control and a canvas-based 2D mascot.

### Project Scaffold — 2026-08-07

- Created independent project structure for the English video course AI assistant Chrome extension.
- Added first requirements document, design note, development plan, lessons, and current next step.
