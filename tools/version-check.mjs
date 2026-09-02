#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MANIFEST_PATH = 'versioning/components.json';
const SEMVER = /^\d+\.\d+\.\d+$/;

export function loadManifest(root = ROOT) {
  return JSON.parse(readFileSync(join(root, MANIFEST_PATH), 'utf8'));
}

function globToRegExp(glob) {
  let source = '';
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char === '*' && glob[i + 1] === '*') {
      source += '.*';
      i += 1;
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

function matches(path, pattern) {
  return globToRegExp(pattern).test(path);
}

function isTestPath(path) {
  return /(^|\/)(tests?|__tests__)(\/|$)|\.(test|spec)\.[^/]+$|_test\.[^/]+$/.test(path);
}

function specificity(pattern) {
  return pattern.replace(/\*\*/g, '').replace(/\*/g, '').length;
}

export function validateManifest(manifest) {
  const errors = [];
  if (manifest?.schemaVersion !== 1) errors.push('schemaVersion 必须为 1');
  if (!manifest?.components || typeof manifest.components !== 'object') errors.push('缺少 components');
  if (!manifest?.auditProfiles || typeof manifest.auditProfiles !== 'object') errors.push('缺少 auditProfiles');
  if (!Array.isArray(manifest?.rules) || manifest.rules.length === 0) errors.push('rules 不能为空');
  for (const [id, component] of Object.entries(manifest.components ?? {})) {
    if (!component.label || !component.category || !component.versionSource) errors.push(`组件 ${id} 缺少 label/category/versionSource`);
  }
  for (const rule of manifest.rules ?? []) {
    if (!rule.id || !rule.auditProfile || !Array.isArray(rule.paths) || rule.paths.length === 0) errors.push(`规则缺少 id/auditProfile/paths: ${rule.id ?? '(unknown)'}`);
    if (!manifest.auditProfiles?.[rule.auditProfile]) errors.push(`规则 ${rule.id} 引用了未知审计等级 ${rule.auditProfile}`);
    for (const component of rule.components ?? []) {
      if (!manifest.components?.[component]) errors.push(`规则 ${rule.id} 引用了未知组件 ${component}`);
    }
  }
  return errors;
}

export function classifyFiles(files, manifest) {
  return files.map((file) => {
    const normalized = file.replaceAll('\\', '/').replace(/^\.\//, '');
    const candidates = [];
    for (const rule of manifest.rules) {
      for (const pattern of rule.paths) {
        if (matches(normalized, pattern)) candidates.push({ rule, pattern, score: specificity(pattern) });
      }
    }
    if (isTestPath(normalized)) {
      const test = candidates.find((candidate) => candidate.rule.id === 'tests');
      if (test) return { file: normalized, ...test.rule, matchedBy: test.pattern };
    }
    candidates.sort((a, b) => b.score - a.score);
    if (candidates.length === 0) return { file: normalized, ruleId: null, category: 'unclassified', auditProfile: null, versionRequired: true, components: [], matchedBy: null };
    const selected = candidates[0].rule;
    return { file: normalized, ruleId: selected.id, category: selected.category, auditProfile: selected.auditProfile, versionRequired: selected.versionRequired, components: selected.components ?? [], matchedBy: candidates[0].pattern };
  });
}

function readJson(root, source) {
  return JSON.parse(readFileSync(join(root, source.path), 'utf8'));
}

function jsonPointer(value, pointer) {
  return pointer.reduce((current, key) => current?.[key], value);
}

function resolveSource(componentId, root, manifest, seen = new Set()) {
  if (seen.has(componentId)) throw new Error(`组件版本来源循环: ${componentId}`);
  const component = manifest.components[componentId];
  if (!component) throw new Error(`未知组件: ${componentId}`);
  const source = component.versionSource;
  if (source.type === 'alias') return resolveSource(source.component, root, manifest, new Set([...seen, componentId]));
  if (source.type === 'file') return readFileSync(join(root, source.path), 'utf8').trim();
  if (source.type === 'regexFile') {
    const match = readFileSync(join(root, source.path), 'utf8').match(new RegExp(source.pattern));
    return match?.[1] ?? null;
  }
  if (source.type === 'jsonPointer') return jsonPointer(readJson(root, source), source.pointer);
  if (source.type === 'alembicHead') {
    const revisions = new Set();
    const downRevisions = new Set();
    for (const file of readdirSync(join(root, source.path))) {
      if (!file.endsWith('.py')) continue;
      const text = readFileSync(join(root, source.path, file), 'utf8');
      const revision = text.match(/revision\s*(?::\s*str)?\s*=\s*["']([^"']+)["']/)?.[1];
      const down = text.match(/down_revision\s*(?::[^=]+)?\s*=\s*["']([^"']+)["']/)?.[1];
      if (revision) revisions.add(revision);
      if (down) downRevisions.add(down);
    }
    return [...revisions].filter((revision) => !downRevisions.has(revision)).sort().join(',');
  }
  throw new Error(`组件 ${componentId} 使用未知版本来源 ${source.type}`);
}

export function resolveVersions(root = ROOT, manifest = loadManifest(root)) {
  const versions = {};
  for (const id of Object.keys(manifest.components)) versions[id] = resolveSource(id, root, manifest);
  return versions;
}

export function requiredAudit(classifications, manifest) {
  const valid = classifications.filter((item) => item.auditProfile && manifest.auditProfiles[item.auditProfile]);
  return valid.sort((a, b) => manifest.auditProfiles[b.auditProfile].rank - manifest.auditProfiles[a.auditProfile].rank)[0]?.auditProfile ?? 'documentation';
}

export function validateChangeRecord(record, classifications, versions, manifest) {
  const errors = [];
  if (!record || record.schemaVersion !== 1 || !record.id) errors.push('变更记录缺少 schemaVersion=1 或 id');
  if (!record?.changeType) errors.push('变更记录缺少 changeType');
  if (!manifest.auditProfiles?.[record?.auditProfile]) errors.push(`变更记录引用了未知审计等级 ${record?.auditProfile ?? '(empty)'}`);
  if (!Array.isArray(record?.components)) errors.push('变更记录缺少 components');
  if (!Array.isArray(record?.versionChanges)) errors.push('变更记录缺少 versionChanges');
  if (!record?.compatibility || typeof record.compatibility !== 'object') errors.push('变更记录缺少 compatibility');
  if (!Array.isArray(record?.requiredAudits) || record.requiredAudits.length === 0) errors.push('变更记录缺少 requiredAudits');
  if (!Array.isArray(record?.evidence) || record.evidence.length === 0) errors.push('变更记录缺少 evidence');
  if (typeof record?.rollback !== 'string' || !record.rollback.trim()) errors.push('变更记录缺少 rollback');
  const required = requiredAudit(classifications, manifest);
  if ((manifest.auditProfiles[record?.auditProfile]?.rank ?? -1) < manifest.auditProfiles[required].rank) errors.push(`变更记录审计等级 ${record?.auditProfile ?? '(empty)'} 低于实际要求 ${required}`);
  const touched = new Set(classifications.flatMap((item) => item.versionRequired ? item.components : []));
  for (const component of touched) {
    if (!record?.components?.includes(component)) errors.push(`变更记录 components 没有覆盖受影响组件 ${component}`);
  }
  const declared = new Map((record?.versionChanges ?? []).map((item) => [item.component, item]));
  for (const component of touched) {
    if (!declared.has(component)) errors.push(`变更记录没有覆盖受影响组件 ${component}`);
  }
  for (const item of record?.versionChanges ?? []) {
    if (!manifest.components[item.component]) errors.push(`变更记录引用了未知组件 ${item.component}`);
    if (item.to !== versions[item.component]) errors.push(`${item.component} 的新版本 ${item.to} 与当前真源 ${versions[item.component]} 不一致`);
    if (item.to == null || (manifest.components[item.component]?.category !== 'architecture' && !SEMVER.test(item.to))) errors.push(`${item.component} 的新版本格式无效: ${item.to}`);
    if (item.from !== null && item.from === item.to) errors.push(`${item.component} 没有发生版本变化: ${item.from}`);
  }
  return errors;
}

function changedFiles(base) {
  // 使用 base 与工作树比较，既覆盖已提交的分支差异，也覆盖本地暂存/未暂存修改。
  // 发布/CI 传入远端基线，本机开发不必先提交才能得到审计结果。
  const args = base ? ['diff', '--name-only', '--diff-filter=ACMRD', base] : ['diff', '--name-only', 'HEAD'];
  const tracked = execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  return [...new Set(tracked)];
}

function parseArgs(argv) {
  const options = { base: null, files: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--base') options.base = argv[++i];
    else if (argv[i] === '--files') options.files = argv[++i]?.split(',').filter(Boolean) ?? [];
    else if (argv[i] === '--json') options.json = true;
  }
  return options;
}

export function run(argv = process.argv.slice(2), root = ROOT) {
  const options = parseArgs(argv);
  const manifest = loadManifest(root);
  const errors = validateManifest(manifest);
  const files = options.files ?? changedFiles(options.base);
  const classifications = classifyFiles(files, manifest);
  for (const item of classifications) if (item.ruleId === null) errors.push(`文件未分类，不能判断审计等级: ${item.file}`);
  const required = classifications.some((item) => item.versionRequired);
  const versions = resolveVersions(root, manifest);
  const records = files.filter((file) => /^versioning\/records\/[^/]+\.json$/.test(file));
  if (required && records.length === 0) errors.push('代码改动缺少 versioning/records/*.json 变更记录');
  if (records.length > 0) {
    const record = JSON.parse(readFileSync(join(root, records[0]), 'utf8'));
    errors.push(...validateChangeRecord(record, classifications, versions, manifest));
  }
  const result = { ok: errors.length === 0, files, classifications, requiredAudit: requiredAudit(classifications, manifest), versions, errors };
  if (options.json) return result;
  if (errors.length) {
    console.error('✗ 版本治理检查失败');
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ 版本治理检查通过：${files.length} 个改动文件，最高审计等级 ${result.requiredAudit}`);
    console.log(`  产品版本：${versions.product}`);
  }
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) run();
