const ALLOWED_TAGS = new Set([
  'A',
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
]);

export const WINDOW_SIZES = ['s', 'm', 'l', 'overlay'] as const;
export const WINDOW_STYLES = ['card', 'document'] as const;

export type WindowSize = (typeof WINDOW_SIZES)[number];
export type WindowStyle = (typeof WINDOW_STYLES)[number];

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
    if (!isSafeRichTextImageSrc(src, window.location.origin)) return null;
    clean.setAttribute('src', src);
    clean.setAttribute('alt', node.getAttribute('alt') ?? '');
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

export function resolveWindowPresentation(display: Record<string, unknown>): {
  size: WindowSize;
  style: WindowStyle;
} {
  const size = WINDOW_SIZES.includes(display.windowSize as WindowSize)
    ? (display.windowSize as WindowSize)
    : 's';
  const style = WINDOW_STYLES.includes(display.windowStyle as WindowStyle)
    ? (display.windowStyle as WindowStyle)
    : 'card';
  return { size, style };
}

export function pageHtmlFromDisplay(display: Record<string, unknown>): string {
  const rich = typeof display.richBody === 'string' ? display.richBody.trim() : '';
  if (rich) return rich;
  return typeof display.prompt === 'string' ? display.prompt.trim() : '';
}
