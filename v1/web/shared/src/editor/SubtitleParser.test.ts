import { describe, expect, it } from 'vitest';
import { parseSubtitle, toSeconds } from './SubtitleParser';

describe('SRT / VTT 字幕解析', () => {
  it('允许包含空格和汉字的文件名，并保留混合位数的小数毫秒', () => {
    const result = parseSubtitle(
      '1\n0:0:0,0 --> 0:0:3,139\n你好\n\n2\n0:0:6,76 --> 0:0:7,24\n相信自己\n',
      '相信自己，自信地说英语.srt'
    );

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.captions).toHaveLength(2);
      expect(result.captions[0].endSeconds).toBeCloseTo(3.139);
      expect(result.captions[1].startSeconds).toBeCloseTo(6.076);
    }
  });

  it('拒绝结束时间早于或等于开始时间的字幕块', () => {
    const result = parseSubtitle(
      '1\n00:00:01,000 --> 00:00:01,000\n无效\n',
      'lesson.srt'
    );

    expect(result).toEqual({
      ok: false,
      message: '字幕内容无效，请检查时间戳、顺序和字幕文字',
    });
  });

  it('拒绝与上一条字幕重叠的字幕块，而不是静默丢弃', () => {
    const result = parseSubtitle(
      '1\n00:00:01,000 --> 00:00:03,000\n第一句\n\n2\n00:00:02,000 --> 00:00:04,000\n第二句\n',
      'lesson.srt'
    );

    expect(result.ok).toBe(false);
  });

  it('前端时间戳解析与后端一致地支持超过两位的小时数', () => {
    expect(toSeconds('123:04:05,006')).toBe(443045.006);
  });

  it('校验 SRT/VTT 文件头与扩展名一致', () => {
    expect(parseSubtitle('WEBVTT\n\n00:00.000 --> 00:01.000\n字幕\n', 'lesson.srt').ok).toBe(
      false
    );
    expect(parseSubtitle('00:00.000 --> 00:01.000\n字幕\n', 'lesson.vtt').ok).toBe(false);
  });
});
