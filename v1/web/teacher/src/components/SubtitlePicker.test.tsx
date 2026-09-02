/** @vitest-environment happy-dom */

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SubtitleDocument } from '@v1/web/shared';
import { SubtitlePicker } from './SubtitlePicker';

const initialSubtitle: SubtitleDocument = {
  schemaVersion: 1,
  filename: '原字幕.srt',
  format: 'srt',
  content: '1\n00:00:00,000 --> 00:00:01,000\n保留的字幕\n',
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('SubtitlePicker 字幕恢复', () => {
  it('重新导入失败时保留原字幕，并允许再次选择文件', async () => {
    const repairSubtitle = vi.fn().mockRejectedValue(new Error('字幕格式无效'));
    const onSubtitle = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SubtitlePicker
          usedSeconds={[]}
          onPick={() => undefined}
          onDuration={() => undefined}
          onCaptions={() => undefined}
          onSubtitle={onSubtitle}
          initialSubtitle={initialSubtitle}
          repairSubtitle={repairSubtitle}
          disabled={false}
        />
      );
    });

    expect(container.textContent).toContain('原字幕.srt');
    expect(container.textContent).toContain('重新导入');
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['invalid'], '错误.srt', { type: 'text/plain' })],
    });

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(repairSubtitle).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('原字幕.srt');
    expect(container.textContent).toContain('发生未知错误');
    expect(container.textContent).toContain('重新导入');
    expect(onSubtitle).not.toHaveBeenCalled();
    root.unmount();
  });
});
