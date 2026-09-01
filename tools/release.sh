#!/usr/bin/env bash
# 初期统一发布入口（D-V1-013）：本机测完后提交 GitHub，构建产物，再 copy 到阿里云切换。
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_HOST="${KNOWNMAP_SSH_HOST:-aliyun-us}"
APP_ROOT="${KNOWNMAP_APP_ROOT:-/opt/knownmap}"
DATA_ROOT="${KNOWNMAP_DATA_ROOT:-/var/lib/knownmap}"
DEPLOY_ROOT="${KNOWNMAP_DEPLOY_ROOT:-/var/www/knownmap}"
SITE_URL="${KNOWNMAP_SITE_URL:-https://knownmap.com}"
REPOSITORY="${KNOWNMAP_REPOSITORY:-xiaobaiworld/lessonpilot}"
PUBLISH_PROFILE="${KNOWNMAP_PUBLISH_PROFILE:-v1-apps}"
SERVICE_NAME="knownmap-teacher-api.service"
UV_VERSION="0.11.12"
UV_SHA256="9acdecddacba550ee616c02bb4616d894352022550c5977524556fd5077ce1d4"
SSH_CONTROL=""
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=15)

log() {
  printf '[release] %s\n' "$*"
}

fail() {
  printf '[release] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

[[ "$PUBLISH_PROFILE" == "v1-apps" ]] || fail "unsupported publish profile: $PUBLISH_PROFILE"

open_ssh() {
  SSH_CONTROL="$(mktemp "${TMPDIR:-/tmp}/knownmap-ssh.XXXXXX")"
  rm -f "$SSH_CONTROL"
  SSH_OPTS+=(
    -o ControlMaster=auto
    -o "ControlPath=$SSH_CONTROL"
    -o ControlPersist=120
  )
  ssh "${SSH_OPTS[@]}" "$SSH_HOST" true ||
    fail "cannot reach SSH host '$SSH_HOST'; set KNOWNMAP_SSH_HOST（本机别名是 aliyun-us）"
}

close_ssh() {
  if [[ -n "$SSH_CONTROL" ]]; then
    ssh -O exit -o "ControlPath=$SSH_CONTROL" "$SSH_HOST" >/dev/null 2>&1 || true
    rm -f "$SSH_CONTROL"
    SSH_CONTROL=""
  fi
}

ssh_host() {
  ssh "${SSH_OPTS[@]}" "$SSH_HOST" "$@"
}

scp_host() {
  scp "${SSH_OPTS[@]}" "$@"
}

rsync_host() {
  rsync -az --delete -e "ssh ${SSH_OPTS[*]}" "$@"
}

validate_settings() {
  [[ "$SSH_HOST" =~ ^[A-Za-z0-9._@-]+$ ]] || fail "unsafe SSH host: $SSH_HOST"
  [[ "$APP_ROOT" =~ ^/[A-Za-z0-9._/-]+$ ]] || fail "unsafe app root: $APP_ROOT"
  [[ "$DEPLOY_ROOT" =~ ^/[A-Za-z0-9._/-]+$ ]] || fail "unsafe deploy root: $DEPLOY_ROOT"
  [[ "$SITE_URL" =~ ^https://[A-Za-z0-9._:-]+$ ]] || fail "site URL must be an HTTPS origin"
}

resolve_commit() {
  git -C "$ROOT_DIR" rev-parse --verify "$1^{commit}"
}

require_github_commit() {
  local commit="$1"
  log "fetching GitHub refs"
  git -C "$ROOT_DIR" fetch origin --prune
  git -C "$ROOT_DIR" cat-file -e "$commit^{commit}"
  git -C "$ROOT_DIR" branch -r --contains "$commit" | grep -q . ||
    fail "commit $commit is not on any origin/* ref; push it to GitHub first"
}

release_id_for_commit() {
  printf '%s-%s\n' "$(date -u +%Y%m%dT%H%M%SZ)" "${1:0:12}"
}

build_web() {
  local commit="$1"
  local output="$2"
  local source_dir
  local app
  local files='[]'
  local relative_path
  local sha256
  local bytes

  source_dir="$(mktemp -d "${TMPDIR:-/tmp}/knownmap-source.XXXXXX")"
  mkdir -p "$output/public/assets/student-guide" "$output/public/downloads/student-plugin"
  git -C "$ROOT_DIR" archive "$commit" -- v1 | tar -x -C "$source_dir"

  cp "$source_dir/v1/site/index.html" "$output/public/index.html"
  cp "$source_dir/v1/site/trial-application.html" "$output/public/trial-application.html"
  cp "$source_dir/v1/site/student-guide.html" "$output/public/student-guide.html"
  cp "$source_dir/v1/site/subtitle-context.js" "$output/public/subtitle-context.js"
  cp "$source_dir/v1/site/demo-captions.js" "$output/public/demo-captions.js"
  cp "$source_dir/v1/site/trial-intake.js" "$output/public/trial-intake.js"
  cp "$source_dir/v1/site/link.html" "$output/public/link.html"
  cp -R "$source_dir/v1/site/assets/." "$output/public/assets/"
  printf 'User-agent: *\nDisallow: /\n' >"$output/public/robots.txt"

  require_command node
  require_command npm
  require_command zip
  [[ -f "$source_dir/v1/package-lock.json" ]] || fail "v1/package-lock.json missing"
  log "npm ci（本机构建，不跑测试）"
  (cd "$source_dir/v1" && npm ci --silent)

  for app in admin teacher; do
    log "building $app"
    (cd "$source_dir/v1/web/$app" && npm run build --silent)
    mkdir -p "$output/public/$app"
    cp -R "$source_dir/v1/web/$app/dist/." "$output/public/$app/"
    [[ -f "$output/public/$app/index.html" ]] || fail "$app index.html missing"
    if grep -qE '(src|href)="/(assets|[a-z])' "$output/public/$app/index.html"; then
      fail "$app/index.html 使用站点根绝对路径"
    fi
  done

  log "building extension"
  (cd "$source_dir/v1/extension" && KNOWNMAP_TARGET=production npm run build --silent)
  local ext_manifest="$source_dir/v1/extension/dist/production/manifest.json"
  [[ -f "$ext_manifest" ]] || fail "extension manifest missing"
  if grep -R -E '127\.0\.0\.1|localhost' "$source_dir/v1/extension/dist/production" \
      --include='*.js' --include='manifest.json' -q; then
    fail "production extension contains localhost"
  fi
  if head -c 64 "$source_dir/v1/extension/dist/production/content/index.js" \
      | grep -qE '^\s*import'; then
    fail "production content script is not a standalone classic script"
  fi
  (cd "$source_dir/v1/extension/dist/production" &&
    zip -q -r -X "$output/public/downloads/student-plugin/knownmap-v1.zip" .)
  cp \
    "$output/public/downloads/student-plugin/knownmap-v1.zip" \
    "$output/public/downloads/student-plugin/knownmapplugin.zip"

  (
    cd "$output"
    find public -type f | LC_ALL=C sort | while IFS= read -r relative_path; do
      shasum -a 256 "$relative_path"
    done
  ) >"$output/SHA256SUMS"

  while IFS= read -r relative_path; do
    sha256="$(shasum -a 256 "$output/$relative_path" | awk '{print $1}')"
    bytes="$(wc -c <"$output/$relative_path" | tr -d ' ')"
    files="$(
      jq --arg path "${relative_path#public/}" --arg sha256 "$sha256" --argjson bytes "$bytes" \
        '. + [{path: $path, sha256: $sha256, bytes: $bytes}]' <<<"$files"
    )"
  done < <(cd "$output" && find public -type f | LC_ALL=C sort)

  printf '%s\n' "$files" >"$output/files.json"
  rm -rf "$source_dir"
}

write_release_json() {
  local output="$1"
  local commit="$2"
  local release_id="$3"
  local built_at
  built_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  jq -n \
    --arg releaseId "$release_id" \
    --arg site "$SITE_URL" \
    --arg repository "$REPOSITORY" \
    --arg gitRemote "$(git -C "$ROOT_DIR" remote get-url origin)" \
    --arg gitCommit "$commit" \
    --arg gitShortCommit "${commit:0:12}" \
    --arg gitRemoteBranch "$(git -C "$ROOT_DIR" branch -r --contains "$commit" | awk 'NR==1{print $1}')" \
    --arg gitCommitSubject "$(git -C "$ROOT_DIR" show -s --format=%s "$commit")" \
    --arg gitCommitTime "$(git -C "$ROOT_DIR" show -s --format=%cI "$commit")" \
    --arg gitTag "web-prod/$release_id" \
    --arg publishProfile "$PUBLISH_PROFILE" \
    --arg builtAt "$built_at" \
    --argjson files "$(cat "$output/files.json")" \
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
      publishProfile: $publishProfile,
      status: "built",
      builtAt: $builtAt,
      deployedAt: null,
      previousReleaseId: null,
      files: $files
    }' >"$output/release.json"
  cp "$output/release.json" "$output/backend-release.json"
  jq '.component = "fastapi"' "$output/backend-release.json" >"$output/backend-release.json.next"
  mv "$output/backend-release.json.next" "$output/backend-release.json"
}

install_remote_backend() {
  local release_id="$1"
  local seed_password="${2:-}"
  local seed_file="-"

  if [[ -n "$seed_password" ]]; then
    seed_file="/root/.knownmap-seed-$release_id"
    ssh_host "install -m 600 /dev/null '$seed_file'"
    printf '%s' "$seed_password" | ssh_host "cat > '$seed_file'"
  fi

  ssh_host bash -s -- \
    "$APP_ROOT" "$DATA_ROOT" "$release_id" "$SERVICE_NAME" \
    "$seed_file" "$UV_VERSION" "$UV_SHA256" <<'REMOTE'
set -euo pipefail
app_root="$1"
data_root="$2"
release_id="$3"
service_name="$4"
seed_password_file="$5"
uv_version="$6"
uv_sha256="$7"
release="$app_root/releases/$release_id"
shared_venv="$app_root/venv"
uv_root="$app_root/tools/uv/$uv_version"
uv_bin="$uv_root/uv"
env_file="/etc/knownmap/teacher-platform.env"

cleanup() {
  [[ "$seed_password_file" == "-" ]] || rm -f "$seed_password_file"
}
trap cleanup EXIT

getent group knownmap >/dev/null || groupadd --system knownmap
id -u knownmap >/dev/null 2>&1 || useradd --system --gid knownmap --home-dir /nonexistent --shell /usr/sbin/nologin knownmap
install -d -m 755 "$app_root/releases" "$app_root/tools" /etc/knownmap
install -d -o knownmap -g knownmap -m 750 "$data_root"
test -d "$release/v1/backend"

if [[ ! -x "$uv_bin" ]]; then
  uv_tmp="$(mktemp -d /tmp/knownmap-uv.XXXXXX)"
  curl -fsSL \
    "https://github.com/astral-sh/uv/releases/download/$uv_version/uv-x86_64-unknown-linux-gnu.tar.gz" \
    -o "$uv_tmp/uv.tar.gz"
  printf '%s  %s\n' "$uv_sha256" "$uv_tmp/uv.tar.gz" | sha256sum -c -
  tar -xzf "$uv_tmp/uv.tar.gz" -C "$uv_tmp"
  install -d -m 755 "$uv_root"
  install -m 755 "$uv_tmp/uv-x86_64-unknown-linux-gnu/uv" "$uv_bin"
  rm -rf "$uv_tmp"
fi

if [[ ! -f "$env_file" ]]; then
  umask 077
  cat >"$env_file.next" <<ENV
APP_ENV=production
DATABASE_URL=sqlite+pysqlite:////var/lib/knownmap/knownmap.db
SESSION_SECRET=$(openssl rand -hex 32)
ACCESS_CODE_SECRET=$(openssl rand -hex 32)
LOG_LEVEL=INFO
CORS_ORIGINS=https://knownmap.com,https://www.knownmap.com
SESSION_TTL_SECONDS=86400
ENV
  install -o root -g knownmap -m 640 "$env_file.next" "$env_file"
  rm -f "$env_file.next"
fi

cd "$release/v1/backend"
lock_hash="$(sha256sum uv.lock | awk '{print $1}')"
lock_stamp="$app_root/venv.lock.sha256"
need_sync=1
if [[ -x "$shared_venv/bin/uvicorn" && -f "$lock_stamp" && "$(cat "$lock_stamp")" == "$lock_hash" ]]; then
  need_sync=0
fi
if [[ "$need_sync" == 1 ]]; then
  UV_PROJECT_ENVIRONMENT="$shared_venv" \
    "$uv_bin" sync --frozen --no-dev --no-editable
  printf '%s\n' "$lock_hash" >"$lock_stamp"
fi
ln -sfn "$shared_venv" "$release/v1/backend/.venv"
test -x "$release/v1/backend/.venv/bin/uvicorn"

set -a
. "$env_file"
set +a
database_path="${DATABASE_URL#sqlite+pysqlite:////}"
if [[ -n "$database_path" ]]; then
  install -d -o knownmap -g knownmap -m 750 "$(dirname "/$database_path")"
fi

if [[ ! -f /var/lib/knownmap/knownmap.db ]]; then
  [[ "$seed_password_file" != "-" ]] || {
    echo "first production deploy requires KNOWNMAP_PRODUCTION_TEACHER_PASSWORD" >&2
    exit 1
  }
  seed_password="$(cat "$seed_password_file")"
  rm -f "$seed_password_file"
  seed_password_file="-"
  "$release/v1/backend/.venv/bin/alembic" -c "$release/v1/backend/alembic.ini" upgrade head
  SEED_TEACHER_LOGIN_NAME=teacher-test-01 \
  SEED_TEACHER_PASSWORD="$seed_password" \
  SEED_TEACHER_DISPLAY_NAME='KnownMap 教师' \
    "$release/v1/backend/.venv/bin/python" -m app.seed
else
  "$release/v1/backend/.venv/bin/alembic" -c "$release/v1/backend/alembic.ini" upgrade head
fi
if [[ -f "/$database_path" ]]; then
  chown knownmap:knownmap "/$database_path"
  chmod 660 "/$database_path"
fi

temporary_link="$app_root/.current-$release_id"
ln -sfn "$release" "$temporary_link"
mv -Tf "$temporary_link" "$app_root/current"
REMOTE
}

install_remote_nginx() {
  local release_id="$1"
  local config_file="$2"
  local remote_tmp="/etc/nginx/sites-available/.knownmap-$release_id"

  [[ -f "$config_file" ]] || fail "nginx config missing: $config_file"
  scp_host "$config_file" "$SSH_HOST:$remote_tmp"
  ssh_host bash -s -- "$remote_tmp" "$release_id" <<'REMOTE'
set -euo pipefail
remote_tmp="$1"
release_id="$2"
current="/etc/nginx/sites-available/knownmap"
backup="/etc/nginx/sites-available/.knownmap-backup-$release_id"

cp "$current" "$backup"
restore() {
  install -m 644 "$backup" "$current"
  rm -f "$remote_tmp" "$backup"
}

install -m 644 "$remote_tmp" "$current"
if ! nginx -t >/dev/null; then
  restore
  exit 1
fi
if ! systemctl reload nginx; then
  restore
  nginx -t >/dev/null
  systemctl reload nginx
  exit 1
fi
rm -f "$remote_tmp" "$backup"
REMOTE
}

restore_backend() {
  local target="$1"
  [[ -n "$target" ]] || return 0
  ssh_host bash -s -- "$APP_ROOT" "$target" "$SERVICE_NAME" <<'REMOTE'
set -euo pipefail
app_root="$1"
target="$2"
service_name="$3"
test -d "$target/v1/backend"
[[ -e "$target/v1/backend/.venv" ]] || ln -sfn "$app_root/venv" "$target/v1/backend/.venv"
temporary_link="$app_root/.current-restore"
ln -sfn "$target" "$temporary_link"
mv -Tf "$temporary_link" "$app_root/current"
systemctl restart "$service_name"
REMOTE
}

light_verify() {
  local release_id="$1"
  local expected_commit="$2"
  local status
  local body

  body="$(curl -fsS "$SITE_URL/health")"
  jq -e '.status == "ok"' <<<"$body" >/dev/null
  for path in / /admin/ /teacher/; do
    status="$(curl -sS -o /dev/null -w '%{http_code}' "$SITE_URL$path")"
    [[ "$status" == "200" ]] || return 1
  done
  [[ "$(ssh_host "jq -r .gitCommit '$APP_ROOT/current/backend-release.json'")" == "$expected_commit" ]]
  log "verified $release_id"
}

deploy_release() {
  local ref="${1:-HEAD}"
  local commit
  local release_id
  local tag
  local temporary
  local previous_backend
  local previous_web
  local seed_password
  local deployed_at
  local record_file

  validate_settings
  require_command git
  require_command jq
  require_command rsync
  require_command curl
  require_command tar
  trap close_ssh EXIT
  open_ssh

  commit="$(resolve_commit "$ref")"
  require_github_commit "$commit"
  release_id="${KNOWNMAP_RELEASE_ID:-$(release_id_for_commit "$commit")}"
  [[ "$release_id" =~ ^[A-Za-z0-9._-]+$ ]] || fail "unsafe release ID"
  tag="web-prod/$release_id"
  seed_password="${KNOWNMAP_PRODUCTION_TEACHER_PASSWORD:-}"

  if git -C "$ROOT_DIR" show-ref --verify --quiet "refs/tags/$tag"; then
    fail "local tag already exists: $tag"
  fi

  temporary="$(mktemp -d "${TMPDIR:-/tmp}/knownmap-release.XXXXXX")"
  mkdir -p "$temporary/web" "$temporary/backend/v1"
  log "building web from $commit"
  build_web "$commit" "$temporary/web"
  write_release_json "$temporary/web" "$commit" "$release_id"
  git -C "$ROOT_DIR" archive "$commit" -- v1/backend deploy/teacher-platform |
    tar -x -C "$temporary/backend"
  cp "$temporary/web/backend-release.json" "$temporary/backend/backend-release.json"

  previous_backend="$(ssh_host "readlink -f '$APP_ROOT/current' 2>/dev/null || true")"
  previous_web="$(ssh_host "readlink -f '$DEPLOY_ROOT/current' 2>/dev/null || true")"

  ssh_host bash -s -- "$APP_ROOT" "$DEPLOY_ROOT" "$release_id" <<'REMOTE'
set -euo pipefail
mkdir -p "$1/releases" "$2/releases"
test ! -e "$1/releases/$3"
test ! -e "$2/releases/$3"
mkdir -p "$1/releases/$3/v1/backend" "$2/.incoming-$3"
REMOTE

  log "copy backend"
  rsync_host "$temporary/backend/v1/backend/" "$SSH_HOST:$APP_ROOT/releases/$release_id/v1/backend/"
  scp_host "$temporary/backend/backend-release.json" \
    "$SSH_HOST:$APP_ROOT/releases/$release_id/backend-release.json"

  if ! install_remote_backend "$release_id" "$seed_password"; then
    restore_backend "$previous_backend"
    fail "backend deploy failed; restored previous"
  fi

  scp_host "$temporary/backend/deploy/teacher-platform/knownmap-teacher-api.service" \
    "$SSH_HOST:/etc/systemd/system/$SERVICE_NAME"
  if ! install_remote_nginx "$release_id" \
      "$temporary/backend/deploy/teacher-platform/knownmap-nginx.conf"; then
    restore_backend "$previous_backend"
    fail "nginx config update failed; restored previous backend"
  fi
  ssh_host "systemctl daemon-reload && systemctl enable '$SERVICE_NAME' >/dev/null && systemctl restart '$SERVICE_NAME' && systemctl is-active --quiet '$SERVICE_NAME'" || {
    restore_backend "$previous_backend"
    fail "systemd restart failed; restored previous"
  }

  log "copy web"
  rsync_host "$temporary/web/" "$SSH_HOST:$DEPLOY_ROOT/.incoming-$release_id/"
  ssh_host bash -s -- "$DEPLOY_ROOT" "$release_id" <<'REMOTE'
set -euo pipefail
deploy_root="$1"
release_id="$2"
incoming="$deploy_root/.incoming-$release_id"
mv "$incoming" "$deploy_root/releases/$release_id"
nginx -t >/dev/null
temporary_link="$deploy_root/.current-$release_id"
ln -sfn "$deploy_root/releases/$release_id/public" "$temporary_link"
mv -Tf "$temporary_link" "$deploy_root/current"
REMOTE

  deployed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if ! light_verify "$release_id" "$commit"; then
    [[ -n "$previous_web" ]] && ssh_host "ln -sfn '$previous_web' '$DEPLOY_ROOT/.current-restore' && mv -Tf '$DEPLOY_ROOT/.current-restore' '$DEPLOY_ROOT/current'"
    restore_backend "$previous_backend"
    fail "verification failed; restored previous"
  fi

  git -C "$ROOT_DIR" tag -a "$tag" "$commit" -m "KnownMap production release $release_id"
  git -C "$ROOT_DIR" push origin "refs/tags/$tag"

  record_file="$ROOT_DIR/deploy/releases/$release_id.json"
  jq --arg deployedAt "$deployed_at" \
    '.status = "verified" | .deployedAt = $deployedAt | .verifiedAt = $deployedAt' \
    "$temporary/web/release.json" >"$record_file"
  scp_host "$record_file" "$SSH_HOST:$DEPLOY_ROOT/releases/$release_id/release.json"
  scp_host "$record_file" "$SSH_HOST:$APP_ROOT/releases/$release_id/backend-release.json"

  rm -rf "$temporary"
  close_ssh
  trap - EXIT
  log "release succeeded"
  printf 'RELEASE_ID=%s\nGIT_COMMIT=%s\nGIT_TAG=%s\nRECORD_FILE=%s\n' \
    "$release_id" "$commit" "$tag" "$record_file"
}

show_status() {
  validate_settings
  open_ssh
  trap close_ssh EXIT
  echo "=== API ==="
  ssh_host bash -s -- "$APP_ROOT" "$SERVICE_NAME" <<'REMOTE'
set -euo pipefail
echo "Current backend: $(readlink -f "$1/current" 2>/dev/null || echo none)"
systemctl is-active "$2" || true
if [[ -f "$1/current/backend-release.json" ]]; then
  jq -r '"Release ID: \(.releaseId)\nGit commit: \(.gitCommit)\nStatus: \(.status)"' \
    "$1/current/backend-release.json"
fi
REMOTE
  echo "=== Web ==="
  ssh_host bash -s -- "$DEPLOY_ROOT" <<'REMOTE'
set -euo pipefail
target="$(readlink -f "$1/current" 2>/dev/null || true)"
echo "Current target: ${target:-none}"
if [[ -n "$target" && -f "$(dirname "$target")/release.json" ]]; then
  jq -r '"Release ID: \(.releaseId)\nGit commit: \(.gitCommit)\nGit tag: \(.gitTag)"' \
    "$(dirname "$target")/release.json"
fi
REMOTE
  close_ssh
  trap - EXIT
}

verify_release() {
  local release_id="$1"
  validate_settings
  [[ "$release_id" =~ ^[A-Za-z0-9._-]+$ ]] || fail "usage: $0 verify <release-id>"
  open_ssh
  trap close_ssh EXIT
  ssh_host bash -s -- "$DEPLOY_ROOT" "$release_id" <<'REMOTE'
set -euo pipefail
release="$1/releases/$2"
test -d "$release/public"
test -f "$release/release.json"
jq -e --arg id "$2" '.releaseId == $id and .environment == "production"' "$release/release.json" >/dev/null
printf 'Verified release: %s\nGit commit: %s\n' "$2" "$(jq -r .gitCommit "$release/release.json")"
REMOTE
  close_ssh
  trap - EXIT
}

list_releases() {
  validate_settings
  open_ssh
  trap close_ssh EXIT
  ssh_host bash -s -- "$DEPLOY_ROOT" <<'REMOTE'
set -euo pipefail
active="$(readlink -f "$1/current" 2>/dev/null || true)"
find "$1/releases" -mindepth 2 -maxdepth 2 -name release.json -print 2>/dev/null | sort |
  while IFS= read -r metadata; do
    dir="$(dirname "$metadata")"
    status=inactive
    [[ "$active" == "$dir/public" ]] && status=active
    jq -r --arg s "$status" '[.releaseId, $s, .gitShortCommit, (.deployedAt // .builtAt)] | @tsv' "$metadata"
  done
REMOTE
  close_ssh
  trap - EXIT
}

rollback_release() {
  local release_id="$1"
  validate_settings
  [[ "$release_id" =~ ^[A-Za-z0-9._-]+$ ]] || fail "usage: $0 rollback <release-id>"
  open_ssh
  trap close_ssh EXIT
  ssh_host bash -s -- "$APP_ROOT" "$DEPLOY_ROOT" "$SERVICE_NAME" "$release_id" <<'REMOTE'
set -euo pipefail
app_root="$1"
deploy_root="$2"
service_name="$3"
release_id="$4"
backend="$app_root/releases/$release_id"
web="$deploy_root/releases/$release_id/public"
test -d "$backend/v1/backend"
test -d "$web"
[[ -e "$backend/v1/backend/.venv" ]] || ln -sfn "$app_root/venv" "$backend/v1/backend/.venv"
tmp="$app_root/.current-rollback"
ln -sfn "$backend" "$tmp"
mv -Tf "$tmp" "$app_root/current"
systemctl restart "$service_name"
tmpw="$deploy_root/.current-rollback"
ln -sfn "$web" "$tmpw"
mv -Tf "$tmpw" "$deploy_root/current"
REMOTE
  close_ssh
  trap - EXIT
  log "rolled back to $release_id"
}

usage() {
  cat <<'EOF'
Usage:
  tools/release.sh deploy [git-ref]
  tools/release.sh status
  tools/release.sh list
  tools/release.sh verify <release-id>
  tools/release.sh rollback <release-id>

初期唯一发布入口（D-V1-013）。测试在本机先跑完；本命令构建产物并 copy 到阿里云。
版本：web-prod/<UTC时间>-<commit12> ，记录在 deploy/releases/*.json
EOF
}

main() {
  case "${1:-}" in
    deploy)
      [[ $# -le 2 ]] || fail "usage: $0 deploy [git-ref]"
      deploy_release "${2:-HEAD}"
      ;;
    status)
      show_status
      ;;
    list)
      list_releases
      ;;
    verify)
      [[ $# -eq 2 ]] || fail "usage: $0 verify <release-id>"
      verify_release "$2"
      ;;
    rollback)
      [[ $# -eq 2 ]] || fail "usage: $0 rollback <release-id>"
      rollback_release "$2"
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
