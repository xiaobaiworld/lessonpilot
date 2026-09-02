/** @vitest-environment happy-dom */

import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { RichTextEditor } from './RichTextEditor';

describe('RichTextEditor 类型化提示', () => {
  let root: ReturnType<typeof createRoot> | null = null;

  afterEach(() => {
    root?.unmount();
    root = null;
    document.body.innerHTML = '';
  });

  it('显示传入的占位示例和引导，同时不把占位示例写入空内容', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const renderedRoot = createRoot(container);
    root = renderedRoot;

    await act(async () => {
      renderedRoot.render(
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

  it('编辑中父组件更新不会重写 DOM，避免回车后光标跳到开头', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const renderedRoot = createRoot(container);
    root = renderedRoot;
    const Harness = () => {
      const [value, setValue] = useState('');
      return <RichTextEditor label="正文" value={value} disabled={false} onChange={setValue} />;
    };

    await act(async () => renderedRoot.render(<Harness />));
    const editor = container.querySelector<HTMLElement>('[contenteditable]')!;
    editor.focus();
    editor.innerHTML = '<div>what if we have</div><div><br></div>';
    await act(async () => {
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(editor.innerHTML).toContain('what if we have');
    expect(editor.innerHTML).toContain('<br>');
  });
});
