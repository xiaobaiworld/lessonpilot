// v1 需求编号抽取与校验的唯一实现。
//
// 追踪矩阵生成（build-traceability.mjs）和文档一致性检查（doc-check.mjs）都从这里
// 读取编号事实，避免两个工具各自解析文档、得出不同的编号总数。
// 依据：`ACC-COVER-001`（全部已接受稳定编号进入矩阵）、`DEV-STRUCT-001`（同一规则只有一个实现真源）。

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** 需求目录：稳定编号的定义真源。 */
export const REQUIREMENTS_DIR = 'doc/requirements/v1';

/**
 * 已登记的编号前缀。
 *
 * `kind: 'requirement'` 计入需求库存和追踪矩阵；
 * `kind: 'reference'` 是决策、来源或设计取舍编号，可被引用但不计入需求数。
 */
export const ID_PREFIXES = [
  { prefix: 'GOAL', kind: 'requirement', desc: '产品目标' },
  { prefix: 'SUCCESS', kind: 'requirement', desc: '产品成功标准' },
  { prefix: 'SCOPE', kind: 'requirement', desc: 'v1 功能范围' },
  { prefix: 'CONSTRAINT', kind: 'requirement', desc: '已知约束' },
  { prefix: 'SCN', kind: 'requirement', desc: '用户场景' },
  { prefix: 'FR', kind: 'requirement', desc: '功能需求' },
  { prefix: 'DATA', kind: 'requirement', desc: '数据需求' },
  { prefix: 'INT', kind: 'requirement', desc: '接口与集成需求' },
  { prefix: 'SEC', kind: 'requirement', desc: '安全、隐私与合规需求' },
  { prefix: 'DEV', kind: 'requirement', desc: '开发质量需求' },
  { prefix: 'OPS', kind: 'requirement', desc: '部署运维需求' },
  { prefix: 'MIG', kind: 'requirement', desc: '迁移兼容需求' },
  { prefix: 'ACC', kind: 'requirement', desc: '验收追踪需求' },
  { prefix: 'NFR', kind: 'reserved', desc: '非功能需求；第一阶段按 07 决定不签发' },
  { prefix: 'TERM', kind: 'reference', desc: '领域术语；02 号文件为真源' },
  { prefix: 'D-V1', kind: 'reference', desc: 'v1 产品与范围决策' },
  { prefix: 'D', kind: 'reference', desc: 'v1 之前的历史决策；已归档，只作来源追溯' },
  { prefix: 'SRC', kind: 'reference', desc: '旧资料来源' },
  { prefix: 'OPEN', kind: 'reference', desc: '需求审核开放项' },
  { prefix: 'ARCH-DEC', kind: 'reference', desc: '架构工程取舍' },
  { prefix: 'DATA-DEC', kind: 'reference', desc: '数据模型工程取舍' },
];

/**
 * 已保留但未签发的编号族：允许被引用，不要求存在定义。
 *
 * 每一项都必须有明确依据，不能用来掩盖笔误或漂移。
 */
export const RESERVED_FAMILIES = new Map([
  ['FR-REPORT', '教师学习反馈与导出；04 第 1.1 节声明为后续阶段候选'],
  ['NFR', '07 决定第一阶段不制定量化非功能指标'],
]);

/** 匹配标题里的编号定义，例如 `#### FR-AUTH-001：...`。 */
const DEFINITION_RE = /^#{2,5}\s+`?([A-Z]+(?:-[A-Z]+)?-\d{2,3})`?(?:：|:|\s|$)/gm;

/**
 * 匹配表格首列里的编号定义，例如 `| TERM-001 | ... |`。
 *
 * 术语（02）和开放项（01 第 8 节）用表格而不是标题定义。它们是引用目标，
 * 不是需求条目，所以只用于「编号可解析」检查，不进入需求库存和追踪矩阵。
 */
const TABLE_DEFINITION_RE = /^\|\s*`?([A-Z]+(?:-[A-Z]+)?-\d{2,3})`?\s*\|/gm;

/** 匹配正文里的编号引用，例如 `` `SEC-ACCESS-001` `` 或 `` `FR-AUTH-*` ``。 */
const REFERENCE_RE = /`([A-Z]+(?:-[A-Z]+)?)-(\*|\d{2,3})`/g;

/** 把编号拆成族名，`FR-AUTH-001` -> `FR-AUTH`。 */
export function familyOf(id) {
  return id.replace(/-\d{2,3}$/, '');
}

/** 族名的前缀，`FR-AUTH` -> `FR`；`D-V1` 自身即前缀。 */
export function prefixOf(family) {
  const known = ID_PREFIXES.find((p) => p.prefix === family || family.startsWith(`${p.prefix}-`));
  return known ? known.prefix : family.split('-')[0];
}

/** 列出目录下的 Markdown 文件，不进入子目录。 */
function listMarkdown(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => join(dir, name));
}

/** 递归列出 Markdown 文件。归档目录有多层结构，需要走到底。 */
function walkMarkdown(target) {
  if (!existsSync(target)) return [];
  if (statSync(target).isFile()) return target.endsWith('.md') ? [target] : [];
  return readdirSync(target)
    .sort()
    .flatMap((name) => walkMarkdown(join(target, name)));
}

/**
 * 从需求目录抽取全部标题级编号定义。
 *
 * 返回按文件、再按文档内出现顺序排列的记录数组。每条记录带出该编号块里的
 * 状态、优先级、来源和关联需求字段（缺失时为空字符串）。
 */
export function extractDefinitions(root = '.') {
  const records = [];
  for (const file of listMarkdown(join(root, REQUIREMENTS_DIR))) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    const relative = file.replace(`${root}/`, '').replace(/^\.\//, '');

    const hits = [];
    for (const match of text.matchAll(DEFINITION_RE)) {
      const before = text.slice(0, match.index);
      hits.push({ id: match[1], line: before.split('\n').length });
    }

    for (const [index, hit] of hits.entries()) {
      const endLine = index + 1 < hits.length ? hits[index + 1].line - 1 : lines.length;
      const block = lines.slice(hit.line, endLine);
      records.push({
        id: hit.id,
        family: familyOf(hit.id),
        file: relative,
        line: hit.line,
        title: readTitle(lines[hit.line - 1]),
        ...readFields(block),
      });
    }
  }
  return records;
}

function readTitle(headingLine) {
  const match = headingLine.match(/^#{2,5}\s+`?[A-Z]+(?:-[A-Z]+)?-\d{2,3}`?(?:：|:)?\s*(.*)$/);
  return match ? match[1].trim() : '';
}

/** 需求块里以 `- 字段：值` 或 `- **字段**：值` 形式出现的字段。 */
function readFields(block) {
  const fields = { status: '', priority: '', source: '', related: '' };
  const names = [
    ['status', '状态'],
    ['priority', '优先级'],
    ['source', '来源'],
    ['related', '关联需求|关联要求'],
  ];
  for (const line of block) {
    for (const [key, pattern] of names) {
      if (fields[key]) continue;
      const match = line.match(new RegExp(`^\\s*-\\s+\\*{0,2}(?:${pattern})\\*{0,2}(?:：|:)\\s*(.+)$`));
      if (match) fields[key] = match[1].trim();
    }
  }
  // 12 号文件把状态和优先级写在同一行（`状态：已接受；优先级：P0`），拆开后与其它文件一致。
  const combined = fields.status.match(/^(.*?)；\s*优先级(?:：|:)\s*(.+)$/);
  if (combined && !fields.priority) {
    fields.status = combined[1].trim();
    fields.priority = combined[2].trim();
  }
  return fields;
}

/**
 * 抽取给定文件里的全部编号引用。
 *
 * 返回 `{ file, line, family, id, raw }` 数组；`id` 为 `*` 表示引用整个族。
 */
export function extractReferences(files, root = '.') {
  const references = [];
  for (const file of files) {
    const relative = file.replace(`${root}/`, '').replace(/^\.\//, '');
    const lines = readFileSync(file, 'utf8').split('\n');
    for (const [index, line] of lines.entries()) {
      for (const match of line.matchAll(REFERENCE_RE)) {
        references.push({
          file: relative,
          line: index + 1,
          family: match[1],
          id: match[2],
          raw: `${match[1]}-${match[2]}`,
        });
      }
    }
  }
  return references;
}

/**
 * 抽取表格首列定义的编号（术语、开放项、决策清单）。
 *
 * 只返回编号集合。这些编号可以被引用，但不是需求条目。
 */
export function extractTableDefinitions(dirs, root = '.') {
  const ids = new Set();
  for (const dir of dirs) {
    const target = join(root, dir);
    if (!existsSync(target)) continue;
    for (const file of walkMarkdown(target)) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(TABLE_DEFINITION_RE)) ids.add(match[1]);
      // 决策文件用标题定义编号（`## D-026 ...`、`# D-V1-012：...`）。
      for (const match of text.matchAll(DEFINITION_RE)) ids.add(match[1]);
    }
  }
  return ids;
}

/** 需求库存：只统计 `kind: 'requirement'` 的编号，按文件汇总。 */
export function inventory(definitions) {
  const requirementPrefixes = new Set(
    ID_PREFIXES.filter((p) => p.kind === 'requirement').map((p) => p.prefix),
  );
  const counted = definitions.filter((d) => requirementPrefixes.has(prefixOf(d.family)));
  const byFile = new Map();
  for (const record of counted) {
    byFile.set(record.file, (byFile.get(record.file) ?? 0) + 1);
  }
  return { total: counted.length, byFile, records: counted };
}
