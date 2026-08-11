/**
 * Horizontal bar overlay that covers subtitle area during configured time ranges.
 */
(function initSubtitleBlocker(global) {
  const { findActiveBlocker, computeBarRect } = global.LessonPilotBlockerLayout;

  class SubtitleBlocker {
    /**
     * @param {{
     *   getVideo: () => HTMLVideoElement | null,
     *   blockers: Array<{
     *     id?: string,
     *     start: number,
     *     end: number,
     *     layout?: {
     *       bottom?: number | string,
     *       height?: number | string,
     *       left?: number | string,
     *       width?: number | string,
     *       minHeight?: number,
     *       background?: string,
     *       opacity?: number
     *     }
     *   }>
     * }} options
     */
    constructor(options) {
      this.getVideo = options.getVideo;
      this.blockers = options.blockers;
      this.visible = false;
      /** @type {string | null} */
      this.activeBlockerId = null;

      this.bar = document.createElement('div');
      this.bar.id = 'lessonpilot-subtitle-blocker';
      this.bar.hidden = true;
      this.bar.setAttribute('aria-hidden', 'true');
    }

    mount() {
      if (!document.getElementById('lessonpilot-subtitle-blocker')) {
        document.documentElement.appendChild(this.bar);
      }

      this.syncLayout();
      window.addEventListener('resize', this.handleLayoutChange);
      window.addEventListener('scroll', this.handleLayoutChange, true);
    }

    handleLayoutChange = () => {
      if (this.visible) {
        this.syncLayout();
      }
    };

    /**
     * @param {number} currentTime
     */
    update(currentTime) {
      const activeBlocker = findActiveBlocker(this.blockers, currentTime);
      const shouldShow = Boolean(activeBlocker);
      const nextBlockerId = activeBlocker?.id ?? null;

      if (shouldShow !== this.visible || nextBlockerId !== this.activeBlockerId) {
        this.visible = shouldShow;
        this.activeBlockerId = nextBlockerId;
        this.bar.hidden = !shouldShow;
      }

      if (shouldShow && activeBlocker) {
        this.syncLayout(activeBlocker);
      }
    }

    /**
     * @param {{ layout?: object } | undefined} activeBlocker
     */
    syncLayout(activeBlocker) {
      const video = this.getVideo();
      if (!video) {
        this.bar.hidden = true;
        this.visible = false;
        this.activeBlockerId = null;
        return;
      }

      const rect = video.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        this.bar.hidden = true;
        this.visible = false;
        this.activeBlockerId = null;
        return;
      }

      const blocker = activeBlocker ?? findActiveBlocker(this.blockers, video.currentTime);
      if (!blocker) {
        this.bar.hidden = true;
        this.visible = false;
        this.activeBlockerId = null;
        return;
      }

      const barRect = computeBarRect(rect, blocker.layout ?? {});

      this.bar.style.left = `${barRect.left}px`;
      this.bar.style.width = `${barRect.width}px`;
      this.bar.style.top = `${barRect.top}px`;
      this.bar.style.height = `${barRect.height}px`;
      this.bar.style.background = barRect.background;
      this.bar.style.opacity = String(barRect.opacity);
    }

    destroy() {
      window.removeEventListener('resize', this.handleLayoutChange);
      window.removeEventListener('scroll', this.handleLayoutChange, true);
      this.bar.remove();
    }
  }

  global.LessonPilotSubtitleBlocker = {
    SubtitleBlocker
  };
})(window);
