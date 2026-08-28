import { describe, expect, it } from 'vitest';
import { isBilibiliVideoRef } from './video-reference';

describe('B 站完整视频引用校验', () => {
  it('接受规范化的 page/cid 引用', () => {
    expect(
      isBilibiliVideoRef({
        platform: 'bilibili',
        videoId: 'BV1Ac41187Lm',
        page: 4,
        cid: '987654321',
      })
    ).toBe(true);
  });

  it('拒绝缺少 page/cid 或带未知字段的不完整消息', () => {
    expect(isBilibiliVideoRef({ platform: 'bilibili', videoId: 'BV1Ac41187Lm' })).toBe(false);
    expect(
      isBilibiliVideoRef({
        platform: 'bilibili',
        videoId: 'BV1Ac41187Lm',
        page: 4,
        cid: null,
        vd_source: 'tracking',
      })
    ).toBe(false);
  });
});
