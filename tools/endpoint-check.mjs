#!/usr/bin/env node
// 比对 v1 端点清单与后端实际实现。
//
// 用法：
//   node tools/endpoint-check.mjs          打印对照表和差异
//   node tools/endpoint-check.mjs --json    机器可读输出
//
// 清单真源：`doc/design/v1/06-interface-contracts.md` 第 4.5 节。
// 依据 `ARCH-DEC-02`：OpenAPI 是 HTTP 契约真源，本清单是实现基准，用于发现漏建、
// 命名不一致和挂错模块的端点。
//
// 退出码 0 表示没有「清单外端点」。缺失（清单有、代码没有）在阶段 1–3 属正常进度，
// 只报告不失败；多余（代码有、清单没有）说明实现绕过了契约设计，必须失败。

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const INVENTORY = 'doc/design/v1/06-interface-contracts.md';
/** 清单表格行：`| 方法 | \`路径\` | 状态 | 依据 |` */
const ROW_RE = /^\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|/gm;

/** 依据列里的旧路径标注：`旧路径：POST /api/v1/auth/login` */
const LEGACY_RE = /旧路径：\s*`?(GET|POST|PUT|PATCH|DELETE)\s+([^\s`，、；]+)/;

/** 第 4.5 节的模块小标题 */
const MODULE_RE = /^####\s+(.+?)\s*$/gm;

/** 读取清单：返回 [{ verb, path, state, module }]。 */
export function readInventory(root = '.') {
  const text = readFileSync(join(root, INVENTORY), 'utf8');
  const start = text.indexOf('### 4.5');
  if (start === -1) throw new Error(`${INVENTORY} 缺少第 4.5 节端点清单`);
  const end = text.indexOf('\n## 5.', start);
  const section = text.slice(start, end === -1 ? undefined : end);

  // 记录每个 #### 小标题的位置，用于给端点标注所属模块
  const modules = [...section.matchAll(MODULE_RE)].map((m) => ({
    name: m[1].trim(),
    index: m.index,
  }));

  const rows = [];
  for (const m of section.matchAll(ROW_RE)) {
    const owner = [...modules].reverse().find((mod) => mod.index < m.index);
    const basis = (m[4] ?? '').trim();
    const legacy = basis.match(LEGACY_RE);
    rows.push({
      verb: m[1],
      path: m[2].trim(),
      state: m[3].trim(),
      basis,
      legacy: legacy ? { verb: legacy[1], path: legacy[2] } : null,
      module: owner ? owner.name : '(未分组)',
    });
  }
  return rows;
}

/** 从新版 FastAPI 的 OpenAPI 读取实际端点。 */
export function readImplementation(root = '.') {
  const backend = join(root, 'v1/backend');
  const script = [
    'import json',
    'from fastapi.testclient import TestClient',
    'from app.main import app',
    "print(json.dumps(TestClient(app).get('/openapi.json').json()['paths']))",
  ].join(';');
  const result = spawnSync('uv', ['run', 'python', '-c', script], {
    cwd: backend,
    encoding: 'utf8',
    env: { ...process.env, APP_ENV: 'test', LOG_LEVEL: 'ERROR' },
  });
  if (result.status !== 0) throw new Error(result.stderr || '无法读取 v1 OpenAPI');
  const paths = JSON.parse(result.stdout.trim().split('\n').at(-1));
  const found = [];
  for (const [path, operations] of Object.entries(paths)) {
    for (const verb of Object.keys(operations)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(verb)) continue;
      found.push({
        verb: verb.toUpperCase(),
        path,
        file: operations[verb].operationId,
      });
    }
  }
  return found;
}

const key = (e) => `${e.verb} ${e.path}`;

export function compare(root = '.') {
  const inventory = readInventory(root);
  const implemented = readImplementation(root);

  const inventoryKeys = new Set(inventory.map(key));
  const implementedKeys = new Set(implemented.map(key));

  // `改名` 行登记的旧路径：代码里存在属正常，等重构时退役。
  const legacyKeys = new Map();
  for (const e of inventory) {
    if (e.legacy) legacyKeys.set(key(e.legacy), e);
  }

  const missing = inventory.filter((e) => !implementedKeys.has(key(e)));
  const matched = inventory.filter((e) => implementedKeys.has(key(e)));

  const extra = [];
  const pendingRetirement = [];
  for (const e of implemented) {
    if (inventoryKeys.has(key(e))) continue;
    const renamed = legacyKeys.get(key(e));
    if (renamed) {
      pendingRetirement.push({ ...e, targetPath: renamed.path, targetVerb: renamed.verb });
    } else {
      extra.push(e);
    }
  }

  // 清单声明「已有」却在代码里找不到：属于清单口径错误，不是进度问题。
  const wrongState = missing.filter((e) => e.state === '已有');

  // 声明了旧路径，但旧路径在代码里也不存在：标注过期或写错。
  const staleLegacy = inventory.filter(
    (e) => e.legacy && !implementedKeys.has(key(e.legacy)) && !implementedKeys.has(key(e)),
  );

  return {
    inventory,
    implemented,
    matched,
    missing,
    extra,
    pendingRetirement,
    wrongState,
    staleLegacy,
  };
}

function main() {
  const result = compare('.');
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.extra.length + result.wrongState.length > 0 ? 1 : 0);
  }

  const { inventory, implemented, matched, missing, extra, pendingRetirement, wrongState, staleLegacy } =
    result;
  console.log(`清单 ${inventory.length} 个端点，代码 ${implemented.length} 个，已对齐 ${matched.length} 个。`);

  const byState = new Map();
  for (const e of inventory) byState.set(e.state, (byState.get(e.state) ?? 0) + 1);
  console.log(`清单状态分布：${[...byState].map(([s, n]) => `${s} ${n}`).join('、')}`);

  if (missing.length > 0) {
    console.log(`\n待实现（清单有、代码无）${missing.length} 个：`);
    for (const e of missing) {
      console.log(`  ${e.state === '已有' ? '✗' : '·'} ${e.verb.padEnd(6)} ${e.path.padEnd(52)} ${e.module}`);
    }
  }

  if (pendingRetirement.length > 0) {
    console.log(`\n待退役旧路径（已在清单登记为改名）${pendingRetirement.length} 个：`);
    for (const e of pendingRetirement) {
      console.log(`  · ${e.verb.padEnd(6)} ${e.path.padEnd(52)} -> ${e.targetVerb} ${e.targetPath}`);
    }
  }

  if (extra.length > 0) {
    console.log(`\n✗ 清单外端点（代码有、清单无、也未登记为旧路径）${extra.length} 个：`);
    for (const e of extra) console.log(`    ${e.verb.padEnd(6)} ${e.path.padEnd(52)} ${e.file}`);
    console.log('  实现绕过了契约设计。先在 06 第 4.5 节登记，再保留代码。');
  }

  if (wrongState.length > 0) {
    console.log(`\n✗ 清单标为「已有」但代码中不存在 ${wrongState.length} 个：`);
    for (const e of wrongState) console.log(`    ${e.verb} ${e.path}`);
    console.log('  清单口径错误，应改为「新建」或「改名」。');
  }

  if (staleLegacy.length > 0) {
    console.log(`\n✗ 旧路径标注已过期 ${staleLegacy.length} 个：`);
    for (const e of staleLegacy) {
      console.log(`    ${e.verb} ${e.path}  标注旧路径 ${e.legacy.verb} ${e.legacy.path}（代码中不存在）`);
    }
    console.log('  旧路径已退役时应从依据列移除该标注。');
  }

  const failures = missing.length + extra.length + wrongState.length + staleLegacy.length;
  if (failures === 0) {
    console.log('\n清单与实现一致：没有未登记端点，状态与旧路径标注准确。');
    return;
  }
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
