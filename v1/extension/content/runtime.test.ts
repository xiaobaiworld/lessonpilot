import { describe, it, expect, vi } from 'vitest';
import {
  CourseRuntime,
  PageController,
  Messenger,
  RuntimeDeps,
  createVideoModeStore,
} from './runtime';
import { PlayerHandle } from '../host/bilibili';
import { RuntimeCandidate } from '../shared/library-view';
import { PortableNode, richDocumentFromText } from '../../web/shared/src';

/**
 * 阶段 5E 的自动化部分：seek、刷新、播放器重建、SPA、离线、扩展更新
 * 和课程库更新。
 *
 * 这些是最容易在真实使用中出问题、又最难靠人工反复验的路径。人工矩阵
 * 仍要在真实 Chrome 上留证，但每一条在这里先有确定性覆盖。
 */

/** 可控播放器替身。记录暂停/继续，可手动触发事件 */
class FakePlayer implements PlayerHandle {
  time = 0;
  paused = false;
  pauseCalls = 0;
  playCalls = 0;
  private timeHandlers: ((s: number) => void)[] = [];
  private seekHandlers: ((s: number) => void)[] = [];

  currentTime() {
    return this.time;
  }
  pause() {
    this.paused = true;
    this.pauseCalls++;
  }
  play() {
    this.paused = false;
    this.playCalls++;
  }
  isPlaying() {
    return !this.paused;
  }
  onTimeUpdate(fn: (s: number) => void) {
    this.timeHandlers.push(fn);
    return () => {
      this.timeHandlers = this.timeHandlers.filter((f) => f !== fn);
    };
  }
  onSeeked(fn: (s: number) => void) {
    this.seekHandlers.push(fn);
    return () => {
      this.seekHandlers = this.seekHandlers.filter((f) => f !== fn);
    };
  }

  advanceTo(seconds: number) {
    this.time = seconds;
    for (const fn of [...this.timeHandlers]) fn(seconds);
  }
  seekTo(seconds: number) {
    this.time = seconds;
    for (const fn of [...this.seekHandlers]) fn(seconds);
  }
  get listenerCount() {
    return this.timeHandlers.length + this.seekHandlers.length;
  }
}

const candidate = (n = 1): RuntimeCandidate => ({
  courseId: `c${n}`,
  courseTitle: `课程 ${n}`,
  lessonId: `l${n}`,
  lessonTitle: `课节 ${n}`,
});

const node = (id: string, timeSeconds: number, interaction: PortableNode['interaction'] = 'notice'): PortableNode => ({
  id,
  enabled: true,
  family: interaction === 'notice' ? 'attention' : 'practice',
  interaction,
  anchor: { kind: 'time_cross', timeSeconds, captionId: null },
  title: id,
  content: richDocumentFromText('x'),
  interactionData: null,
  effects: { pause: true },
});

interface Harness {
  runtime: CourseRuntime;
  player: FakePlayer;
  messenger: Messenger;
  renders: unknown[];
  destroys: number;
  attempts: unknown[];
  positions: number[];
  modeChanges: string[];
  deps: RuntimeDeps;
  companionStates: string[];
}

function harness(overrides: Partial<RuntimeDeps> = {}, lessonNodes = [node('n1', 30)]): Harness {
  const player = new FakePlayer();
  const renders: unknown[] = [];
  const attempts: unknown[] = [];
  const positions: number[] = [];
  const modeChanges: string[] = [];
  const companionStates: string[] = [];
  let destroys = 0;
  let modeControlDestroys = 0;

  const messenger: Messenger = {
    candidates: vi.fn(async () => [candidate()]),
    lesson: vi.fn(async () => ({
      installedAt: '2026-08-23T00:00:00.000Z',
      nodes: lessonNodes,
      done: [],
      lastPositionSeconds: 0,
    })),
    attempt: vi.fn(async (...args) => {
      attempts.push(args);
    }),
    position: vi.fn(async (_c, _l, seconds) => {
      positions.push(seconds);
    }),
  };

  const deps: RuntimeDeps = {
    messenger,
    waitForPlayer: async () => player,
    createWindow: (callbacks) => {
      // 把回调挂出来，测试可直接触发学生操作
      (deps as any).callbacks = callbacks;
      return {
        render: (state) => renders.push(state),
        destroy: () => {
          destroys++;
        },
      };
    },
    modeStore: createVideoModeStore(null),
    createModeControl: (onToggle) => {
      (deps as any).toggleMode = onToggle;
      return {
        setMode: (mode) => modeChanges.push(mode),
        destroy: () => {
          modeControlDestroys++;
        },
      };
    },
    chooseCandidate: async (list) => list[0],
    now: () => new Date('2026-08-23T12:00:00.000Z'),
    companion: {
      setVisualState: (state) => companionStates.push(state),
    },
    ...overrides,
  };

  const h: Harness = {
    runtime: new CourseRuntime(deps),
    player,
    messenger,
    renders,
    get destroys() {
      return destroys;
    },
    attempts,
    positions,
    modeChanges,
    get modeControlDestroys() {
      return modeControlDestroys;
    },
    deps,
    companionStates,
  } as Harness;
  return h;
}

describe('陪伴形象状态映射', () => {
  it('按节点生命周期切换 focus、prompt、correct 和 complete', async () => {
    const h = harness({}, [{ ...node('n1', 10, 'choice'), interactionData: { answer: 'a' } }]);
    await h.runtime.start('BV1Ac41187Lm');
    expect(h.companionStates).toEqual(['focus']);

    h.player.advanceTo(10);
    expect(h.companionStates).toEqual(['focus', 'prompt']);
    callbacksOf(h).onDraft('a');
    callbacksOf(h).onSubmit();
    expect(h.companionStates).toEqual(['focus', 'prompt', 'correct']);
    callbacksOf(h).onClose();
    expect(h.companionStates).toEqual(['focus', 'prompt', 'correct', 'complete']);
  });

  it('答错只进入 wrong，不播放完成庆祝', async () => {
    const h = harness({}, [node('n1', 10, 'choice')]);
    await h.runtime.start('BV1Ac41187Lm');
    h.player.advanceTo(10);
    callbacksOf(h).onDraft('wrong');
    callbacksOf(h).onSubmit();
    callbacksOf(h).onClose();
    expect(h.companionStates).toEqual(['focus', 'prompt', 'wrong', 'idle']);
  });
});

const callbacksOf = (h: Harness) => (h.deps as any).callbacks;
const toggleModeOf = (h: Harness) => (h.deps as any).toggleMode();

describe('原视频模式', () => {
  it('默认使用课程模式，并持久化学生选择', () => {
    const values = new Map<string, string>();
    const store = createVideoModeStore({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    });

    expect(store.read()).toBe('course');
    expect(store.write('original')).toBe('original');
    expect(store.read()).toBe('original');
    expect(store.write('unknown' as never)).toBe('course');
  });

  it('原视频模式不触发互动，切回课程模式后按当前位置恢复', async () => {
    const values = new Map<string, string>([['lessonpilot.video-mode', 'original']]);
    const h = harness({
      modeStore: createVideoModeStore({
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
      }),
    });
    await h.runtime.start('BV1Ac41187Lm');

    h.player.advanceTo(30);
    expect(h.player.pauseCalls).toBe(0);
    expect(h.renders).toHaveLength(0);

    toggleModeOf(h);

    expect(values.get('lessonpilot.video-mode')).toBe('course');
    expect(h.player.pauseCalls).toBe(1);
    expect((h.runtime.snapshot()!.window as any).node.id).toBe('n1');
    expect(h.modeChanges).toEqual(['original', 'course']);
  });

  it('互动打开时切到原视频会收起并播放，切回后重新显示该互动', async () => {
    const h = harness();
    await h.runtime.start('BV1Ac41187Lm');
    h.player.advanceTo(30);
    expect(h.player.pauseCalls).toBe(1);

    toggleModeOf(h);
    expect(h.player.playCalls).toBe(1);
    expect(h.runtime.snapshot()!.window.kind).toBe('idle');

    toggleModeOf(h);
    expect(h.player.pauseCalls).toBe(2);
    expect((h.runtime.snapshot()!.window as any).node.id).toBe('n1');
  });
});

describe('互动节点播放控制', () => {
  it('节点触发前视频已暂停时，关闭节点不自动恢复播放', async () => {
    const h = harness();
    h.player.paused = true;
    await h.runtime.start('BV1Ac41187Lm');

    h.player.advanceTo(30);
    expect(h.player.pauseCalls).toBe(0);
    expect((h.runtime.snapshot()!.window as any).kind).toBe('open');

    callbacksOf(h).onSubmit();
    callbacksOf(h).onClose();

    expect(h.player.playCalls).toBe(0);
  });
});

describe('无匹配页面不显示任何 UI', () => {
  it('零候选时不等播放器也不建窗口', async () => {
    const waitForPlayer = vi.fn(async () => new FakePlayer());
    const h = harness({
      messenger: {
        candidates: async () => [],
        lesson: async () => null,
        attempt: async () => {},
        position: async () => {},
      },
      waitForPlayer,
    });

    await h.runtime.start('BV1Ac41187Lm');

    expect(waitForPlayer).not.toHaveBeenCalled();
    expect(h.renders).toHaveLength(0);
  });

  it('候选查询失败时同样安静退出', async () => {
    const h = harness({
      messenger: {
        candidates: async () => null, // 离线或 worker 失效
        lesson: async () => null,
        attempt: async () => {},
        position: async () => {},
      },
    });

    await h.runtime.start('BV1Ac41187Lm');

    expect(h.renders).toHaveLength(0);
    expect(h.runtime.snapshot()).toBeNull();
  });

  it('课节没有可用节点时不接线', async () => {
    // 节点缺 anchor，toRuntimeNodes 会全部丢弃
    const h = harness({}, [{ id: 'x', interaction: 'notice' } as never]);

    await h.runtime.start('BV1Ac41187Lm');

    expect(h.player.listenerCount).toBe(0);
  });
});

describe('离线与扩展更新', () => {
  it('课节请求失败时不启动，也不留窗口', async () => {
    const h = harness({
      messenger: {
        candidates: async () => [candidate()],
        lesson: async () => null, // service worker 已失效
        attempt: async () => {},
        position: async () => {},
      },
    });

    await h.runtime.start('BV1Ac41187Lm');

    expect(h.runtime.snapshot()).toBeNull();
    expect(h.player.listenerCount).toBe(0);
  });

  it('作答上报失败不影响界面继续', async () => {
    const h = harness({
      messenger: {
        candidates: async () => [candidate()],
        lesson: async () => ({
          installedAt: 'x',
          nodes: [node('n1', 30)],
          done: [],
          lastPositionSeconds: 0,
        }),
        // 上报抛错：网络断了或 worker 重启
        attempt: async () => {
          throw new Error('offline');
        },
        position: async () => {},
      },
    });
    await h.runtime.start('BV1Ac41187Lm');
    h.player.advanceTo(30);

    // 提交后窗口仍进入已作答态，学生能关窗继续看
    expect(() => callbacksOf(h).onSubmit()).not.toThrow();
    const last = h.renders[h.renders.length - 1] as any;
    expect(last.kind).toBe('answered');
  });

  it('上报失败不产生未处理的 rejection', async () => {
    /*
     * `void promise` 遇到 reject 会留下未处理的 rejection，学生控制台里
     * 就是一条错误。这里直接监听进程级事件，改回 void 就会失败。
     */
    const escaped: unknown[] = [];
    const onUnhandled = (reason: unknown) => escaped.push(reason);
    process.on('unhandledRejection', onUnhandled);

    try {
      const h = harness({
        messenger: {
          candidates: async () => [candidate()],
          lesson: async () => ({
            installedAt: 'x',
            nodes: [node('n1', 10)],
            done: [],
            lastPositionSeconds: 0,
          }),
          attempt: async () => {
            throw new Error('offline');
          },
          position: async () => {
            throw new Error('offline');
          },
        },
      });
      await h.runtime.start('BV1Ac41187Lm');
      h.player.advanceTo(10);
      callbacksOf(h).onSubmit();

      // 让被拒绝的 promise 有机会冒泡
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(escaped).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('位置上报失败被吞掉，不打扰学生', async () => {
    const h = harness({
      messenger: {
        candidates: async () => [candidate()],
        lesson: async () => ({
          installedAt: 'x',
          nodes: [node('n1', 300)],
          done: [],
          lastPositionSeconds: 0,
        }),
        attempt: async () => {},
        position: async () => {
          throw new Error('offline');
        },
      },
    });
    await h.runtime.start('BV1Ac41187Lm');

    expect(() => h.player.advanceTo(10)).not.toThrow();
  });
});

describe('seek', () => {
  it('往前拖不补弹跳过的节点', async () => {
    const h = harness({}, [
      node('a', 10, 'choice'),
      node('b', 20, 'choice'),
      node('c', 300, 'choice'),
    ]);
    await h.runtime.start('BV1Ac41187Lm');

    h.player.seekTo(100);
    h.player.advanceTo(100);

    expect(h.player.pauseCalls).toBe(0);

    h.player.advanceTo(300);
    expect(h.player.pauseCalls).toBe(1);
    expect((h.runtime.snapshot()!.window as any).node.id).toBe('c');
  });

  it('往回拖不重复打断已触发的节点', async () => {
    const h = harness({}, [node('n1', 30, 'choice')]);
    await h.runtime.start('BV1Ac41187Lm');

    h.player.advanceTo(30);
    callbacksOf(h).onSubmit();
    callbacksOf(h).onClose();
    const pausesBefore = h.player.pauseCalls;

    h.player.seekTo(0);
    h.player.advanceTo(30);

    expect(h.player.pauseCalls).toBe(pausesBefore);
  });
});

describe('刷新恢复', () => {
  it('已作答的节点刷新后不再弹', async () => {
    const h = harness({
      messenger: {
        candidates: async () => [candidate()],
        lesson: async () => ({
          installedAt: 'x',
          nodes: [node('n1', 30, 'choice'), node('n2', 60, 'choice')],
          done: ['n1'], // 上次已答
          lastPositionSeconds: 45,
        }),
        attempt: async () => {},
        position: async () => {},
      },
    });
    await h.runtime.start('BV1Ac41187Lm');

    h.player.advanceTo(30);
    expect(h.player.pauseCalls).toBe(0);

    h.player.advanceTo(60);
    expect((h.runtime.snapshot()!.window as any).node.id).toBe('n2');
  });
});

describe('SPA 切换与播放器重建', () => {
  it('切走后旧监听全部拆掉，窗口销毁', async () => {
    const h = harness();
    await h.runtime.start('BV1Ac41187Lm');
    expect(h.player.listenerCount).toBe(2);

    h.runtime.stop();

    expect(h.player.listenerCount).toBe(0);
    expect(h.destroys).toBe(1);
    expect(h.runtime.snapshot()).toBeNull();
  });

  it('停止后旧播放器事件不再产生渲染', async () => {
    const h = harness();
    await h.runtime.start('BV1Ac41187Lm');
    h.runtime.stop();
    const before = h.renders.length;

    h.player.advanceTo(30);

    expect(h.renders).toHaveLength(before);
  });

  it('start 过程中被 stop，不把监听绑到已废弃的运行时', async () => {
    // SPA 在等播放器期间切走：这是真实存在的竞态
    let release: (p: FakePlayer) => void = () => {};
    const pending = new Promise<FakePlayer>((resolve) => {
      release = resolve;
    });
    const player = new FakePlayer();

    const h = harness({ waitForPlayer: () => pending });
    const starting = h.runtime.start('BV1Ac41187Lm');

    h.runtime.stop();
    release(player);
    await starting;

    expect(player.listenerCount).toBe(0);
    expect(h.runtime.snapshot()).toBeNull();
  });

  it('学生正在选课节时切走，不启动任何课程', async () => {
    let release: (c: RuntimeCandidate | null) => void = () => {};
    const pending = new Promise<RuntimeCandidate | null>((resolve) => {
      release = resolve;
    });

    const h = harness({
      messenger: {
        candidates: async () => [candidate(1), candidate(2)],
        lesson: async () => ({
          installedAt: 'x',
          nodes: [node('n1', 30)],
          done: [],
          lastPositionSeconds: 0,
        }),
        attempt: async () => {},
        position: async () => {},
      },
      chooseCandidate: () => pending,
    });
    const starting = h.runtime.start('BV1Ac41187Lm');

    h.runtime.stop();
    release(candidate(1));
    await starting;

    expect(h.runtime.snapshot()).toBeNull();
  });

  it('学生关掉选择面板则不启动，也不留 UI', async () => {
    const h = harness({
      messenger: {
        candidates: async () => [candidate(1), candidate(2)],
        lesson: async () => ({
          installedAt: 'x',
          nodes: [node('n1', 30)],
          done: [],
          lastPositionSeconds: 0,
        }),
        attempt: async () => {},
        position: async () => {},
      },
      chooseCandidate: async () => null,
    });

    await h.runtime.start('BV1Ac41187Lm');

    expect(h.runtime.snapshot()).toBeNull();
    expect(h.renders).toHaveLength(0);
  });
});

describe('PageController', () => {
  it('切换视频时先停旧的再起新的', async () => {
    const players: FakePlayer[] = [];
    const controller = new PageController(() => {
      const h = harness({
        waitForPlayer: async () => {
          const p = new FakePlayer();
          players.push(p);
          return p;
        },
      });
      return h.runtime;
    });

    await controller.navigate('BV1Ac41187Lm');
    await controller.navigate('BV1Bc41187Lm');

    // 第一个播放器的监听必须已拆干净
    expect(players[0].listenerCount).toBe(0);
    expect(players[1].listenerCount).toBe(2);
  });

  it('离开视频页时停掉运行时', async () => {
    const h = harness();
    const controller = new PageController(() => h.runtime);

    await controller.navigate('BV1Ac41187Lm');
    await controller.navigate(null);

    expect(controller.current()).toBeNull();
    expect(h.player.listenerCount).toBe(0);
  });
});

describe('位置上报', () => {
  it('节流到整秒，同一秒内多次 timeupdate 只报一次', async () => {
    const h = harness({}, [node('n1', 300)]);
    await h.runtime.start('BV1Ac41187Lm');

    h.player.advanceTo(10.1);
    h.player.advanceTo(10.4);
    h.player.advanceTo(10.9);
    h.player.advanceTo(11.2);

    expect(h.positions).toEqual([10, 11]);
  });
});

describe('作答上报', () => {
  it('提交后按节点上报，带上判分结果', async () => {
    const h = harness({}, [node('n1', 10, 'choice')]);
    await h.runtime.start('BV1Ac41187Lm');

    h.player.advanceTo(10);
    callbacksOf(h).onDraft('a');
    callbacksOf(h).onSubmit();

    expect(h.attempts).toHaveLength(1);
    const [courseId, lessonId, nodeId, , answer] = h.attempts[0] as string[];
    expect({ courseId, lessonId, nodeId, answer }).toEqual({
      courseId: 'c1',
      lessonId: 'l1',
      nodeId: 'n1',
      answer: 'a',
    });
  });

  it('跳过也上报，correct 为 null', async () => {
    const h = harness({}, [node('n1', 10, 'choice')]);
    await h.runtime.start('BV1Ac41187Lm');

    h.player.advanceTo(10);
    callbacksOf(h).onSkip();

    expect(h.attempts).toHaveLength(1);
    expect((h.attempts[0] as unknown[])[5]).toBeNull();
  });

  it('关窗要求继续播放', async () => {
    const h = harness();
    await h.runtime.start('BV1Ac41187Lm');

    h.player.advanceTo(30);
    callbacksOf(h).onSubmit();
    callbacksOf(h).onClose();

    expect(h.player.playCalls).toBe(1);
  });
});
