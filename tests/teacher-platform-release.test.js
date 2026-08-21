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
const backupScript = path.join(root, 'deploy/teacher-platform/knownmap-backup.py');
const backupService = path.join(root, 'deploy/teacher-platform/knownmap-backup.service');
const backupTimer = path.join(root, 'deploy/teacher-platform/knownmap-backup.timer');
const testWorkflow = path.join(root, '.github/workflows/test.yml');
const pagesWorkflow = path.join(root, '.github/workflows/pages.yml');
const dependabotFile = path.join(root, '.github/dependabot.yml');
const editorFile = path.join(root, 'teacher-web/editor.html');

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
    'verification.apiHealth'
  ]) {
    assert.ok(source.includes(marker), `missing ${marker}`);
  }
});

test('teacher platform release never prints or implicitly rotates production credentials', () => {
  const source = fs.readFileSync(releaseScript, 'utf8');

  assert.doesNotMatch(source, /TEACHER_PASSWORD=%s/);
  assert.doesNotMatch(
    source,
    /KNOWNMAP_PRODUCTION_TEACHER_PASSWORD:-\$\(openssl rand/
  );
  assert.match(source, /seed_password="\$\{KNOWNMAP_PRODUCTION_TEACHER_PASSWORD:-\}"/);
  assert.match(source, /local seed_password_file="-"/);
  assert.match(source, /seed_password_file/);
  assert.match(source, /install -m 600 \/dev\/null "\$seed_password_file"/);
  assert.match(source, /CREDENTIAL_ROTATION=/);
});

test('first administrator bootstrap is guarded, one-time, and non-persistent', () => {
  const source = fs.readFileSync(releaseScript, 'utf8');
  const envTemplate = source.match(/cat >"\$env_tmp" <<ENV\n([\s\S]*?)\nENV/);

  assert.ok(envTemplate, 'persistent environment template must be detectable');
  assert.doesNotMatch(envTemplate[1], /SEED_ADMIN|KNOWNMAP_PRODUCTION_ADMIN_PASSWORD/);
  assert.match(source, /KNOWNMAP_PRODUCTION_ADMIN_PASSWORD/);
  assert.match(source, /openssl rand -hex 18/);
  assert.match(source, /local admin_password_file/);
  assert.match(source, /install -m 600 \/dev\/null "\$admin_password_file"/);
  assert.match(source, /select\(func\.count\(\)\)\.select_from\(Admin\)/);
  assert.match(source, /SEED_ADMIN_LOGIN_NAME=admin/);
  assert.match(source, /SEED_ADMIN_PASSWORD="\$admin_password"/);
  assert.match(source, /python" -m app\.seed admin/);
  assert.match(source, /rm -f "\$admin_password_file"/);
  assert.match(source, /ADMIN_BOOTSTRAP=/);
  assert.match(source, /ADMIN_INITIAL_PASSWORD=%s/);
});

test('production verification checks protected administrator endpoints', () => {
  const source = fs.readFileSync(releaseScript, 'utf8');

  assert.match(source, /SITE_URL\/api\/v1\/admin\/auth\/me/);
  assert.match(source, /SITE_URL\/api\/v1\/admin\/teachers/);
  assert.match(source, /\[\[ "\$status" == "401" \]\]/);
});

test('backend deploy uses a checksum-pinned uv and a frozen per-release environment', () => {
  const source = fs.readFileSync(releaseScript, 'utf8');

  assert.doesNotMatch(source, /astral\.sh\/uv\/install\.sh/);
  assert.match(source, /UV_VERSION="0\.11\.12"/);
  assert.match(
    source,
    /UV_SHA256="9acdecddacba550ee616c02bb4616d894352022550c5977524556fd5077ce1d4"/
  );
  assert.match(source, /sha256sum -c/);
  assert.match(source, /UV_PROJECT_ENVIRONMENT="\$release\/backend\/\.venv"/);
  assert.match(source, /sync --frozen --no-dev/);
  assert.match(source, /test -x "\$app_root\/current\/backend\/\.venv\/bin\/uvicorn"/);
  assert.match(
    source,
    /ln -s "\$app_root\/venv" "\$previous_target\/backend\/\.venv"/
  );
  assert.match(
    source,
    /ln -s "\$app_root\/venv" "\$target\/backend\/\.venv"/
  );
});

test('production release accepts only an explicit remote branch with successful CI', () => {
  const source = fs.readFileSync(releaseScript, 'utf8');

  assert.match(
    source,
    /ALLOWED_REMOTE_BRANCH="\$\{KNOWNMAP_ALLOWED_REMOTE_BRANCH:-origin\/main\}"/
  );
  assert.match(source, /git -C "\$ROOT_DIR" merge-base --is-ancestor/);
  assert.match(source, /repos\/\$REPOSITORY\/commits\/\$commit\/check-runs/);
  assert.match(source, /required_checks=\("node-test" "backend-test"\)/);
  assert.match(source, /conclusion.*success/);
});

test('release packages deployment configuration from the exact target commit', () => {
  const source = fs.readFileSync(releaseScript, 'utf8');

  assert.match(
    source,
    /git -C "\$ROOT_DIR" archive "\$commit" -- backend deploy\/teacher-platform/
  );
  assert.match(
    source,
    /install_systemd_service\s+\\?\s*"\$backend_build\/deploy\/teacher-platform\/knownmap-teacher-api\.service"/
  );
  assert.match(
    source,
    /configure_nginx\s+\\?\s*"\$backend_build\/deploy\/teacher-platform\/knownmap-nginx\.conf"/
  );
});

test('teacher API service runs privately with persistent database access', () => {
  const service = fs.readFileSync(serviceFile, 'utf8');

  assert.match(service, /User=knownmap/);
  assert.match(service, /Group=knownmap/);
  assert.match(service, /WorkingDirectory=\/opt\/knownmap\/current\/backend/);
  assert.match(service, /EnvironmentFile=\/etc\/knownmap\/teacher-platform\.env/);
  assert.match(
    service,
    /ExecStart=\/opt\/knownmap\/current\/backend\/\.venv\/bin\/uvicorn/
  );
  assert.match(service, /--host 127\.0\.0\.1 --port 8000/);
  assert.match(service, /ProtectSystem=strict/);
  assert.match(service, /ReadWritePaths=\/var\/lib\/knownmap/);
  assert.match(service, /^CapabilityBoundingSet=$/m);
  assert.match(service, /PrivateDevices=true/);
  assert.match(service, /ProtectKernelTunables=true/);
  assert.match(service, /RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6/);
});

test('nginx exposes the same-origin API and keeps the site root static', () => {
  const nginx = fs.readFileSync(nginxFile, 'utf8');

  assert.match(nginx, /limit_req_zone \$binary_remote_addr zone=knownmap_login:/);
  assert.match(nginx, /limit_req_status 429/);
  assert.match(nginx, /root \/var\/www\/knownmap\/current/);
  assert.match(nginx, /Strict-Transport-Security/);
  assert.match(nginx, /Content-Security-Policy/);
  assert.match(nginx, /frame-ancestors 'none'/);
  assert.match(nginx, /frame-src https:\/\/player\.bilibili\.com/);
  assert.match(nginx, /X-Frame-Options "DENY"/);
  assert.match(nginx, /Permissions-Policy/);
  assert.match(nginx, /location = \/health \{/);
  assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:8000\/health;/);
  assert.match(nginx, /location = \/api\/v1\/auth\/login \{/);
  assert.match(nginx, /location = \/api\/v1\/admin\/auth\/login \{/);
  assert.equal(
    (nginx.match(/limit_req zone=knownmap_login burst=5 nodelay;/g) || []).length,
    2
  );
  assert.match(nginx, /limit_req zone=knownmap_login burst=5 nodelay;/);
  assert.match(nginx, /location \^~ \/api\/ \{/);
  assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:8000;/);
  assert.match(nginx, /proxy_set_header X-Forwarded-Proto \$scheme;/);
  assert.match(nginx, /location = \/downloads\/student-plugin\/knownmapplugin\.zip/);
  assert.match(nginx, /downloads\/student-plugin\/knownmapplugin\.zip/);
  assert.match(nginx, /location \/ \{\s+try_files \$uri \$uri\/ =404;/);
  assert.match(nginx, /ssl_certificate \/etc\/letsencrypt\/live\/knownmap\.com\/fullchain\.pem/);
});

test('nginx deployment restores the previous file when validation fails', () => {
  const source = fs.readFileSync(releaseScript, 'utf8');

  assert.match(source, /knownmap\.next/);
  assert.match(source, /knownmap\.previous/);
  assert.match(source, /if ! nginx -t/);
  assert.match(source, /mv -f "\$previous" "\$target"/);
});

test('teacher login does not publish the production account name', () => {
  const editor = fs.readFileSync(editorFile, 'utf8');

  assert.doesNotMatch(editor, /value="teacher-test-01"/);
  assert.match(editor, /autocomplete="username"/);
});

test('production database backup is isolated, scheduled and retained', () => {
  const script = fs.readFileSync(backupScript, 'utf8');
  const service = fs.readFileSync(backupService, 'utf8');
  const timer = fs.readFileSync(backupTimer, 'utf8');
  const release = fs.readFileSync(releaseScript, 'utf8');

  assert.match(script, /sqlite3\.connect/);
  assert.match(script, /\.backup\(/);
  assert.match(script, /retention_days=14/);
  assert.match(service, /User=knownmap/);
  assert.match(service, /ReadWritePaths=\/var\/backups\/knownmap/);
  assert.match(service, /^CapabilityBoundingSet=$/m);
  assert.match(timer, /OnCalendar=daily/);
  assert.match(timer, /Persistent=true/);
  assert.match(release, /knownmap-backup\.timer/);
  assert.match(release, /systemctl start knownmap-backup\.service/);
});

test('GitHub workflows pin actions and test the production backend lockfile', () => {
  const workflowSources = [
    fs.readFileSync(testWorkflow, 'utf8'),
    fs.readFileSync(pagesWorkflow, 'utf8')
  ];
  const combined = workflowSources.join('\n');

  assert.doesNotMatch(combined, /uses:\s+actions\/[^@\s]+@v\d+/);
  for (const sha of [
    '11d5960a326750d5838078e36cf38b85af677262',
    '49933ea5288caeca8642d1e84afbd3f7d6820020',
    '983d7736d9b0ae728b81ab479565c72886d7745b',
    '56afc609e74202658d3ffba0e8f6dda462b719fa',
    'd6db90164ac5ed86f2b6aed7e0febac5b3c0c03e'
  ]) {
    assert.match(combined, new RegExp(sha));
  }

  assert.match(workflowSources[0], /python -m pip install uv==0\.11\.12/);
  assert.match(workflowSources[0], /uv sync --frozen --all-groups/);
  assert.match(workflowSources[0], /uv run pytest/);
});

test('Dependabot monitors Python and GitHub Actions dependencies', () => {
  const dependabot = fs.readFileSync(dependabotFile, 'utf8');

  assert.match(dependabot, /package-ecosystem: "pip"/);
  assert.match(dependabot, /directory: "\/backend"/);
  assert.match(dependabot, /package-ecosystem: "github-actions"/);
  assert.match(dependabot, /directory: "\/"/);
  assert.match(dependabot, /interval: "weekly"/);
});
