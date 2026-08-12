/**
 * Local parser for teacher-provided UTF-8 SRT/VTT subtitle files.
 * It is shared by the browser prototype and Node contract tests.
 */
(function initSubtitleParser(global, factory) {
  const api = factory();
  global.LessonPilotSubtitleParser = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function createSubtitleParser() {
  function toSeconds(timestamp) {
    const match = String(timestamp).trim().match(/^(?:(\d{1,2}):)?(\d{2}):(\d{2})[,.](\d{1,3})$/);
    if (!match) return null;
    const hours = Number(match[1] || 0);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const milliseconds = Number(match[4].padEnd(3, '0'));
    if (minutes > 59 || seconds > 59) return null;
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const rest = safe % 60;
    return hours > 0
      ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  }

  function parseSubtitle(text, filename = '') {
    if (!/\.(srt|vtt)$/i.test(filename)) return { ok: false, message: '请选择 .srt 或 .vtt 字幕文件。' };
    const blocks = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim().split(/\n{2,}/);
    const captions = [];
    blocks.forEach((block, index) => {
      const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
      const timeIndex = lines.findIndex((line) => line.includes('-->'));
      if (timeIndex < 0) return;
      const [startRaw, endWithSettings] = lines[timeIndex].split('-->');
      const startSeconds = toSeconds(startRaw);
      const endSeconds = toSeconds(String(endWithSettings).trim().split(/\s+/)[0]);
      const captionText = lines.slice(timeIndex + 1).join(' ').replace(/<[^>]+>/g, '').trim();
      if (startSeconds === null || endSeconds === null || endSeconds <= startSeconds || !captionText) return;
      captions.push({ id: `caption-${index + 1}`, time: formatTime(startSeconds), end: formatTime(endSeconds), startSeconds, endSeconds, text: captionText, event: null });
    });
    return captions.length ? { ok: true, captions } : { ok: false, message: '未识别到有效字幕。请确认文件包含时间戳和字幕文字。' };
  }

  return { parseSubtitle };
});
