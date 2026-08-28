import { describe, it, expect } from 'vitest';
import {
  buildLibraryView,
  findCandidates,
  removalImpact,
} from './library-view';
import { StorageRoot, InstalledCourse, emptyRoot } from '../storage/types';
import { emptyRichPageDocument, PortableNode } from '../../web/shared/src';

const testNode = (id: string): PortableNode => ({
  id,
  enabled: true,
  family: 'attention',
  interaction: 'notice',
  anchor: { kind: 'time_cross', timeSeconds: 10, captionId: null },
  title: '重点',
  content: { ...emptyRichPageDocument(), blocks: [{ type: 'paragraph', children: [{ text: '提示' }] }] },
  interactionData: null,
  effects: { pause: true },
});

function root(patch: Partial<StorageRoot> = {}): StorageRoot {
  return { ...emptyRoot(), ...patch };
}

const course = (
  id: string,
  opts: {
    lessons?: { id: string; video: string; page?: number; cid?: string | null; nodes: string[] }[];
    installedAt?: string;
    sourceId?: string;
    readOnly?: boolean;
  } = {}
): InstalledCourse => ({
  courseId: id,
  title: `课程 ${id}`,
  assets: [],
  lessons: (opts.lessons ?? [{ id: `${id}-l1`, video: 'BV1Ac41187Lm', nodes: ['n1', 'n2'] }]).map(
    (l) => Object.assign({
      lessonId: l.id,
      title: `课节 ${l.id}`,
      videoId: l.video,
      nodes: l.nodes.map(testNode),
    }, { page: l.page ?? 1, cid: l.cid ?? null })
  ),
  publishedAt: '2026-08-23T00:00:00.000Z',
  installedAt: opts.installedAt ?? '2026-08-23T00:00:00.000Z',
  source: opts.readOnly ? 'example' : 'authorized',
  readOnly: opts.readOnly ?? false,
  sourceId: opts.sourceId ?? `src-${id}`,
});

describe('buildLibraryView', () => {
  it('空库时提示去输授权码', () => {
    const v = buildLibraryView(emptyRoot());
    expect(v.hasCourses).toBe(false);
    expect(v.courses).toEqual([]);
  });

  it('按已作答节点算进度', () => {
    const v = buildLibraryView(
      root({
        installedCourses: { a: course('a') },
        localLearningState: {
          a: { 'a-l1': { done: ['n1'], attempts: {}, lastPositionSeconds: 12, updatedAt: 'x' } },
        },
      })
    );
    expect(v.courses[0]).toMatchObject({ nodeCount: 2, doneCount: 1, percent: 50 });
    expect(v.courses[0].lessons[0].lastPositionSeconds).toBe(12);
    expect(v.courses[0].lessons[0].finished).toBe(false);
  });

  it('全部作答后课节标记完成', () => {
    const v = buildLibraryView(
      root({
        installedCourses: { a: course('a') },
        localLearningState: {
          a: { 'a-l1': { done: ['n1', 'n2'], attempts: {}, lastPositionSeconds: 0, updatedAt: 'x' } },
        },
      })
    );
    expect(v.courses[0].percent).toBe(100);
    expect(v.courses[0].lessons[0].finished).toBe(true);
  });

  it('老师删掉节点后，旧记录不会算出超过总数的进度', () => {
    // done 里有三个 id，但课程包只剩两个节点
    const v = buildLibraryView(
      root({
        installedCourses: { a: course('a') },
        localLearningState: {
          a: {
            'a-l1': {
              done: ['n1', 'n2', 'n-removed'],
              attempts: {},
              lastPositionSeconds: 0,
              updatedAt: 'x',
            },
          },
        },
      })
    );
    expect(v.courses[0].doneCount).toBe(2);
    expect(v.courses[0].percent).toBe(100);
  });

  it('最近安装的排在前面', () => {
    const v = buildLibraryView(
      root({
        installedCourses: {
          old: course('old', { installedAt: '2026-08-01T00:00:00.000Z' }),
          fresh: course('fresh', { installedAt: '2026-08-23T00:00:00.000Z' }),
        },
      })
    );
    expect(v.courses.map((c) => c.courseId)).toEqual(['fresh', 'old']);
  });

  it('带出授权码尾段，没有来源记录时为 null', () => {
    const v = buildLibraryView(
      root({
        installedCourses: { a: course('a', { sourceId: 's1' }), b: course('b', { sourceId: 'gone' }) },
        authorizationSourceCache: {
          sources: [
            { sourceId: 's1', codeHint: 'OKARQ', redeemedAt: 'x', courseIds: ['a'], expiresAt: null },
          ],
        },
      })
    );
    const byId = Object.fromEntries(v.courses.map((c) => [c.courseId, c.codeHint]));
    expect(byId.a).toBe('OKARQ');
    expect(byId.b).toBeNull();
  });

  it('隔离区非空时对外可见', () => {
    const v = buildLibraryView(
      root({ quarantine: { entries: [{ at: 'x', reason: 'r', sample: 's' }] } })
    );
    expect(v.hasQuarantine).toBe(true);
  });

  it('没有进度记录时不报错，进度为 0', () => {
    const v = buildLibraryView(root({ installedCourses: { a: course('a') } }));
    expect(v.courses[0].percent).toBe(0);
  });
});

describe('findCandidates', () => {
  const two = root({
    installedCourses: {
      a: course('a', { lessons: [{ id: 'a-l1', video: 'BV1Ac41187Lm', nodes: ['n1'] }] }),
      b: course('b', { lessons: [{ id: 'b-l1', video: 'BV1Ac41187Lm', nodes: ['n1'] }] }),
    },
  });

  it('BVID 精确匹配', () => {
    expect(findCandidates(two, 'BV1Ac41187Lm')).toHaveLength(2);
    expect(findCandidates(two, 'BV1Zz99999Zz')).toHaveLength(0);
  });

  it('同一视频在多门课程里时返回全部候选，不擅自取第一个', () => {
    const found = findCandidates(two, 'BV1Ac41187Lm');
    expect(found.map((c) => c.courseId).sort()).toEqual(['a', 'b']);
  });

  it('真实授权课程匹配时排除同视频示例课程', () => {
    const found = findCandidates(
      root({
        installedCourses: {
          example: course('example', { readOnly: true }),
          real: course('real'),
        },
      }),
      'BV1Ac41187Lm'
    );
    expect(found.map((c) => c.courseId)).toEqual(['real']);
  });

  it('没有真实课程时仍能运行示例课程', () => {
    const found = findCandidates(
      root({ installedCourses: { example: course('example', { readOnly: true }) } }),
      'BV1Ac41187Lm'
    );
    expect(found.map((c) => c.courseId)).toEqual(['example']);
  });

  it('前缀相同但不等的 BVID 不算命中', () => {
    expect(findCandidates(two, 'BV1Ac41187L')).toHaveLength(0);
  });

  it('同一 BVID 的不同分 P 必须精确区分', () => {
    const split = root({
      installedCourses: {
        first: course('first', {
          lessons: [{ id: 'first-l1', video: 'BV1Ac41187Lm', page: 1, nodes: ['n1'] }],
        }),
        fourth: course('fourth', {
          lessons: [{ id: 'fourth-l1', video: 'BV1Ac41187Lm', page: 4, nodes: ['n1'] }],
        }),
      },
    });

    expect(findCandidates(split, { platform: 'bilibili', videoId: 'BV1Ac41187Lm', page: 4, cid: null })).toMatchObject([
      { courseId: 'fourth' },
    ]);
  });

  it('课程有 CID 时不因页面缺少 CID 而降级到 page 匹配', () => {
    const withCid = root({
      installedCourses: {
        c: course('c', {
          lessons: [{ id: 'c-l1', video: 'BV1Ac41187Lm', page: 4, cid: '987654321', nodes: ['n1'] }],
        }),
      },
    });

    expect(findCandidates(withCid, { platform: 'bilibili', videoId: 'BV1Ac41187Lm', page: 4, cid: null })).toEqual([]);
  });
});

describe('removalImpact', () => {
  it('删除前说明会丢多少作答记录', () => {
    const impact = removalImpact(
      root({
        installedCourses: { a: course('a') },
        localLearningState: {
          a: {
            'a-l1': {
              done: ['n1'],
              attempts: {
                n1: [
                  { at: 't1', answer: 'x', correct: false },
                  { at: 't2', answer: 'y', correct: true },
                ],
              },
              lastPositionSeconds: 0,
              updatedAt: 'x',
            },
          },
        },
      }),
      'a'
    );
    expect(impact).toEqual({ courseTitle: '课程 a', lessonCount: 1, attemptCount: 2 });
  });

  it('课程不存在时返回 null，不编一个空影响出来', () => {
    expect(removalImpact(emptyRoot(), 'missing')).toBeNull();
  });
});
