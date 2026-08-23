import { describe, it, expect, vi } from 'vitest';
import { currentVideoId, findVideo, attachPlayer } from './index';

describe('currentVideoId', () => {
  it('从视频页路径取出 BVID', () => {
    expect(currentVideoId('/video/BV1Ac41187Lm')).toBe('BV1Ac41187Lm');
    expect(currentVideoId('/video/BV1Ac41187Lm/')).toBe('BV1Ac41187Lm');
    expect(currentVideoId('/video/BV1Ac41187Lm/?p=2')).toBe('BV1Ac41187Lm');
  });

  it('非视频页返回 null，此时不该显示任何课程 UI', () => {
    expect(currentVideoId('/')).toBeNull();
    expect(currentVideoId('/anime/12345')).toBeNull();
    expect(currentVideoId('/space/1')).toBeNull();
    // 番剧集数页不是投稿视频页
    expect(currentVideoId('/bangumi/play/ep1')).toBeNull();
  });

  it('BVID 不在路径开头时不算命中', () => {
    expect(currentVideoId('/read/cv1/video/BV1Ac41187Lm')).toBeNull();
  });
});

/** 最小 video 替身，只带面积和播放控制 */
type FakeVideo = Omit<HTMLVideoElement, 'paused'> & {
  paused: boolean;
  emit(t: string): void;
  listeners: Record<string, ((...a: unknown[]) => void)[]>;
};

function fakeVideo(width: number, height: number): FakeVideo {
  const el = {
    tagName: 'VIDEO',
    clientWidth: width,
    clientHeight: height,
    currentTime: 0,
    paused: true,
    pause: vi.fn(function (this: any) {
      this.paused = true;
    }),
    play: vi.fn(function (this: any) {
      this.paused = false;
      return Promise.resolve();
    }),
    listeners: {} as Record<string, ((...a: unknown[]) => void)[]>,
    addEventListener(type: string, fn: (...a: unknown[]) => void) {
      (this.listeners[type] ??= []).push(fn);
    },
    removeEventListener(type: string, fn: (...a: unknown[]) => void) {
      this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn);
    },
    emit(type: string) {
      for (const fn of this.listeners[type] ?? []) fn();
    },
  };
  return el as unknown as FakeVideo;
}

function fakeDoc(map: Record<string, unknown>, all: unknown[] = []): Document {
  return {
    querySelector: (s: string) => map[s] ?? null,
    querySelectorAll: () => all,
  } as unknown as Document;
}

describe('findVideo', () => {
  it('优先命中已知选择器', () => {
    const wanted = fakeVideo(800, 450);
    expect(findVideo(fakeDoc({ '.bpx-player-video-wrap video': wanted }))).toBe(wanted);
  });

  it('选择器都没命中时取面积最大的，不取第一个', () => {
    // 推荐位小视频常排在主播放器之前
    const small = fakeVideo(160, 90);
    const main = fakeVideo(1280, 720);
    expect(findVideo(fakeDoc({}, [small, main]))).toBe(main);
  });

  it('页面上没有 video 时返回 null', () => {
    expect(findVideo(fakeDoc({}, []))).toBeNull();
  });
});

describe('attachPlayer', () => {
  it('读当前时间', () => {
    const v = fakeVideo(800, 450);
    v.currentTime = 42;
    expect(attachPlayer(v).currentTime()).toBe(42);
  });

  it('已暂停时不重复调 pause', () => {
    const v = fakeVideo(800, 450);
    attachPlayer(v).pause();
    expect(v.pause).not.toHaveBeenCalled();
  });

  it('学生自己暂停时不强行恢复播放', () => {
    const v = fakeVideo(800, 450);
    v.paused = false;
    const p = attachPlayer(v);
    p.play();
    expect(v.play).not.toHaveBeenCalled();
  });

  it('取消订阅后不再收到回调，避免离开页面残留监听', () => {
    const v = fakeVideo(800, 450);
    const seen: number[] = [];
    const off = attachPlayer(v).onTimeUpdate((s) => seen.push(s));

    v.currentTime = 10;
    v.emit('timeupdate');
    off();
    v.currentTime = 20;
    v.emit('timeupdate');

    expect(seen).toEqual([10]);
    expect(v.listeners.timeupdate).toHaveLength(0);
  });

  it('seeked 单独订阅，与 timeupdate 分开', () => {
    const v = fakeVideo(800, 450);
    const seeks: number[] = [];
    attachPlayer(v).onSeeked((s) => seeks.push(s));
    v.currentTime = 300;
    v.emit('seeked');
    expect(seeks).toEqual([300]);
  });
});
