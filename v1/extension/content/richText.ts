import {
  WINDOW_POSITIONS,
  WINDOW_SIZES,
  WINDOW_STYLES,
  resolvePresentationHints,
  type WindowPosition,
  type WindowSize,
  type WindowStyle,
  type ResolvedPresentationHints,
} from '../../web/shared/src';

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

export {
  WINDOW_POSITIONS,
  WINDOW_SIZES,
  WINDOW_STYLES,
  type WindowPosition,
  type WindowSize,
  type WindowStyle,
};

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

/**
 * `data-asset-id` is emitted as a bare ID after the runtime sanitizer has
 * detached the portable `asset://` URI from the DOM.  Never apply this
 * fallback to `src`: a normal external URL must remain an external image.
 */
function assetIdFromDataAttribute(value: string | null): string | null {
  const normalized = value?.trim() ?? '';
  return assetIdFromUri(normalized) ?? (/^[a-zA-Z0-9._:-]+$/.test(normalized) ? normalized : null);
}

export interface RuntimeAsset {
  mimeType: string;
  bytes: ArrayBuffer;
}

export type RuntimeAssetLoader = (assetId: string) => Promise<RuntimeAsset | null>;

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
    const assetId = assetIdFromUri(src) ?? assetIdFromDataAttribute(node.getAttribute('data-asset-id'));
    if (assetId) clean.setAttribute('data-asset-id', assetId);
    else if (isSafeRichTextImageSrc(src, window.location.origin)) clean.setAttribute('src', src);
    else return null;
    clean.setAttribute('alt', node.getAttribute('alt') ?? '');
    return clean;
  }
  if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
    const assetId = assetIdFromDataAttribute(node.getAttribute('data-asset-id'));
    if (!assetId) return null;
    clean.setAttribute('data-asset-id', assetId);
    if (node.getAttribute('controls') !== null) clean.setAttribute('controls', '');
    if (node.getAttribute('title')) clean.setAttribute('title', node.getAttribute('title')!);
    if (node.tagName === 'VIDEO') {
      const posterAssetId = assetIdFromDataAttribute(node.getAttribute('data-poster-asset-id'));
      if (posterAssetId) clean.setAttribute('data-poster-asset-id', posterAssetId);
    }
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

function acceptsMime(element: Element, mimeType: string): boolean {
  const normalized = mimeType.toLowerCase();
  if (element.tagName === 'IMG') return normalized.startsWith('image/');
  if (element.tagName === 'AUDIO') return normalized.startsWith('audio/');
  if (element.tagName === 'VIDEO') return normalized.startsWith('video/');
  return false;
}

/**
 * Resolve only the asset IDs emitted by the sanitizer. Blob URLs are created
 * in the content world because URLs created by the service worker are not
 * usable by the page-facing DOM.
 */
export async function resolveRichTextAssets(
  target: HTMLElement,
  loadAsset: RuntimeAssetLoader
): Promise<() => void> {
  const urls: string[] = [];
  const elements = [...target.querySelectorAll<HTMLElement>('[data-asset-id]')];
  await Promise.all(
    elements.map(async (element) => {
      const assetId = assetIdFromDataAttribute(element.dataset.assetId ?? null);
      if (!assetId) return;
      const asset = await loadAsset(assetId).catch(() => null);
      if (!asset || !acceptsMime(element, asset.mimeType)) return;
      const url = URL.createObjectURL(new Blob([asset.bytes], { type: asset.mimeType }));
      element.setAttribute('src', url);
      urls.push(url);

      if (element.tagName === 'VIDEO') {
        const posterId = assetIdFromDataAttribute(
          element.getAttribute('data-poster-asset-id')
        );
        if (posterId) {
          const poster = await loadAsset(posterId).catch(() => null);
          if (poster && poster.mimeType.toLowerCase().startsWith('image/')) {
            const posterUrl = URL.createObjectURL(
              new Blob([poster.bytes], { type: poster.mimeType })
            );
            element.setAttribute('poster', posterUrl);
            urls.push(posterUrl);
          }
        }
      }
    })
  );
  return () => {
    urls.forEach((url) => URL.revokeObjectURL(url));
  };
}

/** 教师保存与切 Tab 时用：得到消毒后的 HTML 字符串。 */
export function sanitizeRichTextHtml(html: string): string {
  const wrap = document.createElement('div');
  appendRichText(wrap, html);
  return wrap.innerHTML;
}

export function resolveWindowPresentation(hints: Record<string, unknown>): ResolvedPresentationHints {
  return resolvePresentationHints(hints);
}
