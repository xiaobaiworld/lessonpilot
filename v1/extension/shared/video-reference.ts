/** B 站课程匹配所使用的规范化视频引用。 */
export interface BilibiliVideoRef {
  platform: 'bilibili';
  videoId: string;
  page: number;
  cid: string | null;
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
