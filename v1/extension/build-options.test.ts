import { describe, expect, it } from 'vitest';
import { buildEntryPlan } from './build-options';

describe('插件构建入口', () => {
  it('内容脚本使用独立单入口并内联全部依赖', () => {
    const plan = buildEntryPlan(true, '/extension');

    expect(Object.keys(plan.input)).toEqual(['content/index']);
    expect(plan.inlineDynamicImports).toBe(true);
    expect(plan.emptyOutDir).toBe(true);
  });

  it('其它入口保持模块化并保留内容脚本产物', () => {
    const plan = buildEntryPlan(false, '/extension');

    expect(Object.keys(plan.input)).toEqual([
      'background/service-worker',
      'popup/index',
      'settings/index',
    ]);
    expect(plan.inlineDynamicImports).toBe(false);
    expect(plan.emptyOutDir).toBe(false);
  });
});
