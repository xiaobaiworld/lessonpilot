#!/usr/bin/env node
// 生成 v1 需求级追踪矩阵。
//
// 用法：
//   node tools/build-traceability.mjs          写入 TSV 并打印统计
//   node tools/build-traceability.mjs --check   只校验现有 TSV 是否与文档一致，不写入
//
// 依据 `ACC-COVER-001`：全部已接受稳定编号进入矩阵且不重复。矩阵本体是机器可读文件，
// `doc/requirements/v1/12-acceptance-traceability.md` 只保留字段定义、状态取值和发布门禁。
//
// 证据列（设计/实现/自动化/真实环境）由各实施阶段回填，本工具不猜测、不覆盖已填内容。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ID_PREFIXES, extractDefinitions, inventory } from './lib/requirement-ids.mjs';

const OUTPUT = 'doc/traceability/v1-requirements.tsv';

const COLUMNS = [
  '编号',
  '定义文件',
  '标题',
  '需求状态',
  '优先级',
  '来源',
  '关联需求',
  '设计证据',
  '实现证据',
  '自动化证据',
  '真实环境证据',
  '最终状态',
  '最近检查',
];

/**
 * 矩阵自己拥有的列：重新生成时保留已有值，不从需求文档反推。
 *
 * `关联需求` 在这里，是因为需求文档已不再保存该字段 —— 上下游关系由矩阵单向维护。
 * 原来每条需求都写一份「关联要求」，其中 306 处指向从未签发的编号族，改一个族名要动
 * 上百行。收进矩阵后只有一个地方需要维护，也能被 doc-check 检查。
 */
const MATRIX_OWNED_COLUMNS = [
  '关联需求',
  '设计证据',
  '实现证据',
  '自动化证据',
  '真实环境证据',
  '最终状态',
  '最近检查',
];

/** `12-acceptance-traceability.md` 规定的最终状态取值。 */
export const FINAL_STATES = new Set([
  '待设计',
  '待实现',
  '待验证',
  '已验证',
  '阻塞',
  '不适用',
  '已替代',
  '已发布',
]);

function tsvEscape(value) {
  // TSV 不支持转义，制表符和换行必须在写入前规整掉。
  return String(value ?? '')
    .replace(/\t/g, ' ')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function readExisting(path) {
  if (!existsSync(path)) return new Map();
  const lines = readFileSync(path, 'utf8').split('\n').filter((line) => line.length > 0);
  if (lines.length === 0) return new Map();
  const header = lines[0].split('\t');
  const rows = new Map();
  for (const line of lines.slice(1)) {
    const cells = line.split('\t');
    const row = {};
    for (const [index, name] of header.entries()) row[name] = cells[index] ?? '';
    if (row['编号']) rows.set(row['编号'], row);
  }
  return rows;
}

/**
 * 清理需求文档里 `关联需求` 字段的原始文本。
 *
 * 04/05 的该字段大量指向从未签发的编号族并标注「（待建立）」。矩阵只保留能解析的
 * 引用，解析不出来的一律丢弃 —— 保留它们等于把已知漂移搬进矩阵。
 */
function sanitizeRelated(raw, definedIds, definedFamilies, registeredPrefixes) {
  if (!raw) return '';
  const kept = [];
  for (const match of raw.matchAll(/`([A-Z]+(?:-[A-Z]+)?)-(\*|\d{2,3})`/g)) {
    const [token, family, suffix] = [match[0], match[1], match[2]];
    const resolvable =
      suffix === '*'
        ? definedFamilies.has(family) || registeredPrefixes.has(family)
        : definedIds.has(`${family}-${suffix}`);
    if (resolvable && !kept.includes(token)) kept.push(token);
  }
  return kept.join('、');
}

export function buildRows(root = '.') {
  const definitions = extractDefinitions(root);
  const { total, byFile, records } = inventory(definitions);
  const existing = readExisting(OUTPUT);

  const definedIds = new Set(definitions.map((d) => d.id));
  const definedFamilies = new Set(definitions.map((d) => d.family));
  const registeredPrefixes = new Set(ID_PREFIXES.map((p) => p.prefix));

  const rows = records.map((record) => {
    const previous = existing.get(record.id) ?? {};
    const row = {
      编号: record.id,
      定义文件: record.file,
      标题: record.title,
      需求状态: record.status || '已接受',
      优先级: record.priority || '—',
      来源: record.source || '—',
    };
    for (const column of MATRIX_OWNED_COLUMNS) {
      // 已有值优先。首次生成时用需求文档里尚存的字段做初值，之后由矩阵自己维护。
      const seed =
        column === '关联需求'
          ? sanitizeRelated(record.related, definedIds, definedFamilies, registeredPrefixes)
          : '';
      row[column] = previous[column] ?? seed ?? '';
      if (column === '关联需求' && !row[column]) row[column] = '—';
      if (column === '最终状态' && !row[column]) row[column] = '待设计';
    }
    return row;
  });

  return { rows, total, byFile, definitions };
}

function duplicates(rows) {
  const seen = new Set();
  const dupes = [];
  for (const row of rows) {
    if (seen.has(row['编号'])) dupes.push(row['编号']);
    seen.add(row['编号']);
  }
  return dupes;
}

function serialize(rows) {
  const lines = [COLUMNS.join('\t')];
  for (const row of rows) {
    lines.push(COLUMNS.map((column) => tsvEscape(row[column])).join('\t'));
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const { rows, total, byFile } = buildRows('.');

  const dupes = duplicates(rows);
  if (dupes.length > 0) {
    console.error(`编号重复：${dupes.join('、')}`);
    process.exit(1);
  }

  const content = serialize(rows);

  if (checkOnly) {
    if (!existsSync(OUTPUT)) {
      console.error(`矩阵缺失：${OUTPUT}；运行 node tools/build-traceability.mjs 生成`);
      process.exit(1);
    }
    if (readFileSync(OUTPUT, 'utf8') !== content) {
      console.error(`矩阵与需求文档不一致：${OUTPUT}；运行 node tools/build-traceability.mjs 重新生成`);
      process.exit(1);
    }
    console.log(`矩阵一致：${total} 个稳定编号`);
    return;
  }

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, content);

  console.log(`已写入 ${OUTPUT}`);
  console.log(`稳定编号合计：${total}`);
  for (const [file, count] of [...byFile].sort()) {
    console.log(`  ${String(count).padStart(3)}  ${file}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
