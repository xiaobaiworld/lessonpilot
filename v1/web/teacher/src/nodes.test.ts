import { describe, expect, it } from 'vitest';
import { richDocumentFromText } from '@v1/web/shared';
import { changeNodeKind, createNode, findEmptyField, metaOf } from './nodes';

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

  it('四种节点使用课程化默认标题和重点提示元数据', () => {
    expect(createNode('notice', 0).title).toBe('本节重点');
    expect(createNode('choice', 0).title).toBe('想一想');
    expect(createNode('blank', 0).title).toBe('补全关键词');
    expect(createNode('free_text', 0).title).toBe('说说你的理解');
    expect(metaOf('notice')).toMatchObject({
      label: '重点提示',
      hint: '暂停视频，提醒学生记住一个关键点',
    });
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

  it('按课程化字段名称提示各题型的缺失内容', () => {
    const notice = createNode('notice', 0);
    expect(findEmptyField(notice)).toBe('重点内容');

    const choice = createNode('choice', 0);
    choice.content = richDocumentFromText('题目');
    choice.interactionData = {
      options: [
        { id: 'a', label: '选项一' },
        { id: 'b', label: '选项二' },
      ],
      answer: 'a',
      explanation: '',
    };
    expect(findEmptyField(choice)).toBe('学生作答后的解释');

    const blank = createNode('blank', 0);
    blank.content = richDocumentFromText('题目');
    blank.interactionData = {
      acceptedAnswers: [''],
      normalize: ['trim', 'casefold'],
      explanation: '提交后解释',
    };
    expect(findEmptyField(blank)).toBe('标准答案 / 可接受说法');
    blank.interactionData.acceptedAnswers = ['关键词'];
    blank.interactionData.explanation = '';
    expect(findEmptyField(blank)).toBe('学生提交后的解释');

    const freeText = createNode('free_text', 0);
    freeText.content = richDocumentFromText('问题');
    expect(findEmptyField(freeText)).toBe('学生提交后的参考反馈');
  });
});
