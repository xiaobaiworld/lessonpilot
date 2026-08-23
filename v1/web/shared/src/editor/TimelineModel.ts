/**
 * 时间轴计算模块 (纯 TypeScript)
 * 职责：时刻映射、刻度计算、位置计算
 * 无 DOM、无状态、可用于 CLI/Node
 */

export interface TimelineConfig {
  durationSeconds: number;
  pixelsPerSecond: number;
  tickIntervalSeconds: number;
}

export interface TimelinePosition {
  pixelsFromStart: number;
  seconds: number;
  percentage: number;
}

export class TimelineModel {
  constructor(private config: TimelineConfig) {}

  /**
   * 获取给定秒数的像素位置
   */
  getPixelPosition(seconds: number): number {
    return (seconds / this.config.durationSeconds) * this.getTotalWidth();
  }

  /**
   * 获取给定秒数的百分比位置
   */
  getPercentagePosition(seconds: number): number {
    return (seconds / this.config.durationSeconds) * 100;
  }

  /**
   * 获取总宽度（像素）
   */
  getTotalWidth(): number {
    return this.config.durationSeconds * this.config.pixelsPerSecond;
  }

  /**
   * 获取所有刻度
   */
  getTicks(): TimelinePosition[] {
    const ticks: TimelinePosition[] = [];
    const tickCount = Math.ceil(this.config.durationSeconds / this.config.tickIntervalSeconds);

    for (let i = 0; i <= tickCount; i++) {
      const seconds = i * this.config.tickIntervalSeconds;
      if (seconds > this.config.durationSeconds) break;

      ticks.push({
        pixelsFromStart: this.getPixelPosition(seconds),
        seconds,
        percentage: this.getPercentagePosition(seconds),
      });
    }

    return ticks;
  }

  /**
   * 秒数转换为 MM:SS 格式
   */
  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * 解析 MM:SS 格式
   */
  parseTime(timeString: string): number {
    const [minutes, seconds] = timeString.split(':').map(Number);
    return minutes * 60 + seconds;
  }

  /**
   * 获取从点击位置的秒数
   */
  getSecondsFromPixel(pixels: number): number {
    const percentage = pixels / this.getTotalWidth();
    return percentage * this.config.durationSeconds;
  }
}
