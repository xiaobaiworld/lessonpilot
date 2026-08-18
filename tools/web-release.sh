#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_HOST="${KNOWNMAP_SSH_HOST:-aliyun}"
DEPLOY_ROOT="${KNOWNMAP_DEPLOY_ROOT:-/var/www/knownmap}"
SITE_URL="${KNOWNMAP_SITE_URL:-https://knownmap.com}"
REPOSITORY="${KNOWNMAP_REPOSITORY:-xiaobaiworld/lessonpilot}"
PUBLISH_PROFILE="sales-static-v1"

SOURCE_FILES=(
  "teacher-web/forsales.html"
  "teacher-web/subtitle-context.js"
  "teacher-web/demo-captions.js"
  "teacher-web/assets/knownmap-icon.png"
)

PUBLIC_FILES=(
  "public/index.html"
  "public/subtitle-context.js"
  "public/demo-captions.js"
  "public/assets/knownmap-icon.png"
  "public/robots.txt"
  "public/teacher-web/forsales.html"
  "public/teacher-web/subtitle-context.js"
  "public/teacher-web/demo-captions.js"
  "public/teacher-web/assets/knownmap-icon.png"
)

log() {
  printf '[web-release] %s\n' "$*"
}

fail() {
  printf '[web-release] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

validate_settings() {
  [[ "$SSH_HOST" =~ ^[A-Za-z0-9._@-]+$ ]] || fail "unsafe SSH host: $SSH_HOST"
  [[ "$DEPLOY_ROOT" =~ ^/[A-Za-z0-9._/-]+$ ]] || fail "unsafe deploy root: $DEPLOY_ROOT"
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

  log "fetching GitHub refs"
  git -C "$ROOT_DIR" fetch origin --prune
  remote_branch="$(remote_branch_for_commit "$commit")"
  [[ -n "$remote_branch" ]] ||
    fail "commit $commit is not contained in refs/remotes/origin; push it to GitHub first"
}

release_id_for_commit() {
  local commit="$1"
  printf '%s-%s\n' "$(date -u +%Y%m%dT%H%M%SZ)" "${commit:0:12}"
}

write_checksums() {
  local output="$1"

  (
    cd "$output"
    for relative_path in "${PUBLIC_FILES[@]}"; do
      shasum -a 256 "$relative_path"
    done
  ) >"$output/SHA256SUMS"
}

build_file_metadata() {
  local output="$1"
  local files='[]'
  local relative_path
  local sha256
  local bytes

  for relative_path in "${PUBLIC_FILES[@]}"; do
    sha256="$(shasum -a 256 "$output/$relative_path" | awk '{print $1}')"
    bytes="$(wc -c <"$output/$relative_path" | tr -d ' ')"
    files="$(
      jq \
        --arg path "${relative_path#public/}" \
        --arg sha256 "$sha256" \
        --argjson bytes "$bytes" \
        '. + [{path: $path, sha256: $sha256, bytes: $bytes}]' \
        <<<"$files"
    )"
  done

  printf '%s\n' "$files"
}

build_release() {
  local ref="$1"
  local output="$2"
  local commit
  local release_id
  local source_dir
  local remote_branch
  local files
  local built_at
  local git_remote
  local commit_subject
  local commit_time

  require_command git
  require_command jq
  require_command shasum
  require_command tar

  commit="$(resolve_commit "$ref")"
  release_id="${KNOWNMAP_RELEASE_ID:-$(basename "$output")}"
  [[ "$release_id" =~ ^[A-Za-z0-9._-]+$ ]] || fail "unsafe release ID: $release_id"
  [[ ! -e "$output" ]] || fail "build output already exists: $output"

  source_dir="$(mktemp -d "${TMPDIR:-/tmp}/knownmap-source.XXXXXX")"
  trap 'rm -rf "$source_dir"' RETURN

  mkdir -p "$source_dir" "$output/public/assets" "$output/public/teacher-web/assets"
  git -C "$ROOT_DIR" archive "$commit" -- "${SOURCE_FILES[@]}" | tar -x -C "$source_dir"

  cp "$source_dir/teacher-web/forsales.html" "$output/public/index.html"
  cp "$source_dir/teacher-web/subtitle-context.js" "$output/public/subtitle-context.js"
  cp "$source_dir/teacher-web/demo-captions.js" "$output/public/demo-captions.js"
  cp "$source_dir/teacher-web/assets/knownmap-icon.png" "$output/public/assets/knownmap-icon.png"
  cp "$source_dir/teacher-web/forsales.html" "$output/public/teacher-web/forsales.html"
  cp "$source_dir/teacher-web/subtitle-context.js" "$output/public/teacher-web/subtitle-context.js"
  cp "$source_dir/teacher-web/demo-captions.js" "$output/public/teacher-web/demo-captions.js"
  cp "$source_dir/teacher-web/assets/knownmap-icon.png" "$output/public/teacher-web/assets/knownmap-icon.png"
  printf 'User-agent: *\nDisallow: /\n' >"$output/public/robots.txt"

  write_checksums "$output"
  files="$(build_file_metadata "$output")"
  built_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  git_remote="$(git -C "$ROOT_DIR" remote get-url origin)"
  remote_branch="$(remote_branch_for_commit "$commit")"
  commit_subject="$(git -C "$ROOT_DIR" show -s --format=%s "$commit")"
  commit_time="$(git -C "$ROOT_DIR" show -s --format=%cI "$commit")"

  jq -n \
    --arg releaseId "$release_id" \
    --arg site "$SITE_URL" \
    --arg repository "$REPOSITORY" \
    --arg gitRemote "$git_remote" \
    --arg gitCommit "$commit" \
    --arg gitShortCommit "${commit:0:12}" \
    --arg gitRemoteBranch "$remote_branch" \
    --arg gitCommitSubject "$commit_subject" \
    --arg gitCommitTime "$commit_time" \
    --arg gitTag "web-prod/$release_id" \
    --arg publishProfile "$PUBLISH_PROFILE" \
    --arg builtAt "$built_at" \
    --argjson files "$files" \
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

  trap - RETURN
  rm -rf "$source_dir"
  log "built $release_id from $commit at $output"
}

current_target() {
  ssh -o BatchMode=yes "$SSH_HOST" \
    "readlink -f '$DEPLOY_ROOT/current' 2>/dev/null || true"
}

release_id_from_target() {
  local target="$1"

  if [[ "$(basename "$target")" == "public" ]]; then
    basename "$(dirname "$target")"
  else
    basename "$target"
  fi
}

append_history() {
  local event="$1"
  local encoded

  encoded="$(printf '%s\n' "$event" | base64 | tr -d '\n')"
  ssh -o BatchMode=yes "$SSH_HOST" bash -s -- "$DEPLOY_ROOT" "$encoded" <<'REMOTE'
set -euo pipefail
deploy_root="$1"
encoded="$2"
mkdir -p "$deploy_root"
printf '%s' "$encoded" |
  base64 -d |
  flock -x "$deploy_root/.release-history.lock" \
    tee -a "$deploy_root/release-history.jsonl" >/dev/null
REMOTE
}

switch_remote_target() {
  local target="$1"
  local switch_name="$2"

  ssh -o BatchMode=yes "$SSH_HOST" bash -s -- "$DEPLOY_ROOT" "$target" "$switch_name" <<'REMOTE'
set -euo pipefail
deploy_root="$1"
target="$2"
switch_name="$3"
test -d "$target"
nginx -t >/dev/null
temporary_link="$deploy_root/.current-$switch_name"
ln -s "$target" "$temporary_link"
mv -Tf "$temporary_link" "$deploy_root/current"
REMOTE
}

verify_public_site() {
  local release_id="$1"
  local expected_index_sha="$2"
  local body
  local actual_index_sha
  local path
  local status

  body="$(mktemp "${TMPDIR:-/tmp}/knownmap-index.XXXXXX")"
  trap 'rm -f "$body"' RETURN

  [[ "$(curl -fsS "$SITE_URL/healthz")" == "ok" ]] || return 1
  curl -fsS -H 'Cache-Control: no-cache' "$SITE_URL/?release=$release_id" -o "$body"
  actual_index_sha="$(shasum -a 256 "$body" | awk '{print $1}')"
  [[ "$actual_index_sha" == "$expected_index_sha" ]] || return 1

  for path in \
    "/doc/" \
    "/src/" \
    "/tests/" \
    "/teacher-web/editor.html" \
    "/.git/config" \
    "/.env"; do
    status="$(curl -sS -o /dev/null -w '%{http_code}' "$SITE_URL$path")"
    [[ "$status" == "404" ]] || return 1
  done

  trap - RETURN
  rm -f "$body"
}

validate_release_in_worktree() {
  local commit="$1"
  local worktree

  require_command node
  node --test "$ROOT_DIR/tests/web-release.test.js"

  worktree="$(mktemp -d "${TMPDIR:-/tmp}/knownmap-worktree.XXXXXX")"
  rmdir "$worktree"
  git -C "$ROOT_DIR" worktree add --quiet --detach "$worktree" "$commit"

  if ! (
    cd "$worktree"
    node --test \
      tests/forsales-copy-audience.test.js \
      tests/sales-page-copy.test.js
  ); then
    git -C "$ROOT_DIR" worktree remove --force "$worktree" >/dev/null 2>&1 || true
    fail "release tests failed for $commit"
  fi

  git -C "$ROOT_DIR" worktree remove --force "$worktree"
}

ensure_tag_available() {
  local tag="$1"

  if git -C "$ROOT_DIR" show-ref --verify --quiet "refs/tags/$tag"; then
    fail "local tag already exists: $tag"
  fi
  if git -C "$ROOT_DIR" ls-remote --exit-code --tags origin "refs/tags/$tag" >/dev/null 2>&1; then
    fail "GitHub tag already exists: $tag"
  fi
}

record_file_for_release() {
  local build_dir="$1"
  local release_id="$2"
  local verified_at="$3"
  local record_dir="$ROOT_DIR/deploy/releases"
  local record_file="$record_dir/$release_id.json"

  [[ ! -e "$record_file" ]] || fail "release record already exists: $record_file"
  mkdir -p "$record_dir"
  jq \
    --arg status "verified" \
    --arg verifiedAt "$verified_at" \
    '.status = $status
      | .verifiedAt = $verifiedAt
      | .verification = {
          health: "passed",
          homepageSha256: "passed",
          privatePaths: "passed"
        }' \
    "$build_dir/release.json" >"$record_file"

  printf '%s\n' "$record_file"
}

deploy_release() {
  local ref="${1:-HEAD}"
  local commit
  local release_id
  local tag
  local temporary
  local build_dir
  local previous_target
  local previous_release_id
  local deployed_at
  local expected_index_sha
  local verified_at
  local record_file
  local event

  validate_settings
  require_command curl
  require_command jq
  require_command rsync
  require_command ssh

  commit="$(resolve_commit "$ref")"
  require_github_commit "$commit"
  release_id="$(release_id_for_commit "$commit")"
  tag="web-prod/$release_id"
  ensure_tag_available "$tag"
  validate_release_in_worktree "$commit"

  temporary="$(mktemp -d "${TMPDIR:-/tmp}/knownmap-deploy.XXXXXX")"
  build_dir="$temporary/$release_id"
  trap 'rm -rf "$temporary"' RETURN

  KNOWNMAP_RELEASE_ID="$release_id" build_release "$commit" "$build_dir"
  previous_target="$(current_target)"
  previous_release_id=""
  if [[ -n "$previous_target" ]]; then
    previous_release_id="$(release_id_from_target "$previous_target")"
  fi
  deployed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  jq \
    --arg deployedAt "$deployed_at" \
    --arg previousReleaseId "$previous_release_id" \
    '.status = "deployed"
      | .deployedAt = $deployedAt
      | .previousReleaseId = (if $previousReleaseId == "" then null else $previousReleaseId end)' \
    "$build_dir/release.json" >"$build_dir/release.json.next"
  mv "$build_dir/release.json.next" "$build_dir/release.json"

  ssh -o BatchMode=yes "$SSH_HOST" bash -s -- "$DEPLOY_ROOT" "$release_id" <<'REMOTE'
set -euo pipefail
deploy_root="$1"
release_id="$2"
mkdir -p "$deploy_root/releases"
test ! -e "$deploy_root/releases/$release_id"
test ! -e "$deploy_root/.incoming-$release_id"
mkdir "$deploy_root/.incoming-$release_id"
REMOTE

  rsync -az --delete "$build_dir/" "$SSH_HOST:$DEPLOY_ROOT/.incoming-$release_id/"

  ssh -o BatchMode=yes "$SSH_HOST" bash -s -- "$DEPLOY_ROOT" "$release_id" <<'REMOTE'
set -euo pipefail
deploy_root="$1"
release_id="$2"
incoming="$deploy_root/.incoming-$release_id"
release="$deploy_root/releases/$release_id"
cd "$incoming"
sha256sum -c SHA256SUMS >/dev/null
test -f release.json
test -f public/index.html
find "$incoming" -type d -exec chmod 755 {} +
find "$incoming" -type f -exec chmod 644 {} +
chown -R root:root "$incoming"
mv "$incoming" "$release"
nginx -t >/dev/null
temporary_link="$deploy_root/.current-$release_id"
ln -s "$release/public" "$temporary_link"
mv -Tf "$temporary_link" "$deploy_root/current"
REMOTE

  expected_index_sha="$(shasum -a 256 "$build_dir/public/index.html" | awk '{print $1}')"
  if ! verify_public_site "$release_id" "$expected_index_sha"; then
    if [[ -n "$previous_target" ]]; then
      switch_remote_target "$previous_target" "restore-$release_id"
    fi
    event="$(
      jq -nc \
        --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --arg releaseId "$release_id" \
        --arg gitCommit "$commit" \
        --arg previousReleaseId "$previous_release_id" \
        '{
          timestamp: $timestamp,
          action: "deploy_failed_and_restored",
          releaseId: $releaseId,
          gitCommit: $gitCommit,
          previousReleaseId: $previousReleaseId
        }'
    )"
    append_history "$event"
    fail "public verification failed; restored $previous_release_id"
  fi

  git -C "$ROOT_DIR" tag -a "$tag" "$commit" \
    -m "KnownMap production release $release_id"
  if ! git -C "$ROOT_DIR" push origin "refs/tags/$tag"; then
    git -C "$ROOT_DIR" tag -d "$tag" >/dev/null
    if [[ -n "$previous_target" ]]; then
      switch_remote_target "$previous_target" "restore-tag-$release_id"
    fi
    event="$(
      jq -nc \
        --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --arg releaseId "$release_id" \
        --arg gitCommit "$commit" \
        --arg previousReleaseId "$previous_release_id" \
        '{
          timestamp: $timestamp,
          action: "tag_failed_and_restored",
          releaseId: $releaseId,
          gitCommit: $gitCommit,
          previousReleaseId: $previousReleaseId
        }'
    )"
    append_history "$event"
    fail "GitHub tag push failed; restored $previous_release_id"
  fi

  verified_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  record_file="$(record_file_for_release "$build_dir" "$release_id" "$verified_at")"
  scp -q "$record_file" "$SSH_HOST:$DEPLOY_ROOT/releases/$release_id/release.json"

  event="$(
    jq -nc \
      --arg timestamp "$verified_at" \
      --arg releaseId "$release_id" \
      --arg gitCommit "$commit" \
      --arg gitTag "$tag" \
      --arg previousReleaseId "$previous_release_id" \
      '{
        timestamp: $timestamp,
        action: "deploy",
        releaseId: $releaseId,
        gitCommit: $gitCommit,
        gitTag: $gitTag,
        previousReleaseId: (if $previousReleaseId == "" then null else $previousReleaseId end),
        verification: "passed"
      }'
  )"
  append_history "$event"

  trap - RETURN
  rm -rf "$temporary"
  log "production release succeeded"
  printf 'RELEASE_ID=%s\nGIT_COMMIT=%s\nGIT_TAG=%s\nRECORD_FILE=%s\n' \
    "$release_id" "$commit" "$tag" "$record_file"
}

show_status() {
  validate_settings
  ssh -o BatchMode=yes "$SSH_HOST" bash -s -- "$DEPLOY_ROOT" <<'REMOTE'
set -euo pipefail
deploy_root="$1"
target="$(readlink -f "$deploy_root/current" 2>/dev/null || true)"
if [[ -z "$target" ]]; then
  echo "No active release."
  exit 1
fi
if [[ "$(basename "$target")" == "public" ]]; then
  release_dir="$(dirname "$target")"
else
  release_dir="$target"
fi
echo "Current target: $target"
if [[ -f "$release_dir/release.json" ]]; then
  jq -r '
    "Release ID: \(.releaseId)",
    "Status: \(.status)",
    "Git commit: \(.gitCommit)",
    "Git tag: \(.gitTag)",
    "Deployed at: \(.deployedAt)",
    "Previous release: \(.previousReleaseId // "none")",
    "Site: \(.site)"
  ' "$release_dir/release.json"
else
  echo "Release ID: $(basename "$release_dir")"
  echo "Status: legacy-untracked"
fi
REMOTE
}

list_releases() {
  validate_settings
  ssh -o BatchMode=yes "$SSH_HOST" bash -s -- "$DEPLOY_ROOT" <<'REMOTE'
set -euo pipefail
deploy_root="$1"
active_target="$(readlink -f "$deploy_root/current" 2>/dev/null || true)"
if [[ ! -d "$deploy_root/releases" ]]; then
  echo "No tracked releases."
  exit 0
fi
find "$deploy_root/releases" -mindepth 2 -maxdepth 2 -name release.json -print0 |
  sort -z |
  while IFS= read -r -d '' metadata; do
    release_dir="$(dirname "$metadata")"
    runtime_status="inactive"
    if [[ "$active_target" == "$release_dir/public" ]]; then
      runtime_status="active"
    fi
    jq -r \
      --arg runtime_status "$runtime_status" \
      '[.releaseId, $runtime_status, .gitShortCommit, .deployedAt, (.previousReleaseId // "none")] | @tsv' \
      "$metadata"
  done
REMOTE
}

verify_remote_release() {
  local release_id="${1:-}"

  validate_settings
  [[ "$release_id" =~ ^[A-Za-z0-9._-]+$ ]] || fail "usage: $0 verify <release-id>"

  ssh -o BatchMode=yes "$SSH_HOST" bash -s -- "$DEPLOY_ROOT" "$release_id" <<'REMOTE'
set -euo pipefail
release="$1/releases/$2"
test -d "$release/public"
test -f "$release/release.json"
test -f "$release/SHA256SUMS"
cd "$release"
sha256sum -c SHA256SUMS >/dev/null
jq -e \
  --arg release_id "$2" \
  '.schemaVersion == 1
    and .releaseId == $release_id
    and .environment == "production"
    and (.gitCommit | test("^[0-9a-f]{40}$"))
    and (.files | length > 0)' \
  release.json >/dev/null
printf 'Verified release: %s\nGit commit: %s\nFiles: %s\n' \
  "$2" \
  "$(jq -r .gitCommit release.json)" \
  "$(jq -r '.files | length' release.json)"
REMOTE
}

show_history() {
  validate_settings
  ssh -o BatchMode=yes "$SSH_HOST" bash -s -- "$DEPLOY_ROOT" <<'REMOTE'
set -euo pipefail
history="$1/release-history.jsonl"
if [[ ! -f "$history" ]]; then
  echo "No release history."
  exit 0
fi
tail -n 30 "$history" |
  jq -r '[.timestamp, .action, .releaseId, (.gitCommit[0:12] // "-"), (.previousReleaseId // "none"), (.verification // "-")] | @tsv'
REMOTE
}

rollback_release() {
  local release_id="${1:-}"
  local target
  local previous_target
  local previous_release_id
  local commit
  local expected_index_sha
  local verified_at
  local event

  validate_settings
  [[ "$release_id" =~ ^[A-Za-z0-9._-]+$ ]] || fail "usage: $0 rollback <release-id>"

  target="$DEPLOY_ROOT/releases/$release_id/public"
  previous_target="$(current_target)"
  [[ -n "$previous_target" ]] || fail "there is no active release to roll back from"
  previous_release_id="$(release_id_from_target "$previous_target")"
  [[ "$previous_release_id" != "$release_id" ]] || fail "$release_id is already active"

  verify_remote_release "$release_id"

  commit="$(
    ssh -o BatchMode=yes "$SSH_HOST" \
      "jq -r .gitCommit '$DEPLOY_ROOT/releases/$release_id/release.json'"
  )"
  expected_index_sha="$(
    ssh -o BatchMode=yes "$SSH_HOST" \
      "sha256sum '$target/index.html' | cut -d ' ' -f1"
  )"

  switch_remote_target "$target" "rollback-$release_id"
  if ! verify_public_site "$release_id" "$expected_index_sha"; then
    switch_remote_target "$previous_target" "restore-rollback-$release_id"
    event="$(
      jq -nc \
        --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --arg releaseId "$release_id" \
        --arg gitCommit "$commit" \
        --arg previousReleaseId "$previous_release_id" \
        '{
          timestamp: $timestamp,
          action: "rollback_failed_and_restored",
          releaseId: $releaseId,
          gitCommit: $gitCommit,
          previousReleaseId: $previousReleaseId
        }'
    )"
    append_history "$event"
    fail "rollback verification failed; restored $previous_release_id"
  fi

  verified_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  event="$(
    jq -nc \
      --arg timestamp "$verified_at" \
      --arg releaseId "$release_id" \
      --arg gitCommit "$commit" \
      --arg previousReleaseId "$previous_release_id" \
      '{
        timestamp: $timestamp,
        action: "rollback",
        releaseId: $releaseId,
        gitCommit: $gitCommit,
        previousReleaseId: $previousReleaseId,
        verification: "passed"
      }'
  )"
  append_history "$event"
  log "rolled back from $previous_release_id to $release_id"
}

usage() {
  cat <<'EOF'
Usage:
  tools/web-release.sh build <git-ref> <output-directory>
  tools/web-release.sh deploy [git-ref]
  tools/web-release.sh status
  tools/web-release.sh list
  tools/web-release.sh verify <release-id>
  tools/web-release.sh history
  tools/web-release.sh rollback <release-id>
EOF
}

main() {
  local command="${1:-}"

  case "$command" in
    build)
      [[ $# -eq 3 ]] || fail "usage: $0 build <git-ref> <output-directory>"
      build_release "$2" "$3"
      ;;
    deploy)
      [[ $# -le 2 ]] || fail "usage: $0 deploy [git-ref]"
      deploy_release "${2:-HEAD}"
      ;;
    status)
      [[ $# -eq 1 ]] || fail "usage: $0 status"
      show_status
      ;;
    list)
      [[ $# -eq 1 ]] || fail "usage: $0 list"
      list_releases
      ;;
    verify)
      [[ $# -eq 2 ]] || fail "usage: $0 verify <release-id>"
      verify_remote_release "$2"
      ;;
    history)
      [[ $# -eq 1 ]] || fail "usage: $0 history"
      show_history
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
