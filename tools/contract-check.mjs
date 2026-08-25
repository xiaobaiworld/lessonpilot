#!/usr/bin/env node
// 契约检查：Schema 自身合法、版本清单一致、夹具行为符合命名、Python 与 Node 结论一致。
//
// 用法：
//   node tools/contract-check.mjs           全部检查
//   node tools/contract-check.mjs --json     机器可读输出
//   node tools/contract-check.mjs --no-python 跳过 Python 侧（无 uv 环境时）
//
// 依据 `ARCH-DEC-02`：课程包和插件消息以版本化 JSON Schema 为真源，
// 再生成或校验 Python/TypeScript 适配层。阶段 0 门禁要求
// 「Python/TypeScript 对同一夹具给出一致结果」—— 第 4 项检查就是它的实现。
//
// 注意：ajv 默认导出只支持 draft-07，本项目 Schema 声明 2020-12，
// 必须用 ajv/dist/2020，否则报 no schema with key or ref。

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const CONTRACTS_DIR = 'contracts';
const VERSIONS_FILE = join(CONTRACTS_DIR, 'versions.json');
const FIXTURES_DIR = 'tests/fixtures/v1';

/** 契约键 -> 夹具子目录。清单里 schema 为 null 的契约（HTTP）不在此。 */
const FIXTURE_DIRS = {
  coursePackage: 'course-package',
  extensionMessage: 'extension-message',
};

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function readVersions(root = '.') {
  return readJson(join(root, VERSIONS_FILE));
}

/** 列出某契约的夹具：[{ kind: 'valid'|'invalid', name, path }]。 */
export function listFixtures(contractKey, root = '.') {
  const sub = FIXTURE_DIRS[contractKey];
  if (!sub) return [];
  const found = [];
  for (const kind of ['valid', 'invalid']) {
    const dir = join(root, FIXTURES_DIR, sub, kind);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith('.json')) continue;
      found.push({ kind, name, path: join(dir, name) });
    }
  }
  return found;
}

// -------------------------------------------------- 1. Schema 自身合法且可编译

export function checkSchemas(root = '.') {
  const problems = [];
  const compiled = new Map();
  const versions = readVersions(root);

  for (const [key, entry] of Object.entries(versions.contracts)) {
    if (entry.schema === null) continue;
    const path = join(root, CONTRACTS_DIR, entry.schema);
    if (!existsSync(path)) {
      problems.push(`${key}: 清单指向的 Schema 不存在：${entry.schema}`);
      continue;
    }
    let schema;
    try {
      schema = readJson(path);
    } catch (error) {
      problems.push(`${key}: Schema 不是合法 JSON：${error.message}`);
      continue;
    }
    // strict 模式打开：漏写 type、拼错关键字等在这里就失败，不等到夹具校验才发现。
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    try {
      compiled.set(key, ajv.compile(schema));
    } catch (error) {
      problems.push(`${key}: Schema 无法编译：${error.message}`);
      continue;
    }
    if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
      problems.push(`${key}: 必须声明 draft 2020-12，当前为 ${schema.$schema}`);
    }
    // 文件名主版本必须与清单一致，否则升版本时容易改了清单忘改文件
    const fileMajor = entry.schema.match(/\.v(\d+)\.schema\.json$/)?.[1];
    if (Number(fileMajor) !== entry.currentMajor) {
      problems.push(
        `${key}: 文件名主版本 v${fileMajor} 与清单 currentMajor ${entry.currentMajor} 不一致`,
      );
    }
  }
  return { problems, compiled };
}

// ------------------------------------------------------------ 2. 版本清单一致

export function checkVersions(root = '.') {
  const problems = [];
  const versions = readVersions(root);

  for (const [key, entry] of Object.entries(versions.contracts)) {
    for (const field of ['currentMajor', 'supportedMajors', 'description', 'design']) {
      if (entry[field] === undefined) problems.push(`${key}: 清单缺字段 ${field}`);
    }
    if (!Array.isArray(entry.supportedMajors) || entry.supportedMajors.length === 0) {
      problems.push(`${key}: supportedMajors 必须是非空数组`);
      continue;
    }
    if (!entry.supportedMajors.includes(entry.currentMajor)) {
      problems.push(
        `${key}: supportedMajors ${JSON.stringify(entry.supportedMajors)} 不含 currentMajor ${entry.currentMajor}`,
      );
    }
    // 每个受支持主版本都要有对应 Schema 文件，否则无法验证「旧版本被安全拒绝」
    if (entry.schema !== null) {
      for (const major of entry.supportedMajors) {
        const path = join(root, CONTRACTS_DIR, entry.schema.replace(/\.v\d+\./, `.v${major}.`));
        if (!existsSync(path)) {
          problems.push(`${key}: 声明支持主版本 ${major}，但缺少对应 Schema 文件`);
        }
      }
    }
  }
  return problems;
}

// ------------------------------------------------- 3. 夹具行为符合文件名声明

export function checkFixtures(compiled, root = '.') {
  const problems = [];
  const results = new Map();

  for (const key of Object.keys(FIXTURE_DIRS)) {
    const validate = compiled.get(key);
    if (!validate) continue;
    const fixtures = listFixtures(key, root);
    if (fixtures.length === 0) {
      problems.push(`${key}: 没有夹具。契约必须有正例和反例，否则无法证明规则生效`);
      continue;
    }
    const byKind = { valid: 0, invalid: 0 };
    for (const fixture of fixtures) {
      byKind[fixture.kind] += 1;
      let data;
      try {
        data = readJson(fixture.path);
      } catch (error) {
        problems.push(`${key}/${fixture.kind}/${fixture.name}: 不是合法 JSON：${error.message}`);
        continue;
      }
      const passed = validate(data) === true;
      const expected = fixture.kind === 'valid';
      results.set(`${key}/${fixture.kind}/${fixture.name}`, passed);
      if (passed !== expected) {
        problems.push(
          expected
            ? `${key}/valid/${fixture.name}: 应通过却被拒绝 —— ${ajvMessage(validate)}`
            : `${key}/invalid/${fixture.name}: 应被拒绝却通过了。Schema 缺少对应约束`,
        );
      }
    }
    for (const kind of ['valid', 'invalid']) {
      if (byKind[kind] === 0) problems.push(`${key}: 缺少 ${kind} 夹具`);
    }
  }
  return { problems, results };
}

function ajvMessage(validate) {
  return (validate.errors ?? [])
    .slice(0, 3)
    .map((e) => `${e.instancePath || '/'} ${e.message}`)
    .join('; ');
}

// ------------------------------------------- 4. Python 与 Node 对同一夹具一致

/**
 * 用后端的 jsonschema 校验同一批夹具，与 Node 侧结论逐个比对。
 *
 * 这是阶段 0 门禁「Python/TypeScript 对同一夹具给出一致结果」的实现。
 * 两侧结论不一致意味着 Schema 用了某侧不支持的特性，或某侧配置不同 ——
 * 那样契约就不是真正的跨语言真源。
 */
export function checkCrossLanguage(nodeResults, root = '.') {
  const script = `
import json, sys
from jsonschema import Draft202012Validator

out = {}
for key, schema_path, fixture_dir in json.load(sys.stdin):
    with open(schema_path, encoding='utf-8') as f:
        validator = Draft202012Validator(json.load(f))
    import os
    for kind in ('valid', 'invalid'):
        d = os.path.join(fixture_dir, kind)
        if not os.path.isdir(d):
            continue
        for name in sorted(os.listdir(d)):
            if not name.endswith('.json'):
                continue
            with open(os.path.join(d, name), encoding='utf-8') as f:
                data = json.load(f)
            out[f'{key}/{kind}/{name}'] = not list(validator.iter_errors(data))
print(json.dumps(out))
`;

  const versions = readVersions(root);
  const input = [];
  for (const [key, sub] of Object.entries(FIXTURE_DIRS)) {
    const entry = versions.contracts[key];
    if (!entry || entry.schema === null) continue;
    input.push([key, join(root, CONTRACTS_DIR, entry.schema), join(root, FIXTURES_DIR, sub)]);
  }

  let raw;
  try {
    raw = execFileSync('uv', ['run', 'python', '-c', script], {
      cwd: join(root, 'v1/backend'),
      input: JSON.stringify(input.map(([k, s, f]) => [k, join('../..', s), join('../..', f)])),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error) {
    return {
      problems: [
        `Python 侧校验无法执行：${(error.stderr || error.message).toString().trim().split('\n').slice(-2).join(' ')}`,
      ],
      compared: 0,
    };
  }

  const pythonResults = JSON.parse(raw);
  const problems = [];
  let compared = 0;

  for (const [name, nodePassed] of nodeResults) {
    if (!(name in pythonResults)) {
      problems.push(`${name}: Python 侧未给出结论`);
      continue;
    }
    compared += 1;
    if (pythonResults[name] !== nodePassed) {
      problems.push(
        `${name}: 两侧结论不一致 —— Node ${nodePassed ? '通过' : '拒绝'}，Python ${pythonResults[name] ? '通过' : '拒绝'}`,
      );
    }
  }
  for (const name of Object.keys(pythonResults)) {
    if (!nodeResults.has(name)) problems.push(`${name}: Node 侧未给出结论`);
  }
  return { problems, compared };
}

// ----------------------------------------------------------------------- 汇总

export function runAll(root = '.', { python = true } = {}) {
  const schemas = checkSchemas(root);
  const versionProblems = checkVersions(root);
  const fixtures = checkFixtures(schemas.compiled, root);
  const cross = python
    ? checkCrossLanguage(fixtures.results, root)
    : { problems: [], compared: 0, skipped: true };

  return {
    schemas: schemas.problems,
    versions: versionProblems,
    fixtures: fixtures.problems,
    crossLanguage: cross.problems,
    fixtureCount: fixtures.results.size,
    comparedCount: cross.compared,
    pythonSkipped: Boolean(cross.skipped),
  };
}

function main() {
  const python = !process.argv.includes('--no-python');
  const r = runAll('.', { python });

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(r, null, 2));
    const total = r.schemas.length + r.versions.length + r.fixtures.length + r.crossLanguage.length;
    process.exit(total > 0 ? 1 : 0);
  }

  const groups = [
    ['Schema 合法且可编译', r.schemas],
    ['版本清单一致', r.versions],
    ['夹具行为符合命名', r.fixtures],
    [r.pythonSkipped ? '双端结论一致（已跳过）' : '双端结论一致', r.crossLanguage],
  ];

  let total = 0;
  for (const [label, problems] of groups) {
    if (problems.length === 0) {
      console.log(`✓ ${label}`);
    } else {
      total += problems.length;
      console.log(`✗ ${label}（${problems.length}）`);
      for (const p of problems.slice(0, 12)) console.log(`    ${p}`);
      if (problems.length > 12) console.log(`    …其余 ${problems.length - 12} 项`);
    }
  }

  console.log(
    `\n夹具 ${r.fixtureCount} 个；` +
      (r.pythonSkipped ? 'Python 侧已跳过' : `双端比对 ${r.comparedCount} 个`),
  );
  if (total === 0) {
    console.log('四项检查全部通过');
    return;
  }
  console.log(`不一致合计：${total}`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
