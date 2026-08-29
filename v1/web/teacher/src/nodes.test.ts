import { describe, expect, it } from 'vitest';
import { richDocumentFromText } from '@v1/web/shared';
import { changeNodeKind, createNode, findEmptyField } from './nodes';

describe('结构化互动节点', () => {
  it('四种节点都使用 content 与 interactionData，不再生成旧 display/body', () => {
    for (const kind of ['notice', 'choice', 'blank', 'free_text'] as const) {
      const node = createNode(kind, 127);
      expect(node.id).toBeTruthy();
      expect(node.anchor).toMatchObject({ kind: 'time_cross', timeSeconds: 127 });
      expect(node.content.schemaVersion).toBe(1);
      expect(node.presentationHints).toMatchObject({
        windowSize: { widthPercent: 40, heightPercent: 30 },
        windowStyle: 'document',
        windowPosition: { xPercent: 50, yPercent: 50 },
      });
      expect(node).not.toHaveProperty('display');
      expect(node).not.toHaveProperty('evaluation');
    }
  });

  it('切换类型保留稳定 id、锚点和结构化正文', () => {
    const original = createNode('notice', 12);
    original.content = richDocumentFromText('正文');
    original.anchor.captionId = 'caption-2';
    original.presentationHints = {
      windowSize: 'l',
      windowStyle: 'card',
      windowPosition: 'center',
    };
    const next = changeNodeKind(original, 'choice');
    expect(next.id).toBe(original.id);
    expect(next.anchor).toMatchObject({ timeSeconds: 12, captionId: 'caption-2' });
    expect(next.content).toEqual(original.content);
    expect(next.presentationHints).toEqual(original.presentationHints);
    expect(next.interactionData).toMatchObject({ options: [{ id: 'a' }, { id: 'b' }] });
  });

  it('本地保存前检查结构化正文和题型数据', () => {
    const node = createNode('notice', 0);
    expect(findEmptyField(node)).toBe('正文');
    node.content = richDocumentFromText('提示');
    expect(findEmptyField(node)).toBeNull();
    const choice = createNode('choice', 0);
    choice.content = richDocumentFromText('题目');
    expect(findEmptyField(choice)).toBe('选项文字');
  });
});
