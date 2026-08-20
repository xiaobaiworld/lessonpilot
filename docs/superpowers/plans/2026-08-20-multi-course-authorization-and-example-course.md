# Multi-Course Authorization and Example Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the course data path so one UUID-identified course can contain multiple Bilibili lessons, one authorization code can grant multiple course/lesson/node scopes, and the student plugin can retain those course packages alongside a bundled example course.

**Architecture:** Keep `courseId`, `lessonId`, and node IDs as separate identities. The backend owns course and lesson UUIDs and stores authorization scope rows in `AccessGrant`; the public download response becomes a course-package envelope containing multiple courses and lessons. The plugin preserves a compatibility read path for the current single-course response while writing new packages into a per-course/per-lesson local store, with the bundled example course handled as a read-only package.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Pydantic, vanilla JavaScript, Chrome MV3 storage, Node test runner, pytest.

---

## Scope and compatibility

The repository currently contains user changes unrelated to this feature. Workers must touch only the files listed in their task and must not revert unrelated work.

The implementation must preserve current `0.9.1` behavior while introducing the new package shape:

- Existing single-course download responses remain readable by the plugin during migration.
- New backend responses use `{ "courses": [...] }`.
- Existing `installedCourse` / `learningState` data migrates on first access into the new course store.
- The example course is read-only bundled data and is never written over a teacher-authorized course.
- No image/audio upload or physical Finder directory is implemented in this plan.

## Planned file ownership

### Backend course/lesson worker

- Modify: `backend/app/models/course.py`
- Modify: `backend/app/models/lesson.py`
- Modify: `backend/app/repositories/course_repository.py`
- Modify: `backend/app/repositories/lesson_repository.py`
- Modify: `backend/app/services/course_service.py`
- Modify: `backend/app/api/v1/teacher_courses.py`
- Modify: `backend/app/schemas/course.py`
- Modify: `backend/app/schemas/lesson.py`
- Create: `backend/app/migrations/versions/0008_multi_lesson_courses.py`
- Test: `backend/tests/unit/test_course_service.py`
- Test: `backend/tests/integration/test_course_api.py`

### Backend authorization/package worker

- Create: `backend/app/models/access_grant.py`
- Modify: `backend/app/models/access_code.py`
- Create: `backend/app/repositories/access_grant_repository.py`
- Modify: `backend/app/repositories/access_code_repository.py`
- Modify: `backend/app/services/access_code_service.py`
- Modify: `backend/app/api/v1/access_codes.py`
- Modify: `backend/app/api/v1/public_courses.py`
- Modify: `backend/app/schemas/access_code.py`
- Create: `backend/app/migrations/versions/0009_access_grants.py`
- Test: `backend/tests/unit/test_access_code_service.py`
- Test: `backend/tests/integration/test_access_code_api.py`
- Test: `backend/tests/integration/test_public_course_download.py`

### Course package/contract worker

- Create: `src/shared/course-package-contract.js`
- Modify: `src/shared/course-contract.js` only if shared lesson validation must be extracted
- Modify: `backend/app/adapters/plugin_course_config.py`
- Modify: `backend/app/services/publish_service.py`
- Modify: `backend/app/schemas/publish.py`
- Test: `tests/course-package-contract.test.js`
- Test: `backend/tests/unit/test_plugin_course_config.py`
- Test: `backend/tests/integration/test_publish_api.py`

### Plugin storage/runtime/example worker

- Modify: `src/background/storage.js`
- Modify: `src/background/course-downloader.js`
- Modify: `src/background/service-worker.js`
- Modify: `src/content/course-runtime.js`
- Modify: `src/content/index.js`
- Modify: `src/content/access-code/access-panel.js`
- Modify: `src/popup/popup.html`
- Modify: `src/popup/popup.js`
- Create: `src/content/config/example-course.js`
- Test: `tests/plugin-course-storage.test.js`
- Test: `tests/plugin-download-flow.test.js`
- Test: `tests/access-code-panel.test.js`
- Test: `tests/course-runtime.test.js`
- Test: `tests/extension-popup.test.js`

## Task 1: Upgrade Course and Lesson to one-to-many

**Files:** Backend course/lesson worker ownership list above.

- [ ] **Step 1: Add failing tests for multiple lessons**

Add tests proving that one course can create two lessons with distinct UUIDs and sort order, and that `CourseDetail` returns `lessons` rather than a singular `lesson`.

```python
def test_course_accepts_multiple_lessons(client):
    course_id = create_course(client)
    first = create_lesson(client, course_id, "第一节", "BVfirst00001")
    second = create_lesson(client, course_id, "第二节", "BVsecond00002")

    assert first["course_id"] == course_id
    assert second["course_id"] == course_id
    assert first["id"] != second["id"]

    detail = client.get(f"/api/v1/teacher/courses/{course_id}").json()
    assert [lesson["id"] for lesson in detail["lessons"]] == [first["id"], second["id"]]
```

- [ ] **Step 2: Run the focused tests and confirm the expected failure**

Run:

```bash
cd backend
uv run pytest tests/integration/test_course_api.py -q
```

Expected: failure because the database relationship currently has `unique=True`, service raises `LessonLimitReached`, and the response schema exposes singular `lesson`.

- [ ] **Step 3: Remove the one-to-one database and service restriction**

Change `Lesson.course_id` to a normal indexed foreign key, change `Course.lesson` to `Course.lessons`, remove `LessonLimitReached` from the normal create path, and load/sort `Course.lessons` by `sort_order` then creation time.

- [ ] **Step 4: Update schemas and teacher endpoints**

Change `CourseDetail` to expose `lessons: list[LessonPublic]`, return all lessons in stable order, and keep `POST /courses/{course_id}/lessons` idempotent only with respect to request failure, not by silently merging duplicate lessons.

- [ ] **Step 5: Add the migration**

Create an Alembic migration that removes the unique constraint on `lessons.course_id` without deleting existing lesson rows. The migration must be safe for SQLite table recreation and preserve indexes and foreign keys.

- [ ] **Step 6: Run backend course tests**

Run:

```bash
cd backend
uv run pytest tests/unit/test_course_service.py tests/integration/test_course_api.py -q
```

Expected: all focused course tests pass, including legacy tests updated to read `lessons[0]`.

- [ ] **Step 7: Commit the isolated backend course change**

```bash
git add backend/app/models/course.py backend/app/models/lesson.py backend/app/repositories/course_repository.py backend/app/repositories/lesson_repository.py backend/app/services/course_service.py backend/app/api/v1/teacher_courses.py backend/app/schemas/course.py backend/app/schemas/lesson.py backend/app/migrations/versions backend/tests/unit/test_course_service.py backend/tests/integration/test_course_api.py
git commit -m "feat: allow multiple lessons per course"
```

## Task 2: Add scoped authorization grants

**Files:** Backend authorization/package worker ownership list above.

- [ ] **Step 1: Add failing tests for one code with multiple grants**

Cover these exact cases:

```python
def test_one_access_code_can_grant_multiple_courses_and_lesson_scopes():
    # code -> course A whole course
    # code -> course B lesson B2 only
    # download result contains both courses with only permitted lesson data
    ...

def test_node_scope_uses_node_id_not_video_time_seconds():
    ...

def test_grant_rejects_lesson_from_another_course():
    ...

def test_wall_clock_expiry_is_distinct_from_node_trigger_time():
    ...
```

- [ ] **Step 2: Run focused authorization tests and confirm failure**

Run:

```bash
cd backend
uv run pytest tests/unit/test_access_code_service.py tests/integration/test_access_code_api.py tests/integration/test_public_course_download.py -q
```

Expected: failure because `AccessCode` has one `course_id`, no `AccessGrant` table exists, and download returns one course.

- [ ] **Step 3: Add `AccessGrant` model and migration**

Create fields:

```python
id
access_code_id
course_id
lesson_id nullable
node_id nullable
valid_from nullable
valid_until nullable
created_at
```

Add foreign keys to access codes, courses, and lessons; add indexes for lookup by access code and course; enforce `node_id` requires `lesson_id` in service validation. Keep the current `AccessCode.course_id` column during compatibility migration and backfill one course-level grant per existing code.

- [ ] **Step 4: Add grant creation and validation service functions**

Implement a service boundary that:

```text
normalize requested scopes
→ verify teacher owns every course/lesson
→ verify published data exists
→ reject invalid parent/child combinations
→ de-duplicate exact grants
→ save AccessCode and AccessGrant rows atomically
```

Keep access code raw text out of storage and logs.

- [ ] **Step 5: Update schemas and teacher API**

Extend access-code creation with an optional scope list while preserving the current no-body request as “whole current course.” Return scope summaries without returning code digests or raw codes.

- [ ] **Step 6: Update public download**

Return a package envelope with `courses: list[...]`. For each grant, include the course title and only the authorized lessons/nodes. Keep a compatibility `course` response path only if the existing client contract requires it; the new response must be deterministic and contain no duplicate course or lesson entries.

- [ ] **Step 7: Run focused authorization tests**

Run:

```bash
cd backend
uv run pytest tests/unit/test_access_code_service.py tests/integration/test_access_code_api.py tests/integration/test_public_course_download.py -q
```

Expected: all scope, expiry, ownership, and multi-course response tests pass.

- [ ] **Step 8: Commit the isolated authorization change**

```bash
git add backend/app/models/access_code.py backend/app/models/access_grant.py backend/app/repositories backend/app/services/access_code_service.py backend/app/api/v1/access_codes.py backend/app/api/v1/public_courses.py backend/app/schemas/access_code.py backend/app/migrations/versions backend/tests/unit/test_access_code_service.py backend/tests/integration/test_access_code_api.py backend/tests/integration/test_public_course_download.py
git commit -m "feat: add scoped course authorization grants"
```

## Task 3: Introduce the multi-course package contract

**Files:** Course package/contract worker ownership list above.

- [ ] **Step 1: Add failing package contract tests**

Test a valid package with two lessons, reject duplicate `courseId`/`lessonId`, reject a lesson without a valid BVID, reject empty lesson nodes, reject unknown top-level fields, and accept the current single-course response through a legacy adapter.

- [ ] **Step 2: Run the package tests and confirm failure**

Run:

```bash
node --test tests/course-package-contract.test.js
```

Expected: failure because the package module does not exist.

- [ ] **Step 3: Implement the package validator**

Create a closed package envelope:

```js
{
  schemaVersion: 2,
  courseId: "uuid",
  title: "课程名称",
  lessons: [
    {
      lessonId: "uuid",
      title: "课节名称",
      videoRef: { platform: "bilibili", videoId: "BV..." },
      nodes: [],
      updatedAt: "UTC ISO"
    }
  ],
  updatedAt: "UTC ISO"
}
```

Reuse the existing node validator through a focused lesson validation boundary rather than duplicating node rules.

- [ ] **Step 4: Update the backend adapter and publish aggregation**

Build one package per course by collecting every lesson’s latest published script. `courseId` comes from `Course.id`; `lessonId` comes from `Lesson.id`; `title` values come from course and lesson records. A course cannot publish if it has no published lesson package.

- [ ] **Step 5: Update publish tests and backend integration tests**

Verify publishing two lessons creates a package containing both lessons and no BVID-derived course ID.

- [ ] **Step 6: Run focused package and publish tests**

Run:

```bash
node --test tests/course-package-contract.test.js tests/course-contract.test.js
cd backend
uv run pytest tests/unit/test_plugin_course_config.py tests/integration/test_publish_api.py -q
```

Expected: package and publish tests pass while legacy node contract tests remain green.

- [ ] **Step 7: Commit the package contract change**

```bash
git add src/shared/course-package-contract.js src/shared/course-contract.js backend/app/adapters/plugin_course_config.py backend/app/services/publish_service.py backend/app/schemas/publish.py tests/course-package-contract.test.js tests/course-contract.test.js backend/tests/unit/test_plugin_course_config.py backend/tests/integration/test_publish_api.py
git commit -m "feat: add multi-lesson course package contract"
```

## Task 4: Upgrade plugin storage, runtime, and example course

**Files:** Plugin storage/runtime/example worker ownership list above.

- [ ] **Step 1: Add failing storage and downloader tests**

Cover:

```js
test('migrates legacy installedCourse into installedCourses by courseId', ...);
test('stores two course packages without replacement', ...);
test('updates one lesson while preserving other course state', ...);
test('filters package lessons by authorized scope', ...);
test('bundled example course is read-only and does not overwrite installed courses', ...);
```

- [ ] **Step 2: Run focused plugin tests and confirm failure**

Run:

```bash
node --test tests/plugin-course-storage.test.js tests/plugin-download-flow.test.js
```

Expected: failure because storage currently exposes only `installedCourse` and downloader expects `{ course }`.

- [ ] **Step 3: Implement versioned local course storage**

Introduce a versioned store with:

```js
{
  storageVersion: 2,
  installedCourses: {
    [courseId]: {
      courseId,
      title,
      lessons: { [lessonId]: lesson },
      installedAt
    }
  },
  learningStates: {
    [courseId]: {
      [lessonId]: {
        nodeStates: {}
      }
    }
  }
}
```

Migrate legacy `installedCourse` and `learningState` exactly once, preserve data, and never replace a different course because another course was downloaded.

- [ ] **Step 4: Update downloader and service worker**

Accept both legacy `{ course }` and new `{ courses }` responses, validate before writing, merge by `courseId`, preserve same-course lesson state where node IDs remain valid, and return a summary with installed course IDs and titles.

- [ ] **Step 5: Add the bundled example course**

Create a fixed read-only package for `英语面试表达：把答案说得具体` with one lesson copied from the current published plugin configuration. The example package is returned through a separate background operation and is selected only when no authorized installed lesson matches the current BVID.

- [ ] **Step 6: Update runtime and UI**

The Bilibili runtime matches lessons by `videoRef.videoId`, then activates the corresponding course/lesson state. Popup and page bookbag display course titles and lesson titles, never raw IDs. Existing access-code input remains available.

- [ ] **Step 7: Run focused plugin tests**

Run:

```bash
node --test tests/plugin-course-storage.test.js tests/plugin-download-flow.test.js tests/access-code-panel.test.js tests/course-runtime.test.js tests/extension-popup.test.js
```

Expected: legacy migration, multiple course storage, example fallback, title display, and BVID lesson matching all pass.

- [ ] **Step 8: Commit the plugin change**

```bash
git add src/background/storage.js src/background/course-downloader.js src/background/service-worker.js src/content/course-runtime.js src/content/index.js src/content/access-code/access-panel.js src/popup/popup.html src/popup/popup.js src/content/config/example-course.js tests/plugin-course-storage.test.js tests/plugin-download-flow.test.js tests/access-code-panel.test.js tests/course-runtime.test.js tests/extension-popup.test.js
git commit -m "feat: store multiple course packages and bundled example"
```

## Task 5: Integration verification and documentation sync

- [ ] **Step 1: Run the complete JavaScript and backend test suites**

```bash
node --test tests/*.test.js
cd backend
uv run pytest -q
```

- [ ] **Step 2: Run static checks**

```bash
node --check src/shared/course-package-contract.js
node --check src/background/course-downloader.js
python -m compileall -q backend/app
git diff --check
```

- [ ] **Step 3: Perform adversarial checks**

Verify that:

- duplicate course titles do not collide;
- the same BVID can appear in different courses;
- one course with two lessons does not lose either lesson;
- a code scoped to one lesson cannot download another lesson;
- code wall-clock expiry is not confused with video node time;
- a legacy installed course is not deleted during migration;
- example content cannot overwrite a teacher-authorized course;
- no access code, node prose, captions, or answers enter logs.

- [ ] **Step 4: Update current docs**

Synchronize `README.md`, `next.md`, `doc/teacher-platform-api-spec.md`, `doc/teacher-platform-architecture.md`, and `doc/teacher-platform-data-spec.md` with the implemented—not merely planned—behavior. Add a verified changelog entry only after tests pass.

- [ ] **Step 5: Run document health checks**

```bash
rg -n "installedCourse|courseId|lessonId|AccessGrant|courses" README.md next.md doc docs
git diff --check
```

- [ ] **Step 6: Commit documentation separately**

```bash
git add README.md next.md doc/teacher-platform-api-spec.md doc/teacher-platform-architecture.md doc/teacher-platform-data-spec.md doc/DECISIONS.md doc/INDEX.md
git commit -m "docs: synchronize multi-course delivery model"
```

## Plan self-review

- Course identity: Task 3 changes the package identity from BVID-derived course IDs to backend UUIDs.
- Multiple lessons: Tasks 1 and 3 cover one-to-many persistence and aggregated package output.
- Scoped authorization: Task 2 covers course, lesson, node, and wall-clock scope.
- Local course isolation: Task 4 covers migration, merge, per-course/per-lesson state, and example fallback.
- Current compatibility: Tasks 2–4 explicitly preserve legacy reads while new writes use the target model.
- Asset storage: no implementation is included; only the already-documented future boundary remains.
