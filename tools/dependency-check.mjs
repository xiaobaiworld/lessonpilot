#!/usr/bin/env node
// 依赖检查：可重现、已锁定、可追溯。
//
// 用法：
//   node tools/dependency-check.mjs        全部检查
//   node tools/dependency-check.mjs --json  机器可读输出
//
// 依据 `DEV-DEP-001`：只引入当前需求必需的依赖，使用可重现的锁定版本并保留来源信息；
// 来源不明、无法锁定或存在未处置高风险漏洞的依赖不进入发布结果。
//
// 本工具只做**离线可验证**的部分：锁文件存在且与声明同步、版本已约束、
// 依赖数量在可审阅范围内。漏洞库查询需要联网，由 CI 的 npm audit 与
// pip-audit 承担 —— 本机常用镜像源不实现 advisories 端点，
// 在本机跑 npm audit 只会得到 404 而不是「无漏洞」，那是最坏的假绿。

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

/** 直接依赖数量上限。超过说明需要重新审视「最小依赖」。 */
const MAX_DIRECT_DEPS = { node: 10, python: 20 };

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// ------------------------------------------------------------ Node 侧

export function checkNode() {
  const problems = [];
  if (!existsSync('package.json')) {
    return { problems: ['缺少 package.json'], direct: 0 };
  }
  const pkg = readJson('package.json');
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const names = Object.keys(deps);

  if (!existsSync('package-lock.json')) {
    problems.push('缺少 package-lock.json：没有锁文件无法重现安装结果');
  } else {
    const lock = readJson('package-lock.json');
    if (lock.lockfileVersion < 2) {
      problems.push(`package-lock.json 版本 ${lock.lockfileVersion} 过旧，缺少完整依赖树`);
    }
    // 声明的每个依赖都必须出现在锁文件里，否则 npm ci 结果与声明不一致
    const locked = lock.packages ?? {};
    for (const name of names) {
      if (!(`node_modules/${name}` in locked)) {
        problems.push(`${name} 在 package.json 声明但不在锁文件中；运行 npm install 同步`);
      }
    }
  }

  // 精确版本：契约校验器的结果必须逐位可重现，范围版本会让不同时间安装得到不同行为
  for (const [name, range] of Object.entries(deps)) {
    if (!/^\d+\.\d+\.\d+$/.test(range)) {
      problems.push(`${name} 版本「${range}」不是精确版本；校验器行为必须可逐位重现`);
    }
  }

  if (names.length > MAX_DIRECT_DEPS.node) {
    problems.push(
      `Node 直接依赖 ${names.length} 个，超过 ${MAX_DIRECT_DEPS.node} 个的审阅上限；` +
        '请复核每一项是否为当前需求必需',
    );
  }
  return { problems, direct: names.length };
}

// ---------------------------------------------------------- Python 侧

export function checkPython() {
  const problems = [];
  const pyproject = 'backend/pyproject.toml';
  if (!existsSync(pyproject)) {
    return { problems: [`缺少 ${pyproject}`], direct: 0 };
  }
  const text = readFileSync(pyproject, 'utf8');

  if (!existsSync('backend/uv.lock')) {
    problems.push('缺少 backend/uv.lock：没有锁文件无法重现安装结果');
  }

  // 抽取 dependencies 与 dependency-groups 里的依赖行
  const specs = [...text.matchAll(/^\s*"([A-Za-z0-9_.\-[\]]+)([^"]*)"\s*,?\s*$/gm)]
    .map((m) => ({ name: m[1], constraint: m[2].trim() }))
    .filter((d) => !d.name.includes('/') && !d.name.includes(' '));

  for (const { name, constraint } of specs) {
    if (constraint.length === 0) {
      problems.push(`${name} 没有版本约束；来源不明或无法锁定的依赖不得进入发布结果`);
      continue;
    }
    // 必须有上界，否则新主版本会静默进入，破坏可重现性
    if (!/[<~=]/.test(constraint)) {
      problems.push(`${name} 约束「${constraint}」缺少上界；新主版本会静默进入`);
    }
  }

  if (specs.length > MAX_DIRECT_DEPS.python) {
    problems.push(
      `后端直接依赖 ${specs.length} 个，超过 ${MAX_DIRECT_DEPS.python} 个的审阅上限`,
    );
  }
  return { problems, direct: specs.length };
}

// -------------------------------------------------- 锁文件与声明是否同步

export function checkLockSync() {
  const problems = [];
  // uv 能离线判断锁文件是否与 pyproject 一致
  try {
    execFileSync('uv', ['lock', '--check'], {
      cwd: 'backend',
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const detail = (error.stderr || error.message).toString().trim().split('\n').slice(-1)[0];
    if (/not found|No such file|ENOENT/i.test(detail)) {
      problems.push('无法执行 uv lock --check（本机无 uv）；CI 必须覆盖此项');
    } else {
      problems.push(`backend/uv.lock 与 pyproject.toml 不同步：${detail}`);
    }
  }
  return problems;
}

export function runAll() {
  const node = checkNode();
  const python = checkPython();
  const lockSync = checkLockSync();
  return {
    node: node.problems,
    python: python.problems,
    lockSync,
    nodeDirect: node.direct,
    pythonDirect: python.direct,
  };
}

function main() {
  const r = runAll();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.node.length + r.python.length + r.lockSync.length > 0 ? 1 : 0);
  }

  const groups = [
    [`Node 依赖已锁定（直接依赖 ${r.nodeDirect} 个）`, r.node],
    [`后端依赖已约束（直接依赖 ${r.pythonDirect} 个）`, r.python],
    ['锁文件与声明同步', r.lockSync],
  ];

  let total = 0;
  for (const [label, problems] of groups) {
    if (problems.length === 0) {
      console.log(`✓ ${label}`);
    } else {
      total += problems.length;
      console.log(`✗ ${label}（${problems.length}）`);
      for (const p of problems) console.log(`    ${p}`);
    }
  }

  console.log(
    '\n漏洞库查询不在本工具范围内：需要联网，由 CI 的 npm audit 与 pip-audit 承担。' +
      '\n本机镜像源常不实现 advisories 端点，在本机跑只会得到 404 而非「无漏洞」。',
  );

  if (total === 0) {
    console.log('三项检查全部通过');
    return;
  }
  console.log(`不一致合计：${total}`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
