#!/usr/bin/env bash
#
# 切换前生产预检（只读）。
#
# 回答一个问题：现在执行 v1 切换，会不会失败或把站点弄挂。
#
# 不改动生产任何状态，不打印任何密钥值——只报告规则是否满足。
#
#   KNOWNMAP_SSH_HOST=<别名> tools/preflight-check.sh
#
# 全部通过不代表可以切换：切换需要人明确决定，这个脚本只排除已知的失败方式。

set -euo pipefail

SSH_HOST="${KNOWNMAP_SSH_HOST:-aliyun}"
SITE_URL="${KNOWNMAP_SITE_URL:-https://knownmap.com}"

fail() {
  printf '[preflight] ERROR: %s\n' "$*" >&2
  exit 1
}

[[ "$SSH_HOST" =~ ^[A-Za-z0-9._@-]+$ ]] || fail "unsafe SSH host: $SSH_HOST"

if ! ssh -o BatchMode=yes -o ConnectTimeout=10 "$SSH_HOST" true 2>/dev/null; then
  fail "连不上 '$SSH_HOST'；设置 KNOWNMAP_SSH_HOST 为 ~/.ssh/config 里的别名"
fi

echo "生产预检：$SSH_HOST"
echo

# shellcheck disable=SC2029  # SITE_URL 有意在本地展开
ssh -o BatchMode=yes "$SSH_HOST" "SITE_URL='$SITE_URL' bash -s" <<'REMOTE'
set -uo pipefail
problems=0
note() { printf '  %s %s\n' "$1" "$2"; }

echo "[1/5] 后端服务"
if systemctl is-active --quiet knownmap-teacher-api.service; then
  note "✓" "knownmap-teacher-api.service 运行中"
else
  note "✗" "后端服务未运行"; problems=$((problems+1))
fi
code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/health || echo 000)
[ "$code" = "200" ] && note "✓" "/health $code" || { note "✗" "/health $code"; problems=$((problems+1)); }

echo
echo "[2/5] 环境配置能否通过 6C 启动校验"
# 新校验会拒绝占位符密钥、短密钥、本机 CORS、DEBUG 日志、内存库。
# 不满足时部署后服务起不来，所以必须在切换前查。
python3 - <<'PY'
import os, re, subprocess, sys

path = None
for p in ('/etc/knownmap/teacher-platform.env', '/etc/knownmap/knownmap.env'):
    if os.path.isfile(p):
        path = p; break
if not path:
    out = subprocess.run(['systemctl', 'cat', 'knownmap-teacher-api.service'],
                         capture_output=True, text=True).stdout
    m = re.search(r'EnvironmentFile=-?(\S+)', out)
    path = m.group(1) if m else None

if not path or not os.path.isfile(path):
    print('  ✗ 找不到环境文件，无法核对'); sys.exit(1)

env = {}
for line in open(path):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip().strip('"').strip("'")

PLACEHOLDERS = {'replace-with-a-random-secret', 'change-me', 'changeme',
                'secret', 'your-secret-here'}
problems = []

# 只报告长度与是否占位符，从不输出取值
for name in ('SESSION_SECRET', 'ACCESS_CODE_SECRET'):
    v = env.get(name)
    if not v:
        problems.append(f'{name} 未设置')
    elif v in PLACEHOLDERS:
        problems.append(f'{name} 是占位符')
    elif len(v) < 32:
        problems.append(f'{name} 长度 {len(v)} < 32')
    else:
        print(f'  ✓ {name} 已设置（{len(v)} 字符，非占位符）')

cors = [o.strip() for o in env.get('CORS_ORIGINS', '').split(',') if o.strip()]
local = [o for o in cors
         if any(m in o.lower() for m in ('localhost', '127.0.0.1', '0.0.0.0', '[::1]'))]
if not cors:
    problems.append('CORS_ORIGINS 为空')
elif local:
    problems.append(f'CORS 含本机来源：{", ".join(local)}')
else:
    print(f'  ✓ CORS_ORIGINS {len(cors)} 个来源，均非本机')

app_env = env.get('APP_ENV', 'development')
level = env.get('LOG_LEVEL', '')
effective = level.upper() if level else ('DEBUG' if app_env in ('development', 'test') else 'INFO')
if app_env == 'production' and effective == 'DEBUG':
    problems.append('生产日志级别为 DEBUG')
else:
    print(f'  ✓ APP_ENV={app_env}，日志 {effective}')

if 'memory' in env.get('DATABASE_URL', ''):
    problems.append('数据库为内存库')
else:
    print('  ✓ 数据库为文件库')

for p in problems:
    print(f'  ✗ {p}')
sys.exit(1 if problems else 0)
PY
[ $? -ne 0 ] && problems=$((problems+1))

echo
echo "[3/5] 目录请求能否解析到 index.html"
# /admin/ 与 /teacher/ 是目录。nginx 若不解析目录索引，切换后两个应用都是 404。
probe=/var/www/knownmap/current/__preflight__
mkdir -p "$probe" && printf 'ok' > "$probe/index.html"
code=$(curl -s -o /tmp/.preflight -w '%{http_code}' "$SITE_URL/__preflight__/" || echo 000)
body=$(cat /tmp/.preflight 2>/dev/null || true)
rm -rf "$probe" /tmp/.preflight
if [ "$code" = "200" ] && [ "$body" = "ok" ]; then
  note "✓" "目录请求解析正常（GET /__preflight__/ → 200）"
else
  note "✗" "目录请求返回 $code，切换后 /admin/ 与 /teacher/ 会 404"
  problems=$((problems+1))
fi

echo
echo "[4/5] 目标路径未被占用"
for d in admin teacher; do
  if [ -e "/var/www/knownmap/current/$d" ]; then
    note "!" "$d/ 已存在（切换会覆盖）"
  else
    note "✓" "$d/ 空闲"
  fi
done

echo
echo "[5/5] 备份"
count=$(ls -1 /var/backups/knownmap/*.db 2>/dev/null | wc -l | tr -d ' ')
[ "$count" -gt 0 ] && note "✓" "$count 份备份" \
  || { note "✗" "没有备份，切换前应先备份"; problems=$((problems+1)); }
systemctl is-active --quiet knownmap-backup.timer \
  && note "✓" "备份定时器运行中" \
  || { note "✗" "备份定时器未运行"; problems=$((problems+1)); }

echo
if [ "$problems" -eq 0 ]; then
  echo "预检通过：未发现会导致切换失败的问题。"
  echo "这不代表应当切换——切换需要人明确决定。"
else
  echo "发现 $problems 项问题，修复后再切换。"
  exit 1
fi
REMOTE
