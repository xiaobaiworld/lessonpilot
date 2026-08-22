#!/usr/bin/env node
// v1 文档一致性门禁。
//
// 用法：node tools/doc-check.mjs [--json]
// 退出码 0 表示四项检查全部通过；非 0 表示存在必须修复的不一致。
//
// 四项检查分别对应文档体系自己写下的规则：
//   1. 编号可解析 —— `ACC-LINK-001`（需求与设计、代码和证据双向链接）
//   2. 链接不断   —— `ACC-LINK-002`、`DEV-DOC-*`
//   3. 矩阵覆盖   —— `ACC-COVER-001`（全部已接受稳定编号进入矩阵且不重复）
//   4. 权威唯一   —— `DEV-STRUCT-001`、02 号设计登记 §10.2（旧资料不与新真源并列）
//
// 这些规则原来只写在文档里，靠人工记得。冻结 v1 需求时正是因为没有第 1 项，
// 369 处指向不存在编号的回链被一起冻结。检查脚本存在的意义就是不再依赖记忆。

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import {
  ID_PREFIXES,
  RESERVED_FAMILIES,
  extractDefinitions,
  extractReferences,
  extractTableDefinitions,
  inventory,
} from './lib/requirement-ids.mjs';

const TSV = 'doc/traceability/v1-requirements.tsv';
const INDEX = 'doc/INDEX.md';
const SRC_REGISTER = 'doc/requirements/v1/13-legacy-source-register.md';

/**
 * 编号引用检查范围：v1 真源。
 *
 * 旧文档和归档不参与，它们按定义已停止指导开发。同理排除：
 *  - `legacy-source-extractions/`：旧资料逐文件提取记录，属于审计证据，其中的旧编号
 *    是被提取时的原文，改写会破坏证据；
 *  - `plans/stage-1*.md` 与其它已完成计划：历史原型阶段，编号体系是 v1 之前的。
 */
const ID_SCOPE = ['doc/requirements/v1', 'doc/design/v1', 'doc/plans', 'doc/dev-rules.md'];

const ID_SCOPE_EXCLUDE = [/legacy-source-extractions\//, /doc\/plans\/(?!v1-)/];

/** 链接检查范围：全部活跃与归档 Markdown，断链在哪都是断链。 */
const LINK_ROOTS = ['doc', 'docs', 'README.md', 'next.md', 'changelog.md'];

function walkMarkdown(target) {
  if (!existsSync(target)) return [];
  if (statSync(target).isFile()) return target.endsWith('.md') ? [target] : [];
  const found = [];
  for (const name of readdirSync(target).sort()) {
    found.push(...walkMarkdown(join(target, name)));
  }
  return found;
}

function collect(roots) {
  return roots.flatMap((root) => walkMarkdown(root));
}

// ---------------------------------------------------------------- 1. 编号可解析

function checkIdentifiers() {
  const problems = [];
  const definitions = extractDefinitions('.');
  const definedFamilies = new Set(definitions.map((d) => d.family));
  const definedIds = new Set([
    ...definitions.map((d) => d.id),
    // 术语、开放项和决策清单用表格首列定义，不是标题。
    // 术语和开放项在表格里；决策和工程取舍（`ARCH-DEC-*`、`DATA-DEC-*`）在标题里。
    ...extractTableDefinitions(
      // `doc/archive/` 参与扫描：`D-*` 历史决策总表已归档，但仍是合法的来源引用目标。
      ['doc/requirements/v1', 'doc/design/v1', 'doc/decisions', 'doc/archive'],
      '.',
    ),
  ]);
  // 已登记的前缀本身可以整体引用（`FR-*` 指全部功能需求，不是某个族）。
  const registeredPrefixes = new Set(ID_PREFIXES.map((p) => p.prefix));

  const scoped = collect(ID_SCOPE).filter(
    (file) => !ID_SCOPE_EXCLUDE.some((pattern) => pattern.test(file)),
  );

  for (const reference of extractReferences(scoped, '.')) {
    const { family, id, raw, file, line } = reference;
    if (RESERVED_FAMILIES.has(family)) continue;
    // 引用整个族或整个编号域：任一存在即可。
    if (id === '*') {
      if (!definedFamilies.has(family) && !registeredPrefixes.has(family)) {
        problems.push(`${file}:${line} 引用未定义编号族 \`${family}-*\``);
      }
      continue;
    }
    // 引用具体编号：编号必须存在。族存在但编号不存在同样是漂移。
    if (!definedIds.has(raw)) {
      problems.push(`${file}:${line} 引用未定义编号 \`${raw}\``);
    }
  }
  return problems;
}

// ------------------------------------------------------------------ 2. 链接不断

function checkLinks() {
  const problems = [];
  const files = collect(LINK_ROOTS);
  for (const file of files) {
    const base = dirname(file);
    const lines = readFileSync(file, 'utf8').split('\n');
    for (const [index, line] of lines.entries()) {
      for (const match of line.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
        const target = match[1];
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        const path = target.split('#')[0];
        if (!path) continue;
        const resolved = normalize(join(base, decodeURIComponent(path)));
        if (!existsSync(resolved)) {
          problems.push(`${file}:${index + 1} 断链 ${target}`);
        }
      }
    }
  }
  return { problems, checked: files.length };
}

// ------------------------------------------------------------------ 3. 矩阵覆盖

function checkMatrix() {
  const problems = [];
  if (!existsSync(TSV)) {
    return { problems: [`矩阵缺失：${TSV}`], total: 0 };
  }
  const { total, records } = inventory(extractDefinitions('.'));
  const lines = readFileSync(TSV, 'utf8').split('\n').filter((line) => line.length > 0);
  const header = lines[0].split('\t');
  const rows = lines.slice(1).map((line) => {
    const cells = line.split('\t');
    return Object.fromEntries(header.map((name, index) => [name, cells[index] ?? '']));
  });

  const matrixIds = rows.map((row) => row['编号']);
  const matrixSet = new Set(matrixIds);
  if (matrixIds.length !== matrixSet.size) {
    problems.push(`矩阵存在重复编号（${matrixIds.length} 行 / ${matrixSet.size} 个唯一编号）`);
  }

  for (const record of records) {
    if (!matrixSet.has(record.id)) problems.push(`矩阵缺少编号 ${record.id}`);
  }
  const definedSet = new Set(records.map((r) => r.id));
  for (const id of matrixSet) {
    if (!definedSet.has(id)) problems.push(`矩阵含未定义编号 ${id}`);
  }
  return { problems, total, rows: rows.length };
}

// ------------------------------------------------------------------ 4. 权威唯一

/** 从来源登记里读出被标为归档或证据的文件路径。它们不得出现在「当前权威」段。 */
function retiredSources() {
  if (!existsSync(SRC_REGISTER)) return new Set();
  const retired = new Set();
  for (const line of readFileSync(SRC_REGISTER, 'utf8').split('\n')) {
    if (!/^\|\s*SRC-\d+/.test(line)) continue;
    if (!/(待归档|保留为证据|已归档)/.test(line)) continue;
    // 路径既可能是链接 [`path`](rel)，也可能是裸 `path`。
    const match = line.match(/\[`([^`]+)`\]|`([^`]+\.md)`/);
    const path = match?.[1] ?? match?.[2];
    if (path && path.endsWith('.md')) retired.add(path.replace(/^\.\//, ''));
  }
  return retired;
}

function checkAuthority() {
  const problems = [];
  if (!existsSync(INDEX)) return [`索引缺失：${INDEX}`];

  const text = readFileSync(INDEX, 'utf8');
  const section = text.match(/^## 当前权威\s*$([\s\S]*?)(?=^## |\Z)/m);
  if (!section) return ['`doc/INDEX.md` 缺少「当前权威」段'];

  const body = section[1];
  const retired = retiredSources();

  for (const [index, line] of body.split('\n').entries()) {
    for (const match of line.matchAll(/`([^`]+\.md)`|\(([^)\s]+\.md)[^)]*\)/g)) {
      const raw = (match[1] ?? match[2]).replace(/^\.\//, '');
      const path = raw.startsWith('doc/') || raw.startsWith('docs/') || !raw.includes('/')
        ? raw
        : relative('.', normalize(join('doc', raw)));
      if (path.includes('doc/archive/')) {
        problems.push(`当前权威段含归档路径：${raw}`);
      }
      if (retired.has(path)) {
        problems.push(`当前权威段含已退出指导链的旧文档：${raw}`);
      }
    }
  }
  return problems;
}

// ----------------------------------------------------------------------- 汇总

function main() {
  const asJson = process.argv.includes('--json');
  const identifiers = checkIdentifiers();
  const links = checkLinks();
  const matrix = checkMatrix();
  const authority = checkAuthority();

  const report = {
    编号可解析: identifiers,
    链接不断: links.problems,
    矩阵覆盖: matrix.problems,
    权威唯一: authority,
  };
  const failures = Object.values(report).reduce((sum, list) => sum + list.length, 0);

  if (asJson) {
    console.log(JSON.stringify({ report, failures, stats: { links: links.checked, ids: matrix.total } }, null, 2));
    process.exit(failures > 0 ? 1 : 0);
  }

  for (const [name, problems] of Object.entries(report)) {
    if (problems.length === 0) {
      console.log(`✓ ${name}`);
      continue;
    }
    console.log(`✗ ${name}（${problems.length}）`);
    for (const problem of problems.slice(0, 25)) console.log(`    ${problem}`);
    if (problems.length > 25) console.log(`    …其余 ${problems.length - 25} 项`);
  }

  console.log(`\n检查 ${links.checked} 个 Markdown 文件、${matrix.total} 个稳定编号`);
  if (failures > 0) {
    console.error(`不一致合计：${failures}`);
    process.exit(1);
  }
  console.log('四项检查全部通过');
}

if (import.meta.url === `file://${process.argv[1]}`) main();

export { checkAuthority, checkIdentifiers, checkLinks, checkMatrix };
