#!/usr/bin/env node
// 仓库秘密扫描。
//
// 用法：
//   node tools/secret-scan.mjs            扫描 Git 跟踪的全部文件
//   node tools/secret-scan.mjs --json      机器可读输出
//   node tools/secret-scan.mjs --staged    只扫暂存区（适合 pre-commit）
//
// 依据 `SEC-SECRET-003`：授权码原文、会话密钥、授权码验证密钥及其它系统秘密
// 不得通过版本库取得。该需求把「仓库秘密扫描测试」列为验收证据。
//
// 只扫 Git 跟踪的文件：未跟踪文件不会进入发布物，node_modules 和 .venv 也不该扫。
//
// 设计取向：宁可漏报也不能让人学会忽略告警。因此
//  - 模式针对真实凭证形态，不匹配「password」这类词本身；
//  - 已知安全的占位、示例和测试夹具通过 ALLOWLIST 显式排除，每条附理由；
//  - 命中只报文件、行号和规则名，**不打印命中的内容** —— 否则扫描输出自己变成泄露渠道。

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

/** 二进制和产物类扩展名：扫描它们只会产生噪音。 */
const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pdf', '.zip', '.gz', '.tar', '.mp4', '.mp3', '.srt', '.vtt',
  '.lock',
]);

/** 单文件大小上限：超过多半是产物或数据集。 */
const MAX_BYTES = 512 * 1024;

/**
 * 检测规则。每条只针对可直接使用的凭证形态。
 *
 * `name` 出现在报告里，`why` 说明为什么这个形态是可用秘密。
 */
export const RULES = [
  {
    name: 'private-key-block',
    why: 'PEM 私钥块可直接用于签名或解密',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
    // 私钥块没有「占位」形态：即使内容是假的，提交这个结构本身也应人工确认。
    allowPlaceholder: false,
  },
  {
    name: 'aws-access-key-id',
    why: 'AWS 访问密钥 ID 与 secret 配对即可调用云 API',
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  },
  {
    name: 'github-token',
    why: 'GitHub 令牌可读写仓库和发布',
    pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
  },
  {
    name: 'slack-token',
    why: 'Slack 令牌可读取消息和文件',
    pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/,
  },
  {
    name: 'generic-assigned-secret',
    why: '把长随机值直接赋给 secret/token/password 类变量，通常是真实凭证',
    // 至少 20 位、含大小写或数字的连续串，且不是明显占位
    pattern:
      /\b(?:secret|token|passwd|password|api[_-]?key|private[_-]?key|session[_-]?key)\b\s*[:=]\s*["'][A-Za-z0-9+/=_-]{20,}["']/i,
  },
  {
    name: 'knownmap-access-code',
    why: 'KM- 授权码原文按 SEC-SECRET-003 只显示一次，不得入库',
    pattern: /\bKM-[A-Z2-7]{5}(?:-[A-Z2-7]{5}){3}\b/,
  },
  {
    name: 'postgres-url-with-password',
    why: '连接串内嵌口令可直接连库',
    pattern: /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\/[^\s:@/]+:[^\s:@/]+@/,
  },
];

/**
 * 已知安全的例外。每条必须写明为什么它不是可用秘密。
 *
 * 只允许「文件 + 规则」粒度，不允许整目录豁免 —— 那样新文件会自动获得豁免。
 */
export const ALLOWLIST = [
  {
    file: 'tools/secret-scan.mjs',
    rules: ['*'],
    why: '本文件包含检测模式本身，模式不是凭证',
  },
  {
    file: 'doc/design/v1/06-interface-contracts.md',
    rules: ['knownmap-access-code'],
    why: '契约示例用的是 KM-EXAMPLE-ONLY 形态的说明值，不是可兑换授权码',
  },
  {
    file: 'tests/doc-consistency.test.mjs',
    rules: ['*'],
    why:
      '该文件用刻意构造成真实形态的样本验证每条规则会命中 —— ' +
      '一个只会通过的扫描器等于没有扫描器。样本是随机生成的无效值，' +
      '不对应任何真实账号、仓库或数据库。',
  },
];

function isAllowed(file, ruleName) {
  return ALLOWLIST.some(
    (entry) => entry.file === file && (entry.rules.includes('*') || entry.rules.includes(ruleName)),
  );
}

/**
 * 判断命中是否为明显的占位或示例，而不是可用凭证。
 *
 * 这不是宽容，是必要的：一个对每个测试夹具都告警的扫描器会被学会忽略，
 * 那时它对真实泄露也不起作用。真实凭证是高熵随机值；占位是重复字符、
 * 连续字母或词典词。
 */
export function looksLikePlaceholder(text) {
  const value = text.trim();

  // 全 X / 全同一字符的段，例如 KM-XXXXX-XXXXX 或 KM-AAAAA-AAAAA
  const segments = value.split(/[-_:/.]/).filter((s) => s.length >= 4);
  if (segments.length > 0 && segments.every((s) => new Set(s.toUpperCase()).size === 1)) {
    return true;
  }

  // 连续字母表片段，升序或降序。例如 ABCDE-FGHIJ 与 ZYXWV-TSRQP
  // （测试常用第二个降序码来区分两次调用）。
  const isSequential = (s) => {
    const upper = s.toUpperCase();
    if (upper.length < 4) return false;
    const step = upper.charCodeAt(1) - upper.charCodeAt(0);
    if (step !== 1 && step !== -1) return false;
    for (let i = 1; i < upper.length; i += 1) {
      if (upper.charCodeAt(i) - upper.charCodeAt(i - 1) !== step) return false;
    }
    return true;
  };
  if (segments.length > 0 && segments.every(isSequential)) return true;

  // 词典式占位词：真实凭证不会由这些词构成
  const placeholderWords = [
    'example', 'placeholder', 'sample', 'dummy', 'fake', 'test', 'todo',
    'changeme', 'replace', 'your', 'xxx', 'redacted', 'secret-here', 'notreal',
  ];
  const lower = value.toLowerCase();
  if (placeholderWords.some((word) => lower.includes(word))) return true;

  // 低熵：去重后字符种类过少，或全为小写字母加分隔符（词典词形态）
  const quoted = value.match(/["']([^"']+)["']/)?.[1] ?? value;
  if (/^[a-z][a-z-]*[a-z]$/.test(quoted)) return true;

  return false;
}

function trackedFiles(staged) {
  const args = staged
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACM']
    : ['ls-files'];
  return execFileSync('git', args, { encoding: 'utf8' })
    .split('\n')
    .filter((line) => line.length > 0);
}

export function scan({ staged = false } = {}) {
  const findings = [];
  let scanned = 0;
  let skipped = 0;

  for (const file of trackedFiles(staged)) {
    const dot = file.lastIndexOf('.');
    const ext = dot === -1 ? '' : file.slice(dot).toLowerCase();
    if (SKIP_EXTENSIONS.has(ext)) {
      skipped += 1;
      continue;
    }
    let size;
    try {
      size = statSync(file).size;
    } catch {
      // 暂存区里可能有已删除的文件
      continue;
    }
    if (size > MAX_BYTES) {
      skipped += 1;
      continue;
    }

    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      skipped += 1;
      continue;
    }
    scanned += 1;

    const lines = text.split('\n');
    for (const rule of RULES) {
      if (isAllowed(file, rule.name)) continue;
      for (const [index, line] of lines.entries()) {
        const match = line.match(rule.pattern);
        if (!match) continue;
        // 私钥块和云厂商令牌没有「占位」形态可言，一律报告。
        if (rule.allowPlaceholder !== false && looksLikePlaceholder(match[0])) continue;
        // 只记录位置和规则，绝不记录命中内容：报告本身不能成为泄露渠道。
        findings.push({ file, line: index + 1, rule: rule.name, why: rule.why });
      }
    }
  }
  return { findings, scanned, skipped };
}

function main() {
  const staged = process.argv.includes('--staged');
  const result = scan({ staged });

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.findings.length > 0 ? 1 : 0);
  }

  console.log(`扫描 ${result.scanned} 个文件（跳过 ${result.skipped} 个二进制/超大/产物文件）。`);

  if (result.findings.length === 0) {
    console.log('✓ 未发现可用秘密');
    return;
  }

  console.log(`\n✗ 疑似秘密 ${result.findings.length} 处：`);
  for (const f of result.findings) {
    console.log(`    ${f.file}:${f.line}  [${f.rule}]  ${f.why}`);
  }
  console.log(
    '\n处置顺序：先确认该凭证是否已在真实环境使用 —— 若是，先吊销再改代码。' +
      '\n从历史中移除比从工作区移除困难得多，不要只删当前文件就认为解决了。' +
      '\n确认是占位或示例时，在 tools/secret-scan.mjs 的 ALLOWLIST 按「文件 + 规则」登记并写明理由。',
  );
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
