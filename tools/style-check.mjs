#!/usr/bin/env node

/**
 * 样式漂移门禁。
 *
 * tokens.css 是唯一允许直接出现色值的 CSS。阶段 0 仍有历史页面裸色值，
 * 它们按文件和值登记在 style-check-baseline.json；本门禁只允许已登记的旧值，
 * 任何新增裸色值都会失败。后续视觉收敛阶段逐步删除基线，最终切到零裸色值。
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scanRoots = ['v1/web', 'v1/site', 'v1/extension'];
const tokenFile = 'v1/web/shared/src/styles/tokens.css';
const baselinePath = path.join(root, 'tools/style-check-baseline.json');
const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;

function filesUnder(relativeRoot) {
  const absoluteRoot = path.join(root, relativeRoot);
  const result = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (['node_modules', 'dist', '.venv'].includes(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (/\.(css|html)$/.test(entry.name)) result.push(absolute);
    }
  }
  if (existsSync(absoluteRoot)) visit(absoluteRoot);
  return result;
}

export function checkStyles({ scanDirectory = root, baseline = null } = {}) {
  const approved = baseline ?? JSON.parse(readFileSync(baselinePath, 'utf8'));
  const failures = [];
  const files = scanRoots.flatMap((item) => filesUnder(path.relative(root, path.join(scanDirectory, item))));
  for (const file of files) {
    const relative = path.relative(scanDirectory, file);
    if (relative === tokenFile) continue;
    const source = readFileSync(file, 'utf8');
    const values = [...new Set(source.match(hexPattern) ?? [])].map((value) => value.toLowerCase());
    const known = new Set((approved[relative] ?? []).map((value) => value.toLowerCase()));
    for (const value of values) {
      if (!known.has(value)) failures.push({ file: relative, value });
    }
  }
  return { failures, filesScanned: files.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = checkStyles();
  if (result.failures.length > 0) {
    for (const failure of result.failures) console.error(`${failure.file}: 新增裸色值 ${failure.value}`);
    process.exitCode = 1;
  } else {
    const legacyCount = Object.values(JSON.parse(readFileSync(baselinePath, 'utf8')))
      .reduce((count, values) => count + values.length, 0);
    console.log(`样式检查通过：扫描 ${result.filesScanned} 个文件；暂存历史裸色值 ${legacyCount} 个。`);
  }
}
