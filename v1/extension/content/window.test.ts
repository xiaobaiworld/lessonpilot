/** @vitest-environment happy-dom */

import { describe, expect, it } from 'vitest';
import { LearningWindow } from './window';
import { RuntimeNode } from '../runtime/session';

const callbacks = {
  onDraft() {},
  onSubmit() {},
  onSkip() {},
  onClose() {},
};

function notice(display: Record<string, unknown>): RuntimeNode {
  return {
    id: 'n1',
    interaction: 'notice',
    timeSeconds: 1,
    display,
    evaluation: null,
  };
}

function choice(display: Record<string, unknown>): RuntimeNode {
  return {
    id: 'c1',
    interaction: 'choice',
    timeSeconds: 1,
    display,
    evaluation: { answer: 'a' },
  };
}

describe('LearningWindow 外观与正文', () => {
  it('overlay 加上遮罩和对应 class；非法尺寸回退小卡片', () => {
    const view = new LearningWindow(callbacks, '');
    view.render({
      kind: 'open',
      node: notice({
        title: '重点',
        richBody: '<p>正文</p>',
        windowSize: 'overlay',
        windowStyle: 'document',
      }),
      draft: '',
    });

    const overlayRoot = document.getElementById('knownmap-learning-window')!.shadowRoot!;
    expect(overlayRoot.querySelector('.km-backdrop')).not.toBeNull();
    expect(overlayRoot.querySelector('.km-panel')?.className).toContain('km-size-overlay');
    expect(overlayRoot.querySelector('.km-panel')?.className).toContain('km-style-document');

    view.render({
      kind: 'open',
      node: notice({ title: '重点', richBody: '<p>正文</p>', windowSize: 'huge' }),
      draft: '',
    });
    const fallbackRoot = document.getElementById('knownmap-learning-window')!.shadowRoot!;
    expect(fallbackRoot.querySelector('.km-backdrop')).toBeNull();
    expect(fallbackRoot.querySelector('.km-panel')?.className).toContain('km-size-s');
    expect(fallbackRoot.querySelector('.km-panel')?.className).toContain('km-style-card');
    view.destroy();
  });

  it('选择题没有 richBody 时用 prompt 作为页面正文', () => {
    const view = new LearningWindow(callbacks, '');
    view.render({
      kind: 'open',
      node: choice({
        title: '选择题',
        prompt: '旧题干',
        options: [{ id: 'a', label: 'A' }],
      }),
      draft: '',
    });
    const root = document.getElementById('knownmap-learning-window')!.shadowRoot!;
    expect(root.querySelector('.km-rich-text')?.textContent).toContain('旧题干');
    expect(root.querySelector('.km-options')).not.toBeNull();
    view.destroy();
  });
});
