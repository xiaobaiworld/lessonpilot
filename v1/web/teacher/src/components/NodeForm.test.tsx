/** @vitest-environment happy-dom */

import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { ScriptNode } from '../api';
import { createNode } from '../nodes';
import { nodeFormCopy } from '../nodeFormCopy';
import { NodeForm } from './NodeForm';

const initialNode: ScriptNode = {
  id: 'node-1',
  enabled: true,
  family: 'attention',
  interaction: 'notice',
  anchor: { kind: 'time_cross', timeSeconds: 48, captionId: null },
  title: '重点',
  content: {
    schemaVersion: 1,
    blocks: [{ type: 'paragraph', children: [{ text: '正文' }] }],
  },
  interactionData: null,
  presentationHints: {
    windowSize: { widthPercent: 46.8, heightPercent: 39 },
    windowPosition: { xPercent: 44.4, yPercent: 44 },
    windowStyle: 'document',
  },
  effects: { pause: true },
};

function NodeFormHarness() {
  const [node, setNode] = useState(initialNode);
  return <NodeForm node={node} disabled={false} onChange={setNode} />;
}

describe('节点展示位置编辑', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('明确说明是窗口中心坐标，并提供 X/Y 手工输入', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<NodeFormHarness />);
    });

    expect(container.textContent).toContain('窗口大小');
    expect(container.textContent).toContain('窗口位置');
    expect(container.textContent).not.toContain('窗口样式');
    expect(container.textContent).not.toContain('学生端预览');
    expect(container.textContent).not.toContain('学生看到的样子');
    expect(container.textContent).toContain('窗口设置');
    expect(container.textContent).not.toContain('预览设置');
    expect(container.textContent).not.toContain('窗口显示');
    expect(container.textContent).not.toContain('正在播放');
    expect(container.textContent).not.toContain('修改后查看上方预览');
    expect(container.textContent).not.toContain('学生将在视频中看到');
    expect(container.querySelector('.student-node-preview-head')).toBeNull();
    expect(container.textContent).toContain('拖动上方窗口，或直接输入中心点坐标');
    expect(container.querySelector<HTMLInputElement>('input[name="position-x"]')?.value).toBe('44.4');
    expect(container.querySelector<HTMLInputElement>('input[name="position-y"]')?.value).toBe('44');
    root.unmount();
  });

  it('手工修改坐标后同步更新预览位置和摘要', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<NodeFormHarness />);
    });

    const preview = container.querySelector<HTMLElement>('.student-node-card')!;
    const before = preview.style.getPropertyValue('--preview-left');
    const input = container.querySelector<HTMLInputElement>('input[name="position-x"]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

    await act(async () => {
      setter?.call(input, '72.3');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(input.value).toBe('72.3');
    expect(preview.style.getPropertyValue('--preview-left')).not.toBe(before);
    expect(container.textContent).not.toContain('示意预览');
    expect(container.textContent).not.toContain('窗口样式');
    root.unmount();
  });
});

type TestNode = ReturnType<typeof createNode>;

describe('NodeForm 课程化填写引导', () => {
  let root: ReturnType<typeof createRoot> | null = null;

  afterEach(() => {
    root?.unmount();
    root = null;
    document.body.innerHTML = '';
  });

  async function renderNode(
    node: TestNode,
    onChange: (nextNode: TestNode) => void = () => undefined
  ) {
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
          onChange={onChange}
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

  it('删除当前正确答案时一次更新就移除选项并迁移答案', async () => {
    const node = createNode('choice', 39);
    node.interactionData = {
      options: [
        { id: 'a', label: '选项一' },
        { id: 'b', label: '选项二' },
        { id: 'c', label: '选项三' },
      ],
      answer: 'b',
      explanation: '说明',
    };
    const changes: TestNode[] = [];
    const container = await renderNode(node, (nextNode) => changes.push(nextNode));

    const checkedRadio = container.querySelector<HTMLInputElement>('input[type="radio"]:checked');
    const removeButton = checkedRadio?.closest('.choice-row')?.querySelector<HTMLButtonElement>('button');
    expect(removeButton).not.toBeNull();

    await act(async () => {
      removeButton?.click();
    });

    expect(changes).toHaveLength(1);
    const interactionData = changes[0].interactionData as {
      options: { id: string; label: string }[];
      answer: string;
    };
    expect(interactionData.options).toEqual([
      { id: 'a', label: '选项一' },
      { id: 'c', label: '选项三' },
    ]);
    expect(interactionData.answer).toBe('a');
  });

  it('删除中间选项后新增选项使用 a-f 中首个未占用的 ID', async () => {
    const node = createNode('choice', 39);
    node.interactionData = {
      options: [
        { id: 'a', label: '选项一' },
        { id: 'b', label: '选项二' },
        { id: 'c', label: '选项三' },
      ],
      answer: 'a',
      explanation: '说明',
    };
    const changes: TestNode[] = [];
    const container = await renderNode(node, (nextNode) => changes.push(nextNode));

    const rows = Array.from(container.querySelectorAll<HTMLElement>('.choice-row'));
    const removeButton = rows[1]?.querySelector<HTMLButtonElement>('button');
    expect(removeButton).not.toBeNull();

    await act(async () => {
      removeButton?.click();
    });

    const afterRemoval = changes.find((nextNode) => {
      const options = (nextNode.interactionData as { options: { id: string }[] }).options;
      return options.map((option) => option.id).join(',') === 'a,c';
    });
    expect(afterRemoval).toBeDefined();
    const remainingOptions = (
      afterRemoval?.interactionData as { options: { id: string; label: string }[] }
    ).options;
    expect(remainingOptions.map((option) => option.id)).toEqual(['a', 'c']);

    const firstUnusedId = ['a', 'b', 'c', 'd', 'e', 'f'].find(
      (id) => !remainingOptions.some((option) => option.id === id)
    );
    expect(firstUnusedId).toBeDefined();

    const additions: TestNode[] = [];
    const afterRemovalContainer = await renderNode(afterRemoval!, (nextNode) => additions.push(nextNode));
    const addButton = Array.from(afterRemovalContainer.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('增加选项')
    );
    expect(addButton).not.toBeNull();

    await act(async () => {
      addButton?.click();
    });

    const afterAddition = additions[0];
    expect(afterAddition).toBeDefined();
    const options = (
      afterAddition?.interactionData as { options: { id: string; label: string }[] }
    ).options;
    const ids = options.map((option) => option.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.at(-1)).toBe(firstUnusedId);
  });
});
