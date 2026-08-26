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
  it('overlay 加上遮罩和对应 class；非法尺寸回退小卡片', () => {
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
    expect(overlayRoot.querySelector('.km-panel')?.className).toContain('km-size-overlay');
    expect(overlayRoot.querySelector('.km-panel')?.className).toContain('km-style-document');

    view.render({
      kind: 'open',
      node: { ...notice({ windowSize: 'huge' }) },
      draft: '',
    });
    const fallbackRoot = document.getElementById('knownmap-learning-window')!.shadowRoot!;
    expect(fallbackRoot.querySelector('.km-backdrop')).toBeNull();
    expect(fallbackRoot.querySelector('.km-panel')?.className).toContain('km-size-s');
    expect(fallbackRoot.querySelector('.km-panel')?.className).toContain('km-style-card');
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
