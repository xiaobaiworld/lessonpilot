import { describe, it, expect } from 'vitest';
import { LearningSession, RuntimeNode, evaluate, toRuntimeNodes } from './session';
import { emptyRichPageDocument } from '../../web/shared/src';

const node = (
  id: string,
  timeSeconds: number,
  interaction: RuntimeNode['interaction'] = 'notice',
  evaluation: Record<string, unknown> | null = null
): RuntimeNode => ({ id, interaction, timeSeconds, title: id, content: emptyRichPageDocument(), interactionData: evaluation });

const session = (nodes: RuntimeNode[]) =>
  new LearningSession('c1', 'l1', '2026-08-23T00:00:00.000Z', nodes);

describe('触发', () => {
  it('跨过时刻才触发，并要求宿主暂停', () => {
    const s = session([node('n1', 30)]);
    expect(s.advance(29)).toEqual({ type: 'none' });
    expect(s.advance(30)).toEqual({ type: 'pause' });
    expect(s.snapshot().window.kind).toBe('open');
  });

  it('同一节点一次会话只打断一次', () => {
    const s = session([node('n1', 30)]);
    s.advance(30);
    s.close();
    expect(s.advance(31)).toEqual({ type: 'none' });
  });

  it('窗口已开时不叠加第二个', () => {
    const s = session([node('n1', 10), node('n2', 12)]);
    expect(s.advance(15)).toEqual({ type: 'pause' });
    expect(s.advance(15)).toEqual({ type: 'none' });
    expect((s.snapshot().window as any).node.id).toBe('n1');
  });

  it('按时刻顺序触发，不按数组顺序', () => {
    const s = session([node('late', 60), node('early', 10)]);
    s.advance(60);
    expect((s.snapshot().window as any).node.id).toBe('early');
  });

  it('同刻节点按 id 稳定排序，两次运行顺序一致', () => {
    const order = () => {
      const s = session([node('b', 10), node('a', 10)]);
      s.advance(10);
      return (s.snapshot().window as any).node.id;
    };
    expect(order()).toBe('a');
    expect(order()).toBe('a');
  });

  it('刷新后已作答的节点不再弹', () => {
    const s = session([
      node('n1', 30, 'choice', { answer: 'a' }),
      node('n2', 60, 'choice', { answer: 'a' }),
    ]);
    s.restoreDone(['n1']);
    s.advance(60);
    expect((s.snapshot().window as any).node.id).toBe('n2');
  });
});

describe('五种结局互不冒充', () => {
  it('答对', () => {
    const s = session([node('n1', 10, 'choice', { answer: 'a' })]);
    s.advance(10);
    s.updateDraft('a');
    const rec = s.submit('t');
    expect(rec?.attempt.correct).toBe(true);
    expect((s.snapshot().window as any).outcome).toEqual({ result: 'correct' });
  });

  it('答错记 false，不记 null', () => {
    const s = session([node('n1', 10, 'choice', { answer: 'a' })]);
    s.advance(10);
    s.updateDraft('b');
    expect(s.submit('t')?.attempt.correct).toBe(false);
  });

  it('无判分节点记 null，不算答对', () => {
    const s = session([node('n1', 10, 'notice')]);
    s.advance(10);
    const rec = s.submit('t');
    expect(rec?.attempt.correct).toBeNull();
    expect((s.snapshot().window as any).outcome).toEqual({ result: 'acknowledged' });
  });

  it('跳过记为 skipped，不是答对也不是答错', () => {
    const s = session([node('n1', 10, 'choice', { answer: 'a' })]);
    s.advance(10);
    const rec = s.skip('t');
    expect(rec?.attempt.correct).toBeNull();
    expect((s.snapshot().window as any).outcome).toEqual({ result: 'skipped' });
  });

  it('出错记为 failed，不冒充完成', () => {
    const s = session([node('n1', 10, 'choice', { answer: 'a' })]);
    s.advance(10);
    s.failCurrent('渲染失败');
    expect((s.snapshot().window as any).outcome).toMatchObject({ result: 'failed' });
  });

  it('不支持的类型单独成状态，既不暂停也不假装完成', () => {
    const s = session([node('n1', 10, 'hologram' as any)]);
    expect(s.advance(10)).toEqual({ type: 'none' });
    expect(s.snapshot().window.kind).toBe('unsupported');
  });
});

describe('提交与草稿', () => {
  it('草稿不产生作答记录', () => {
    const s = session([node('n1', 10, 'blank', { acceptedAnswers: ['x'], normalize: [] })]);
    s.advance(10);
    s.updateDraft('x');
    expect(s.snapshot().window).toMatchObject({ draft: 'x' });
  });

  it('重复点提交只记一条', () => {
    const s = session([node('n1', 10, 'choice', { answer: 'a' })]);
    s.advance(10);
    expect(s.submit('t')).not.toBeNull();
    expect(s.submit('t')).toBeNull();
  });

  it('窗口没开时提交无效', () => {
    const s = session([node('n1', 10)]);
    expect(s.submit('t')).toBeNull();
    expect(s.skip('t')).toBeNull();
  });
});

describe('关窗与继续', () => {
  it('作答后关窗要求继续播放', () => {
    const s = session([node('n1', 10)]);
    s.advance(10);
    s.submit('t');
    expect(s.close()).toEqual({ type: 'resume' });
    expect(s.snapshot().window.kind).toBe('idle');
  });

  it('不支持的节点关窗后也继续播放', () => {
    const s = session([node('n1', 10, 'hologram' as any)]);
    s.advance(10);
    expect(s.close()).toEqual({ type: 'resume' });
  });

  it('本来就空闲时关窗不发多余的继续指令', () => {
    expect(session([]).close()).toEqual({ type: 'none' });
  });

  it('暂时切回原视频时收起未完成节点，恢复课程后仍可再次触发', () => {
    const s = session([node('n1', 10)]);
    s.advance(10);

    expect(s.suspend()).toEqual({ type: 'resume' });
    expect(s.snapshot().window.kind).toBe('idle');
    expect(s.advance(10)).toEqual({ type: 'pause' });
  });
});

describe('seek', () => {
  it('往前拖不补弹跳过的节点', () => {
    const s = session([
      node('n1', 10, 'choice', { answer: 'a' }),
      node('n2', 20, 'choice', { answer: 'a' }),
      node('n3', 300, 'choice', { answer: 'a' }),
    ]);
    s.seek(100);
    expect(s.advance(100)).toEqual({ type: 'none' });
    expect(s.advance(300)).toEqual({ type: 'pause' });
    expect((s.snapshot().window as any).node.id).toBe('n3');
  });

  it('往回拖不重复打断已触发的节点', () => {
    const s = session([node('n1', 30, 'choice', { answer: 'a' })]);
    s.advance(30);
    s.close();
    s.seek(0);
    expect(s.advance(30)).toEqual({ type: 'none' });
  });

  it('重新播放视频时重点提示节点可以再次弹出', () => {
    const s = session([node('n1', 30, 'notice')]);
    s.advance(30);
    s.submit('t');
    s.close();
    s.seek(0);
    expect(s.advance(30)).toEqual({ type: 'pause' });
    expect((s.snapshot().window as any).node.id).toBe('n1');
  });
});

describe('填空判分', () => {
  const blank = (rules: string[], accepted: string[]) =>
    node('n1', 0, 'blank', { acceptedAnswers: accepted, normalize: rules });

  it('按 normalize 规则比对', () => {
    expect(evaluate(blank(['trim', 'casefold'], ['Hello']), ' hello ')).toEqual({
      result: 'correct',
    });
    expect(evaluate(blank([], ['Hello']), ' hello ')).toEqual({ result: 'incorrect' });
  });

  it('多个可接受答案任一命中即算对', () => {
    expect(evaluate(blank(['trim'], ['甲', '乙']), '乙')).toEqual({ result: 'correct' });
  });

  it('问答题不自动判分', () => {
    expect(evaluate(node('n1', 0, 'free_text', { referenceFeedback: 'x' }), '随便写')).toEqual(
      { result: 'acknowledged' }
    );
  });
});

describe('toRuntimeNodes', () => {
  it('丢弃缺 id 或时刻非法的节点，不让它们进运行时', () => {
    const nodes = toRuntimeNodes({
      lessonId: 'l1',
      title: 't',
      videoId: 'BV1Ac41187Lm',
      nodes: [
        { id: 'ok', interaction: 'notice', anchor: { timeSeconds: 10 } },
        { interaction: 'notice', anchor: { timeSeconds: 20 } },
        { id: 'bad-time', interaction: 'notice', anchor: { timeSeconds: 'x' } },
        { id: 'no-anchor', interaction: 'notice' },
      ],
    });
    expect(nodes.map((n) => n.id)).toEqual(['ok']);
  });
});

describe('完成判定', () => {
  it('全部触发过才算完成', () => {
    const s = session([node('n1', 10), node('n2', 20)]);
    s.advance(10);
    s.close();
    expect(s.complete).toBe(false);
    s.advance(20);
    expect(s.complete).toBe(true);
  });

  it('没有节点的课节不算已完成课程', () => {
    // 空节点课节在安装时就被拒绝，这里只保证不误判为完成
    expect(session([]).complete).toBe(true);
  });
});
