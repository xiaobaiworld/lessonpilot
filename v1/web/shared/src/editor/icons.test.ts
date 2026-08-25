import { describe, expect, it } from 'vitest';
import { NODE_ICON_DEFINITIONS, NODE_ICON_IDS } from './icons';

describe('节点共享图标真源', () => {
  it('四种节点各自只有一个稳定 iconId', () => {
    expect(NODE_ICON_IDS).toEqual({
      notice: 'attention',
      choice: 'choice',
      blank: 'blank',
      free_text: 'qa',
    });
    expect(new Set(Object.values(NODE_ICON_IDS)).size).toBe(4);
  });

  it('所有 iconId 都能从同一个定义表解析', () => {
    for (const iconId of Object.values(NODE_ICON_IDS)) {
      expect(NODE_ICON_DEFINITIONS[iconId]).toMatchObject({
        viewBox: '0 0 20 20',
      });
    }
  });
});
