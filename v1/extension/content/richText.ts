const ALLOWED_TAGS = new Set([
  'A',
  'B',
  'BLOCKQUOTE',
  'BR',
  'DIV',
  'EM',
  'FONT',
  'H3',
  'I',
  'LI',
  'OL',
  'P',
  'SPAN',
  'STRONG',
  'U',
  'UL',
]);

export function isSafeRichTextHref(value: string, base = 'https://knownmap.invalid/'): boolean {
  try {
    const url = new URL(value, base);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function isSafeRichTextColor(value: string): boolean {
  const color = value.trim();
  return /^#[0-9a-f]{3,8}$/i.test(color) || /^rgb(a)?\([\d\s.,%]+\)$/i.test(color);
}

function appendSafeNode(target: HTMLElement, node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    target.append(document.createTextNode(node.textContent ?? ''));
    return;
  }
  if (!(node instanceof HTMLElement) || !ALLOWED_TAGS.has(node.tagName)) return;

  const clean = document.createElement(node.tagName === 'FONT' ? 'span' : node.tagName.toLowerCase());
  if (node.tagName === 'A') {
    const href = node.getAttribute('href') ?? '';
    if (!isSafeRichTextHref(href, window.location.origin)) {
      target.append(document.createTextNode(node.textContent ?? ''));
      return;
    }
    clean.setAttribute('href', href);
    clean.setAttribute('target', '_blank');
    clean.setAttribute('rel', 'noreferrer noopener');
  }
  if (node.tagName === 'SPAN' || node.tagName === 'FONT') {
    const color = node.tagName === 'FONT' ? node.getAttribute('color') ?? '' : node.style.color;
    if (isSafeRichTextColor(color)) clean.setAttribute('style', `color: ${color.trim()}`);
  }
  node.childNodes.forEach((child) => appendSafeNode(clean, child));
  target.append(clean);
}

/** 将编辑器生成的有限 HTML 转成安全 DOM；未知标签和属性一律丢弃。 */
export function appendRichText(target: HTMLElement, html: string): void {
  const source = new DOMParser().parseFromString(html, 'text/html').body;
  source.childNodes.forEach((node) => appendSafeNode(target, node));
}
