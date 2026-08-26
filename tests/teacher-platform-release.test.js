// 定位: 验证教师平台生产部署的服务、反代和数据目录约束。
// 入口参数: deploy/teacher-platform/ 下的静态配置。
// 返回参数: Node test 通过/失败结果。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const serviceFile = path.join(root, 'deploy/teacher-platform/knownmap-teacher-api.service');
const nginxFile = path.join(root, 'deploy/teacher-platform/knownmap-nginx.conf');
const backupScript = path.join(root, 'deploy/teacher-platform/knownmap-backup.py');
const backupService = path.join(root, 'deploy/teacher-platform/knownmap-backup.service');
const backupTimer = path.join(root, 'deploy/teacher-platform/knownmap-backup.timer');
const testWorkflow = path.join(root, '.github/workflows/test.yml');
const pagesWorkflow = path.join(root, '.github/workflows/pages.yml');
const dependabotFile = path.join(root, '.github/dependabot.yml');

test('teacher API service runs privately with persistent database access', () => {
  const service = fs.readFileSync(serviceFile, 'utf8');

  assert.match(service, /User=knownmap/);
  assert.match(service, /Group=knownmap/);
  assert.match(service, /WorkingDirectory=\/opt\/knownmap\/current\/v1\/backend/);
  assert.match(service, /EnvironmentFile=\/etc\/knownmap\/teacher-platform\.env/);
  assert.match(
    service,
    /ExecStart=\/opt\/knownmap\/current\/v1\/backend\/\.venv\/bin\/uvicorn/
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
  assert.match(nginx, /location = \/api\/v1\/teacher\/auth\/login \{/);
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

test('production database backup is isolated, scheduled and retained', () => {
  const script = fs.readFileSync(backupScript, 'utf8');
  const service = fs.readFileSync(backupService, 'utf8');
  const timer = fs.readFileSync(backupTimer, 'utf8');

  assert.match(script, /sqlite3\.connect/);
  assert.match(script, /\.backup\(/);
  assert.match(script, /retention_days=30/);
  assert.match(service, /User=knownmap/);
  assert.match(service, /ReadWritePaths=\/var\/backups\/knownmap/);
  assert.match(service, /^CapabilityBoundingSet=$/m);
  assert.match(timer, /OnCalendar=daily/);
  assert.match(timer, /Persistent=true/);
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
  assert.match(dependabot, /directory: "\/v1\/backend"/);
  assert.match(dependabot, /package-ecosystem: "github-actions"/);
  assert.match(dependabot, /directory: "\/"/);
  assert.match(dependabot, /interval: "weekly"/);
});

test('恢复演练脚本检查归属关系而不只是行数', () => {
  const drill = fs.readFileSync(
    path.join(root, 'deploy/teacher-platform/knownmap-restore-check.py'),
    'utf8'
  );

  // 行数对上但外键断了，是行数统计看不出的失败
  assert.match(drill, /OWNERSHIP_CHECKS/);
  assert.match(drill, /owner_teacher_id/);
  assert.match(drill, /integrity_check/);

  // 演练不得改动备份本身
  assert.match(drill, /mode=ro/);
  assert.match(drill, /shutil\.copy2/);
});
