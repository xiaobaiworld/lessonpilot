import { describe, expect, it } from 'vitest';
import { parseBilibiliVideoRef } from './CoursePage';

describe('教师端 B 站视频引用解析', () => {
  it('从直接视频页保留分 P/CID，忽略来源追踪参数', () => {
    expect(
      parseBilibiliVideoRef(
        'https://www.bilibili.com/video/BV1bDoLYVE1k/?p=4&cid=987654321&vd_source=tracking'
      )
    ).toEqual({
      platform: 'bilibili',
      video_id: 'BV1bDoLYVE1k',
      page: 4,
      cid: '987654321',
    });
  });

  it('裸 BV 号规范化为第 1 P', () => {
    expect(parseBilibiliVideoRef(' BV1Ac41187Lm ')).toEqual({
      platform: 'bilibili',
      video_id: 'BV1Ac41187Lm',
      page: 1,
      cid: null,
    });
  });

  it('拒绝其它站点、短链和非法分 P', () => {
    expect(parseBilibiliVideoRef('https://example.com/video/BV1Ac41187Lm?p=4')).toBeNull();
    expect(parseBilibiliVideoRef('https://b23.tv/abc')).toBeNull();
    expect(parseBilibiliVideoRef('https://www.bilibili.com/video/BV1Ac41187Lm?p=0')).toBeNull();
  });
});
