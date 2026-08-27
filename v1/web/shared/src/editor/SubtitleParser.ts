/**
 * SRT / VTT 字幕解析。
 *
 * 处理教师导入的真实字幕文件；
 * 那些规则是踩过坑换来的，不能因为重写而丢掉。
 */

export interface Caption {
  id: string;
  /** 起始时刻，mm:ss 或 hh:mm:ss */
  time: string;
  end: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface SubtitleDocument {
  schemaVersion: 1;
  filename: string;
  format: 'srt' | 'vtt';
  content: string;
}

export const SUBTITLE_MAX_BYTES = 5 * 1024 * 1024;

const SUBTITLE_INVALID_MESSAGE = '字幕内容无效，请检查时间戳、顺序和字幕文字';

export type ParseResult =
  | { ok: true; captions: Caption[] }
  | { ok: false; message: string };

/**
 * 小数部分按字面毫秒数读，不当补零小数。
 *
 * 导出的字幕文件会在同一份文档里变动这一段的宽度，把 `,6` 补成 600ms
 * 会让部分字幕越过后一条、乱序后被静默丢弃。
 */
export function toSeconds(timestamp: string): number | null {
  const m = String(timestamp)
    .trim()
    .match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})[,.](\d{1,3})$/);
  if (!m) return null;

  const hours = Number(m[1] || 0);
  const minutes = Number(m[2]);
  const seconds = Number(m[3]);
  const milliseconds = Number(m[4]);
  if (minutes > 59 || seconds > 59) return null;

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

/** 超过一小时才显示小时位 */
export function formatTimestamp(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function parseSubtitle(text: string, filename = ''): ParseResult {
  if (!/\.(srt|vtt)$/i.test(filename)) {
    return { ok: false, message: '请选择 .srt 或 .vtt 字幕文件。' };
  }
  if (new TextEncoder().encode(text).length > SUBTITLE_MAX_BYTES) {
    return { ok: false, message: '字幕文件不能超过 5 MB。' };
  }

  const normalized = String(text || '')
    .replace(/^\uFEFF/, '') // BOM
    .replace(/\r\n?/g, '\n'); // CRLF / CR

  if (normalized.trimStart().startsWith('WEBVTT') !== /\.vtt$/i.test(filename)) {
    return { ok: false, message: SUBTITLE_INVALID_MESSAGE };
  }

  const blocks = normalized.trim().split(/\n{2,}/);

  const captions: Caption[] = [];
  let previousEndSeconds = -Infinity;

  for (const [index, block] of blocks.entries()) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const timeIndex = lines.findIndex((line) => line.includes('-->'));
    // VTT 头部、注释和样式块没有时间轴，不是字幕 cue，继续检查后续块。
    if (timeIndex < 0) continue;

    const [startRaw, endWithSettings] = lines[timeIndex].split('-->');
    const startSeconds = toSeconds(startRaw);
    // VTT 的 cue settings 跟在结束时刻后面，如 "... align:start position:50%"
    const endSeconds = toSeconds(String(endWithSettings).trim().split(/\s+/)[0]);

    const captionText = lines
      .slice(timeIndex + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '') // 去掉 <i>、<c.colorE5E5E5> 等标记
      .trim();

    if (
      startSeconds === null ||
      endSeconds === null ||
      endSeconds <= startSeconds ||
      !captionText ||
      startSeconds < previousEndSeconds
    ) {
      return { ok: false, message: SUBTITLE_INVALID_MESSAGE };
    }

    captions.push({
      id: `caption-${index + 1}`,
      time: formatTimestamp(startSeconds),
      end: formatTimestamp(endSeconds),
      startSeconds,
      endSeconds,
      text: captionText,
    });
    previousEndSeconds = endSeconds;
  }

  return captions.length
    ? { ok: true, captions }
    : {
        ok: false,
        message: SUBTITLE_INVALID_MESSAGE,
      };
}

/** 找出给定秒数所在的那句字幕 */
export function captionAt(captions: Caption[], seconds: number): Caption | undefined {
  return captions.find((c) => c.startSeconds <= seconds && seconds < c.endSeconds);
}
