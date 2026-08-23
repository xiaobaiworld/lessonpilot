/**
 * 字幕解析 (纯 TypeScript)
 * 支持 SRT 和 VTT 格式
 */

export interface Subtitle {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
}

export class SubtitleParser {
  /**
   * 时间戳转秒数 (HH:MM:SS,mmm -> seconds)
   */
  private parseTimestamp(timestamp: string): number {
    // 支持 00:01:23,456 (SRT) 和 00:01:23.456 (VTT) 格式
    timestamp = timestamp.replace(',', '.');
    const [hours, minutes, seconds] = timestamp.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * 解析 SRT 字幕
   */
  parseSRT(content: string): Subtitle[] {
    const subtitles: Subtitle[] = [];
    const blocks = content.trim().split('\n\n');

    blocks.forEach((block) => {
      const lines = block.trim().split('\n');
      if (lines.length < 3) return;

      const timeLine = lines[1];
      const [startStr, endStr] = timeLine.split(' --> ');

      if (!startStr || !endStr) return;

      const index = subtitles.length + 1;
      const startTime = this.parseTimestamp(startStr.trim());
      const endTime = this.parseTimestamp(endStr.trim());
      const text = lines.slice(2).join('\n');

      subtitles.push({
        index,
        startTime,
        endTime,
        text,
      });
    });

    return subtitles;
  }

  /**
   * 解析 VTT 字幕
   */
  parseVTT(content: string): Subtitle[] {
    // VTT 格式类似 SRT，去掉 WEBVTT 头后使用 SRT 解析
    const lines = content.split('\n');
    const srtContent = lines.slice(1).join('\n');
    return this.parseSRT(srtContent);
  }

  /**
   * 自动检测格式并解析
   */
  parse(content: string): Subtitle[] {
    if (content.trim().startsWith('WEBVTT')) {
      return this.parseVTT(content);
    }
    return this.parseSRT(content);
  }

  /**
   * 在给定秒数获取字幕
   */
  getSubtitleAtTime(subtitles: Subtitle[], seconds: number): Subtitle | undefined {
    return subtitles.find((s) => s.startTime <= seconds && seconds < s.endTime);
  }
}
