/** @vitest-environment happy-dom */

import { describe, expect, it } from 'vitest';
import { LearningWindow } from './window';
import { RuntimeNode } from '../runtime/session';
import { richDocumentFromText } from '../../web/shared/src';

const callbacks = {
  onDraft() {},
  onSubmit() {},
  onSkip() {},
  onClose() {},
};

function notice(hints: Record<string, unknown>): RuntimeNode {
  return {
    id: 'n1',
    interaction: 'notice',
    timeSeconds: 1,
    title: '重点',
    content: richDocumentFromText('正文'),
    interactionData: null,
    presentationHints: hints as RuntimeNode['presentationHints'],
  };
}

function choice(data: Record<string, unknown>): RuntimeNode {
  return {
    id: 'c1',
    interaction: 'choice',
    timeSeconds: 1,
    title: '选择题',
    content: richDocumentFromText('题干'),
    interactionData: data,
  };
}

describe('LearningWindow 外观与正文', () => {
  it('旧 overlay 保留遮罩；非法配置回退默认居中窗口', () => {
    const view = new LearningWindow(callbacks, '');
    view.render({
      kind: 'open',
      node: { ...notice({
        windowSize: 'overlay',
        windowStyle: 'document',
      }) },
      draft: '',
    });

    const overlayRoot = document.getElementById('knownmap-learning-window')!.shadowRoot!;
    expect(overlayRoot.querySelector('.km-backdrop')).not.toBeNull();
    expect(overlayRoot.querySelector<HTMLElement>('.km-panel')?.className).not.toContain('km-size-overlay');
    expect(overlayRoot.querySelector<HTMLElement>('.km-panel')?.className).toContain('km-style-document');
    expect(overlayRoot.querySelector<HTMLElement>('.km-panel')?.style.getPropertyValue('--km-width-percent')).toBe('66');

    view.render({
      kind: 'open',
      node: { ...notice({ windowSize: 'huge' }) },
      draft: '',
    });
    const fallbackRoot = document.getElementById('knownmap-learning-window')!.shadowRoot!;
    expect(fallbackRoot.querySelector('.km-backdrop')).toBeNull();
    expect(fallbackRoot.querySelector<HTMLElement>('.km-panel')?.className).not.toContain('km-size-s');
    expect(fallbackRoot.querySelector<HTMLElement>('.km-panel')?.className).toContain('km-style-document');
    expect(fallbackRoot.querySelector<HTMLElement>('.km-panel')?.style.getPropertyValue('--km-x-percent')).toBe('50');
    view.destroy();
  });

  it('渲染旧位置为连续坐标变量', () => {
    const view = new LearningWindow(callbacks, '');
    view.render({
      kind: 'open',
      node: {
        ...notice({
          windowSize: 'm',
          windowStyle: 'card',
          windowPosition: 'bottom-left',
        }),
      },
      draft: '',
    });
    const root = document.getElementById('knownmap-learning-window')!.shadowRoot!;
    expect(root.querySelector<HTMLElement>('.km-panel')?.className).not.toContain('km-position-bottom-left');
    expect(root.querySelector<HTMLElement>('.km-panel')?.style.getPropertyValue('--km-x-percent')).toBe('20');
    view.destroy();
  });

  it('渲染新格式的连续尺寸和位置', () => {
    const view = new LearningWindow(callbacks, '');
    view.render({
      kind: 'open',
      node: {
        ...notice({
          windowSize: { widthPercent: 42.5, heightPercent: 31.2 },
          windowPosition: { xPercent: 63.4, yPercent: 28.7 },
          windowStyle: 'document',
        }),
      },
      draft: '',
    });
    const root = document.getElementById('knownmap-learning-window')!.shadowRoot!;
    const panel = root.querySelector<HTMLElement>('.km-panel')!;
    expect(panel.className).not.toContain('km-size-');
    expect(panel.className).not.toContain('km-position-');
    expect(panel.style.getPropertyValue('--km-width-percent')).toBe('42.5');
    expect(panel.style.getPropertyValue('--km-height-percent')).toBe('31.2');
    expect(panel.style.getPropertyValue('--km-x-percent')).toBe('63.4');
    expect(panel.style.getPropertyValue('--km-y-percent')).toBe('28.7');
    view.destroy();
  });

  it('选择题正文来自结构化 content，不从旧 prompt 回退', () => {
    const view = new LearningWindow(callbacks, '');
    view.render({
      kind: 'open',
      node: choice({
        options: [{ id: 'a', label: 'A' }],
      }),
      draft: '',
    });
    const root = document.getElementById('knownmap-learning-window')!.shadowRoot!;
    expect(root.querySelector('.km-rich-text')?.textContent).toContain('题干');
    expect(root.querySelector('.km-options')).not.toBeNull();
    view.destroy();
  });
});
