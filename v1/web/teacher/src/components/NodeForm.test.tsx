/** @vitest-environment happy-dom */

import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { ScriptNode } from '../api';
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
