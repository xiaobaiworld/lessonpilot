/** @vitest-environment happy-dom */

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { createNode } from '../nodes';
import { nodeFormCopy } from '../nodeFormCopy';
import { NodeForm } from './NodeForm';

describe('NodeForm 课程化填写引导', () => {
  let root: ReturnType<typeof createRoot> | null = null;

  afterEach(() => {
    root?.unmount();
    root = null;
    document.body.innerHTML = '';
  });

  async function renderNode(node: ReturnType<typeof createNode>) {
    root?.unmount();
    document.body.innerHTML = '';
    const container = document.createElement('div');
    document.body.appendChild(container);
    const renderedRoot = createRoot(container);
    root = renderedRoot;

    await act(async () => {
      renderedRoot.render(
        <NodeForm
          node={node}
          disabled={false}
          onChange={() => undefined}
        />
      );
    });

    return container;
  }

  it('为四种节点显示对应的课程任务说明和字段名称', async () => {
    const expectedCopy = {
      notice: ['告诉学生这一刻要理解或记住什么'],
      choice: ['题目主干', '请手工填写选项', '标记为正确答案', '学生作答后的解释'],
      blank: ['标准答案 / 可接受说法', '学生提交后的解释'],
      free_text: ['问题', '学生提交后的参考反馈'],
    } as const;

    for (const kind of ['notice', 'choice', 'blank', 'free_text'] as const) {
      const container = await renderNode(createNode(kind, 39));
      for (const copyText of expectedCopy[kind]) {
        expect(container.textContent).toContain(copyText);
      }
      expect(container.textContent).toContain(nodeFormCopy(kind).contentHeading);
      expect(container.textContent).toContain(nodeFormCopy(kind).contentAside);
    }
  });

  it('选择题预览展示全部四个选项，而不是只展示前三项', async () => {
    const node = createNode('choice', 39);
    node.interactionData = {
      options: [
        { id: 'a', label: '选项一' },
        { id: 'b', label: '选项二' },
        { id: 'c', label: '选项三' },
        { id: 'd', label: '选项四' },
      ],
      answer: 'a',
      explanation: '',
    };

    const container = await renderNode(node);

    expect(container.textContent).toContain('选项一');
    expect(container.textContent).toContain('选项二');
    expect(container.textContent).toContain('选项三');
    expect(container.textContent).toContain('选项四');
  });

  it('把示例放在 placeholder 或 data-placeholder，不写入受控值', async () => {
    for (const kind of ['notice', 'choice', 'blank', 'free_text'] as const) {
      const node = createNode(kind, 39);
      const container = await renderNode(node);
      const copy = nodeFormCopy(kind);
      const controls = Array.from(
        container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
          'input[placeholder], textarea[placeholder]'
        )
      );
      const editor = container.querySelector<HTMLElement>('[contenteditable]');

      expect(controls.some((control) => control.placeholder === copy.titlePlaceholder)).toBe(true);
      if (kind === 'choice' || kind === 'blank' || kind === 'free_text') {
        expect(controls.some((control) => control.placeholder === copy.feedbackPlaceholder)).toBe(true);
      }
      if (kind === 'blank') {
        expect(controls.some((control) => control.placeholder === copy.answerPlaceholder)).toBe(true);
      }
      if (kind === 'choice') {
        expect(controls.some((control) => control.placeholder === '选项 1')).toBe(true);
      }
      expect(editor).not.toBeNull();
      expect(editor?.dataset.placeholder).toBe(copy.contentPlaceholder);
      expect(editor?.innerHTML).toBe('');
      expect(editor?.textContent).toBe('');
      for (const control of controls) {
        expect(control.value).not.toBe(control.placeholder);
      }
    }
  });
});
