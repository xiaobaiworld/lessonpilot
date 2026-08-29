/** @vitest-environment happy-dom */

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { RichTextEditor } from './RichTextEditor';

describe('RichTextEditor 类型化提示', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('显示传入的占位示例和引导，同时不把占位示例写入空内容', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <RichTextEditor
          label="题目主干"
          value=""
          disabled={false}
          onChange={() => undefined}
          placeholder="例如：面对同事冲突，第一步应该做什么？"
          hint="题干只提出一个需要判断的问题。"
        />
      );
    });

    const editor = container.querySelector<HTMLElement>('[contenteditable]');
    expect(editor).not.toBeNull();
    expect(editor?.dataset.placeholder).toBe('例如：面对同事冲突，第一步应该做什么？');
    expect(editor?.getAttribute('aria-label')).toBe('题目主干');
    expect(container.textContent).toContain('题干只提出一个需要判断的问题。');
    expect(container.textContent).toContain('保存前会去掉脚本、危险链接和未允许的标签。');
    expect(editor?.innerHTML).toBe('');
    expect(editor?.textContent).toBe('');
  });
});
