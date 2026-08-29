import { describe, expect, it } from 'vitest';
import { NODE_FORM_COPY, nodeFormCopy } from './nodeFormCopy';

describe('节点课程化填写文案', () => {
  const kinds = ['notice', 'choice', 'blank', 'free_text'] as const;

  it('四种节点都有完整课程任务 copy', () => {
    expect(Object.keys(NODE_FORM_COPY).sort()).toEqual([...kinds].sort());
    for (const kind of kinds) {
      const copy = nodeFormCopy(kind);
      expect(copy.contentHeading).toBeTruthy();
      expect(copy.contentLabel).toBeTruthy();
      expect(copy.contentHint).toBeTruthy();
      expect(copy.contentPlaceholder).toBeTruthy();
      expect(copy.titleLabel).toBeTruthy();
      expect(copy.titlePlaceholder).toBeTruthy();
      expect(copy.previewBadge).toBeTruthy();
      expect(copy.previewEmptyText).toBeTruthy();
    }
  });

  it('选择题文案完整表达填写路径', () => {
    expect(nodeFormCopy('choice')).toMatchObject({
      contentLabel: '题目主干',
      detailHeading: '请手工填写选项',
      optionHint: '标记为正确答案',
      feedbackLabel: '学生作答后的解释',
    });
  });

  it('重点提示文案明确课程重点', () => {
    expect(nodeFormCopy('notice')).toMatchObject({
      titleLabel: '重点主题',
      contentLabel: '重点内容',
      previewBadge: '本节重点',
    });
  });

  it('填空题文案明确答案和反馈', () => {
    expect(nodeFormCopy('blank')).toMatchObject({
      contentLabel: '题目主干',
      answerLabel: '标准答案 / 可接受说法',
      feedbackLabel: '学生提交后的解释',
      previewBadge: '补全关键词',
    });
  });

  it('问答题文案明确问题和参考反馈', () => {
    expect(nodeFormCopy('free_text')).toMatchObject({
      contentLabel: '问题',
      feedbackLabel: '学生提交后的参考反馈',
      feedbackHint: '学生提交后展示；不自动判分。',
      previewBadge: '说说你的理解',
    });
  });
});
