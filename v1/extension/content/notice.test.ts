import { describe, expect, it } from 'vitest';
import { getNoticeSummary } from './notice';

describe('重点提示结构化内容', () => {
  it('优先读取结构化字段', () => {
    const result = getNoticeSummary({
      title: '重点提示',
      body: '旧版正文',
      eyebrow: '把答案说得具体',
      intro: '这节课练习具体表达。',
      sections: [
        { label: '先理解', body: '先理解情境。' },
        { label: '再练习', body: '再做题。' },
        { label: '最后巩固', body: '最后总结。' },
      ],
      summary: { title: '本节重点', body: '掌握情境、行动和结果。加油。' },
    });

    expect(result).toEqual({
      eyebrow: '把答案说得具体',
      intro: '这节课练习具体表达。',
      sections: [
        { label: '先理解', body: '先理解情境。' },
        { label: '再练习', body: '再做题。' },
        { label: '最后巩固', body: '最后总结。' },
      ],
      summary: { title: '本节重点', body: '掌握情境、行动和结果。加油。' },
    });
  });

  it('把当前长正文转换成三段摘要', () => {
    const result = getNoticeSummary({
      title: '重点提示',
      body: [
        '这是一节关于“把答案说得具体”的互动课。',
        '第一个节点是重点提示：先注意示范中的表达差异。',
        '第二个节点是选择题：回顾前面的提醒。',
        '第三个节点是填空题：从示范表达中找出关键句。',
        '第四个节点是问答题：请用自己的经历说明困难情况。',
        '第五个节点是选择题：再次比较两个回答。',
        '接下来一共有 4 道题：两道选择题、一道填空题和一道问答题。',
        '本节总结：掌握“情境—行动—结果”的表达方法。',
        '加油。',
      ].join('\n\n'),
    });

    expect(result).toMatchObject({
      intro: '这是一节关于“把答案说得具体”的互动课。',
      sections: [
        { label: '先理解' },
        { label: '再练习' },
        { label: '最后巩固' },
      ],
      summary: { body: expect.stringContaining('加油') },
    });
    expect(result?.sections[1].body).toContain('4 道题');
  });

  it('普通旧正文没有足够结构时返回空，调用方继续使用单段正文', () => {
    expect(getNoticeSummary({ title: '重点提示', body: '记住这一句。' })).toBeNull();
  });

  it('结构化字段缺少必要内容时不渲染半成品', () => {
    expect(
      getNoticeSummary({
        title: '重点提示',
        body: '旧版正文',
        sections: [{ label: '先理解', body: '' }],
      })
    ).toBeNull();
  });
});
