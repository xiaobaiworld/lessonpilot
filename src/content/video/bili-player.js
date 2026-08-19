/**
 * Bilibili main player detection and playback control.
 * Selectors are centralized here for easier maintenance when Bilibili updates DOM.
 */
(function initBiliPlayer(global) {
  const PLAYER_SELECTORS = [
    '.bpx-player-container video',
    '.bilibili-player-video video',
    '#bilibili-player video',
    '.player-wrap video'
  ];

  /**
   * @returns {HTMLVideoElement | null}
   */
  function getMainVideo() {
    for (const selector of PLAYER_SELECTORS) {
      const video = document.querySelector(selector);
      if (video instanceof HTMLVideoElement) {
        return video;
      }
    }

    const videos = [...document.querySelectorAll('video')].filter(
      (el) => el instanceof HTMLVideoElement
    );
    if (videos.length === 0) {
      return null;
    }

    return videos.reduce((largest, current) => {
      const largestArea = largest.clientWidth * largest.clientHeight;
      const currentArea = current.clientWidth * current.clientHeight;
      return currentArea > largestArea ? current : largest;
    });
  }

  /**
   * @returns {'playing' | 'paused' | 'missing'}
   */
  function getPlaybackState() {
    const video = getMainVideo();
    if (!video) {
      return 'missing';
    }
    return video.paused || video.ended ? 'paused' : 'playing';
  }

  /**
   * @returns {Promise<'playing' | 'paused' | 'missing'>}
   */
  async function togglePlayback() {
    const video = getMainVideo();
    if (!video) {
      return 'missing';
    }

    if (video.paused || video.ended) {
      try {
        await video.play();
      } catch {
        return 'paused';
      }
      return 'playing';
    }

    video.pause();
    return 'paused';
  }

  /**
   * Resume idempotently after a completed interaction.
   * @returns {Promise<'playing' | 'paused' | 'missing'>}
   */
  async function play() {
    const video = getMainVideo();
    if (!video) return 'missing';
    if (!video.paused && !video.ended) return 'playing';
    try {
      await video.play();
      return 'playing';
    } catch {
      return 'paused';
    }
  }

  /**
   * @returns {'playing' | 'paused' | 'missing'}
   */
  function pause() {
    const video = getMainVideo();
    if (!video) {
      return 'missing';
    }
    video.pause();
    return 'paused';
  }

  /**
   * @param {number} seconds
   * @returns {'playing' | 'paused' | 'missing'}
   */
  function seekTo(seconds) {
    const video = getMainVideo();
    if (!video) {
      return 'missing';
    }

    const safeSeconds = Math.max(0, Math.min(seconds, Number.isFinite(video.duration) ? video.duration : seconds));
    video.currentTime = safeSeconds;
    return video.paused || video.ended ? 'paused' : 'playing';
  }

  /**
   * @param {(state: 'playing' | 'paused') => void} listener
   * @returns {() => void}
   */
  function watchPlayback(listener) {
    let boundVideo = null;
    const handlers = {
      play: () => listener('playing'),
      pause: () => listener('paused'),
      ended: () => listener('paused')
    };

    function bind(video) {
      if (!(video instanceof HTMLVideoElement) || video === boundVideo) {
        return;
      }

      unbind();
      boundVideo = video;
      boundVideo.addEventListener('play', handlers.play);
      boundVideo.addEventListener('pause', handlers.pause);
      boundVideo.addEventListener('ended', handlers.ended);
      listener(getPlaybackState() === 'playing' ? 'playing' : 'paused');
    }

    function unbind() {
      if (!boundVideo) {
        return;
      }
      boundVideo.removeEventListener('play', handlers.play);
      boundVideo.removeEventListener('pause', handlers.pause);
      boundVideo.removeEventListener('ended', handlers.ended);
      boundVideo = null;
    }

    function scan() {
      bind(getMainVideo());
    }

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const intervalId = window.setInterval(scan, 2000);

    return () => {
      observer.disconnect();
      window.clearInterval(intervalId);
      unbind();
    };
  }

  /**
   * @param {(currentTime: number, video: HTMLVideoElement) => void} listener
   * @returns {() => void}
   */
  function watchTime(listener) {
    let boundVideo = null;

    function onTimeUpdate() {
      if (!boundVideo) {
        return;
      }
      listener(boundVideo.currentTime, boundVideo);
    }

    function bind(video) {
      if (!(video instanceof HTMLVideoElement) || video === boundVideo) {
        return;
      }

      unbind();
      boundVideo = video;
      boundVideo.addEventListener('timeupdate', onTimeUpdate);
      onTimeUpdate();
    }

    function unbind() {
      if (!boundVideo) {
        return;
      }
      boundVideo.removeEventListener('timeupdate', onTimeUpdate);
      boundVideo = null;
    }

    function scan() {
      bind(getMainVideo());
    }

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const intervalId = window.setInterval(scan, 2000);

    return () => {
      observer.disconnect();
      window.clearInterval(intervalId);
      unbind();
    };
  }

  global.LessonPilotBiliPlayer = {
    getMainVideo,
    getPlaybackState,
    togglePlayback,
    play,
    pause,
    seekTo,
    watchPlayback,
    watchTime
  };
})(window);
