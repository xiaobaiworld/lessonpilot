import { describe, it, expect } from 'vitest';
import { NODE_KINDS, createNode, formatTime, parseTime, findEmptyField } from './nodes';

/**
 * family / interaction 的组合和各自的 evaluation 形状由后端 schema 用 const
 * 固定死，写错就整份草稿被拒。这些断言照 backend/app/schemas/script.py 写。
 */
describe('createNode', () => {
  it('四种节点的 family 与 interaction 组合正确', () => {
    expect(createNode('notice', 0)).toMatchObject({
      family: 'attention',
      interaction: 'notice',
    });
    for (const kind of ['choice', 'blank', 'free_text'] as const) {
      expect(createNode(kind, 0)).toMatchObject({ family: 'practice', interaction: kind });
    }
  });

  it('所有节点都带 time_cross 触发和 pause 效果', () => {
    for (const { kind } of NODE_KINDS) {
      const n = createNode(kind, 127);
      expect(n.trigger).toEqual({ kind: 'time_cross', timeSeconds: 127 });
      expect(n.effects).toEqual({ pause: true });
      expect(n.enabled).toBe(true);
      expect(n.id).toMatch(/^n-/);
    }
  });

  it('notice 的 evaluation 必须是 null，其余必须是对象', () => {
    expect(createNode('notice', 0).evaluation).toBeNull();
    for (const kind of ['choice', 'blank', 'free_text'] as const) {
      expect(createNode(kind, 0).evaluation).toBeTypeOf('object');
      expect(createNode(kind, 0).evaluation).not.toBeNull();
    }
  });

  it('choice 预置两个选项且答案指向其中之一', () => {
    const n = createNode('choice', 0);
    const options = (n.display as any).options;
    expect(options).toHaveLength(2);
    expect(options.map((o: any) => o.id)).toContain((n.evaluation as any).answer);
  });

  it('blank 的 normalize 是数组，取值限于 trim / casefold', () => {
    const e = createNode('blank', 0).evaluation as any;
    expect(Array.isArray(e.normalize)).toBe(true);
    for (const v of e.normalize) expect(['trim', 'casefold']).toContain(v);
    expect(e.acceptedAnswers.length).toBeGreaterThan(0);
  });

  it('id 不重复', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createNode('notice', 0).id));
    expect(ids.size).toBe(50);
  });
});

describe('findEmptyField', () => {
  it('新建的节点都缺内容，不会被误判为可保存', () => {
    for (const { kind } of NODE_KINDS) {
      expect(findEmptyField(createNode(kind, 0))).not.toBeNull();
    }
  });

  it('填满后放行：重点标注', () => {
    const n = createNode('notice', 0);
    n.display = { title: '重点', body: '正文' };
    expect(findEmptyField(n)).toBeNull();
  });

  it('填满后放行：选择题', () => {
    const n = createNode('choice', 0);
    n.display = {
      title: 'T',
      prompt: 'P',
      options: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    };
    n.evaluation = { answer: 'a', explanation: '解析' };
    expect(findEmptyField(n)).toBeNull();
  });

  it('选择题答案指向不存在的选项时拦下', () => {
    const n = createNode('choice', 0);
    n.display = {
      title: 'T',
      prompt: 'P',
      options: [{ id: 'a', label: 'A' }],
    };
    n.evaluation = { answer: 'z', explanation: '解析' };
    expect(findEmptyField(n)).toBe('正确答案');
  });

  it('空白字符不算填了', () => {
    const n = createNode('notice', 0);
    n.display = { title: '  ', body: '正文' };
    expect(findEmptyField(n)).toBe('标题');
  });

  it('填空题的可接受答案不能是空串', () => {
    const n = createNode('blank', 0);
    n.display = { title: 'T', prompt: 'P' };
    n.evaluation = { acceptedAnswers: [''], normalize: ['trim'], explanation: '解析' };
    expect(findEmptyField(n)).toBe('可接受答案');
  });
});

describe('时间输入', () => {
  it('mm:ss 与秒可互转', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(127)).toBe('02:07');
    expect(formatTime(3661)).toBe('61:01');
    expect(parseTime('02:07')).toBe(127);
    expect(parseTime('61:01')).toBe(3661);
  });

  it('也接受裸秒数', () => {
    expect(parseTime('127')).toBe(127);
    expect(parseTime(' 0 ')).toBe(0);
  });

  it('非法输入返回 null 而不是 0，避免把节点悄悄挪到片头', () => {
    expect(parseTime('')).toBeNull();
    expect(parseTime('abc')).toBeNull();
    expect(parseTime('-5')).toBeNull();
    expect(parseTime('1:70')).toBeNull();
  });
});
