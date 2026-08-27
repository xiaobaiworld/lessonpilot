export type TextMark = 'strong' | 'em' | 'underline';

export interface InlineContent {
  text: string;
  marks?: TextMark[];
  color?: string;
  link?: { href: string };
}

export type RichPageBlock =
  | { type: 'paragraph'; children: InlineContent[] }
  | { type: 'heading'; level: 2 | 3; children: InlineContent[] }
  | { type: 'quote'; children: InlineContent[] }
  | { type: 'list'; ordered: boolean; items: Array<{ children: InlineContent[] }> }
  | { type: 'image'; assetId: string; alt: string }
  | { type: 'audio'; assetId: string; title?: string }
  | { type: 'video'; assetId: string; title?: string; posterAssetId?: string };

export interface RichPageDocument {
  schemaVersion: 1;
  blocks: RichPageBlock[];
}

export type NodeKind = 'notice' | 'choice' | 'blank' | 'free_text';
export type WindowPosition = 'bottom-left' | 'bottom-right' | 'center';

export interface PresentationHints {
  windowSize?: 's' | 'm' | 'l' | 'overlay';
  windowStyle?: 'card' | 'document';
  windowPosition?: WindowPosition;
}

export interface AssetRecord {
  assetId: string;
  kind: 'image' | 'audio' | 'video';
  mimeType: string;
  byteSize: number;
  sha256: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  alt?: string;
  sourceType: 'uploaded' | 'licensed';
}

export interface PortableNode {
  id: string;
  enabled: boolean;
  family: 'attention' | 'practice';
  interaction: NodeKind;
  anchor: { kind: 'time_cross'; timeSeconds: number; captionId?: string | null };
  title: string;
  content: RichPageDocument;
  interactionData: Record<string, unknown> | null;
  presentationHints?: PresentationHints;
  effects: { pause: true };
}

const SAFE_COLORS = /^#[0-9a-f]{3,8}$/i;
const ASSET_URI = /^asset:\/\/([a-zA-Z0-9._:-]+)$/;

function safeHref(value: string): string | undefined {
  try {
    const url = new URL(value, 'https://knownmap.invalid/');
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function emptyRichPageDocument(): RichPageDocument {
  return { schemaVersion: 1, blocks: [] };
}

export function richDocumentFromText(text: string): RichPageDocument {
  const value = text.trim();
  return value
    ? { schemaVersion: 1, blocks: [{ type: 'paragraph', children: [{ text: value }] }] }
    : emptyRichPageDocument();
}

function cleanText(value: string): string {
  return value.replace(/\u00a0/g, ' ');
}

function marksFor(element: HTMLElement): TextMark[] {
  const marks: TextMark[] = [];
  let current: HTMLElement | null = element;
  while (current) {
    if ((current.tagName === 'STRONG' || current.tagName === 'B') && !marks.includes('strong')) {
      marks.push('strong');
    }
    if ((current.tagName === 'EM' || current.tagName === 'I') && !marks.includes('em')) {
      marks.push('em');
    }
    if (current.tagName === 'U' && !marks.includes('underline')) marks.push('underline');
    current = current.parentElement;
  }
  return marks;
}

function inlineFromNode(node: Node, parent: HTMLElement | null = null): InlineContent[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = cleanText(node.textContent ?? '');
    if (!text) return [];
    const marks = parent ? marksFor(parent) : [];
    const colorValue = parent?.style.color?.trim() ?? '';
    const color = colorValue && SAFE_COLORS.test(colorValue) ? colorValue : undefined;
    const linkElement = parent?.closest('a');
    const href = linkElement?.getAttribute('href') ?? '';
    return [{
      text,
      ...(marks.length ? { marks } : {}),
      ...(color ? { color } : {}),
    ...(safeHref(href) ? { link: { href } } : {}),
    }];
  }
  if (!(node instanceof HTMLElement)) return [];
  if (node.tagName === 'BR') return [{ text: '\n' }];
  const out: InlineContent[] = [];
  node.childNodes.forEach((child) => out.push(...inlineFromNode(child, node)));
  return out;
}

function nonEmptyChildren(children: InlineContent[]): InlineContent[] {
  return children.filter((item) => item.text.length > 0);
}

function assetIdFromElement(element: HTMLElement): string | null {
  const dataId = element.getAttribute('data-asset-id')?.trim() ?? '';
  const dataMatch = ASSET_URI.exec(dataId);
  if (dataMatch) return dataMatch[1];
  if (dataId && /^[a-zA-Z0-9._:-]+$/.test(dataId)) return dataId;
  const srcMatch = ASSET_URI.exec((element.getAttribute('src') ?? '').trim());
  return srcMatch?.[1] ?? null;
}

function blockFromElement(element: HTMLElement): RichPageBlock | null {
  const children = nonEmptyChildren(inlineFromNode(element));
  if (element.tagName === 'H2' || element.tagName === 'H3') {
    return { type: 'heading', level: element.tagName === 'H2' ? 2 : 3, children };
  }
  if (element.tagName === 'BLOCKQUOTE') return { type: 'quote', children };
  if (element.tagName === 'UL' || element.tagName === 'OL') {
    const items = [...element.children]
      .filter((child): child is HTMLElement => child.tagName === 'LI')
      .map((item) => ({ children: nonEmptyChildren(inlineFromNode(item)) }))
      .filter((item) => item.children.length > 0);
    return items.length ? { type: 'list', ordered: element.tagName === 'OL', items } : null;
  }
  if (element.tagName === 'IMG') {
    const assetId = assetIdFromElement(element);
    return assetId ? {
      type: 'image',
      assetId,
      alt: element.getAttribute('alt') ?? '',
    } : null;
  }
  if (element.tagName === 'AUDIO' || element.tagName === 'VIDEO') {
    const assetId = assetIdFromElement(element);
    if (!assetId) return null;
    return element.tagName === 'AUDIO'
      ? { type: 'audio', assetId, ...(element.getAttribute('title') ? { title: element.getAttribute('title')! } : {}) }
      : {
          type: 'video',
          assetId,
          ...(element.getAttribute('title') ? { title: element.getAttribute('title')! } : {}),
          ...(element.getAttribute('data-poster-asset-id') ? { posterAssetId: element.getAttribute('data-poster-asset-id')! } : {}),
        };
  }
  return { type: 'paragraph', children };
}

function blocksFromElement(element: HTMLElement): RichPageBlock[] {
  if (element.tagName === 'P' || element.tagName === 'DIV') {
    const media = [...element.children].filter(
      (child): child is HTMLElement => ['IMG', 'AUDIO', 'VIDEO'].includes(child.tagName)
    );
    if (media.length) {
      const blocks: RichPageBlock[] = [];
      const textBlock = blockFromElement(element);
      if (textBlock?.type === 'paragraph' && textBlock.children.length) blocks.push(textBlock);
      for (const child of media) {
        const block = blockFromElement(child);
        if (block) blocks.push(block);
      }
      return blocks;
    }
  }
  const block = blockFromElement(element);
  return block ? [block] : [];
}

/** 将教师编辑器的有限 HTML 转成跨客户端保存的结构化文档。 */
export function richDocumentFromHtml(html: string): RichPageDocument {
  const root = document.createElement('div');
  root.innerHTML = html;
  const blocks: RichPageBlock[] = [];
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      blocks.push({ type: 'paragraph', children: [{ text: cleanText(node.textContent) }] });
    } else if (node instanceof HTMLElement) {
      for (const block of blocksFromElement(node)) {
        if (block.type !== 'paragraph' || block.children.length) blocks.push(block);
      }
    }
  });
  return { schemaVersion: 1, blocks };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineHtml(inline: InlineContent): string {
  let value = escapeHtml(inline.text).replace(/\n/g, '<br>');
  if (inline.link) value = `<a href="${escapeHtml(inline.link.href)}">${value}</a>`;
  if (inline.color) value = `<span style="color: ${escapeHtml(inline.color)}">${value}</span>`;
  for (const mark of inline.marks ?? []) {
    if (mark === 'strong') value = `<strong>${value}</strong>`;
    if (mark === 'em') value = `<em>${value}</em>`;
    if (mark === 'underline') value = `<u>${value}</u>`;
  }
  return value;
}

function childrenHtml(children: InlineContent[]): string {
  return children.map(inlineHtml).join('');
}

/** 将结构化文档转成当前教师/插件渲染器可消费的有限 HTML。 */
export function richDocumentToHtml(documentValue: RichPageDocument): string {
  if (documentValue.schemaVersion !== 1) return '';
  return documentValue.blocks.map((block) => {
    switch (block.type) {
      case 'paragraph': return `<p>${childrenHtml(block.children)}</p>`;
      case 'heading': return `<h${block.level}>${childrenHtml(block.children)}</h${block.level}>`;
      case 'quote': return `<blockquote>${childrenHtml(block.children)}</blockquote>`;
      case 'list': {
        const tag = block.ordered ? 'ol' : 'ul';
        return `<${tag}>${block.items.map((item) => `<li>${childrenHtml(item.children)}</li>`).join('')}</${tag}>`;
      }
      case 'image': return `<img src="asset://${block.assetId}" alt="${escapeHtml(block.alt)}">`;
      case 'audio': return `<audio controls data-asset-id="asset://${block.assetId}" title="${escapeHtml(block.title ?? '')}"></audio>`;
      case 'video': return `<video controls data-asset-id="asset://${block.assetId}"${block.posterAssetId ? ` data-poster-asset-id="${escapeHtml(block.posterAssetId)}"` : ''} title="${escapeHtml(block.title ?? '')}"></video>`;
    }
  }).join('');
}

export function richDocumentToPlainText(documentValue: RichPageDocument): string {
  return documentValue.blocks.map((block) => {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
      case 'quote': return block.children.map((child) => child.text).join(' ');
      case 'list': return block.items.map((item) => item.children.map((child) => child.text).join(' ')).join(' ');
      case 'image': return block.alt;
      case 'audio': return block.title ?? '';
      case 'video': return block.title ?? '';
    }
  }).join(' ').replace(/\s+/g, ' ').trim();
}
