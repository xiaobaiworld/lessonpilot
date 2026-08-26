import { AssetRecord, InstalledCourse, InstalledLesson } from '../storage/types';

export type Invalid = { ok: false; reason: string };
export type Valid<T> = { ok: true; value: T };
export type Checked<T> = Valid<T> | Invalid;

const BVID = /^BV[0-9A-Za-z]{10}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const ASSET_KINDS = new Set(['image', 'audio', 'video']);
const NODE_KINDS = new Set(['notice', 'choice', 'blank', 'free_text']);

function isObject(v: unknown): v is Record<string, any> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function nonBlank(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function checkDocument(value: unknown, assets: Set<string>, at: string): string | null {
  if (!isObject(value) || value.schemaVersion !== 1 || !Array.isArray(value.blocks) || !value.blocks.length) {
    return `${at} 的结构化文档版本或 blocks 无效`;
  }
  for (const [i, block] of value.blocks.entries()) {
    if (!isObject(block) || typeof block.type !== 'string') return `${at}.blocks[${i}] 内容块不受支持`;
    if (['paragraph', 'heading', 'quote'].includes(block.type)) {
      if (!Array.isArray(block.children) || !block.children.length || block.children.some((child: any) => !isObject(child) || !nonBlank(child.text))) return `${at}.blocks[${i}] 文本无效`;
      if (block.type === 'heading' && ![2, 3].includes(block.level)) return `${at}.blocks[${i}] 标题级别无效`;
    } else if (block.type === 'list') {
      if (typeof block.ordered !== 'boolean' || !Array.isArray(block.items) || !block.items.length) return `${at}.blocks[${i}] 列表无效`;
      if (block.items.some((item: any) => !isObject(item) || !Array.isArray(item.children) || !item.children.length || item.children.some((child: any) => !isObject(child) || !nonBlank(child.text)))) return `${at}.blocks[${i}] 列表项无效`;
    } else if (['image', 'audio', 'video'].includes(block.type) && nonBlank(block.assetId)) {
      assets.add(block.assetId);
      if (block.type === 'image' && typeof block.alt !== 'string') return `${at}.blocks[${i}] 图片缺 alt`;
    } else {
      return `${at}.blocks[${i}] 内容块不受支持`;
    }
  }
  return null;
}

function checkNode(raw: unknown, at: string, assetIds: Set<string>): string | null {
  if (!isObject(raw) || !nonBlank(raw.id)) return `${at} 缺少稳定 id`;
  if (raw.enabled !== true || !NODE_KINDS.has(raw.interaction)) return `${at} 节点类型无效`;
  if (raw.family !== (raw.interaction === 'notice' ? 'attention' : 'practice')) return `${at} family 无效`;
  if ('display' in raw || 'evaluation' in raw || 'trigger' in raw) return `${at} 使用了已废弃的 display/evaluation/trigger`;
  if (!isObject(raw.anchor) || raw.anchor.kind !== 'time_cross' || typeof raw.anchor.timeSeconds !== 'number' || !Number.isFinite(raw.anchor.timeSeconds) || raw.anchor.timeSeconds < 0) return `${at} anchor 无效`;
  if (!nonBlank(raw.title) || raw.effects?.pause !== true) return `${at} 基础内容无效`;
  const documentError = checkDocument(raw.content, assetIds, `${at}.content`);
  if (documentError) return documentError;
  if (raw.interaction === 'notice' && raw.interactionData !== null) return `${at} 重点标注不应有 interactionData`;
  if (raw.interaction !== 'notice' && !isObject(raw.interactionData)) return `${at} 缺少 interactionData`;
  return null;
}

function checkAsset(raw: unknown): raw is AssetRecord {
  return isObject(raw) && nonBlank(raw.assetId) && ASSET_KINDS.has(raw.kind) && nonBlank(raw.mimeType) && Number.isInteger(raw.byteSize) && raw.byteSize >= 0 && SHA256.test(raw.sha256) && ['uploaded', 'licensed'].includes(raw.sourceType);
}

function checkLesson(raw: unknown, at: string, packageAssetIds: Set<string>): Checked<InstalledLesson> {
  if (!isObject(raw) || !UUID.test(String(raw.lessonId)) || !nonBlank(raw.title)) return { ok: false, reason: `${at} 基础字段无效` };
  const video = raw.videoRef;
  if (!isObject(video) || video.platform !== 'bilibili' || !BVID.test(String(video.videoId))) return { ok: false, reason: `${at} 的 videoRef 必须是 B 站播放引用` };
  if (!Array.isArray(raw.nodes) || !raw.nodes.length) return { ok: false, reason: `${at} 没有互动节点` };
  const nodeAssetIds = new Set<string>();
  const seen = new Set<string>();
  for (const [i, node] of raw.nodes.entries()) {
    if (isObject(node) && seen.has(node.id)) return { ok: false, reason: `${at} 节点 id 重复` };
    if (isObject(node)) seen.add(node.id);
    const error = checkNode(node, `${at} 第 ${i + 1} 个节点`, nodeAssetIds);
    if (error) return { ok: false, reason: error };
  }
  for (const assetId of nodeAssetIds) if (!packageAssetIds.has(assetId)) return { ok: false, reason: `${at} 引用了缺失资源 ${assetId}` };
  return { ok: true, value: { lessonId: String(raw.lessonId), title: String(raw.title).trim(), videoId: String(video.videoId), nodes: raw.nodes } };
}

export function checkCoursePackage(raw: unknown, sourceId: string): Checked<InstalledCourse> {
  if (!isObject(raw)) return { ok: false, reason: '课程包不是对象' };
  if (raw.schemaVersion !== 3) return { ok: false, reason: `课程包版本 ${String(raw.schemaVersion)} 不受支持` };
  if (!UUID.test(String(raw.courseId)) || !UUID.test(String(raw.releaseId)) || !Number.isInteger(raw.releaseNumber) || raw.releaseNumber < 1 || !nonBlank(raw.title) || !Array.isArray(raw.lessons) || !raw.lessons.length || !nonBlank(raw.updatedAt) || !Array.isArray(raw.assets)) return { ok: false, reason: '课程包基础字段无效' };
  const assets: AssetRecord[] = [];
  const assetIds = new Set<string>();
  for (const [i, asset] of raw.assets.entries()) {
    if (!checkAsset(asset) || assetIds.has(asset.assetId)) return { ok: false, reason: `assets[${i}] 资源元数据无效或重复` };
    assetIds.add(asset.assetId); assets.push(asset);
  }
  const lessons: InstalledLesson[] = [];
  const lessonIds = new Set<string>();
  const videoIds = new Set<string>();
  for (const [i, lesson] of raw.lessons.entries()) {
    const checked = checkLesson(lesson, `第 ${i + 1} 个课节`, assetIds);
    if (!checked.ok) return checked;
    if (lessonIds.has(checked.value.lessonId)) return { ok: false, reason: '课节 id 重复' };
    if (videoIds.has(checked.value.videoId)) return { ok: false, reason: 'BVID 重复' };
    lessonIds.add(checked.value.lessonId); lessons.push(checked.value);
    videoIds.add(checked.value.videoId);
  }
  return { ok: true, value: { courseId: String(raw.courseId), title: String(raw.title).trim(), lessons, assets, publishedAt: String(raw.updatedAt), installedAt: new Date().toISOString(), source: 'authorized', readOnly: false, sourceId } };
}
