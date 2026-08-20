#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_HOST="${KNOWNMAP_SSH_HOST:-aliyun}"
APP_ROOT="${KNOWNMAP_APP_ROOT:-/opt/knownmap}"
DATA_ROOT="${KNOWNMAP_DATA_ROOT:-/var/lib/knownmap}"
SITE_URL="${KNOWNMAP_SITE_URL:-https://knownmap.com}"
REPOSITORY="${KNOWNMAP_REPOSITORY:-xiaobaiworld/lessonpilot}"
SERVICE_NAME="knownmap-teacher-api.service"
SERVICE_FILE="$ROOT_DIR/deploy/teacher-platform/knownmap-teacher-api.service"

log() {
  printf '[teacher-platform-release] %s\n' "$*"
}

fail() {
  printf '[teacher-platform-release] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

validate_settings() {
  [[ "$SSH_HOST" =~ ^[A-Za-z0-9._@-]+$ ]] || fail "unsafe SSH host: $SSH_HOST"
  [[ "$APP_ROOT" =~ ^/[A-Za-z0-9._/-]+$ ]] || fail "unsafe app root: $APP_ROOT"
  [[ "$DATA_ROOT" =~ ^/[A-Za-z0-9._/-]+$ ]] || fail "unsafe data root: $DATA_ROOT"
  [[ "$SITE_URL" =~ ^https://[A-Za-z0-9._:-]+$ ]] || fail "site URL must be an HTTPS origin"
}

resolve_commit() {
  git -C "$ROOT_DIR" rev-parse --verify "$1^{commit}"
}

remote_branch_for_commit() {
  git -C "$ROOT_DIR" for-each-ref \
    --format='%(refname:short)' \
    --contains "$1" \
    refs/remotes/origin |
    grep -v '^origin/HEAD$' |
    head -n 1 || true
}

require_github_commit() {
  local commit="$1"
  local remote_branch

  git -C "$ROOT_DIR" fetch origin --prune
  remote_branch="$(remote_branch_for_commit "$commit")"
  [[ -n "$remote_branch" ]] ||
    fail "commit $commit is not contained in refs/remotes/origin; push it to GitHub first"
}

release_id_for_commit() {
  local commit="$1"
  printf '%s-%s\n' "$(date -u +%Y%m%dT%H%M%SZ)" "${commit:0:12}"
}

run_commit_tests() {
  local commit="$1"
  local worktree

  require_command node
  require_command uv
  worktree="$(mktemp -d "${TMPDIR:-/tmp}/knownmap-teacher-worktree.XXXXXX")"
  rmdir "$worktree"
  git -C "$ROOT_DIR" worktree add --quiet --detach "$worktree" "$commit"

  if ! (
    cd "$worktree"
    node --test tests/*.test.js
    cd backend
    uv run pytest -q
  ); then
    git -C "$ROOT_DIR" worktree remove --force "$worktree" >/dev/null 2>&1 || true
    fail "release tests failed for $commit"
  fi

  git -C "$ROOT_DIR" worktree remove --force "$worktree"
}

build_backend_package() {
  local commit="$1"
  local output="$2"
  local source_dir

  source_dir="$(mktemp -d "${TMPDIR:-/tmp}/knownmap-backend-source.XXXXXX")"
  trap 'rm -rf "$source_dir"' RETURN
  mkdir -p "$output"
  git -C "$ROOT_DIR" archive "$commit" -- backend | tar -x -C "$source_dir"
  cp -a "$source_dir/backend" "$output/backend"
  trap - RETURN
  rm -rf "$source_dir"
}

write_backend_metadata() {
  local output="$1"
  local commit="$2"
  local release_id="$3"
  local remote_branch="$4"
  local git_remote="$5"
  local subject="$6"
  local commit_time="$7"
  local built_at="$8"

  jq -n \
    --arg releaseId "$release_id" \
    --arg site "$SITE_URL" \
    --arg repository "$REPOSITORY" \
    --arg gitRemote "$git_remote" \
    --arg gitCommit "$commit" \
    --arg gitShortCommit "${commit:0:12}" \
    --arg gitRemoteBranch "$remote_branch" \
    --arg gitCommitSubject "$subject" \
    --arg gitCommitTime "$commit_time" \
    --arg gitTag "web-prod/$release_id" \
    --arg builtAt "$built_at" \
    '{
      schemaVersion: 1,
      releaseId: $releaseId,
      environment: "production",
      site: $site,
      repository: $repository,
      gitRemote: $gitRemote,
      gitCommit: $gitCommit,
      gitShortCommit: $gitShortCommit,
      gitRemoteBranch: $gitRemoteBranch,
      gitCommitSubject: $gitCommitSubject,
      gitCommitTime: $gitCommitTime,
      gitTag: $gitTag,
      publishProfile: "teacher-platform-v1",
      component: "fastapi",
      status: "built",
      builtAt: $builtAt,
      deployedAt: null,
      previousReleaseId: null
    }' >"$output/backend-release.json"
}

remote_current_backend() {
  ssh -o BatchMode=yes "$SSH_HOST" \
    "readlink -f '$APP_ROOT/current' 2>/dev/null || true"
}

remote_restore_backend() {
  local target="$1"

  [[ -n "$target" ]] || return 0
  ssh -o BatchMode=yes "$SSH_HOST" bash -s -- "$APP_ROOT" "$target" "$SERVICE_NAME" <<'REMOTE'
set -euo pipefail
app_root="$1"
target="$2"
service_name="$3"
test -d "$target/backend"
temporary_link="$app_root/.current-restore"
ln -s "$target" "$temporary_link"
mv -Tf "$temporary_link" "$app_root/current"
systemctl restart "$service_name"
systemctl is-active --quiet "$service_name"
REMOTE
}

install_remote_backend() {
  local release_id="$1"
  local build_dir="$2"
  local previous_target="$3"
  local password="$4"
  local remote_env_file

  remote_env_file="/etc/knownmap/teacher-platform.env"
  ssh -o BatchMode=yes "$SSH_HOST" bash -s -- "$APP_ROOT" "$DATA_ROOT" "$release_id" "$SERVICE_NAME" "$remote_env_file" "$password" <<'REMOTE'
set -euo pipefail
app_root="$1"
data_root="$2"
release_id="$3"
service_name="$4"
env_file="$5"
seed_password="$6"
release="$app_root/releases/$release_id"

getent group knownmap >/dev/null || groupadd --system knownmap
id -u knownmap >/dev/null 2>&1 || useradd --system --gid knownmap --home-dir /nonexistent --shell /usr/sbin/nologin knownmap
install -d -m 755 "$app_root/releases" /etc/knownmap
install -d -o knownmap -g knownmap -m 750 "$data_root"
test -d "$release/backend"

if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi
uv_bin="$(command -v uv || true)"
if [[ -z "$uv_bin" && -x /root/.local/bin/uv ]]; then
  uv_bin=/root/.local/bin/uv
fi
test -x "$uv_bin"

if [[ ! -x "$app_root/venv/bin/python" ]]; then
  "$uv_bin" venv --python python3 "$app_root/venv"
fi

env_tmp="$env_file.next"
if [[ ! -f "$env_file" ]]; then
  session_secret="$(openssl rand -hex 32)"
  access_code_secret="$(openssl rand -hex 32)"
  umask 077
  cat >"$env_tmp" <<ENV
APP_ENV=production
DATABASE_URL=sqlite+pysqlite:////var/lib/knownmap/knownmap.db
SESSION_SECRET=$session_secret
ACCESS_CODE_SECRET=$access_code_secret
LOG_LEVEL=INFO
CORS_ORIGINS=https://knownmap.com,https://www.knownmap.com
SESSION_TTL_SECONDS=86400
ENV
  install -o root -g knownmap -m 640 "$env_tmp" "$env_file"
  rm -f "$env_tmp"
fi

test -d "$release/backend"
cd "$release/backend"
"$uv_bin" pip install --python "$app_root/venv/bin/python" .
chown -R root:knownmap "$app_root/venv"
find "$app_root/venv" -type d -exec chmod 755 {} +
find "$app_root/venv" -type f -exec chmod 644 {} +
find "$app_root/venv/bin" -type f -exec chmod 755 {} +

set -a
. "$env_file"
set +a
if [[ "$DATABASE_URL" == sqlite+pysqlite:////* ]]; then
  database_path="${DATABASE_URL#sqlite+pysqlite:////}"
  install -d -o knownmap -g knownmap -m 750 "$(dirname "/$database_path")"
fi
chown -R root:knownmap "$release"
find "$release" -type d -exec chmod 755 {} +
find "$release" -type f -exec chmod 644 {} +

if [[ ! -f /var/lib/knownmap/knownmap.db ]]; then
  "$app_root/venv/bin/alembic" -c "$release/backend/alembic.ini" upgrade head
  SEED_TEACHER_LOGIN_NAME=teacher-test-01 \
  SEED_TEACHER_PASSWORD="$seed_password" \
  SEED_TEACHER_DISPLAY_NAME='KnownMap 教师' \
    "$app_root/venv/bin/python" -m app.seed
else
  "$app_root/venv/bin/alembic" -c "$release/backend/alembic.ini" upgrade head
fi
if [[ -f "/$database_path" ]]; then
  chown knownmap:knownmap "/$database_path"
  chmod 660 "/$database_path"
fi

temporary_link="$app_root/.current-$release_id"
ln -s "$release" "$temporary_link"
mv -Tf "$temporary_link" "$app_root/current"
chown -h root:root "$app_root/current"
REMOTE

}

prepare_remote_backend() {
  local release_id="$1"

  ssh -o BatchMode=yes "$SSH_HOST" bash -s -- "$APP_ROOT" "$release_id" <<'REMOTE'
set -euo pipefail
app_root="$1"
release_id="$2"
getent group knownmap >/dev/null || groupadd --system knownmap
id -u knownmap >/dev/null 2>&1 || useradd --system --gid knownmap --home-dir /nonexistent --shell /usr/sbin/nologin knownmap
install -d -m 755 "$app_root/releases"
test ! -e "$app_root/releases/$release_id"
mkdir "$app_root/releases/$release_id"
install -d -m 755 "$app_root/releases/$release_id/backend"
REMOTE
}

install_systemd_service() {
  scp -q "$SERVICE_FILE" "$SSH_HOST:/etc/systemd/system/$SERVICE_NAME"
  ssh -o BatchMode=yes "$SSH_HOST" bash -s -- "$APP_ROOT" "$SERVICE_NAME" <<'REMOTE'
set -euo pipefail
app_root="$1"
service_name="$2"
test -x "$app_root/venv/bin/uvicorn"
systemctl daemon-reload
systemctl enable "$service_name" >/dev/null
systemctl restart "$service_name"
systemctl is-active --quiet "$service_name"
REMOTE
}

configure_nginx() {
  scp -q "$ROOT_DIR/deploy/teacher-platform/knownmap-nginx.conf" \
    "$SSH_HOST:/etc/nginx/sites-available/knownmap"
  ssh -o BatchMode=yes "$SSH_HOST" \
    'nginx -t && systemctl reload nginx'
}

verify_remote() {
  local release_id="$1"
  local expected_commit="$2"
  local body

  body="$(mktemp "${TMPDIR:-/tmp}/knownmap-api-health.XXXXXX")"
  trap 'rm -f "$body"' RETURN
  /usr/bin/curl -fsS "$SITE_URL/health" -o "$body"
  jq -e '.status == "ok"' "$body" >/dev/null || return 1
  /usr/bin/curl -fsS "$SITE_URL/teacher-web/editor.html" >/dev/null
  /usr/bin/curl -fsS "$SITE_URL/" >/dev/null

  for private_path in /doc/ /src/ /tests/ /.git/config /.env; do
    status="$(/usr/bin/curl -sS -o /dev/null -w '%{http_code}' "$SITE_URL$private_path")"
    [[ "$status" == "404" ]] || return 1
  done

  remote_commit="$(
    ssh -o BatchMode=yes "$SSH_HOST" \
      "jq -r .gitCommit '$APP_ROOT/current/backend-release.json'"
  )"
  [[ "$remote_commit" == "$expected_commit" ]] || return 1

  trap - RETURN
  rm -f "$body"
  log "verified release $release_id"
}

deploy_release() {
  local ref="${1:-HEAD}"
  local commit
  local release_id
  local remote_branch
  local temporary
  local backend_build
  local previous_target
  local seed_password
  local built_at
  local git_remote
  local subject
  local commit_time
  local record_file

  validate_settings
  require_command git
  require_command jq
  require_command rsync
  require_command scp
  require_command ssh
  require_command curl
  require_command openssl

  commit="$(resolve_commit "$ref")"
  require_github_commit "$commit"
  remote_branch="$(remote_branch_for_commit "$commit")"
  release_id="${KNOWNMAP_RELEASE_ID:-$(release_id_for_commit "$commit")}"
  [[ "$release_id" =~ ^[A-Za-z0-9._-]+$ ]] || fail "unsafe release ID: $release_id"
  seed_password="${KNOWNMAP_PRODUCTION_TEACHER_PASSWORD:-$(openssl rand -hex 18)}"
  run_commit_tests "$commit"

  temporary="$(mktemp -d "${TMPDIR:-/tmp}/knownmap-teacher-release.XXXXXX")"
  trap 'rm -rf "$temporary"' RETURN
  backend_build="$temporary/$release_id"
  mkdir -p "$backend_build"
  build_backend_package "$commit" "$backend_build"
  built_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  git_remote="$(git -C "$ROOT_DIR" remote get-url origin)"
  subject="$(git -C "$ROOT_DIR" show -s --format=%s "$commit")"
  commit_time="$(git -C "$ROOT_DIR" show -s --format=%cI "$commit")"
  write_backend_metadata "$backend_build" "$commit" "$release_id" "$remote_branch" "$git_remote" "$subject" "$commit_time" "$built_at"

  previous_target="$(remote_current_backend)"
  prepare_remote_backend "$release_id"
  rsync -az --delete "$backend_build/backend/" "$SSH_HOST:$APP_ROOT/releases/$release_id/backend/"
  scp -q "$backend_build/backend-release.json" \
    "$SSH_HOST:$APP_ROOT/releases/$release_id/backend-release.json"
  if ! install_remote_backend "$release_id" "$backend_build" "$previous_target" "$seed_password"; then
    remote_restore_backend "$previous_target"
    fail "backend deployment failed; restored previous backend"
  fi
  if ! install_systemd_service; then
    remote_restore_backend "$previous_target"
    fail "systemd service failed; restored previous backend"
  fi

  if ! configure_nginx; then
    remote_restore_backend "$previous_target"
    fail "nginx configuration failed; restored previous backend"
  fi

  if ! KNOWNMAP_PUBLISH_PROFILE=teacher-platform-v1 \
    KNOWNMAP_RELEASE_ID="$release_id" \
    "$ROOT_DIR/tools/web-release.sh" deploy "$commit"; then
    remote_restore_backend "$previous_target"
    fail "web deployment failed; restored previous backend"
  fi

  if ! verify_remote "$release_id" "$commit"; then
    remote_restore_backend "$previous_target"
    fail "production verification failed; restored previous backend"
  fi

  record_file="$ROOT_DIR/deploy/releases/$release_id.json"
  jq \
    --arg deployedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --slurpfile backend "$backend_build/backend-release.json" \
    '.status = "verified"
      | .verifiedAt = $deployedAt
      | .verification.apiHealth = "passed"
      | .verification.teacherEditor = "passed"
      | .components.backend = $backend[0]
      | .components.backend.status = "verified"
      | .components.backend.deployedAt = $deployedAt' \
    "$record_file" >"$record_file.next"
  mv "$record_file.next" "$record_file"
  jq \
    --arg deployedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '.status = "verified" | .deployedAt = $deployedAt' \
    "$backend_build/backend-release.json" >"$backend_build/backend-release.json.next"
  mv "$backend_build/backend-release.json.next" "$backend_build/backend-release.json"
  scp -q "$backend_build/backend-release.json" \
    "$SSH_HOST:$APP_ROOT/releases/$release_id/backend-release.json"

  trap - RETURN
  rm -rf "$temporary"
  log "teacher platform production release succeeded"
  printf 'RELEASE_ID=%s\nGIT_COMMIT=%s\nGIT_TAG=web-prod/%s\n' \
    "$release_id" "$commit" "$release_id"
  printf 'TEACHER_LOGIN=teacher-test-01\nTEACHER_PASSWORD=%s\n' "$seed_password"
  log "save the one-time production password; it is not stored in the repository"
}

show_status() {
  validate_settings
  ssh -o BatchMode=yes "$SSH_HOST" bash -s -- "$APP_ROOT" "$SERVICE_NAME" <<'REMOTE'
set -euo pipefail
app_root="$1"
service_name="$2"
target="$(readlink -f "$app_root/current" 2>/dev/null || true)"
echo "Current backend: ${target:-none}"
systemctl is-active "$service_name"
if [[ -f "$app_root/current/backend-release.json" ]]; then
  jq -r '
    "Release ID: \(.releaseId)",
    "Git commit: \(.gitCommit)",
    "Status: \(.status)",
    "Site: \(.site)"
  ' "$app_root/current/backend-release.json"
fi
REMOTE
}

usage() {
  cat <<'EOF'
Usage:
  tools/teacher-platform-release.sh deploy [git-ref]
  tools/teacher-platform-release.sh status
EOF
}

main() {
  case "${1:-}" in
    deploy)
      [[ $# -le 2 ]] || fail "usage: $0 deploy [git-ref]"
      deploy_release "${2:-HEAD}"
      ;;
    status)
      [[ $# -eq 1 ]] || fail "usage: $0 status"
      show_status
      ;;
    -h | --help | help)
      usage
      ;;
    *)
      usage >&2
      exit 1
      ;;
  esac
}

main "$@"
