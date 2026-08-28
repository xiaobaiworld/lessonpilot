/** B 站课程匹配所使用的规范化视频引用。 */
export interface BilibiliVideoRef {
  platform: 'bilibili';
  videoId: string;
  page: number;
  cid: string | null;
}

export function isBilibiliVideoRef(value: unknown): value is BilibiliVideoRef {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).sort().join(',') !== 'cid,page,platform,videoId') return false;
  return (
    raw.platform === 'bilibili' &&
    typeof raw.videoId === 'string' &&
    /^BV[a-zA-Z0-9]{10}$/.test(raw.videoId) &&
    typeof raw.page === 'number' &&
    Number.isSafeInteger(raw.page) &&
    raw.page >= 1 &&
    (raw.cid === null || (typeof raw.cid === 'string' && /^\d+$/.test(raw.cid)))
  );
}

/**
 * 比较课程引用与当前页面引用。
 * CID 已知时不允许退回 page，避免把两个不同内容误认为同一课节。
 */
export function sameBilibiliVideoRef(
  expected: Pick<BilibiliVideoRef, 'videoId' | 'page' | 'cid'>,
  actual: Pick<BilibiliVideoRef, 'videoId' | 'page' | 'cid'>
): boolean {
  if (expected.videoId !== actual.videoId) return false;
  if (expected.cid !== null || actual.cid !== null) {
    return expected.cid !== null && actual.cid !== null && expected.cid === actual.cid;
  }
  return expected.page === actual.page;
}
