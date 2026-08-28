/**
 * B 站宿主适配。
 *
 * 这是唯一允许出现 B 站选择器和 DOM 操作的地方；课程逻辑不引用选择器。
 * 选择器与"最大面积回退"沿用 src/content/video/bili-player.js —— 那是在
 * 真实页面上试出来的，B 站改版时只需要动这一个文件。
 *
 * 干预面积刻意压到最小：只读时间、只暂停/继续。不改倍速、不阻止跳过、
 * 不降原声、不改播放器 UI（doc/lessons.md 2026-08-14 的合规约束）。
 */

const PLAYER_SELECTORS = [
  '.bpx-player-video-wrap video',
  '#bilibili-player video',
  '.player-wrap video',
];

import type { BilibiliVideoRef } from '../../shared/video-reference';

export interface PlayerHandle {
  currentTime(): number;
  isPlaying(): boolean;
  pause(): void;
  play(): void;
  /** 返回取消订阅函数 */
  onTimeUpdate(fn: (seconds: number) => void): () => void;
  onSeeked(fn: (seconds: number) => void): () => void;
}

/** 从地址栏取 BVID。非视频页返回 null，此时不应显示任何课程 UI */
export function currentVideoId(pathname = location.pathname): string | null {
  const m = pathname.match(/^\/video\/(BV[a-zA-Z0-9]{10})(?:\/|$)/i);
  return m ? m[1] : null;
}

/** 从完整 B 站地址规范化课程匹配对象。 */
export function currentVideoRef(href = location.href): BilibiliVideoRef | null {
  let url: URL;
  try {
    url = new URL(href, 'https://www.bilibili.com');
  } catch {
    return null;
  }
  if (!['www.bilibili.com', 'bilibili.com', 'm.bilibili.com'].includes(url.hostname)) {
    return null;
  }

  const videoId = currentVideoId(url.pathname);
  if (!videoId) return null;

  const rawPage = url.searchParams.get('p');
  if (rawPage !== null && !/^\d+$/.test(rawPage)) return null;
  const page = rawPage === null ? 1 : Number(rawPage);
  if (!Number.isSafeInteger(page) || page < 1) return null;

  const rawCid = url.searchParams.get('cid');
  if (rawCid !== null && !/^\d+$/.test(rawCid)) return null;

  return { platform: 'bilibili', videoId, page, cid: rawCid };
}

/**
 * 找主播放器。
 *
 * 优先已知选择器；都没命中时取面积最大的 video —— B 站页面里还有推荐位
 * 的小视频，取第一个会绑错元素。
 */
export function findVideo(doc: Document = document): HTMLVideoElement | null {
  /*
   * 用 tagName 而非 instanceof：B 站播放器有时在 iframe 里，
   * 跨 realm 的 instanceof 会对真实 video 元素返回 false。
   */
  const isVideo = (el: unknown): el is HTMLVideoElement =>
    !!el && (el as Element).tagName === 'VIDEO';

  for (const selector of PLAYER_SELECTORS) {
    const el = doc.querySelector(selector);
    if (isVideo(el)) return el;
  }

  const videos = [...doc.querySelectorAll('video')].filter(isVideo);
  if (videos.length === 0) return null;

  return videos.reduce((largest, current) =>
    current.clientWidth * current.clientHeight >
    largest.clientWidth * largest.clientHeight
      ? current
      : largest
  );
}

export function attachPlayer(video: HTMLVideoElement): PlayerHandle {
  return {
    currentTime: () => video.currentTime,
    isPlaying: () => !video.paused && !video.ended,
    pause: () => {
      if (!video.paused) video.pause();
    },
    play: () => {
      // 学生可能自己暂停了，这时不该强行恢复播放
      if (video.paused) void video.play().catch(() => undefined);
    },
    onTimeUpdate(fn) {
      const handler = () => fn(video.currentTime);
      video.addEventListener('timeupdate', handler);
      return () => video.removeEventListener('timeupdate', handler);
    },
    onSeeked(fn) {
      const handler = () => fn(video.currentTime);
      video.addEventListener('seeked', handler);
      return () => video.removeEventListener('seeked', handler);
    },
  };
}

/**
 * SPA 生命周期。
 *
 * B 站是单页应用，切视频不重新加载文档，播放器元素也会被替换。
 * 这里把"当前 BVID 变了"和"播放器被换了"都归一成一次重启回调，
 * 由调用方负责拆掉旧监听——离开页面后残留监听会对着已销毁的元素触发。
 */
export function watchNavigation(
  onChange: (videoRef: BilibiliVideoRef | null) => void,
  win: Window = window
): () => void {
  let last = currentVideoRef(win.location.href);

  const check = () => {
    const now = currentVideoRef(win.location.href);
    if (JSON.stringify(now) !== JSON.stringify(last)) {
      last = now;
      onChange(now);
    }
  };

  // history API 不触发 popstate，包一层才能感知 pushState
  const origPush = win.history.pushState;
  const origReplace = win.history.replaceState;
  win.history.pushState = function (...args) {
    origPush.apply(this, args as never);
    check();
  };
  win.history.replaceState = function (...args) {
    origReplace.apply(this, args as never);
    check();
  };
  win.addEventListener('popstate', check);

  return () => {
    win.history.pushState = origPush;
    win.history.replaceState = origReplace;
    win.removeEventListener('popstate', check);
  };
}

/**
 * 等播放器出现。
 *
 * 内容脚本注入时播放器常还没渲染；轮询到超时为止，超时就安静退出，
 * 不在非视频页或加载失败的页面上留下任何 UI。
 */
export function waitForVideo(
  options: { timeoutMs?: number; intervalMs?: number; doc?: Document } = {}
): Promise<HTMLVideoElement | null> {
  const { timeoutMs = 15000, intervalMs = 300, doc = document } = options;
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve) => {
    const tick = () => {
      const video = findVideo(doc);
      if (video) return resolve(video);
      if (Date.now() >= deadline) return resolve(null);
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}
