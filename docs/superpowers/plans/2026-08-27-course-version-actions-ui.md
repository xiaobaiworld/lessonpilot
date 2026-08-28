# Course Version Actions UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved published-course actions to the teacher dashboard and connect them to the existing version-draft and access-code APIs.

**Architecture:** Keep the dashboard card as the entry point. `CoursesPage` owns the selected course action and confirmation state, `TeacherAPI` owns the HTTP DTOs, and a focused `AccessCodesPage` handles listing, single generation, batch generation, and termination. Version actions call the existing atomic backend endpoint and navigate to the resulting draft; access-code actions remain scoped to the selected `course_id`.

**Tech Stack:** React 18, TypeScript, Vitest, existing `APIClient`, existing teacher CSS.

---

### Task 1: Lock the teacher API contract and page behaviors with failing tests

**Files:**
- Modify: `v1/web/teacher/src/api.test.ts`
- Modify: `v1/web/teacher/src/pages/CoursesPage.test.ts`
- Create: `v1/web/teacher/src/pages/AccessCodesPage.test.ts`

- [ ] **Step 1: Add API tests for version drafts and access-code management**

Add tests that assert:

```ts
await api.createVersionDraft('course-1', 'modify');
await api.listAccessCodes('course-1');
await api.createAccessCodeBatch('course-1', 3);
await api.terminateAccessCode('code-1');
```

use these request shapes:

```ts
POST /api/v1/teacher/courses/course-1/version-drafts
{ mode: 'modify', idempotency_key: <uuid> }

GET /api/v1/teacher/access-codes?course_id=course-1

POST /api/v1/teacher/access-codes/batch
{ idempotency_key: <uuid>, count: 3, grants: [{ course_id: 'course-1', scope: 'course' }] }

POST /api/v1/teacher/access-codes/code-1/terminate
```

- [ ] **Step 2: Add failing dashboard tests for the three published-card actions**

Render a published course and assert:

```ts
expect(button('修改本版本')).toBeDefined();
expect(button('增加版本')).toBeDefined();
expect(button('授权码管理')).toBeDefined();
```

Click `修改本版本`, assert the confirmation copy contains `退回草稿区` and `发布区不再保留这个版本`, then confirm and assert `onOpenCourse` receives the returned draft course id.

Click `增加版本`, assert the confirmation copy contains `当前已发布版本继续保留` and `复制一份到草稿区`, then confirm and assert `onOpenCourse` receives the new draft id.

Click `授权码管理`, assert the page navigation callback receives the selected course id.

- [ ] **Step 3: Add failing access-code page tests**

Render a selected course with an API double and assert:

```ts
expect(screen.getByText('授权码管理')).toBeTruthy();
expect(screen.getByText('KM-AAAAA-BBBBB-CCCCC')).toBeTruthy();
expect(screen.getByText('已领取 2 台设备')).toBeTruthy();
```

Click `批量生成`, fill count `3`, submit, and assert `createAccessCodeBatch` receives `courseId` and `3`, then assert all returned codes render.

Click a code's `终止授权`, confirm, and assert `terminateAccessCode` receives that code id.

- [ ] **Step 4: Run the focused tests and verify they fail for missing methods and UI**

Run:

```bash
npm --prefix v1 test -- web/teacher/src/api.test.ts web/teacher/src/pages/CoursesPage.test.ts web/teacher/src/pages/AccessCodesPage.test.ts
```

Expected: FAIL because the new API methods, callbacks, and access-code page do not yet exist.

### Task 2: Implement the teacher API DTOs and methods

**Files:**
- Modify: `v1/web/teacher/src/api.ts`
- Test: `v1/web/teacher/src/api.test.ts`

- [ ] **Step 1: Add DTOs matching the backend responses**

Add:

```ts
export interface VersionDraftResult {
  source_course_id: string;
  source_release_id: string;
  mode: 'modify' | 'add';
  source_retained: boolean;
  replayed: boolean;
  course: CourseSummary;
}

export interface ManagedAccessCode {
  id: string;
  access_code: string;
  display_tail: string;
  status: string;
  redeem_from: string | null;
  redeem_until: string | null;
  created_at: string;
  redemption_count: number;
  first_redeemed_at: string | null;
  last_redeemed_at: string | null;
  grants: Array<{
    course_id: string;
    scope: string;
    lesson_ids: string[];
    node_ids: string[];
  }>;
}
```

- [ ] **Step 2: Add methods using `crypto.randomUUID()` for idempotency**

Implement:

```ts
createVersionDraft(courseId: string, mode: 'modify' | 'add'): Promise<VersionDraftResult>
listAccessCodes(courseId: string): Promise<ManagedAccessCode[]>
createAccessCodeBatch(courseId: string, count: number): Promise<ManagedAccessCode[]>
terminateAccessCode(accessCodeId: string): Promise<ManagedAccessCode>
```

All methods must use the existing `APIClient` and return only the nested DTO values needed by pages.

- [ ] **Step 3: Run API tests**

Run:

```bash
npm --prefix v1 test -- web/teacher/src/api.test.ts
```

Expected: PASS.

### Task 3: Implement dashboard confirmations and navigation

**Files:**
- Modify: `v1/web/teacher/src/pages/CoursesPage.tsx`
- Modify: `v1/web/teacher/src/App.tsx`
- Modify: `v1/web/teacher/src/pages/CoursesPage.test.ts`
- Modify: `v1/web/teacher/src/index.css`

- [ ] **Step 1: Extend route state with access-code management**

Add `accessCourse?: string` to `Route`, parse it from `?access=`, and render `AccessCodesPage` before the normal course/lesson route when present. Add `onOpenAccessCodes(courseId)` to `CoursesPage`.

- [ ] **Step 2: Add action state and confirmation dialog**

Use:

```ts
type VersionMode = 'modify' | 'add';
const [versionAction, setVersionAction] = useState<{ course: CourseListItem; mode: VersionMode } | null>(null);
```

The dialog copy must be exactly:

```ts
modify: '当前已发布版本将退回草稿区，发布区不再保留这个版本；课程内容可继续修改。'
add: '当前已发布版本继续保留，同时复制一份到草稿区，作为新版本继续修改。'
```

On confirmation call `api.createVersionDraft(course.id, mode)`, close the dialog, and call `onOpenCourse(result.course.id)`. Keep the dialog open if the request fails and show the existing page error.

- [ ] **Step 3: Add the three buttons to `PublishedCourseCard`**

Keep the existing card information and footer. Add:

```tsx
<button>修改本版本</button>
<button>增加版本</button>
<button>授权码管理</button>
```

The first two open confirmation; the third calls `onOpenAccessCodes(course.id)`.

- [ ] **Step 4: Run dashboard tests**

Run:

```bash
npm --prefix v1 test -- web/teacher/src/pages/CoursesPage.test.ts
```

Expected: PASS.

### Task 4: Build the access-code management page

**Files:**
- Create: `v1/web/teacher/src/pages/AccessCodesPage.tsx`
- Create: `v1/web/teacher/src/pages/AccessCodesPage.test.ts`
- Modify: `v1/web/teacher/src/App.tsx`
- Modify: `v1/web/teacher/src/index.css`

- [ ] **Step 1: Load course details and codes**

When mounted:

```ts
const [course, codes] = await Promise.all([
  api.getCourse(courseId),
  api.listAccessCodes(courseId),
]);
```

Render the course title, `第 {course.version_number} 版` when present, a back button, and an empty state when no codes exist.

- [ ] **Step 2: Add single and batch generation**

Use a compact control with count values from `1` to `100`, default `1`. On submit call `api.createAccessCodeBatch(courseId, count)`, prepend returned codes to the list, reset count to `1`, and show the returned complete codes.

The single-generation shortcut is `count=1`; no separate frontend request path is needed.

- [ ] **Step 3: Render complete-code usage details**

Each row must show:

```tsx
code.access_code
code.status
已领取 {code.redemption_count} 台设备
首次领取 {formatDateTime(code.first_redeemed_at)}
最近领取 {formatDateTime(code.last_redeemed_at)}
```

Show a `终止授权` button only for non-terminated codes. Confirm with `window.confirm('确定终止这条授权码吗？')` before calling `api.terminateAccessCode(code.id)`.

- [ ] **Step 4: Add page styles**

Use existing page bands and button styles. Keep the management page as a full-width work surface with one framed code table/list, no nested cards. On narrow screens switch each code row to a two-column detail layout.

- [ ] **Step 5: Run access-code page tests**

Run:

```bash
npm --prefix v1 test -- web/teacher/src/pages/AccessCodesPage.test.ts
```

Expected: PASS.

### Task 5: Full verification and documentation

**Files:**
- Modify: `next.md`
- Modify: `changelog.md`

- [ ] **Step 1: Run focused and repository checks**

Run:

```bash
npm --prefix v1 test
npm --prefix v1 run type-check
npm --prefix v1 run build
npm test
npm run check
```

Expected: all commands exit `0`.

- [ ] **Step 2: Update current work tracking**

Record in `next.md` that the teacher dashboard now exposes the three approved published-version actions and the access-code management page, including the exact state semantics.

- [ ] **Step 3: Add a verified changelog entry**

Add a concise entry to `changelog.md` describing the UI behavior and verification commands.

- [ ] **Step 4: Review final diff and status**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Confirm only the plan, teacher UI/API, tests, and required docs changed.
