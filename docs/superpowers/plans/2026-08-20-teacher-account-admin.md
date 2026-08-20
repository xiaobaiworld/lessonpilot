# Teacher Account Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a protected super-admin workspace to the existing `admin.html` entry page for creating teachers, resetting teacher passwords, and viewing published-course counts, then deploy and verify it on the production server.

**Architecture:** Keep the existing teacher authentication flow untouched and add a separate `admins`/`admin_sessions` authentication boundary with its own cookie and `require_admin` dependency. Add focused admin services and APIs first, then extend the existing production `admin.html` page so unauthenticated visitors still see the three current links while authenticated administrators see the teacher-management workspace.

**Tech Stack:** FastAPI, SQLAlchemy 2, Alembic, SQLite, `pwdlib[argon2]`, structlog, vanilla HTML/CSS/JavaScript, Node `node:test`, pytest, existing `tools/teacher-platform-release.sh` and `tools/web-release.sh`.

---

## Context and file map

The production `admin.html` already exists on the `codex/admin-index` release baseline, but it is not present in the current checkout. The implementation must restore that exact entry-page behavior first, including:

- `/`
- `/teacher-web/editor.html`
- `/health`

The current branch already has teacher authentication, teacher sessions, operation logs, workspaces, courses, and published course status. Reuse those patterns; do not merge the unrelated `codex/admin-index` security/deployment changes wholesale.

Files to create:

- `backend/app/models/admin.py`
- `backend/app/models/admin_session.py`
- `backend/app/repositories/admin_repository.py`
- `backend/app/repositories/admin_session_repository.py`
- `backend/app/services/admin_auth_service.py`
- `backend/app/services/admin_teacher_service.py`
- `backend/app/schemas/admin.py`
- `backend/app/api/v1/admin_auth.py`
- `backend/app/api/v1/admin_teachers.py`
- `backend/app/migrations/versions/0009_admin_auth.py`
- `backend/tests/unit/test_admin_auth_service.py`
- `backend/tests/unit/test_admin_teacher_service.py`
- `backend/tests/integration/test_admin_api.py`
- `tests/admin-page.test.js`
- `teacher-web/admin.js`

Files to modify:

- `backend/app/db.py`
- `backend/app/models/__init__.py`
- `backend/app/api/deps.py`
- `backend/app/main.py`
- `backend/app/seed.py`
- `backend/app/config.py`
- `backend/.env.example`
- `tools/web-release.sh`
- `tools/teacher-platform-release.sh`
- `teacher-web/admin.html`
- `doc/data-spec.md`
- `doc/data/model.md`
- `doc/data/dictionary.md`
- `doc/data/flow.md`
- `doc/data/quality.md`
- `doc/teacher-platform-api-spec.md`
- `doc/teacher-platform-architecture.md`
- `deploy/teacher-platform/README.md`
- `tests/teacher-platform-release.test.js`
- `tests/web-release.test.js`

## Task 1: Add administrator persistence and migration

**Files:**

- Create: `backend/app/models/admin.py`
- Create: `backend/app/models/admin_session.py`
- Modify: `backend/app/db.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/app/migrations/versions/0009_admin_auth.py`
- Test: `backend/tests/unit/test_admin_auth_service.py`

- [ ] **Step 1: Write model-level failing tests**

Add tests that import the new models through `app.db.Base`, call `create_tables(engine)`, and assert the database creates `admins` and `admin_sessions` with:

```python
def test_admin_tables_are_registered(database_session):
    inspector = inspect(database_session.get_bind())
    assert "admins" in inspector.get_table_names()
    assert "admin_sessions" in inspector.get_table_names()
```

Also assert `login_name` and `token_digest` are unique and `admin_sessions.admin_id` references `admins.id`.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
cd backend
uv run pytest tests/unit/test_admin_auth_service.py -q
```

Expected: collection or assertion failure because the new models and tables do not exist.

- [ ] **Step 3: Implement the two SQLAlchemy models**

Match `Teacher` and `TeacherSession` conventions:

```python
class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    login_name: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
```

`AdminSession` must use `admin_id`, a unique indexed 64-character `token_digest`, `expires_at`, nullable `revoked_at`, and `created_at`.

Import both models in `backend/app/db.py` and export them from `backend/app/models/__init__.py` so metadata registration works in tests and Alembic.

- [ ] **Step 4: Add the Alembic migration**

Create revision `0009_admin_auth` with `down_revision = "0008_multi_lesson_courses"`. Create `admins` and `admin_sessions` with the same columns and indexes as the models. The downgrade must drop `admin_sessions` first, then `admins`.

- [ ] **Step 5: Run the focused tests and migration inspection**

Run:

```bash
cd backend
uv run pytest tests/unit/test_admin_auth_service.py -q
uv run alembic -c alembic.ini upgrade head
```

Expected: tests pass and Alembic reaches `0009_admin_auth` without changing existing teacher/course tables.

## Task 2: Implement admin authentication and bootstrap seeding

**Files:**

- Create: `backend/app/repositories/admin_repository.py`
- Create: `backend/app/repositories/admin_session_repository.py`
- Create: `backend/app/services/admin_auth_service.py`
- Modify: `backend/app/api/deps.py`
- Modify: `backend/app/config.py`
- Modify: `backend/app/seed.py`
- Modify: `backend/.env.example`
- Test: `backend/tests/unit/test_admin_auth_service.py`

- [ ] **Step 1: Write failing service tests**

Cover the following exact behaviors:

```python
def test_seed_admin_is_idempotent_and_stores_only_a_hash(database_session):
    first = seed_admin_account(
        database_session,
        login_name="admin",
        password="first-password",
        display_name="KnownMap 管理员",
    )
    second = seed_admin_account(
        database_session,
        login_name="admin",
        password="first-password",
        display_name="KnownMap 管理员",
    )
    assert first.id == second.id
    assert second.password_hash != "first-password"
    assert "first-password" not in second.password_hash
```

Also cover correct/incorrect authentication, disabled admins, token digest storage, expiration, and revocation.

- [ ] **Step 2: Implement repository and service functions**

Implement:

```python
normalize_admin_login_name(login_name: str) -> str
hash_admin_password(raw_password: str) -> str
verify_admin_password(raw_password: str, stored_hash: str) -> bool
authenticate_admin(session, login_name: str, raw_password: str) -> Admin | None
create_admin_session(session, admin, session_secret, ttl_seconds) -> tuple[str, AdminSession]
digest_admin_session_token(token: str, session_secret: str) -> str
revoke_admin_session(row: AdminSession) -> None
seed_admin_account(session, login_name, password, display_name) -> Admin
```

Use `PasswordHash.recommended()` and the same HMAC-SHA256 token digest pattern as `auth_service.py`. Never return a password hash from an API schema.

- [ ] **Step 3: Add `require_admin`**

In `backend/app/api/deps.py`, add a dependency that reads the new admin cookie, checks `Settings.admin_session_cookie_name`, `Settings.session_secret`, the active non-expired session, and the admin `active` status. It must raise the existing `ApiError(401, "AUTH_REQUIRED", "需要管理员登录。")` for missing, invalid, expired, revoked, disabled, or teacher-session cookies.

- [ ] **Step 4: Add settings and seed configuration**

Add:

```python
admin_session_cookie_name: str = "knownmap_admin_session"
admin_login_name: str = "admin"
admin_display_name: str = "KnownMap 管理员"
```

Keep the initial admin password out of `Settings` and out of `.env.example` as a persistent runtime setting. Extend `seed.py` with a separate `seed_admin_from_environment()` path that reads `SEED_ADMIN_LOGIN_NAME`, `SEED_ADMIN_PASSWORD`, and `SEED_ADMIN_DISPLAY_NAME` only when the deployment script explicitly invokes it.

Add placeholder variable names to `backend/.env.example` only if the existing configuration documentation requires them; never add a real password value.

- [ ] **Step 5: Run the service tests**

Run:

```bash
cd backend
uv run pytest tests/unit/test_admin_auth_service.py -q
```

Expected: all admin service tests pass, and the test database contains no plaintext password or raw session token.

## Task 3: Add protected admin authentication API

**Files:**

- Create: `backend/app/schemas/admin.py`
- Create: `backend/app/api/v1/admin_auth.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/integration/test_admin_api.py`

- [ ] **Step 1: Write failing integration tests**

Create a `make_app()` fixture using test settings, seed one admin, seed two teachers, and assert:

```python
def test_admin_can_login_restore_session_and_logout():
    response = client.post(
        "/api/v1/admin/auth/login",
        json={"login_name": "admin", "password": "admin-password"},
    )
    assert response.status_code == 200
    assert "knownmap_admin_session=" in response.headers["set-cookie"]
    assert client.get("/api/v1/admin/auth/me").status_code == 200
    assert client.post("/api/v1/admin/auth/logout").json() == {"logged_out": True}
```

Also assert wrong and missing credentials return the same `AUTH_INVALID_CREDENTIALS`, unauthenticated `/me` returns `AUTH_REQUIRED`, and a teacher session cannot access admin endpoints.

- [ ] **Step 2: Implement schemas**

Add request/response types:

```python
class AdminLoginRequest(BaseModel):
    login_name: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=1, max_length=256)

class AdminPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    login_name: str
    display_name: str
    status: str

class AdminAuthResponse(BaseModel):
    admin: AdminPublic

class AdminLogoutResponse(BaseModel):
    logged_out: bool
```

- [ ] **Step 3: Implement the three endpoints**

Use the teacher auth route structure, but:

- prefix the router with `/api/v1/admin/auth`;
- use the admin cookie name;
- log with `actor_type="admin"` and module `"admin-auth"`;
- do not include passwords in structlog fields or operation logs;
- set `httponly=True`, `samesite="lax"`, `secure=settings.app_env == "production"`.

Register the router in `backend/app/main.py`.

- [ ] **Step 4: Run integration tests**

Run:

```bash
cd backend
uv run pytest tests/integration/test_admin_api.py -q
```

Expected: all admin login, logout, session isolation, and error-shape tests pass.

## Task 4: Add teacher management service and API

**Files:**

- Create: `backend/app/repositories/admin_teacher_repository.py`
- Create: `backend/app/services/admin_teacher_service.py`
- Create: `backend/app/api/v1/admin_teachers.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/schemas/admin.py`
- Test: `backend/tests/unit/test_admin_teacher_service.py`
- Test: `backend/tests/integration/test_admin_api.py`

- [ ] **Step 1: Write service and API failures**

Cover:

- duplicate login names return conflict without changing the existing teacher hash;
- creation creates an active teacher and workspace;
- reset replaces the hash and invalidates the old password;
- generated passwords are not equal across two operations;
- course count includes only `courses.status == "published"`;
- response objects contain no `password_hash`;
- operation logs contain action/target/result but no temporary password.

- [ ] **Step 2: Implement deterministic service boundaries**

Implement these exact service boundaries:

```python
def generate_temporary_password() -> str:
    return secrets.token_urlsafe(18)


def create_teacher_for_admin(session, *, login_name: str, display_name: str) -> tuple[Teacher, str]:
    normalized_login_name = normalize_login_name(login_name)
    if get_teacher_by_login_name(session, normalized_login_name) is not None:
        raise TeacherLoginConflict(normalized_login_name)
    temporary_password = generate_temporary_password()
    teacher = add_teacher(
        session,
        Teacher(
            login_name=normalized_login_name,
            password_hash=hash_password(temporary_password),
            display_name=display_name.strip(),
            status="active",
        ),
    )
    session.flush()
    ensure_teacher_workspace(session, teacher)
    return teacher, temporary_password


def reset_teacher_password_for_admin(session, teacher_id: str) -> tuple[Teacher, str]:
    teacher = get_teacher_by_id(session, teacher_id)
    if teacher is None:
        raise TeacherNotFound(teacher_id)
    temporary_password = generate_temporary_password()
    teacher.password_hash = hash_password(temporary_password)
    session.flush()
    return teacher, temporary_password
```

Define `TeacherLoginConflict` and `TeacherNotFound` in `admin_teacher_service.py`. `create_teacher_for_admin` must reject a blank display name after trimming, hash the generated password with the existing auth hashing helper, call `ensure_teacher_workspace`, and return the raw password only to the immediate API caller. `reset_teacher_password_for_admin` must preserve the teacher status and update only the password hash and timestamp. `list_teachers_for_admin` must execute a grouped SQLAlchemy query through `admin_teacher_repository.py` and return one summary row per teacher.

Use a grouped SQL query or a correlated count that joins `teachers -> workspaces -> courses` and filters `courses.status == "published"`. Do not load every course into Python for counting.

- [ ] **Step 3: Implement schemas and endpoints**

Add:

```python
class AdminTeacherSummary(BaseModel):
    id: str
    login_name: str
    display_name: str
    status: str
    published_course_count: int
    created_at: datetime
    updated_at: datetime

class CreateTeacherRequest(BaseModel):
    login_name: str = Field(min_length=3, max_length=80)
    display_name: str = Field(min_length=1, max_length=120)

class AdminTeacherMutationResponse(BaseModel):
    teacher: AdminTeacherSummary
    temporary_password: str
```

Implement:

```text
GET  /api/v1/admin/teachers
POST /api/v1/admin/teachers
POST /api/v1/admin/teachers/{teacher_id}/reset-password
```

All three routes require `Depends(require_admin)`. Log:

```text
admin.teachers.list
admin.teachers.create
admin.teachers.password_reset
```

The response model may contain `temporary_password` only for create/reset. Never log or echo request bodies.

- [ ] **Step 4: Run all backend tests**

Run:

```bash
cd backend
uv run pytest -q
```

Expected: existing teacher/course/auth tests and all new admin tests pass.

## Task 5: Update data, API, architecture, and deployment documentation

**Files:**

- Modify: `doc/data-spec.md`
- Modify: `doc/data/model.md`
- Modify: `doc/data/dictionary.md`
- Modify: `doc/data/flow.md`
- Modify: `doc/data/quality.md`
- Modify: `doc/teacher-platform-api-spec.md`
- Modify: `doc/teacher-platform-architecture.md`
- Modify: `deploy/teacher-platform/README.md`
- Modify: `doc/INDEX.md`
- Modify: `next.md`

- [ ] **Step 1: Document the authoritative data shape**

Add `admins` and `admin_sessions` to the database model and field dictionary. Record that `password_hash` is an Argon2 slow hash, not reversible ciphertext, and that raw passwords and raw session tokens are not stored.

- [ ] **Step 2: Document data flow and quality rules**

Add flows for admin login, teacher creation, password reset, and published-course aggregation. Add quality rules that:

- temporary passwords may exist only in the immediate HTTPS response;
- logs and persistent records must not contain passwords, hashes, cookies, or raw tokens;
- published course count excludes drafts;
- duplicate teacher login names are rejected.

- [ ] **Step 3: Document API and deployment**

Add all admin endpoints, response shapes, auth errors, and the one-time password behavior to `doc/teacher-platform-api-spec.md`. Update architecture and deployment README with migration, first-admin bootstrap, and remote verification commands.

- [ ] **Step 4: Update `next.md` with the current implementation step**

Record the active step, files, tests, and deployment verification before implementation begins. After each completed plan task, update the step and verification result.

- [ ] **Step 5: Run documentation checks**

Run:

```bash
git diff --check
rg -n -i '(password|token|cookie)' doc/data doc/teacher-platform-api-spec.md deploy/teacher-platform/README.md
```

Expected: docs describe the prohibition and handling rules without containing any real credential.

## Task 6: Restore and extend the existing `admin.html` workspace

**Files:**

- Create or restore: `teacher-web/admin.html`
- Create: `teacher-web/admin.js`
- Modify: `teacher-web/admin.html`
- Create: `tests/admin-page.test.js`

- [ ] **Step 1: Restore the existing entry page baseline**

Bring the current production page structure into this branch from the known `codex/admin-index` baseline, preserving the exact existing links:

```html
<a class="entry" href="/">销售首页</a>
<a class="entry" href="/teacher-web/editor.html">教师工作台</a>
<a class="entry" href="/health">服务状态</a>
```

Do not remove or rename those links.

- [ ] **Step 2: Add unauthenticated login state**

Add a hidden login form with username and password fields, `autocomplete="username"` and `autocomplete="current-password"`. Do not prefill a production password. Keep the current entry list visible while the admin session is absent.

- [ ] **Step 3: Add authenticated workspace markup**

Add hidden sections for:

- admin identity and logout;
- teacher table;
- create-teacher form;
- one-time temporary password result;
- loading, error, empty, and success states.

The password result must be held in a JavaScript variable/text node only. Do not write it to browser storage or the URL. The reset button must be disabled while the request is in flight and confirmation text must state that the old password becomes invalid immediately.

- [ ] **Step 4: Implement `teacher-web/admin.js`**

Use a small same-origin API client with `credentials: "include"` and these methods:

```javascript
login(loginName, password)
logout()
me()
listTeachers()
createTeacher(loginName, displayName)
resetTeacherPassword(teacherId)
```

On load, call `me()`. A 401 keeps the entry page visible and shows the admin login affordance. A successful login loads the teacher list and switches to the workspace. On logout or session expiry, clear all teacher rows and the temporary password text.

- [ ] **Step 5: Add frontend structural tests**

`tests/admin-page.test.js` must assert:

- existing three links remain;
- `admin.html` loads `admin.js`;
- login, teacher list, create, reset, logout, and temporary-password markers exist;
- no password value is prefilled;
- source does not use `localStorage` or `sessionStorage` for temporary passwords;
- source does not contain a known production password.

- [ ] **Step 6: Run frontend tests**

Run:

```bash
node --test tests/admin-page.test.js tests/teacher-api-client.test.js
```

Expected: all structural and API-client tests pass.

## Task 7: Add release packaging and bootstrap-safe deployment

**Files:**

- Modify: `tools/web-release.sh`
- Modify: `tools/teacher-platform-release.sh`
- Modify: `tests/web-release.test.js`
- Modify: `tests/teacher-platform-release.test.js`
- Modify: `deploy/teacher-platform/README.md`

- [ ] **Step 1: Write failing release tests**

Extend the teacher-platform build test to assert:

```javascript
assert.ok(fs.existsSync(path.join(output, "public/admin.html")));
assert.ok(metadata.files.some((file) => file.path === "admin.html"));
```

Add shell-source assertions for:

- admin page in the `teacher-platform-v1` allowlist;
- Alembic migration before service restart;
- first-admin seed guarded by “admin row does not exist”;
- no admin password written to the persistent remote env file;
- remote verification checks `/admin.html` and unauthenticated admin API behavior.

- [ ] **Step 2: Add admin page to the web publish allowlist**

Add:

```bash
ADMIN_SOURCE_FILES=("teacher-web/admin.html" "teacher-web/admin.js")
ADMIN_PUBLIC_FILES=("public/admin.html" "public/admin.js")
```

Include both arrays only in `teacher-platform-v1`, copy them into the release output, include them in checksums/metadata, and verify `/admin.html` returns 200. Keep `sales-static-v1` unchanged.

- [ ] **Step 3: Add first-admin bootstrap without persistent password storage**

Add a production deployment variable such as `KNOWNMAP_PRODUCTION_ADMIN_PASSWORD`. If it is empty, generate with `openssl rand -hex 18`. Pass it to a one-time remote file with mode `0600`, invoke a seed command only when the `admins` table has no active/any admin row, then delete the remote file before deployment returns.

The seed command must receive the raw password only through an environment variable or stdin for the one invocation. It must never append the password to `/etc/knownmap/teacher-platform.env`, release JSON, release history, logs, or Git.

On later releases, run only `alembic upgrade head`; do not reset existing admin or teacher passwords.

- [ ] **Step 4: Add remote verification**

After release:

```bash
curl -fsS https://knownmap.com/health
curl -fsS -o /dev/null -w '%{http_code}\n' https://knownmap.com/admin.html
curl -sS -o /dev/null -w '%{http_code}\n' https://knownmap.com/api/v1/admin/auth/me
```

Expected: health 200, page 200, unauthenticated admin API 401. The verification function must not print the generated admin password.

- [ ] **Step 5: Run release tests**

Run:

```bash
node --test tests/web-release.test.js tests/teacher-platform-release.test.js
bash -n tools/web-release.sh tools/teacher-platform-release.sh
```

Expected: all release allowlist, shell syntax, and credential-handling tests pass.

## Task 8: Full verification, production deploy, and documentation closeout

**Files:**

- Modify: `doc/DECISIONS.md` only if a new implementation decision differs from this spec
- Modify: `deploy/releases/<new-release-id>.json` after verified deployment
- Modify: `changelog.md` after all checks pass
- Modify: `next.md`

- [ ] **Step 1: Run the complete local suite**

Run:

```bash
node --test tests/*.test.js
cd backend
uv run pytest -q
cd ..
git diff --check
```

Expected: no test failures, no credential values in test output, and no whitespace errors.

- [ ] **Step 2: Build the exact release candidate**

Push the implementation commit to the confirmed remote branch, then use:

```bash
KNOWNMAP_PUBLISH_PROFILE=teacher-platform-v1 \
tools/teacher-platform-release.sh deploy <git-ref>
```

Before running production deployment, confirm the candidate commit is present on the allowed remote branch and the deployment command is operating on the intended commit. Do not deploy the current dirty worktree.

- [ ] **Step 3: Verify production behavior**

Check:

- `https://knownmap.com/admin.html` returns 200 and keeps the three original links;
- no admin session gives 401 for `/api/v1/admin/auth/me` and `/api/v1/admin/teachers`;
- admin login succeeds;
- teacher list shows current published-course counts;
- creating a teacher returns a one-time password and the password is not present in release records or service logs;
- the created teacher can log in with the one-time password;
- resetting the password invalidates the old password and returns a new one-time password;
- refreshing or reopening the page no longer shows the old temporary password.

- [ ] **Step 4: Record the verified release**

Update `deploy/releases/<release-id>.json`, `deploy/releases/README.md` if its schema needs a new verification field, `changelog.md`, and `next.md`. Never write the generated admin password or teacher temporary password to any of these files.

- [ ] **Step 5: Perform final security review**

Run:

```bash
rg -n -i --hidden \
  -g '!node_modules' -g '!backend/.venv' -g '!deploy/releases/*.json' \
  '(SEED_ADMIN_PASSWORD=|KNOWNMAP_PRODUCTION_ADMIN_PASSWORD=|temporary_password|password_hash)' .
```

Review each match and confirm only code paths, tests, schemas, and documentation rules remain; no real credential is present. Then verify the remote env file contains only runtime secrets and no seed password names or values.

## Execution checkpoints

- Commit after Task 2: admin persistence/auth services and unit tests.
- Commit after Task 4: admin API and integration tests.
- Commit after Task 6: protected `admin.html` workspace and frontend tests.
- Commit after Task 7: release/bootstrap changes and release tests.
- Commit after Task 8: verified production release and changelog.

Do not merge or push unrelated pre-existing worktree changes into these commits.
