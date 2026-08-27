#!/usr/bin/env bash
#
# 本机 ↔ 服务器 测试数据同步（整包覆盖，求两边完全一致）。
#
# 范围仅两项：
#   1. SQLite 数据库
#   2. 媒体资源目录（图片 / 音频 / 视频等）
#
# 用法：
#   tools/sync-data.sh               # 弹出菜单选择方向
#   tools/sync-data.sh push          # 本地 → 服务器（覆盖服务器）
#   tools/sync-data.sh pull          # 服务器 → 本地（覆盖本地）
#   tools/sync-data.sh push --yes    # 跳过确认
#   tools/sync-data.sh pull --yes
#
# 环境变量（可选）：
#   KNOWNMAP_SSH_HOST   SSH 别名，默认 aliyun-us
#   KNOWNMAP_DATA_ROOT  服务器数据根，默认 /var/lib/knownmap
#
# 注意：macOS bash 会把「$VAR」后紧跟的全角字符当成变量名一部分，展开一律用 ${VAR}。

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="${ROOT}/v1/backend"
LOCAL_DB="${BACKEND_DIR}/knownmap-v1.db"
LOCAL_ASSETS="${BACKEND_DIR}/asset-storage"
BACKUP_DIR="${ROOT}/logs/sync-backup"

SSH_HOST="${KNOWNMAP_SSH_HOST:-aliyun-us}"
DATA_ROOT="${KNOWNMAP_DATA_ROOT:-/var/lib/knownmap}"
REMOTE_DB="${DATA_ROOT}/knownmap.db"
REMOTE_ASSETS="${DATA_ROOT}/asset-storage"
REMOTE_SERVICE="knownmap-teacher-api.service"
ASSUME_YES=0

log() { printf '[sync-data] %s\n' "$*"; }
fail() { printf '[sync-data] ERROR: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
用法: tools/sync-data.sh [push|pull] [--yes]

  （无参数）  显示菜单后选择同步方向
  push        从本地往服务器同步（覆盖服务器）
  pull        从服务器往本地同步（覆盖本地）
  --yes       跳过二次确认

环境变量:
  KNOWNMAP_SSH_HOST    默认 aliyun-us
  KNOWNMAP_DATA_ROOT   默认 /var/lib/knownmap
EOF
}

show_menu() {
  cat <<EOF

KnownMap 测试数据同步
  SSH: ${SSH_HOST}
  本地库: ${LOCAL_DB}
  服务器库: ${REMOTE_DB}
  本地媒体: ${LOCAL_ASSETS}/
  服务器媒体: ${REMOTE_ASSETS}/

  1) 从本地往服务器同步（覆盖服务器）
  2) 从服务器往本地同步（覆盖本地）
  0) 取消

EOF
  local choice
  printf '请选择 [1/2/0]: '
  read -r choice
  case "${choice}" in
    1 ) MODE=push ;;
    2 ) MODE=pull ;;
    0 | "" ) fail "已取消" ;;
    * ) fail "无效选项: ${choice}" ;;
  esac
}

ssh_run() {
  ssh -o BatchMode=yes -o ConnectTimeout=15 "${SSH_HOST}" "$@"
}

require_tools() {
  command -v ssh >/dev/null || fail "need ssh"
  command -v scp >/dev/null || fail "need scp"
  command -v rsync >/dev/null || fail "need rsync"
  command -v sqlite3 >/dev/null || fail "need sqlite3"
  [[ "${SSH_HOST}" =~ ^[A-Za-z0-9._@-]+$ ]] || fail "unsafe SSH host: ${SSH_HOST}"
  if ! ssh_run true >/dev/null 2>&1; then
    fail "cannot connect to '${SSH_HOST}'; set KNOWNMAP_SSH_HOST"
  fi
}

confirm() {
  local prompt="$1"
  if [[ "${ASSUME_YES}" == 1 ]]; then
    return 0
  fi
  printf '%s [y/N] ' "${prompt}"
  local answer
  read -r answer
  [[ "${answer}" == "y" || "${answer}" == "Y" || "${answer}" == "yes" ]] || fail "cancelled"
}

stamp() {
  date -u +%Y%m%dT%H%M%SZ
}

local_api_busy() {
  lsof -nP -iTCP:8000 -sTCP:LISTEN -t >/dev/null 2>&1
}

remote_stop() {
  log "stopping remote ${REMOTE_SERVICE}"
  ssh_run "sudo systemctl stop ${REMOTE_SERVICE}"
}

remote_start() {
  log "starting remote ${REMOTE_SERVICE}"
  ssh_run "sudo systemctl start ${REMOTE_SERVICE}"
  local i code
  for ((i = 1; i <= 40; i++)); do
    code="$(ssh_run 'curl -s -o /dev/null -w %{http_code} --connect-timeout 1 http://127.0.0.1:8000/health' || true)"
    if [[ "${code}" == "200" ]]; then
      log "remote API healthy"
      return 0
    fi
    sleep 0.25
  done
  fail "remote API did not become healthy after restart"
}

remote_backup_db() {
  local ts
  ts="$(stamp)"
  ssh_run "sudo mkdir -p /var/backups/knownmap && if [[ -f '${REMOTE_DB}' ]]; then sudo cp -a '${REMOTE_DB}' '/var/backups/knownmap/knownmap-sync-${ts}.db'; fi"
  log "remote db backup (if existed): /var/backups/knownmap/knownmap-sync-${ts}.db"
}

local_backup_db() {
  mkdir -p "${BACKUP_DIR}"
  if [[ -f "${LOCAL_DB}" ]]; then
    local dest="${BACKUP_DIR}/knownmap-v1-$(stamp).db"
    cp -a "${LOCAL_DB}" "${dest}"
    log "local db backup: ${dest}"
  fi
}

ensure_local_assets_dir() {
  mkdir -p "${LOCAL_ASSETS}"
}

# 用 sqlite3 .backup 生成一致快照，避免拷正在写入的库。
snapshot_sqlite() {
  local src="$1"
  local dest="$2"
  [[ -f "${src}" ]] || fail "sqlite missing: ${src}"
  rm -f "${dest}"
  sqlite3 "${src}" ".backup '${dest}'"
}

push_to_server() {
  require_tools
  [[ -f "${LOCAL_DB}" ]] || fail "local db missing: ${LOCAL_DB}"
  ensure_local_assets_dir

  log "direction: local -> server (${SSH_HOST})"
  log "  db     ${LOCAL_DB}  ->  ${REMOTE_DB}"
  log "  assets ${LOCAL_ASSETS}/  ->  ${REMOTE_ASSETS}/"
  confirm "Overwrite SERVER db + assets with LOCAL copies?"

  local tmp_db
  tmp_db="$(mktemp "${TMPDIR:-/tmp}/knownmap-sync-XXXXXX.db")"
  trap 'rm -f "${tmp_db}"' RETURN
  log "snapshotting local sqlite"
  snapshot_sqlite "${LOCAL_DB}" "${tmp_db}"

  remote_stop
  remote_backup_db

  log "uploading database"
  ssh_run "sudo mkdir -p '${DATA_ROOT}' '${REMOTE_ASSETS}' /var/backups/knownmap"
  scp -q "${tmp_db}" "${SSH_HOST}:/tmp/knownmap-sync-incoming.db"
  ssh_run "sudo mv /tmp/knownmap-sync-incoming.db '${REMOTE_DB}' && sudo chown knownmap:knownmap '${REMOTE_DB}' && sudo chmod 660 '${REMOTE_DB}'"

  log "syncing assets (rsync --delete)"
  # 先同步到临时目录再原子替换，避免半截状态；媒体目录用 rsync 直接覆盖即可。
  rsync -az --delete \
    -e "ssh -o BatchMode=yes" \
    --rsync-path="sudo rsync" \
    "${LOCAL_ASSETS}/" \
    "${SSH_HOST}:${REMOTE_ASSETS}/"
  ssh_run "sudo chown -R knownmap:knownmap '${REMOTE_ASSETS}' && sudo find '${REMOTE_ASSETS}' -type d -exec chmod 750 {} + && sudo find '${REMOTE_ASSETS}' -type f -exec chmod 640 {} + || true"

  # 生产 systemd 只允许写 /var/lib/knownmap；确保 env 指向此处，否则服务仍读发布目录下的相对路径。
  ssh_run "sudo grep -q '^ASSET_STORAGE_DIR=' /etc/knownmap/teacher-platform.env 2>/dev/null || echo 'ASSET_STORAGE_DIR=${REMOTE_ASSETS}' | sudo tee -a /etc/knownmap/teacher-platform.env >/dev/null; sudo sed -i 's|^ASSET_STORAGE_DIR=.*|ASSET_STORAGE_DIR=${REMOTE_ASSETS}|' /etc/knownmap/teacher-platform.env"

  remote_start
  log "push complete"
}

pull_from_server() {
  require_tools
  ensure_local_assets_dir

  if local_api_busy; then
    fail "local API is listening on :8000; stop it first (./dev-up.sh --stop) then pull"
  fi

  log "direction: server -> local (${SSH_HOST})"
  log "  db     ${REMOTE_DB}  ->  ${LOCAL_DB}"
  log "  assets ${REMOTE_ASSETS}/  ->  ${LOCAL_ASSETS}/"
  confirm "Overwrite LOCAL db + assets with SERVER copies?"

  remote_stop
  local_backup_db

  local tmp_remote
  tmp_remote="$(mktemp "${TMPDIR:-/tmp}/knownmap-sync-XXXXXX.db")"
  trap 'rm -f "${tmp_remote}"' RETURN

  log "copying remote sqlite (API stopped)"
  ssh_run "sudo test -f '${REMOTE_DB}'"
  ssh_run "sudo cp -a '${REMOTE_DB}' /tmp/knownmap-sync-outgoing.db && sudo chmod 644 /tmp/knownmap-sync-outgoing.db"
  scp -q "${SSH_HOST}:/tmp/knownmap-sync-outgoing.db" "${tmp_remote}"
  ssh_run "sudo rm -f /tmp/knownmap-sync-outgoing.db"
  mv "${tmp_remote}" "${LOCAL_DB}"
  trap - RETURN

  log "syncing assets (rsync --delete)"
  ssh_run "sudo mkdir -p '${REMOTE_ASSETS}'"
  rsync -az --delete \
    -e "ssh -o BatchMode=yes" \
    --rsync-path="sudo rsync" \
    "${SSH_HOST}:${REMOTE_ASSETS}/" \
    "${LOCAL_ASSETS}/"

  remote_start
  log "pull complete"
  log "restart local stack when ready: ./dev-up.sh"
}

MODE="${1:-}"
if [[ $# -gt 0 ]]; then
  shift
fi
while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes | -y ) ASSUME_YES=1 ;;
    --help | -h ) usage; exit 0 ;;
    * ) usage >&2; fail "未知参数: $1" ;;
  esac
  shift
done

case "${MODE}" in
  "" )
    show_menu
    ;;
  push | pull ) ;;
  --help | -h | help )
    usage
    exit 0
    ;;
  * )
    usage >&2
    fail "未知模式: ${MODE}"
    ;;
esac

case "${MODE}" in
  push ) push_to_server ;;
  pull ) pull_from_server ;;
  * ) fail "内部错误: 未选择同步方向" ;;
esac
