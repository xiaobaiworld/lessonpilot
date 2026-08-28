import { AssetRecord, InstalledCourse, InstalledLesson } from '../storage/types';

export type Invalid = { ok: false; reason: string };
export type Valid<T> = { ok: true; value: T };
export type Checked<T> = Valid<T> | Invalid;

const BVID = /^BV[0-9A-Za-z]{10}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const COLOR = /^#[0-9a-f]{3,8}$/i;
const ASSET_KINDS = new Set(['image', 'audio', 'video']);
const NODE_KINDS = new Set(['notice', 'choice', 'blank', 'free_text']);
const MARKS = new Set(['strong', 'em', 'underline']);
const MIME_PREFIX: Record<string, string> = { image: 'image/', audio: 'audio/', video: 'video/' };

function isObject(v: unknown): v is Record<string, any> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function nonBlank(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function onlyKeys(raw: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => key in raw) && Object.keys(raw).every((key) => allowed.has(key));
}

function safeHref(value: unknown): value is string {
  if (!nonBlank(value)) return false;
  try {
    const protocol = new URL(value, 'https://knownmap.invalid/').protocol;
    return ['http:', 'https:', 'mailto:'].includes(protocol);
  } catch {
    return false;
  }
}

function checkInline(value: unknown): boolean {
  if (!isObject(value) || !onlyKeys(value, ['text'], ['marks', 'color', 'link']) || !nonBlank(value.text)) return false;
  if (value.marks !== undefined && (!Array.isArray(value.marks) || value.marks.some((mark: unknown) => !MARKS.has(String(mark))))) return false;
  if (value.color !== undefined && (typeof value.color !== 'string' || !COLOR.test(value.color))) return false;
  if (value.link !== undefined && (!isObject(value.link) || !onlyKeys(value.link, ['href']) || !safeHref(value.link.href))) return false;
  return true;
}

function checkChildren(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.length > 0 && value.every(checkInline);
}

function checkDocument(
  value: unknown,
  assets: Set<string>,
  packageAssets: Map<string, AssetRecord>,
  at: string
): string | null {
  if (!isObject(value) || !onlyKeys(value, ['schemaVersion', 'blocks']) || value.schemaVersion !== 1 || !Array.isArray(value.blocks) || !value.blocks.length) {
    return `${at} 的结构化文档版本或 blocks 无效`;
  }
  for (const [i, block] of value.blocks.entries()) {
    if (!isObject(block) || typeof block.type !== 'string') return `${at}.blocks[${i}] 内容块不受支持`;
    if (['paragraph', 'quote'].includes(block.type)) {
      if (!onlyKeys(block, ['type', 'children']) || !checkChildren(block.children)) return `${at}.blocks[${i}] 文本无效`;
    } else if (block.type === 'heading') {
      if (!onlyKeys(block, ['type', 'level', 'children']) || ![2, 3].includes(block.level) || !checkChildren(block.children)) return `${at}.blocks[${i}] 标题无效`;
    } else if (block.type === 'list') {
      if (!onlyKeys(block, ['type', 'ordered', 'items']) || typeof block.ordered !== 'boolean' || !Array.isArray(block.items) || !block.items.length || block.items.some((item: any) => !isObject(item) || !onlyKeys(item, ['children']) || !checkChildren(item.children))) return `${at}.blocks[${i}] 列表无效`;
    } else if (['image', 'audio', 'video'].includes(block.type)) {
      const optional = block.type === 'image' ? [] : block.type === 'video' ? ['title', 'posterAssetId'] : ['title'];
      const required = block.type === 'image' ? ['type', 'assetId', 'alt'] : ['type', 'assetId'];
      if (!onlyKeys(block, required, optional) || !nonBlank(block.assetId)) return `${at}.blocks[${i}] 媒体引用无效`;
      const asset = packageAssets.get(block.assetId);
      if (!asset) return `${at}.blocks[${i}] 引用了缺失资源 ${block.assetId}`;
      if (asset.kind !== block.type) return `${at}.blocks[${i}] 资源类型与内容块不匹配`;
      assets.add(block.assetId);
      if (block.type === 'image' && typeof block.alt !== 'string') return `${at}.blocks[${i}] 图片缺 alt`;
      if (block.type !== 'image' && block.title !== undefined && typeof block.title !== 'string') return `${at}.blocks[${i}] 媒体标题无效`;
      if (block.type === 'video' && block.posterAssetId !== undefined) {
        if (!nonBlank(block.posterAssetId)) return `${at}.blocks[${i}] posterAssetId 无效`;
        const poster = packageAssets.get(block.posterAssetId);
        if (!poster) return `${at}.blocks[${i}] 引用了缺失海报资源 ${block.posterAssetId}`;
        if (poster.kind !== 'image') return `${at}.blocks[${i}] 海报资源必须是图片`;
        assets.add(block.posterAssetId);
      }
    } else {
      return `${at}.blocks[${i}] 内容块不受支持`;
    }
  }
  return null;
}

function checkInteractionData(raw: Record<string, any>): boolean {
  if (raw.interaction === 'notice') return raw.interactionData === null;
  if (!isObject(raw.interactionData)) return false;
  const data = raw.interactionData;
  if (raw.interaction === 'choice') {
    if (!onlyKeys(data, ['options', 'answer', 'explanation']) || !Array.isArray(data.options) || data.options.length < 2 || !nonBlank(data.answer) || !nonBlank(data.explanation)) return false;
    return data.options.every((option: any) => isObject(option) && onlyKeys(option, ['id', 'label']) && nonBlank(option.id) && nonBlank(option.label)) && data.options.some((option: any) => option.id === data.answer);
  }
  if (raw.interaction === 'blank') {
    if (!onlyKeys(data, ['acceptedAnswers', 'normalize', 'explanation']) || !Array.isArray(data.acceptedAnswers) || !data.acceptedAnswers.length || data.acceptedAnswers.some((answer: unknown) => !nonBlank(answer)) || !nonBlank(data.explanation)) return false;
    return Array.isArray(data.normalize) && data.normalize.every((rule: unknown) => rule === 'trim' || rule === 'casefold');
  }
  return onlyKeys(data, ['referenceFeedback']) && nonBlank(data.referenceFeedback);
}

function checkNode(raw: unknown, at: string, packageAssets: Map<string, AssetRecord>): string | null {
  if (!isObject(raw) || !onlyKeys(raw, ['id', 'enabled', 'family', 'interaction', 'anchor', 'title', 'content', 'interactionData', 'effects'], ['presentationHints']) || !nonBlank(raw.id)) return `${at} 缺少稳定 id 或含未知字段`;
  if (raw.enabled !== true || !NODE_KINDS.has(raw.interaction)) return `${at} 节点类型无效`;
  if (raw.family !== (raw.interaction === 'notice' ? 'attention' : 'practice')) return `${at} family 无效`;
  if (!isObject(raw.anchor) || !onlyKeys(raw.anchor, ['kind', 'timeSeconds'], ['captionId']) || raw.anchor.kind !== 'time_cross' || typeof raw.anchor.timeSeconds !== 'number' || !Number.isFinite(raw.anchor.timeSeconds) || raw.anchor.timeSeconds < 0 || (raw.anchor.captionId !== undefined && raw.anchor.captionId !== null && !nonBlank(raw.anchor.captionId))) return `${at} anchor 无效`;
  if (!nonBlank(raw.title) || !isObject(raw.effects) || !onlyKeys(raw.effects, ['pause']) || raw.effects.pause !== true) return `${at} 基础内容无效`;
  const referenced = new Set<string>();
  const documentError = checkDocument(raw.content, referenced, packageAssets, `${at}.content`);
  if (documentError) return documentError;
  if (raw.presentationHints !== undefined && (!isObject(raw.presentationHints) || !onlyKeys(raw.presentationHints, [], ['windowSize', 'windowStyle', 'windowPosition']) || (raw.presentationHints.windowSize !== undefined && !['s', 'm', 'l', 'overlay'].includes(raw.presentationHints.windowSize)) || (raw.presentationHints.windowStyle !== undefined && !['card', 'document'].includes(raw.presentationHints.windowStyle)) || (raw.presentationHints.windowPosition !== undefined && !['bottom-left', 'bottom-right', 'center'].includes(raw.presentationHints.windowPosition)))) return `${at} 展示提示无效`;
  if (!checkInteractionData(raw)) return `${at} 交互数据无效`;
  return [...referenced].some((assetId) => !packageAssets.has(assetId)) ? `${at} 引用了缺失资源` : null;
}

function checkAsset(raw: unknown): raw is AssetRecord {
  if (!isObject(raw) || !onlyKeys(raw, ['assetId', 'kind', 'mimeType', 'byteSize', 'sha256', 'sourceType'], ['width', 'height', 'durationSeconds', 'alt']) || !nonBlank(raw.assetId) || !ASSET_KINDS.has(raw.kind) || !nonBlank(raw.mimeType) || !raw.mimeType.startsWith(MIME_PREFIX[raw.kind]) || !Number.isInteger(raw.byteSize) || raw.byteSize < 0 || !SHA256.test(raw.sha256) || !['uploaded', 'licensed'].includes(raw.sourceType)) return false;
  if (raw.width !== undefined && (!Number.isInteger(raw.width) || raw.width < 1)) return false;
  if (raw.height !== undefined && (!Number.isInteger(raw.height) || raw.height < 1)) return false;
  if (raw.durationSeconds !== undefined && (typeof raw.durationSeconds !== 'number' || !Number.isFinite(raw.durationSeconds) || raw.durationSeconds <= 0)) return false;
  return raw.alt === undefined || typeof raw.alt === 'string';
}

function checkLesson(raw: unknown, at: string, packageAssets: Map<string, AssetRecord>): Checked<InstalledLesson> {
  if (!isObject(raw) || !onlyKeys(raw, ['lessonId', 'title', 'videoRef', 'nodes']) || !UUID.test(String(raw.lessonId)) || !nonBlank(raw.title)) return { ok: false, reason: `${at} 基础字段无效` };
  const video = raw.videoRef;
  if (!isObject(video) || !onlyKeys(video, ['platform', 'videoId'], ['page', 'cid']) || video.platform !== 'bilibili' || !BVID.test(String(video.videoId))) return { ok: false, reason: `${at} 的 videoRef 必须是 B 站播放引用` };
  const page = video.page === undefined ? 1 : video.page;
  if (!Number.isSafeInteger(page) || Number(page) < 1) return { ok: false, reason: `${at} 的分 P 必须是正整数` };
  const cid = video.cid === undefined || video.cid === null ? null : video.cid;
  if (cid !== null && typeof cid !== 'string') return { ok: false, reason: `${at} 的 cid 无效` };
  if (cid !== null && !/^\d+$/.test(cid)) return { ok: false, reason: `${at} 的 cid 无效` };
  if (!Array.isArray(raw.nodes) || !raw.nodes.length) return { ok: false, reason: `${at} 没有互动节点` };
  const seen = new Set<string>();
  for (const [i, node] of raw.nodes.entries()) {
    if (isObject(node) && seen.has(node.id)) return { ok: false, reason: `${at} 节点 id 重复` };
    if (isObject(node)) seen.add(node.id);
    const error = checkNode(node, `${at} 第 ${i + 1} 个节点`, packageAssets);
    if (error) return { ok: false, reason: error };
  }
  return { ok: true, value: { lessonId: String(raw.lessonId), title: String(raw.title).trim(), videoId: String(video.videoId), page: Number(page), cid, nodes: raw.nodes as InstalledLesson['nodes'] } };
}

export function checkCoursePackage(raw: unknown, sourceId: string): Checked<InstalledCourse> {
  if (!isObject(raw) || !onlyKeys(raw, ['schemaVersion', 'courseId', 'releaseId', 'releaseNumber', 'title', 'assets', 'lessons', 'updatedAt']) || raw.schemaVersion !== 3 || !UUID.test(String(raw.courseId)) || !UUID.test(String(raw.releaseId)) || !Number.isInteger(raw.releaseNumber) || raw.releaseNumber < 1 || !nonBlank(raw.title) || !Array.isArray(raw.lessons) || !raw.lessons.length || !nonBlank(raw.updatedAt) || !Array.isArray(raw.assets)) return { ok: false, reason: '课程包基础字段无效' };
  const assets: AssetRecord[] = [];
  const assetMap = new Map<string, AssetRecord>();
  for (const [i, asset] of raw.assets.entries()) {
    if (!checkAsset(asset) || assetMap.has(asset.assetId)) return { ok: false, reason: `assets[${i}] 资源元数据无效或重复` };
    assetMap.set(asset.assetId, asset); assets.push(asset);
  }
  const lessons: InstalledLesson[] = [];
  const lessonIds = new Set<string>();
  const videoRefs = new Set<string>();
  for (const [i, lesson] of raw.lessons.entries()) {
    const checked = checkLesson(lesson, `第 ${i + 1} 个课节`, assetMap);
    if (!checked.ok) return checked;
    if (lessonIds.has(checked.value.lessonId)) return { ok: false, reason: '课节 id 重复' };
    const refKey = `${checked.value.videoId}\u0000${checked.value.cid ?? `page:${checked.value.page}`}`;
    if (videoRefs.has(refKey)) return { ok: false, reason: 'BVID 重复或分 P 重复' };
    lessonIds.add(checked.value.lessonId); lessons.push(checked.value);
    videoRefs.add(refKey);
  }
  return {
    ok: true,
    value: {
      courseId: String(raw.courseId),
      title: String(raw.title).trim(),
      lessons,
      assets,
      releaseId: String(raw.releaseId),
      releaseNumber: Number(raw.releaseNumber),
      publishedAt: String(raw.updatedAt),
      installedAt: new Date().toISOString(),
      source: 'authorized',
      readOnly: false,
      sourceId,
    },
  };
}
