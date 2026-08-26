const ALLOWED_TAGS = new Set([
  'A',
  'AUDIO',
  'B',
  'BLOCKQUOTE',
  'BR',
  'DIV',
  'EM',
  'FONT',
  'H2',
  'H3',
  'I',
  'IMG',
  'LI',
  'OL',
  'P',
  'SPAN',
  'STRONG',
  'U',
  'UL',
  'VIDEO',
]);

export const WINDOW_SIZES = ['s', 'm', 'l', 'overlay'] as const;
export const WINDOW_STYLES = ['card', 'document'] as const;
export const WINDOW_POSITIONS = ['bottom-left', 'bottom-right', 'center'] as const;

export type WindowSize = (typeof WINDOW_SIZES)[number];
export type WindowStyle = (typeof WINDOW_STYLES)[number];
export type WindowPosition = (typeof WINDOW_POSITIONS)[number];

export function isSafeRichTextHref(value: string, base = 'https://knownmap.invalid/'): boolean {
  try {
    const url = new URL(value, base);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function isSafeRichTextImageSrc(
  value: string,
  base = 'https://knownmap.invalid/'
): boolean {
  try {
    const url = new URL(value, base);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function assetIdFromUri(value: string): string | null {
  const match = /^asset:\/\/([a-zA-Z0-9._:-]+)$/.exec(value.trim());
  return match?.[1] ?? null;
}

export function isSafeRichTextColor(value: string): boolean {
  const color = value.trim();
  return /^#[0-9a-f]{3,8}$/i.test(color) || /^rgb(a)?\([\d\s.,%]+\)$/i.test(color);
}

function cloneSafeNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? '');
  if (!(node instanceof HTMLElement) || !ALLOWED_TAGS.has(node.tagName)) return null;

  const clean = document.createElement(node.tagName === 'FONT' ? 'span' : node.tagName.toLowerCase());
  if (node.tagName === 'A') {
    const href = node.getAttribute('href') ?? '';
    if (!isSafeRichTextHref(href, window.location.origin)) {
      return document.createTextNode(node.textContent ?? '');
    }
    clean.setAttribute('href', href);
    clean.setAttribute('target', '_blank');
    clean.setAttribute('rel', 'noreferrer noopener');
  }
  if (node.tagName === 'IMG') {
    const src = node.getAttribute('src') ?? '';
    const assetId = assetIdFromUri(src) ?? assetIdFromUri(node.getAttribute('data-asset-id') ?? '');
    if (assetId) clean.setAttribute('data-asset-id', assetId);
    else if (isSafeRichTextImageSrc(src, window.location.origin)) clean.setAttribute('src', src);
    else return null;
    clean.setAttribute('alt', node.getAttribute('alt') ?? '');
    return clean;
  }
  if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
    const assetId = assetIdFromUri(node.getAttribute('data-asset-id') ?? '');
    if (!assetId) return null;
    clean.setAttribute('data-asset-id', assetId);
    if (node.getAttribute('controls') !== null) clean.setAttribute('controls', '');
    if (node.getAttribute('title')) clean.setAttribute('title', node.getAttribute('title')!);
    return clean;
  }
  if (node.tagName === 'SPAN' || node.tagName === 'FONT') {
    const color = node.tagName === 'FONT' ? node.getAttribute('color') ?? '' : node.style.color;
    if (isSafeRichTextColor(color)) clean.setAttribute('style', `color: ${color.trim()}`);
  }
  node.childNodes.forEach((child) => {
    const safeChild = cloneSafeNode(child);
    if (safeChild) clean.append(safeChild);
  });
  return clean;
}

/** 将编辑器生成的有限 HTML 转成安全 DOM；未知标签和属性一律丢弃。 */
export function appendRichText(target: HTMLElement, html: string): void {
  const source = new DOMParser().parseFromString(html, 'text/html').body;
  source.childNodes.forEach((node) => {
    const safe = cloneSafeNode(node);
    if (safe) target.append(safe);
  });
}

/** 教师保存与切 Tab 时用：得到消毒后的 HTML 字符串。 */
export function sanitizeRichTextHtml(html: string): string {
  const wrap = document.createElement('div');
  appendRichText(wrap, html);
  return wrap.innerHTML;
}

export function resolveWindowPresentation(hints: Record<string, unknown>): {
  size: WindowSize;
  style: WindowStyle;
  position: WindowPosition;
} {
  const size = WINDOW_SIZES.includes(hints.windowSize as WindowSize)
    ? (hints.windowSize as WindowSize)
    : 's';
  const style = WINDOW_STYLES.includes(hints.windowStyle as WindowStyle)
    ? (hints.windowStyle as WindowStyle)
    : 'card';
  const position = WINDOW_POSITIONS.includes(hints.windowPosition as WindowPosition)
    ? (hints.windowPosition as WindowPosition)
    : size === 'overlay'
      ? 'center'
      : 'bottom-right';
  return { size, style, position };
}
