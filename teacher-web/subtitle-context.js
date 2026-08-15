/**
 * COURSE-06 字幕上下文列的选段逻辑。
 *
 * 给定已解析字幕和一个时间点，决定竖向列里显示哪几条、哪条是中心、每条占几行。
 * 纯函数、无 DOM，因此可以在 Node 里独立测试；渲染和底色属于页面层。
 *
 * 与页面的双载入约定同 `subtitle-parser.js`：浏览器挂全局，Node 走 module.exports。
 */
(function initSubtitleContext(global, factory) {
  const api = factory();
  global.LessonPilotSubtitleContext = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function createSubtitleContext() {
  /**
   * 上方固定 2 条、初始下方 2 条（共 5 条起步），总行数下限 7。
   *
   * 上方之所以固定：老师要判断的是"这句之前刚讲完什么、之后紧接着讲什么"，
   * 向前回溯更多历史内容对判断时间点没有帮助，所以补行只向后取（COURSE-06）。
   */
  const DEFAULT_CONTEXT_OPTIONS = Object.freeze({
    above: 2,
    initialBelow: 2,
    minTotalLines: 7,
    maxLinesPerCaption: 2,
    // 栏宽约 20 个全角字符。该值与 CSS 的 --subtitle-context-columns 必须一致，
    // 否则"至少 7 行"在页面上就不成立。由 css-contract 测试锁定两处相等。
    columnsPerLine: 20
  });

  const CJK_OR_WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;

  /**
   * 以"半角格"为单位估算文本宽度。中日韩文字和全角标点占两格。
   * 用宽度而不是字符数，是因为混排的中英文按字符数估算会算出明显错误的行数。
   */
  function estimateDisplayWidth(text) {
    const value = typeof text === 'string' ? text : '';
    let width = 0;
    for (const char of value) {
      width += CJK_OR_WIDE.test(char) ? 2 : 1;
    }
    return width;
  }

  /**
   * 一条字幕占几行。空文本按 1 行计：若返回 0，补足循环会认为加了这条却没增加行数，
   * 从而一直往后取直到字幕耗尽。
   */
  function estimateLineCount(text, options = DEFAULT_CONTEXT_OPTIONS) {
    const columns = options.columnsPerLine || DEFAULT_CONTEXT_OPTIONS.columnsPerLine;
    const maxLines = options.maxLinesPerCaption || DEFAULT_CONTEXT_OPTIONS.maxLinesPerCaption;
    const width = estimateDisplayWidth(text);
    const lines = Math.max(1, Math.ceil(width / columns));
    return Math.min(lines, maxLines);
  }

  /**
   * 找中心条的下标。
   *
   * 命中优先：时间落在 [startSeconds, endSeconds] 内。有多条覆盖同一时间时取最早的一条，
   * 这样结果不依赖数组里谁排在前面。
   * 未命中时按与 startSeconds 的差取最小；差值相等取更早的一条（COURSE-06）。
   */
  function findCenterIndex(captions, timeSeconds) {
    const time = Number(timeSeconds);
    if (!Number.isFinite(time)) return 0;

    let hitIndex = -1;
    let hitStart = Infinity;
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    let nearestStart = Infinity;

    captions.forEach((caption, index) => {
      const start = Number(caption.startSeconds);
      const end = Number(caption.endSeconds);
      if (Number.isFinite(start) && Number.isFinite(end) && time >= start && time <= end && start < hitStart) {
        hitIndex = index;
        hitStart = start;
      }
      if (!Number.isFinite(start)) return;
      const distance = Math.abs(time - start);
      // 严格小于：距离相同时保留先遇到的；再按 start 更早的兜底，
      // 使反序输入得到同一条。
      if (distance < nearestDistance || (distance === nearestDistance && start < nearestStart)) {
        nearestIndex = index;
        nearestDistance = distance;
        nearestStart = start;
      }
    });

    return hitIndex >= 0 ? hitIndex : nearestIndex;
  }

  function toItem(captions, index, centerIndex, options) {
    const caption = captions[index];
    const lines = estimateLineCount(caption && caption.text, options);
    return {
      index,
      caption,
      isCenter: index === centerIndex,
      lines,
      truncated: estimateLineCount(caption && caption.text, { ...options, maxLinesPerCaption: Infinity }) > lines
    };
  }

  /**
   * 选出要显示的字幕段。
   *
   * 返回 `{ items, centerIndex, totalLines, empty, wholeList, belowExhausted }`。
   * `items` 按时间升序，其中恰有一条 `isCenter`；`items[].caption` 是原对象的引用，
   * 不复制文本，页面渲染时必须用 textContent（字幕是不可信输入）。
   */
  function selectSubtitleContext({ captions, timeSeconds, options } = {}) {
    const list = Array.isArray(captions) ? captions : [];
    const config = { ...DEFAULT_CONTEXT_OPTIONS, ...(options || {}) };

    if (list.length === 0) {
      return { items: [], centerIndex: -1, totalLines: 0, empty: true, wholeList: false, belowExhausted: true };
    }

    const centerIndex = findCenterIndex(list, timeSeconds);
    const start = Math.max(0, centerIndex - config.above);
    let end = Math.min(list.length - 1, centerIndex + config.initialBelow);

    const items = [];
    let totalLines = 0;
    for (let i = start; i <= end; i += 1) {
      const item = toItem(list, i, centerIndex, config);
      items.push(item);
      totalLines += item.lines;
    }

    // 补足只向后取。上方保持 config.above 条不变，即使前面还有内容可用。
    while (totalLines < config.minTotalLines && end + 1 <= list.length - 1) {
      end += 1;
      const item = toItem(list, end, centerIndex, config);
      items.push(item);
      totalLines += item.lines;
    }

    return {
      items,
      centerIndex,
      totalLines,
      empty: false,
      wholeList: items.length === list.length,
      // 后方已耗尽但仍不足下限：页面据此知道"就这么多了"，而不是渲染出了 bug。
      belowExhausted: end >= list.length - 1
    };
  }

  return {
    selectSubtitleContext,
    estimateDisplayWidth,
    estimateLineCount,
    findCenterIndex,
    DEFAULT_CONTEXT_OPTIONS
  };
});
