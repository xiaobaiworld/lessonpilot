const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'dev-up.sh'), 'utf8');

test('本地启动会先把数据库升级到最新 migration head', () => {
  const startAll = source.slice(source.indexOf('start_all()'));

  assert.match(source, /uv run alembic upgrade head/);
  assert.ok(
    startAll.indexOf('migrate_database') < startAll.indexOf('start_frontends'),
    '数据库迁移必须在启动前端和后端之前执行'
  );
});
