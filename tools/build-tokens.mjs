#!/usr/bin/env node

/**
 * KnownMap 视觉 token 生成器。
 *
 * 品牌颜色从 knownmap-tokens.json 读取；工程 token 的角色映射集中在这里，
 * 生成物 tokens.css 禁止手改。阶段 0 的新增颜色在这里做对比度校准，
 * 通过后才允许写入 CSS。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, '..');
const sourcePath = path.join(root, 'v1/assets/brand/knownmap-tokens.json');
const outputPath = path.join(root, 'v1/web/shared/src/styles/tokens.css');

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const brand = source.colors;

const roles = {
  canvas: '#F5F1E7',
  surface: brand.pathStroke.hex,
  sunken: '#EDE8DA',
  ink: brand.wordmarkInk.hex,
  ink2: '#43544C',
  ink3: brand.foldStrokeOnLight.hex,
  line: '#D8D2C2',
  lineOnDark: brand.mapStroke.hex,
  brand: brand.brandGreen.hex,
  brandDeep: brand.containerGreen.hex,
  accent: '#D9A51E',
  end: brand.pathEnd.hex,
  danger: '#A74232',
  voice: '#3E8060',
  activity: '#A9654E',
  ai: '#5D766E',
  status: '#E5B93F',
};

const contrastPairs = [
  ['ink', 'canvas', 4.5, '正文文字'],
  ['ink2', 'canvas', 4.5, '次级文字'],
  ['brand', 'canvas', 4.5, '浅底主行动文字'],
  ['danger', 'canvas', 4.5, '浅底危险文字'],
  ['surface', 'brand', 3, '品牌按钮文字'],
  ['lineOnDark', 'brandDeep', 3, '深底细线或图标'],
  ['ink3', 'canvas', 3, '辅助文字或图标'],
];

function channel(value) {
  const normalized = value.replace('#', '');
  const channels = normalized.length === 3
    ? normalized.split('').map((item) => Number.parseInt(item + item, 16))
    : [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
  return channels.map((item) => item / 255).map((item) => (
    item <= 0.03928 ? item / 12.92 : ((item + 0.055) / 1.055) ** 2.4
  ));
}

export function contrast(first, second) {
  const firstLuminance = channel(first).reduce((sum, item, index) => sum + item * [0.2126, 0.7152, 0.0722][index], 0);
  const secondLuminance = channel(second).reduce((sum, item, index) => sum + item * [0.2126, 0.7152, 0.0722][index], 0);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function validateContrast() {
  const failures = contrastPairs
    .map(([foreground, background, minimum, label]) => ({
      foreground,
      background,
      minimum,
      label,
      actual: contrast(roles[foreground], roles[background]),
    }))
    .filter((item) => item.actual < item.minimum);
  if (failures.length > 0) {
    throw new Error(
      failures
        .map((item) => `${item.label} ${item.foreground}/${item.background} 对比度 ${item.actual.toFixed(2)} < ${item.minimum}`)
        .join('\n')
    );
  }
}

function cssVariable(name, value, comment) {
  return `  --${name}: ${value};${comment ? ` /* ${comment} */` : ''}`;
}

export function buildTokensCss() {
  validateContrast();
  const lines = [
    '/* 此文件由 tools/build-tokens.mjs 生成，请勿手工修改。 */',
    `/* source: ${path.relative(root, sourcePath)} */`,
    ':root {',
    cssVariable('canvas', roles.canvas, '视觉方案 §5.2'),
    cssVariable('surface', roles.surface, 'brand.pathStroke'),
    cssVariable('sunken', roles.sunken, '阶段 0 对比度校准后的凹陷表面'),
    cssVariable('ink', roles.ink, 'brand.wordmarkInk'),
    cssVariable('ink-2', roles.ink2, '阶段 0 对比度校准后的次级文字'),
    cssVariable('ink-3', roles.ink3, 'brand.foldStrokeOnLight'),
    cssVariable('line', roles.line, '阶段 0 对比度校准后的浅底细线'),
    cssVariable('line-on-dark', roles.lineOnDark, 'brand.mapStroke'),
    cssVariable('brand', roles.brand, 'brand.brandGreen'),
    cssVariable('brand-deep', roles.brandDeep, 'brand.containerGreen'),
    cssVariable('accent', roles.accent, '视觉方案 §5.2'),
    cssVariable('end', roles.end, 'brand.pathEnd'),
    cssVariable('danger', roles.danger, '阶段 0 对比度校准后的危险色'),
    cssVariable('voice', roles.voice, '现有节点语义色，阶段 2 再校准'),
    cssVariable('activity', roles.activity, '现有节点语义色，阶段 2 再校准'),
    cssVariable('ai', roles.ai, '现有节点语义色，阶段 2 再校准'),
    cssVariable('status', roles.status, '现有状态色，阶段 2 再校准'),
    '',
    '  --font-family: "Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif;',
    '  --font-size-display: 28px;',
    '  --font-size-title: 22px;',
    '  --font-size-head: 17px;',
    '  --font-size-body: 15px;',
    '  --font-size-small: 13px;',
    '  --font-size-micro: 11px;',
    '  --font-weight-regular: 400;',
    '  --font-weight-medium: 590;',
    '  --font-weight-strong: 650;',
    '',
    '  --space-1: 4px;',
    '  --space-2: 8px;',
    '  --space-3: 12px;',
    '  --space-4: 16px;',
    '  --space-5: 24px;',
    '  --space-6: 32px;',
    '  --space-7: 48px;',
    '  --radius-control: 6px;',
    '  --radius-card: 8px;',
    '  --radius-pill: 999px;',
    '  --shadow-popover: 0 18px 48px rgba(22, 37, 31, 0.12);',
    '  --motion-fast: 150ms ease-out;',
    '  --motion-standard: 200ms ease-out;',
    '',
    '  /* 旧页面分阶段迁移时使用的兼容别名；阶段 1–4 完成后逐步删除。 */',
    '  --paper: var(--canvas);',
    '  --paper-bright: var(--surface);',
    '  --ink-soft: var(--ink-2);',
    '  --green: var(--brand);',
    '  --green-deep: var(--brand-deep);',
    '  --green-pale: #D9E9DF;',
    '  --chalk: var(--accent);',
    '  --chalk-pale: #F5E7B0;',
    '  --line-dark: #B9BEB5;',
    '  --radius: var(--radius-control);',
    '}',
    '',
    '@media (prefers-reduced-motion: reduce) {',
    '  *, *::before, *::after {',
    '    scroll-behavior: auto !important;',
    '    transition-duration: 0.01ms !important;',
    '    animation-duration: 0.01ms !important;',
    '    animation-iteration-count: 1 !important;',
    '  }',
    '}',
    '',
  ];
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const generated = buildTokensCss();
  if (process.argv.includes('--check')) {
    const current = readFileSync(outputPath, 'utf8');
    if (current !== generated) {
      console.error(`tokens.css 不是最新生成物：请运行 node tools/build-tokens.mjs`);
      process.exitCode = 1;
    }
  } else {
    writeFileSync(outputPath, generated);
    console.log(`已生成 ${path.relative(root, outputPath)}`);
  }
}
