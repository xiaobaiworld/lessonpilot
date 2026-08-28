#!/usr/bin/env bash
#
# 本机一键启动 KnownMap 本地开发栈。
#
# 默认（无参数）：启动服务；若已在跑则先停再启（重启）。
#
#   ./dev-up.sh           # 启动 / 重启，终端跟随后端日志
#   ./dev-up.sh --status  # 只查看端口占用
#   ./dev-up.sh --stop    # 只停止并释放端口
#
# 端口约定（与教师/管理端前端一致）：
#   API      127.0.0.1:8000
#   Admin    http://localhost:5173
#   Teacher  http://localhost:5174
#
# 注意：macOS bash 会把「$VAR」后紧跟的全角字符当成变量名一部分。
# 所有展开必须写成 ${VAR}。

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="${ROOT}/v1/backend"
WEB_DIR="${ROOT}/v1"
RUN_DIR="${ROOT}/logs/dev-run"
API_PORT=8000
ADMIN_PORT=5173
TEACHER_PORT=5174

API_PID_FILE="${RUN_DIR}/api.pid"
ADMIN_PID_FILE="${RUN_DIR}/admin.pid"
TEACHER_PID_FILE="${RUN_DIR}/teacher.pid"
ADMIN_LOG="${RUN_DIR}/admin.log"
TEACHER_LOG="${RUN_DIR}/teacher.log"

mkdir -p "${RUN_DIR}"

log() { printf '[dev-up] %s\n' "$*"; }
fail() { printf '[dev-up] ERROR: %s\n' "$*" >&2; exit 1; }

listening_pids() {
  local port="$1"
  lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null | sort -u || true
}

describe_port() {
  local port="$1"
  local lines
  lines="$(lsof -nP -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {printf "    %s pid=%s %s\n", $1, $2, $9}' || true)"
  if [[ -z "${lines}" ]]; then
    printf '  :%-5s 空闲\n' "${port}"
    return
  fi
  printf '  :%-5s 占用\n' "${port}"
  printf '%s\n' "${lines}"
}

free_port() {
  local port="$1"
  local pids
  pids="$(listening_pids "${port}")"
  if [[ -z "${pids}" ]]; then
    log "端口 ${port} 空闲"
    return
  fi
  log "端口 ${port} 被占用，准备释放：$(echo "${pids}" | tr '\n' ' ')"
  while IFS= read -r pid; do
    [[ -z "${pid}" ]] && continue
    kill "${pid}" 2>/dev/null || true
  done <<<"${pids}"
  sleep 0.4
  pids="$(listening_pids "${port}")"
  if [[ -n "${pids}" ]]; then
    log "端口 ${port} 仍被占用，强制 kill -9"
    while IFS= read -r pid; do
      [[ -z "${pid}" ]] && continue
      kill -9 "${pid}" 2>/dev/null || true
    done <<<"${pids}"
    sleep 0.2
  fi
  if [[ -n "$(listening_pids "${port}")" ]]; then
    fail "无法释放端口 ${port}"
  fi
  log "端口 ${port} 已释放"
}

kill_pidfile() {
  local file="$1"
  local label="$2"
  if [[ ! -f "${file}" ]]; then
    return
  fi
  local pid
  pid="$(cat "${file}" 2>/dev/null || true)"
  rm -f "${file}"
  if [[ -z "${pid:-}" ]]; then
    return
  fi
  if kill -0 "${pid}" 2>/dev/null; then
    log "停止上次记录的 ${label} (pid ${pid})"
    kill "${pid}" 2>/dev/null || true
    sleep 0.2
    kill -0 "${pid}" 2>/dev/null && kill -9 "${pid}" 2>/dev/null || true
  fi
}

stop_all() {
  log "停止本机开发进程"
  kill_pidfile "${ADMIN_PID_FILE}" "admin"
  kill_pidfile "${TEACHER_PID_FILE}" "teacher"
  kill_pidfile "${API_PID_FILE}" "api"
  free_port "${ADMIN_PORT}"
  free_port "${TEACHER_PORT}"
  free_port "${API_PORT}"
}

show_status() {
  log "本机端口状态"
  describe_port "${API_PORT}"
  describe_port "${ADMIN_PORT}"
  describe_port "${TEACHER_PORT}"
}

require_tools() {
  command -v lsof >/dev/null || fail "需要 lsof"
  command -v curl >/dev/null || fail "需要 curl"
  command -v npm >/dev/null || fail "需要 npm"
  command -v uv >/dev/null || fail "需要 uv（后端）"
  [[ -d "${BACKEND_DIR}" ]] || fail "找不到后端目录：${BACKEND_DIR}"
  [[ -d "${WEB_DIR}" ]] || fail "找不到前端目录：${WEB_DIR}"
  [[ -f "${BACKEND_DIR}/.env" ]] || fail "缺少 ${BACKEND_DIR}/.env（可从 .env.example 复制）"
  [[ -d "${WEB_DIR}/node_modules" ]] || fail "前端依赖未安装：cd v1 && npm ci"
}

start_frontends() {
  log "启动管理端 :${ADMIN_PORT}"
  (
    cd "${WEB_DIR}"
    npm run dev:admin
  ) >"${ADMIN_LOG}" 2>&1 &
  echo $! >"${ADMIN_PID_FILE}"

  log "启动教师端 :${TEACHER_PORT}"
  (
    cd "${WEB_DIR}"
    npm run dev:teacher
  ) >"${TEACHER_LOG}" 2>&1 &
  echo $! >"${TEACHER_PID_FILE}"
}

migrate_database() {
  log "执行数据库迁移"
  (
    cd "${BACKEND_DIR}"
    uv run alembic upgrade head
  )
  log "数据库已升级到最新版本"
}

wait_http() {
  local url="$1"
  local name="$2"
  local log_file="${3:-}"
  # Vite 默认只绑 localhost（常为 ::1），用 127.0.0.1 会一直连不上。
  local tries=80
  local i code
  for ((i = 1; i <= tries; i++)); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 1 "${url}" || true)"
    if [[ "${code}" =~ ^[1235][0-9][0-9]$ ]]; then
      log "${name} 就绪：${url} (HTTP ${code})"
      return 0
    fi
    sleep 0.25
  done
  if [[ -n "${log_file}" && -f "${log_file}" ]]; then
    log "${name} 最近日志（${log_file}）："
    tail -n 40 "${log_file}" >&2 || true
  fi
  fail "${name} 启动超时：${url}"
}

cleanup_on_exit() {
  local code=$?
  trap - EXIT INT TERM
  log "收到退出信号，清理子进程"
  stop_all
  exit "${code}"
}

any_service_running() {
  [[ -n "$(listening_pids "${API_PORT}")" ]] \
    || [[ -n "$(listening_pids "${ADMIN_PORT}")" ]] \
    || [[ -n "$(listening_pids "${TEACHER_PORT}")" ]]
}

start_all() {
  require_tools
  show_status
  if any_service_running; then
    log "检测到本地服务已在运行 → 先停止再重启"
  else
    log "本地服务未运行 → 开始启动"
  fi
  stop_all
  migrate_database
  start_frontends

  log "启动后端 :${API_PORT}（日志输出到本终端）"
  log "管理端日志：${ADMIN_LOG}"
  log "教师端日志：${TEACHER_LOG}"
  log "地址："
  log "  Admin    http://localhost:${ADMIN_PORT}"
  log "  Teacher  http://localhost:${TEACHER_PORT}"
  log "  API      http://127.0.0.1:${API_PORT}/health"
  log "Ctrl+C 会停止全部本地服务"
  echo

  trap cleanup_on_exit EXIT INT TERM

  (
    cd "${BACKEND_DIR}"
    uv run uvicorn app.main:app --reload --host 127.0.0.1 --port "${API_PORT}"
  ) &
  local api_pid=$!
  echo "${api_pid}" >"${API_PID_FILE}"

  wait_http "http://127.0.0.1:${API_PORT}/health" "后端"
  # 前端必须用 localhost：Vite 默认不监听 127.0.0.1
  wait_http "http://localhost:${ADMIN_PORT}/" "管理端" "${ADMIN_LOG}"
  wait_http "http://localhost:${TEACHER_PORT}/" "教师端" "${TEACHER_LOG}"

  log "全部就绪。以下为后端日志："
  echo "------------------------------------------------------------"
  wait "${api_pid}"
}

usage() {
  cat <<'EOF'
用法: ./dev-up.sh [--status|--stop|--help]

  （默认）    启动本地服务；若已启动则先停再启（重启）。
              后端日志打印在当前终端，前端日志写入 logs/dev-run/
  --status    查看端口占用
  --stop      停止服务并释放端口
  --help      显示帮助
EOF
}

case "${1:-}" in
  "" )
    start_all
    ;;
  --status | status )
    show_status
    ;;
  --stop | stop )
    stop_all
    log "已停止"
    ;;
  --help | -h | help )
    usage
    ;;
  * )
    usage >&2
    fail "未知参数：$1"
    ;;
esac
