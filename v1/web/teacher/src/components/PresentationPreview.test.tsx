/** @vitest-environment happy-dom */

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import {
  adjustPositionByKey,
  positionFromPointerDelta,
  PresentationPreview,
  resizeFromPointerDelta,
} from './PresentationPreview';
import type { PresentationHints } from '@v1/web/shared';

describe('互动窗口预览位置控制', () => {
  it('把拖动位移转换为百分比并限制在安全位置', () => {
    expect(positionFromPointerDelta(
      { xPercent: 50, yPercent: 50 },
      { x: 250, y: -100 },
      { width: 1000, height: 800 },
    )).toEqual({ xPercent: 75, yPercent: 37.5 });

    expect(positionFromPointerDelta(
      { xPercent: 50, yPercent: 50 },
      { x: -900, y: 900 },
      { width: 1000, height: 800 },
    )).toEqual({ xPercent: 0, yPercent: 100 });
  });

  it('方向键每次微调半个百分点', () => {
    expect(adjustPositionByKey({ xPercent: 50, yPercent: 50 }, 'ArrowRight')).toEqual({
      xPercent: 50.5,
      yPercent: 50,
    });
    expect(adjustPositionByKey({ xPercent: 0, yPercent: 100 }, 'ArrowLeft')).toEqual({
      xPercent: 0,
      yPercent: 100,
    });
  });

  it('拖动右边缘时只改变宽度，并以左边缘为固定边界', () => {
    expect(resizeFromPointerDelta(
      {
        windowSize: { widthPercent: 40, heightPercent: 30 },
        windowPosition: { xPercent: 50, yPercent: 50 },
      },
      'e',
      { x: 100, y: 0 },
      { width: 1000, height: 800 },
    )).toEqual({
      windowSize: { widthPercent: 50, heightPercent: 30 },
      windowPosition: { xPercent: 55, yPercent: 50 },
    });
  });

  it('拖动右下角时同时改变宽高，并限制最大尺寸', () => {
    expect(resizeFromPointerDelta(
      {
        windowSize: { widthPercent: 40, heightPercent: 30 },
        windowPosition: { xPercent: 50, yPercent: 50 },
      },
      'se',
      { x: 100, y: 80 },
      { width: 1000, height: 800 },
    )).toEqual({
      windowSize: { widthPercent: 50, heightPercent: 40 },
      windowPosition: { xPercent: 55, yPercent: 55 },
    });

    expect(resizeFromPointerDelta(
      {
        windowSize: { widthPercent: 40, heightPercent: 30 },
        windowPosition: { xPercent: 50, yPercent: 50 },
      },
      'se',
      { x: 1000, y: 1000 },
      { width: 1000, height: 800 },
    ).windowSize).toEqual({ widthPercent: 66, heightPercent: 66 });
  });

  it('预览窗口显示四边和四角共八个缩放控制点', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const hints: PresentationHints = {
      windowSize: { widthPercent: 40, heightPercent: 30 },
      windowPosition: { xPercent: 50, yPercent: 50 },
      windowStyle: 'document',
    };

    await act(async () => {
      root.render(
        <PresentationPreview hints={hints} disabled={false} onChange={vi.fn()}>
          <span>预览内容</span>
        </PresentationPreview>,
      );
    });

    expect(container.querySelectorAll('.preview-resize-handle')).toHaveLength(8);
    expect(container.querySelector<HTMLElement>('.student-node-card')?.getAttribute('aria-label')).toContain('调整大小');
    root.unmount();
    document.body.innerHTML = '';
  });
});
