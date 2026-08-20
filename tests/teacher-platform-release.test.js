// 定位: 验证教师平台生产部署的服务、反代、数据目录和发布记录约束。
// 入口参数: deploy/teacher-platform/ 下的静态配置和 tools/teacher-platform-release.sh。
// 返回参数: Node test 通过/失败结果。
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const releaseScript = path.join(root, 'tools/teacher-platform-release.sh');
const serviceFile = path.join(root, 'deploy/teacher-platform/knownmap-teacher-api.service');
const nginxFile = path.join(root, 'deploy/teacher-platform/knownmap-nginx.conf');

function run(command, args) {
  return childProcess.spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8'
  });
}

test('teacher platform release orchestration has valid shell syntax and traceability guards', () => {
  const syntax = run('bash', ['-n', releaseScript]);
  assert.equal(syntax.status, 0, syntax.stderr);

  const source = fs.readFileSync(releaseScript, 'utf8');
  for (const marker of [
    'git -C "$ROOT_DIR" archive',
    'git -C "$ROOT_DIR" fetch origin --prune',
    'node --test tests/*.test.js',
    'uv run pytest -q',
    'alembic',
    'SEED_TEACHER_LOGIN_NAME',
    'backend-release.json',
    'systemctl enable',
    'KNOWNMAP_PUBLISH_PROFILE=teacher-platform-v1',
    'web-prod/$release_id',
    'chown knownmap:knownmap "/$database_path"',
    'verification.apiHealth',
    'TEACHER_PASSWORD='
  ]) {
    assert.ok(source.includes(marker), `missing ${marker}`);
  }
});

test('teacher API service runs privately with persistent database access', () => {
  const service = fs.readFileSync(serviceFile, 'utf8');

  assert.match(service, /User=knownmap/);
  assert.match(service, /Group=knownmap/);
  assert.match(service, /WorkingDirectory=\/opt\/knownmap\/current\/backend/);
  assert.match(service, /EnvironmentFile=\/etc\/knownmap\/teacher-platform\.env/);
  assert.match(service, /--host 127\.0\.0\.1 --port 8000/);
  assert.match(service, /ProtectSystem=strict/);
  assert.match(service, /ReadWritePaths=\/var\/lib\/knownmap/);
});

test('nginx exposes the same-origin API and keeps the site root static', () => {
  const nginx = fs.readFileSync(nginxFile, 'utf8');

  assert.match(nginx, /root \/var\/www\/knownmap\/current/);
  assert.match(nginx, /location = \/health \{/);
  assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:8000\/health;/);
  assert.match(nginx, /location \^~ \/api\/ \{/);
  assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:8000;/);
  assert.match(nginx, /proxy_set_header X-Forwarded-Proto \$scheme;/);
  assert.match(nginx, /location \/ \{\s+try_files \$uri \$uri\/ =404;/);
  assert.match(nginx, /ssl_certificate \/etc\/letsencrypt\/live\/knownmap\.com\/fullchain\.pem/);
});
