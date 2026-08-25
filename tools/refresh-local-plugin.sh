#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${KNOWNMAP_LOCAL_PLUGIN_DIR:-/Users/bai/Downloads/knownmapplugin (1)}"
DIST_DIR="$ROOT_DIR/v1/extension/dist/production"

fail() {
  printf '[refresh-local-plugin] ERROR: %s\n' "$*" >&2
  exit 1
}

command -v npm >/dev/null 2>&1 || fail "missing required command: npm"
command -v rsync >/dev/null 2>&1 || fail "missing required command: rsync"
command -v jq >/dev/null 2>&1 || fail "missing required command: jq"
[[ -d "$TARGET_DIR" ]] || fail "local plugin directory does not exist: $TARGET_DIR"

(
  cd "$ROOT_DIR/v1"
  KNOWNMAP_TARGET=production npm run build --workspace @v1/extension --silent
)

# The test directory must be an exact copy of the current production artifact.
# --delete removes legacy files that are not referenced by the new manifest.
rsync -a --delete --exclude 'LOCAL_TESTING.md' "$DIST_DIR/" "$TARGET_DIR/"
cp "$ROOT_DIR/docs/LOCAL_PLUGIN_REFRESH.md" "$TARGET_DIR/LOCAL_TESTING.md"

jq -e '
  .version
  and .action.default_popup == "popup/index.html"
  and .content_scripts[0].js == ["content/index.js"]
' "$TARGET_DIR/manifest.json" >/dev/null ||
  fail "synced plugin manifest is not a V1 production manifest"

printf 'LOCAL_PLUGIN_DIR=%s\nVERSION=%s\n' \
  "$TARGET_DIR" \
  "$(jq -r .version "$TARGET_DIR/manifest.json")"
